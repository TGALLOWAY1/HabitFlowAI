/**
 * Goal Detail Page
 * 
 * Displays comprehensive details for a single goal including:
 * - Header with Mantra and Progress Bar
 * - Cumulative Progress Chart (Line Graph)
 * - Weekly Contribution Summary
 * - Linked Habits with Navigation
 * - Manual Progress Logging with habit-first logic
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { useHabitStore } from '../../store/HabitContext';
import { Loader2, ArrowLeft, Check, Edit, Trash2, Trophy, TrendingUp, Route, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DeleteGoalConfirmModal } from '../../components/goals/DeleteGoalConfirmModal';
import { EditGoalModal } from '../../components/goals/EditGoalModal';
import { CreateGoalTrackModal } from '../../components/goals/CreateGoalTrackModal';
import { deleteGoal, markGoalAsCompleted, createGoal, addGoalToTrack, fetchGoalTracks, removeGoalFromTrack } from '../../lib/persistenceClient';
import { GoalStatusChip } from '../../components/goals/GoalSharedComponents';
import { GoalTrendChart } from '../../components/goals/GoalTrendChart';
import type { GoalTrack } from '../../types';

import { GoalCumulativeChart } from '../../components/goals/GoalCumulativeChart';
import { GoalWeeklySummary } from '../../components/goals/GoalWeeklySummary';
import { GoalEntryList } from '../../components/goals/GoalEntryList';
import type { HabitEntry } from '../../models/persistenceTypes';

interface GoalDetailPageProps {
    goalId: string;
    onBack?: () => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onViewWinArchive?: () => void;
    onViewHabit?: (habitId: string) => void;
    onViewGoal?: (goalId: string) => void;
}

type Tab = 'cumulative' | 'dayByDay' | 'trend';

export const GoalDetailPage: React.FC<GoalDetailPageProps> = ({ goalId, onBack, onNavigateToCompleted, onViewHabit, onViewGoal }) => {
    const { data, loading, error, refetch } = useGoalDetail(goalId);
    const { habits, logs } = useHabitStore();
    const [activeTab, setActiveTab] = useState<Tab>('cumulative');
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [showExtendForm, setShowExtendForm] = useState(false);
    const [extendTarget, setExtendTarget] = useState('');
    const [isExtending, setIsExtending] = useState(false);
    const [extendError, setExtendError] = useState<string | null>(null);
    const [showTrackMenu, setShowTrackMenu] = useState(false);
    const [showCreateTrackModal, setShowCreateTrackModal] = useState(false);
    const [availableTracks, setAvailableTracks] = useState<GoalTrack[]>([]);

    // Track previous state to prevent infinite loops (Auto-completion)
    const previousPercentRef = useRef<number | null>(null);
    const isCompletingRef = useRef<boolean>(false);

    // Create habit lookup map
    const habitMap = useMemo(() => {
        const map = new Map<string, typeof habits[0]>();
        habits.forEach(habit => map.set(habit.id, habit));
        return map;
    }, [habits]);

    // Get linked habits
    const linkedHabits = useMemo(() => {
        if (!data) return [];
        return data.goal.linkedHabitIds
            .map(habitId => habitMap.get(habitId))
            .filter((habit): habit is NonNullable<typeof habit> => habit !== undefined);
    }, [data, habitMap]);

    // Derive linked habit entries from HabitContext logs (already pre-fetched)
    // instead of making N separate API calls per linked habit
    const linkedHabitEntries = useMemo(() => {
        if (!data?.goal.linkedHabitIds.length) return [];

        const linkedSet = new Set(data.goal.linkedHabitIds);
        const entries: HabitEntry[] = [];

        for (const [_key, dayLog] of Object.entries(logs)) {
            if (!linkedSet.has(dayLog.habitId)) continue;
            if (!dayLog.completed && !dayLog.value) continue;

            entries.push({
                id: `entry-${dayLog.habitId}-${dayLog.date}`,
                habitId: dayLog.habitId,
                timestamp: dayLog.date,
                dayKey: dayLog.date,
                date: dayLog.date,
                dateKey: dayLog.date,
                value: dayLog.value ?? (dayLog.completed ? 1 : 0),
                source: dayLog.source,
                routineId: dayLog.routineId,
                deletedAt: undefined,
                createdAt: dayLog.date,
                updatedAt: dayLog.date,
            } as HabitEntry);
        }

        return entries;
    }, [data?.goal.linkedHabitIds, logs]);

    // Combine Data for Charts/List
    const combinedEntries = useMemo(() => {
        if (!data) return [];

        const fromHabits = linkedHabitEntries
            .filter(entry => {
                const habit = habitMap.get(entry.habitId);
                if (!habit) return false;

                // Type-Based Aggregation Logic
                if (data.goal.type === 'cumulative') {
                    // Include all habits (boolean habits contribute their target per entry)
                    return true;
                }

                // For other goal types (onetime), accept everything
                return true;
            })
            .map(entry => {
                const habit = habitMap.get(entry.habitId);
                // Use entry.date (YYYY-MM-DD) as the canonical date source.
                // Fallback to timestamp split if needed, but entry.date is required.
                const dateStr = entry.date || entry.timestamp.split('T')[0];

                return {
                    id: entry.id,
                    date: dateStr,
                    // Now that we filtered incompatible units, we can safely use value.
                    // If value is undefined but unit matched (unlikely if strictly checked, but possible for some data shapes),
                    // we might default to 0 or 1.
                    // If goal is cumulative, we expect a number.
                    value: (() => {
                        const h = habitMap.get(entry.habitId);
                        // Boolean habits contribute their target value per entry
                        if (h?.goal.type === 'boolean' && data.goal.type === 'cumulative') {
                            return h.goal.target ?? 1;
                        }
                        return entry.value !== undefined ? entry.value : 0;
                    })(),
                    source: 'habit' as const,
                    habitName: habit?.name,
                    unit: habit?.goal.unit || data.goal.unit
                };
            });

        const combined = fromHabits.filter(item => item.date);
        console.log('[GoalDetail] Final combined entries:', combined);
        return combined.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }, [data, linkedHabitEntries, habitMap]);

    // Calculate Cumulative Data for Chart
    const cumulativeData = useMemo(() => {
        let total = 0;
        // Sort ascending by date safely
        const sorted = [...combinedEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        return sorted.map(entry => {
            total += entry.value;
            return {
                date: entry.date,
                value: total
            };
        });
    }, [combinedEntries]);

    // Inline Milestones Logic
    const milestones = useMemo(() => {
        if (!data?.goal.targetValue) return [];
        return [
            { percent: 25 },
            { percent: 50 },
            { percent: 75 }
        ];
    }, [data]);

    const handleDeleteGoal = async () => {
        try {
            await deleteGoal(goalId);
            if (onBack) onBack();
        } catch (err) {
            console.error('Error deleting goal:', err);
        }
    };

    const handleMarkComplete = async () => {
        setIsMarkingComplete(true);
        try {
            await markGoalAsCompleted(goalId);
            setShowCompleteConfirm(false);
            if (onNavigateToCompleted) onNavigateToCompleted(goalId);
            else refetch();
        } catch (err) {
            console.error('Error marking goal complete:', err);
            setIsMarkingComplete(false);
        }
    };

    const handleExtendGoal = async () => {
        if (!data) return;
        const numTarget = parseFloat(extendTarget);
        if (isNaN(numTarget) || numTarget <= 0) {
            setExtendError('Target must be a positive number');
            return;
        }
        if (numTarget <= (data.goal.targetValue ?? 0)) {
            setExtendError(`New target must be higher than the original (${data.goal.targetValue})`);
            return;
        }

        setIsExtending(true);
        setExtendError(null);

        try {
            const { goal } = data;
            // Clear past deadlines to avoid invalid date intervals in GoalTrendChart
            const deadline = goal.deadline && goal.deadline >= new Date().toISOString().slice(0, 10)
                ? goal.deadline
                : undefined;

            const newGoal = await createGoal({
                title: goal.title,
                type: goal.type,
                targetValue: numTarget,
                unit: goal.unit,
                linkedHabitIds: goal.linkedHabitIds,
                linkedTargets: goal.linkedTargets,
                aggregationMode: goal.aggregationMode,
                countMode: goal.countMode,
                deadline,
                categoryId: goal.categoryId,
                notes: goal.notes,
            });

            // Navigate to the new active goal
            if (onViewGoal) {
                onViewGoal(newGoal.id);
            } else if (onBack) {
                onBack();
            }
        } catch (err) {
            console.error('Error extending goal:', err);
            setExtendError(err instanceof Error ? err.message : 'Failed to extend goal');
            setIsExtending(false);
        }
    };

    // Auto-completion Effect
    useEffect(() => {
        if (!data || loading || isCompletingRef.current) return;
        const { goal, progress } = data;
        if (goal.type === 'onetime' || !goal.targetValue) return;

        const currentPercent = progress.percent;
        const currentCompletedAt = goal.completedAt;

        if (currentPercent >= 100 && !currentCompletedAt && !isCompletingRef.current) {
            if ((previousPercentRef.current === null || previousPercentRef.current < 100)) {
                isCompletingRef.current = true;
                markGoalAsCompleted(goalId).then(() => {
                    refetch();
                    if (onNavigateToCompleted) onNavigateToCompleted(goalId);
                }).catch(err => {
                    console.error(err);
                    isCompletingRef.current = false;
                });
            }
        }
        previousPercentRef.current = currentPercent;
    }, [data, loading, goalId, refetch, onNavigateToCompleted]);


    if (loading || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="text-emerald-500 animate-spin mb-4" size={32} />
                <div className="text-content-secondary">Loading goal details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="text-red-400 mb-2">Error loading goal</div>
                <button onClick={() => refetch()} className="text-content-primary underline">Retry</button>
            </div>
        );
    }

    const { goal, progress } = data;
    const progressPercent = goal.completedAt ? 100 : progress.percent;

    // Determine if Trend tab should be shown
    const canShowTrend = goal.type === 'cumulative' && goal.deadline;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8 bg-[#0A0A0A] min-h-screen text-content-primary">
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
                {onBack && (
                    <button onClick={onBack} className="flex items-center gap-2 text-content-secondary hover:text-content-primary transition-colors">
                        <ArrowLeft size={18} />
                        <span>Back</span>
                    </button>
                )}
                <div className="flex items-center gap-2">
                    {/* Track action — only for standalone, non-completed goals */}
                    {!goal.trackId && !goal.completedAt && (
                        <div className="relative">
                            <button
                                onClick={async () => {
                                    if (showTrackMenu) {
                                        setShowTrackMenu(false);
                                        return;
                                    }
                                    try {
                                        const tracks = await fetchGoalTracks();
                                        setAvailableTracks(tracks.filter(t => t.categoryId === goal.categoryId && !t.completedAt));
                                    } catch { /* ignore */ }
                                    setShowTrackMenu(true);
                                }}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-secondary hover:text-accent-contrast hover:bg-accent-strong/10 rounded-lg transition-colors"
                                aria-label="Add to track"
                                title="Add to track"
                            >
                                <Route size={18} />
                            </button>
                            {showTrackMenu && (
                                <div className="absolute right-0 top-full mt-1 w-56 bg-surface-1 border border-line-subtle rounded-lg shadow-xl z-50 py-1">
                                    <button
                                        onClick={() => {
                                            setShowTrackMenu(false);
                                            setShowCreateTrackModal(true);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm text-accent-contrast hover:bg-surface-2/50 flex items-center gap-2"
                                    >
                                        <Plus size={14} />
                                        Create new track
                                    </button>
                                    {availableTracks.length > 0 && (
                                        <>
                                            <div className="border-t border-line-subtle my-1" />
                                            <div className="px-3 py-1 text-[10px] text-content-muted uppercase tracking-wider">Add to existing track</div>
                                            {availableTracks.map(track => (
                                                <button
                                                    key={track.id}
                                                    onClick={async () => {
                                                        setShowTrackMenu(false);
                                                        try {
                                                            await addGoalToTrack(track.id, goal.id);
                                                            refetch();
                                                        } catch (err) {
                                                            console.error('Failed to add goal to track:', err);
                                                        }
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm text-content-secondary hover:bg-surface-2/50"
                                                >
                                                    {track.name}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Remove from track — only for tracked goals */}
                    {goal.trackId && !goal.completedAt && (
                        <button
                            onClick={async () => {
                                try {
                                    await removeGoalFromTrack(goal.trackId!, goal.id);
                                    refetch();
                                } catch (err) {
                                    console.error('Failed to remove from track:', err);
                                }
                            }}
                            className="min-h-[44px] flex items-center gap-1.5 px-3 text-xs text-content-muted hover:text-content-secondary hover:bg-surface-2 rounded-lg transition-colors"
                            title="Remove from track"
                        >
                            <Route size={14} />
                            <span>Remove from track</span>
                        </button>
                    )}
                    <button onClick={() => setShowEditModal(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-secondary hover:text-content-primary hover:bg-surface-2 rounded-lg transition-colors" aria-label="Edit goal">
                        <Edit size={18} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-secondary hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" aria-label="Delete goal">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Header Section */}
            <div className="mb-10">
                <div className="flex flex-col gap-4">
                    {/* Title & Badge */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-content-primary tracking-tight">{goal.title}</h1>
                                <GoalStatusChip status={goal.completedAt ? 'completed' : 'active'}>
                                    {goal.completedAt ? 'Completed' : 'Active'}
                                </GoalStatusChip>
                            </div>
                            {/* Mantra / Notes (Read Only) */}
                            {goal.notes && (
                                <p className="text-content-secondary text-sm leading-relaxed max-w-2xl">
                                    “{goal.notes}”
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Track context info */}
                    {goal.trackId && goal.activeWindowStart && (
                        <div className="mt-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                            <p className="text-xs text-accent-contrast/80">
                                {goal.trackStatus === 'active'
                                    ? `Progress tracked since ${format(parseISO(goal.activeWindowStart), 'MMM d, yyyy')}. Only habit entries from this date onward count toward this goal.`
                                    : goal.trackStatus === 'completed' && goal.activeWindowEnd
                                    ? `Progress tracked from ${format(parseISO(goal.activeWindowStart), 'MMM d, yyyy')} to ${format(parseISO(goal.activeWindowEnd), 'MMM d, yyyy')}.`
                                    : goal.trackStatus === 'locked'
                                    ? 'This goal is locked. It will become active when earlier goals in the track are completed.'
                                    : ''}
                            </p>
                        </div>
                    )}

                    {/* Progress Bar with Inline Milestones */}
                    <div className="relative pt-6 pb-2">
                        <div className="h-4 bg-surface-1 rounded-full overflow-hidden relative">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                            {/* Milestones Markers */}
                            {milestones.map(m => (
                                <div
                                    key={m.percent}
                                    className="absolute top-0 bottom-0 w-px bg-white/20 z-10"
                                    style={{ left: `${m.percent}%` }}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-medium text-content-muted">
                            <span>Start</span>
                            {goal.targetValue && (
                                <span>{goal.targetValue} {goal.unit}</span>
                            )}
                        </div>

                        {/* Current Value Display */}
                        <div className="mt-2 text-2xl font-semibold text-content-primary">
                            {goal.type === 'cumulative'
                                ? <span>{progress.currentValue} <span className="text-content-muted text-lg font-normal">/ {goal.targetValue} {goal.unit}</span></span>
                                : <span>{progressPercent}% Complete</span>
                            }
                        </div>
                    </div>

                    {/* Target Date */}
                    {goal.deadline && (
                        <div className="flex items-center gap-2 text-content-muted text-sm">
                            <span className=" px-2 py-0.5 bg-surface-0 rounded border border-line-subtle">
                                Target: {format(parseISO(goal.deadline), 'MMM d, yyyy')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mark Complete Button (for active goals) */}
            {!goal.completedAt && (
                <div className="mb-8">
                    {!showCompleteConfirm ? (
                        <button
                            onClick={() => setShowCompleteConfirm(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-accent-soft border border-accent/30 text-accent-contrast rounded-lg hover:bg-accent-strong/20 transition-colors font-medium text-sm"
                        >
                            <Trophy size={16} />
                            Mark as Complete
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 p-4 bg-accent-soft border border-accent/30 rounded-lg">
                            <span className="text-sm text-accent-contrast">Mark this goal as achieved?</span>
                            <button
                                onClick={handleMarkComplete}
                                disabled={isMarkingComplete}
                                className="px-4 py-1.5 bg-emerald-500 text-neutral-900 font-medium text-sm rounded-lg hover:bg-accent-strong transition-colors disabled:opacity-50"
                            >
                                {isMarkingComplete ? 'Completing...' : 'Yes, I did it!'}
                            </button>
                            <button
                                onClick={() => setShowCompleteConfirm(false)}
                                className="px-3 py-1.5 text-content-secondary hover:text-content-primary text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Extend Goal (for completed goals) */}
            {goal.completedAt && goal.type !== 'onetime' && (
                <div className="mb-8">
                    {!showExtendForm ? (
                        <div>
                            <button
                                onClick={() => {
                                    setExtendTarget(((goal.targetValue ?? 0) * 2).toString());
                                    setExtendError(null);
                                    setShowExtendForm(true);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors font-medium text-sm"
                            >
                                <TrendingUp size={16} />
                                Extend Goal
                            </button>
                            <p className="text-content-muted text-xs mt-2">
                                Create a new goal with a higher target. This goal stays in your Win Archive.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
                            <div className="text-sm text-blue-300 font-medium">Set your new target</div>
                            <div className="text-xs text-content-muted">
                                Original target: {goal.targetValue} {goal.unit} (completed). Your progress carries over to the new goal.
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    value={extendTarget}
                                    onChange={(e) => setExtendTarget(e.target.value)}
                                    min={(goal.targetValue ?? 0) + 1}
                                    className="w-32 bg-surface-1 border border-line-subtle rounded-lg px-3 py-2 text-content-primary text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="New target"
                                    autoFocus
                                />
                                {goal.unit && <span className="text-content-secondary text-sm">{goal.unit}</span>}
                            </div>
                            {extendError && (
                                <div className="text-red-400 text-xs">{extendError}</div>
                            )}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleExtendGoal}
                                    disabled={isExtending}
                                    className="px-4 py-1.5 bg-blue-500 text-content-primary font-medium text-sm rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50"
                                >
                                    {isExtending ? 'Creating...' : 'Create Extended Goal'}
                                </button>
                                <button
                                    onClick={() => setShowExtendForm(false)}
                                    disabled={isExtending}
                                    className="px-3 py-1.5 text-content-secondary hover:text-content-primary text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-line-subtle mb-8">
                <button
                    onClick={() => setActiveTab('cumulative')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'cumulative'
                        ? 'border-emerald-500 text-accent-contrast'
                        : 'border-transparent text-content-secondary hover:text-content-primary'
                        }`}
                >
                    Cumulative
                </button>
                {canShowTrend && (
                    <button
                        onClick={() => setActiveTab('trend')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'trend'
                            ? 'border-emerald-500 text-accent-contrast'
                            : 'border-transparent text-content-secondary hover:text-content-primary'
                            }`}
                    >
                        Trend
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('dayByDay')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dayByDay'
                        ? 'border-emerald-500 text-accent-contrast'
                        : 'border-transparent text-content-secondary hover:text-content-primary'
                        }`}
                >
                    Day by Day
                </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-8 animate-in fade-in duration-300">
                {activeTab === 'cumulative' && (
                    <div className="space-y-8 h-full">
                        {/* Cumulative Chart */}
                        <div>
                            <h3 className="text-content-secondary text-sm font-medium mb-4 uppercase tracking-wider">Total Progress</h3>
                            <GoalCumulativeChart
                                data={cumulativeData}
                                color="#10b981"
                                unit={goal.unit}
                                targetValue={goal.targetValue}
                            />
                        </div>

                        {/* Weekly Summary */}
                        <GoalWeeklySummary entries={combinedEntries} unit={goal.unit} />
                    </div>
                )}

                {activeTab === 'trend' && canShowTrend && (
                    <div className="space-y-8 h-full">
                        <div>
                            <h3 className="text-content-secondary text-sm font-medium mb-4 uppercase tracking-wider">Progress Trend</h3>
                            <p className="text-content-muted text-sm mb-4">
                                Solid line is your actual progress. Dashed line is the pace needed to reach your target by the deadline.
                            </p>
                            <GoalTrendChart
                                data={cumulativeData}
                                startDate={goal.createdAt}
                                firstEntryDate={cumulativeData[0]?.date}
                                deadline={goal.deadline!}
                                targetValue={goal.targetValue!}
                                color="#10b981"
                                unit={goal.unit}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'dayByDay' && (
                    <div>
                        <GoalEntryList entries={combinedEntries} />
                    </div>
                )}
            </div>


            {/* Linked Habits Section */}
            <div className="mt-12 pt-8 border-t border-line-subtle">
                <div className="mb-6">
                    <p className="text-accent-contrast font-medium mb-1">Habits are how goals are achieved.</p>
                    <p className="text-content-muted text-sm">Consistent daily action drives your progress.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {linkedHabits.length > 0 ? linkedHabits.map(habit => (
                        <button
                            key={habit.id}
                            onClick={() => {
                                if (onViewHabit) onViewHabit(habit.id);
                            }}
                            className="flex items-center gap-4 p-4 bg-surface-0/50 border border-line-subtle rounded-xl hover:bg-surface-1 hover:border-line-subtle transition-all text-left group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center text-emerald-500 group-hover:bg-accent-strong/20 transition-colors">
                                {habit.goal.type === 'boolean' ? <Check size={20} /> : <span className="font-bold text-xs">{habit.goal.unit}</span>}
                            </div>
                            <div>
                                <div className="font-medium text-content-primary group-hover:text-accent-contrast transition-colors">{habit.name}</div>
                                <div className="text-xs text-content-muted mt-0.5">
                                    {habit.goal.type === 'number' ? `Daily Target: ${habit.goal.target} ${habit.goal.unit}` : 'Daily Completion'}
                                </div>
                            </div>
                        </button>
                    )) : (
                        <div className="col-span-full p-6 border border-dashed border-line-subtle rounded-xl text-center">
                            <p className="text-content-muted text-sm mb-3">No habits linked to this goal yet.</p>
                            <button
                                onClick={() => setShowEditModal(true)} // Edit modal allows linking/creating habits
                                className="text-accent-contrast text-sm font-medium hover:underline"
                            >
                                Link a habit
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Manual contribution area removed in V1: progress is derived from habit entries */}

            {/* Modals */}
            {data && (
                <EditGoalModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    goalWithProgress={data}
                    onSuccess={refetch}
                />
            )}

            {data && (
                <DeleteGoalConfirmModal
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    onConfirm={handleDeleteGoal}
                    goalTitle={data.goal.title}
                />
            )}

            {/* Create Track Modal (from goal detail) */}
            <CreateGoalTrackModal
                isOpen={showCreateTrackModal}
                onClose={() => setShowCreateTrackModal(false)}
                defaultCategoryId={data.goal.categoryId}
                onSuccess={async (trackId) => {
                    // Add this goal to the newly created track
                    try {
                        await addGoalToTrack(trackId, data.goal.id);
                        refetch();
                    } catch (err) {
                        console.error('Failed to add goal to new track:', err);
                    }
                }}
            />
        </div>
    );
};
