import React, { useState, useCallback, useEffect } from 'react';
import { useProgressOverview } from '../lib/useProgressOverview';
import { DailyCheckInModal } from './DailyCheckInModal';
import { Loader2, Pin } from 'lucide-react';
import { GoalPulseCard } from './goals/GoalPulseCard';
import { ActivitySection } from './ActivitySection';
import { DailyOverviewCard } from './dashboard/DailyOverviewCard';
import { DailyCheckInCard } from './dashboard/DailyCheckInCard';
import { JournalCard } from './dashboard/JournalCard';
import { TasksCard } from './dashboard/TasksCard';
import { PinnedRoutinesCard } from './dashboard/PinnedRoutinesCard';
import { WeeklySummaryCard } from './dashboard/WeeklySummaryCard';
import { SetupDashboard } from './dashboard/SetupDashboard';
import { useSetupProgress } from '../hooks/useSetupProgress';
import type { Routine } from '../models/persistenceTypes';

const PINNED_GOALS_KEY = 'hf_pinned_dashboard_goals';
const SETUP_GUIDE_DISMISSED_KEY = 'hf_setup_guide_dismissed';

function usePinnedGoals() {
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(PINNED_GOALS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const togglePin = useCallback((id: string) => {
        setPinnedIds(prev => {
            const next = prev.includes(id)
                ? prev.filter(x => x !== id)
                : [...prev, id];
            localStorage.setItem(PINNED_GOALS_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

    return { pinnedIds, togglePin, isPinned };
}

interface ProgressDashboardProps {
    onCreateGoal?: () => void;
    onViewGoal?: (goalId: string) => void;
    onSelectCategory?: (categoryId: string) => void;
    onNavigateWellbeingHistory?: () => void;
    onStartRoutine?: (routine: Routine) => void;
    onPreviewRoutine?: (routine: Routine) => void;
    onNavigateToJournal?: () => void;
    onNavigateToRoutines?: () => void;
    onNavigateToTasks?: () => void;
    onNavigate?: (route: string, params?: Record<string, string>) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
    onCreateGoal,
    onViewGoal,
    onSelectCategory,
    onStartRoutine,
    onPreviewRoutine,
    onNavigateToJournal,
    onNavigateToRoutines,
    onNavigateToTasks,
    onNavigate,
}) => {
    const { data: progressData, loading: progressLoading } = useProgressOverview();
    const goalsCount = progressData?.goalsWithProgress?.length ?? 0;
    const { setupPhase, hasHabits, hasTasks, loading: setupLoading } = useSetupProgress(goalsCount);
    const hasJournalEntries = false; // Will be derived from journal data when available

    const [guideDismissed, setGuideDismissed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(SETUP_GUIDE_DISMISSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    const dismissGuide = useCallback(() => {
        setGuideDismissed(true);
        setGuideForceOpen(false);
        try { localStorage.setItem(SETUP_GUIDE_DISMISSED_KEY, 'true'); } catch { /* noop */ }
    }, []);

    const [guideForceOpen, setGuideForceOpen] = useState(false);

    // Listen for settings "reopen guide" event
    useEffect(() => {
        const handleReopen = () => {
            setGuideDismissed(false);
            setGuideForceOpen(true);
            try { localStorage.removeItem(SETUP_GUIDE_DISMISSED_KEY); } catch { /* noop */ }
        };
        window.addEventListener('habitflow:reopen-setup-guide', handleReopen);
        return () => window.removeEventListener('habitflow:reopen-setup-guide', handleReopen);
    }, []);

    const [isCheckInOpen, setIsCheckInOpen] = useState(false);
    const { pinnedIds: pinnedGoalIds, togglePin: toggleGoalPin, isPinned: isGoalPinned } = usePinnedGoals();
    const [showGoalManage, setShowGoalManage] = useState(false);

    const showGuide = !guideDismissed && (setupPhase !== 'mature' || guideForceOpen) && onNavigate && !setupLoading && !progressLoading;

    // Zero-state: show ONLY the setup guide (no dashboard content yet)
    if (setupPhase === 'zero' && showGuide) {
        return (
            <SetupDashboard
                hasHabits={hasHabits}
                hasTasks={hasTasks}
                hasJournalEntries={hasJournalEntries}
                goalsCount={goalsCount}
                onNavigate={onNavigate}
                onDismiss={dismissGuide}
                forceOpen={guideForceOpen}
            />
        );
    }

    return (
        <div className="space-y-4 overflow-y-auto pb-20">
            {/* Setup guide — shown during early phase or when force-reopened from settings */}
            {showGuide && (setupPhase === 'early' || guideForceOpen) && onNavigate && (
                <SetupDashboard
                    hasHabits={hasHabits}
                    hasTasks={hasTasks}
                    hasJournalEntries={hasJournalEntries}
                    goalsCount={goalsCount}
                    onNavigate={onNavigate}
                    onDismiss={dismissGuide}
                    forceOpen={guideForceOpen}
                />
            )}

            {/* Daily Overview + Check-In — always side by side */}
            <div className="grid grid-cols-2 gap-4">
                <DailyOverviewCard />
                <DailyCheckInCard onOpenCheckIn={() => setIsCheckInOpen(true)} />
            </div>

            {/* Journal + Tasks — side by side */}
            <div className="grid grid-cols-2 gap-4">
                {onNavigateToJournal && (
                    <JournalCard onNavigateToJournal={onNavigateToJournal} />
                )}
                {onNavigateToTasks && (
                    <TasksCard onNavigateToTasks={onNavigateToTasks} />
                )}
            </div>

            {/* Pinned Routines */}
            {onStartRoutine && (
                <PinnedRoutinesCard
                    onStartRoutine={onStartRoutine}
                    onPreviewRoutine={onPreviewRoutine}
                    onViewAllRoutines={onNavigateToRoutines}
                />
            )}

            {/* AI Weekly Summary */}
            <WeeklySummaryCard />

            {/* Goals at a glance */}
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Goals at a glance</h3>
                    <div className="flex items-center gap-2">
                        {progressData && progressData.goalsWithProgress.length > 0 && (
                            <button
                                onClick={() => setShowGoalManage(s => !s)}
                                className={`text-[11px] transition-colors ${showGoalManage ? 'text-white' : 'text-emerald-400 hover:text-emerald-300'}`}
                            >
                                {showGoalManage ? 'Done' : 'Manage'}
                            </button>
                        )}
                        <button
                            onClick={() => onViewGoal && onViewGoal('all')}
                            className="text-xs text-neutral-500 hover:text-white transition-colors"
                        >
                            View all
                        </button>
                    </div>
                </div>

                {progressLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="text-emerald-500 animate-spin" size={20} />
                    </div>
                ) : !progressData || progressData.goalsWithProgress.length === 0 ? (
                    <div className="text-center py-6">
                        <h4 className="text-neutral-400 text-sm mb-2">No active goals</h4>
                        {onCreateGoal && (
                            <button
                                onClick={onCreateGoal}
                                className="text-emerald-500 hover:text-emerald-400 text-xs font-medium transition-colors"
                            >
                                + Add a goal
                            </button>
                        )}
                    </div>
                ) : showGoalManage ? (
                    <div className="space-y-1">
                        {progressData.goalsWithProgress
                            .filter(({ goal }) => !goal.completedAt)
                            .map(({ goal }) => (
                                <button
                                    key={goal.id}
                                    onClick={() => toggleGoalPin(goal.id)}
                                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors text-left min-h-[44px]"
                                >
                                    <Pin
                                        size={14}
                                        className={isGoalPinned(goal.id) ? 'text-emerald-400' : 'text-neutral-600'}
                                        fill={isGoalPinned(goal.id) ? 'currentColor' : 'none'}
                                    />
                                    <span className={`text-sm ${isGoalPinned(goal.id) ? 'text-white' : 'text-neutral-400'}`}>
                                        {goal.title}
                                    </span>
                                </button>
                            ))}
                        <p className="text-[10px] text-neutral-600 px-3 pt-2">
                            {pinnedGoalIds.length === 0
                                ? 'Pin goals to choose which ones appear here. Showing first 4 by default.'
                                : `${pinnedGoalIds.length} goal${pinnedGoalIds.length !== 1 ? 's' : ''} pinned`}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {(() => {
                            const activeGoals = progressData.goalsWithProgress.filter(({ goal }) => !goal.completedAt);
                            // If user has pinned goals, show only those; otherwise show first 4
                            const displayGoals = pinnedGoalIds.length > 0
                                ? activeGoals.filter(({ goal }) => pinnedGoalIds.includes(goal.id)).slice(0, 4)
                                : activeGoals.slice(0, 4);
                            return displayGoals.map((goalWithProgress) => (
                                <GoalPulseCard
                                    key={goalWithProgress.goal.id}
                                    goalWithProgress={goalWithProgress}
                                    onClick={() => {
                                        if (onViewGoal) {
                                            onViewGoal(goalWithProgress.goal.id);
                                        }
                                    }}
                                />
                            ));
                        })()}
                    </div>
                )}
            </div>

            {/* Activity Heatmap */}
            <ActivitySection onSelectCategory={onSelectCategory} />

            <DailyCheckInModal
                isOpen={isCheckInOpen}
                onClose={() => setIsCheckInOpen(false)}
            />
        </div>
    );
};
