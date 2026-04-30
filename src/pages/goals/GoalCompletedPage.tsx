import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Sparkles, TrendingUp, RotateCcw } from 'lucide-react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { CelebratoryBadgeIcon } from '../../components/goals/CelebratoryBadgeIcon';
import { getCachedGoalsWithProgress, getCachedCompletedGoals } from '../../lib/goalDataCache';
import type { Goal } from '../../types';

/**
 * Try to find goal metadata from already-cached data (goals-with-progress or completed-goals).
 * Avoids a full detail fetch when the goal is already in memory.
 */
function findGoalInCache(goalId: string): Goal | null {
    const goalsWithProgress = getCachedGoalsWithProgress();
    if (goalsWithProgress) {
        const match = goalsWithProgress.find(g => g.goal.id === goalId);
        if (match) return match.goal;
    }
    const completedGoals = getCachedCompletedGoals();
    if (completedGoals) {
        const match = completedGoals.find(g => g.id === goalId);
        if (match) return match;
    }
    return null;
}

interface GoalCompletedPageProps {
    goalId: string;
    onBack?: () => void;
    onViewGoalDetail?: (goalId: string) => void;
    onViewWinArchive?: () => void;
    onLevelUp?: (goalId: string) => void;
    onRepeat?: (goalId: string) => void;
}

/**
 * Celebration page shown when a goal is completed.
 * Displays confetti animation and goal completion details.
 * This is the first screen users see when they finish a goal.
 *
 * Performance: checks goal caches first to avoid a full detail fetch
 * when goal metadata is already in memory (M17 audit fix).
 */
export const GoalCompletedPage: React.FC<GoalCompletedPageProps> = ({
    goalId,
    onBack,
    onViewGoalDetail,
    onViewWinArchive,
    onLevelUp,
    onRepeat,
}) => {
    // Check caches first — only fetch detail as fallback
    const cachedGoal = useMemo(() => findGoalInCache(goalId), [goalId]);
    const { data, loading } = useGoalDetail(cachedGoal ? '' : goalId);
    const goal = cachedGoal ?? data?.goal;
    const [showConfetti, setShowConfetti] = useState(true);

    // Hide confetti after animation completes
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowConfetti(false);
        }, 3000); // Hide after 3 seconds
        return () => clearTimeout(timer);
    }, []);

    // Calculate time span (must be before early returns to satisfy Rules of Hooks)
    const timeSpan = useMemo(() => {
        if (!goal?.createdAt || !goal?.completedAt) return null;
        try {
            const startDate = parseISO(goal.createdAt);
            const endDate = parseISO(goal.completedAt);
            const days = differenceInDays(endDate, startDate);
            return days;
        } catch {
            return null;
        }
    }, [goal?.createdAt, goal?.completedAt]);

    if (!cachedGoal && loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col items-center gap-4 py-12">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm">Loading...</div>
                </div>
            </div>
        );
    }

    if (!goal) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="text-center py-12 text-neutral-500">
                    <p>Goal not found</p>
                </div>
            </div>
        );
    }

    // Format dates for display
    const createdDateFormatted = goal.createdAt
        ? format(parseISO(goal.createdAt), 'MMM d, yyyy')
        : '';
    const completedDateFormatted = goal.completedAt
        ? format(parseISO(goal.completedAt), 'MMM d, yyyy')
        : '';

    // Get habit count
    const habitCount = goal.linkedHabitIds.length;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative overflow-hidden">
            {/* Confetti Animation */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50">
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute confetti-particle"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: '-10px',
                                width: `${Math.random() * 10 + 5}px`,
                                height: `${Math.random() * 10 + 5}px`,
                                backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#a855f7'][
                                    Math.floor(Math.random() * 5)
                                ],
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${Math.random() * 2 + 2}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Main Content */}
            <div className="text-center py-12 sm:py-16">
                {/* Celebratory Badge Icon */}
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div className="w-32 h-32 animate-bounce" style={{ filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.4))' }}>
                            <CelebratoryBadgeIcon goalId={goalId} badgeImageUrl={goal.badgeImageUrl} size={64} />
                        </div>
                        <Sparkles
                            className="absolute -top-4 -right-4 text-emerald-400 animate-pulse"
                            size={40}
                        />
                        <Sparkles
                            className="absolute -bottom-4 -left-4 text-blue-400 animate-pulse"
                            size={40}
                            style={{ animationDelay: '0.5s' }}
                        />
                    </div>
                </div>

                {/* Celebration Message */}
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 animate-fade-in">
                    You completed your goal!
                </h1>
                <h2 className="text-2xl sm:text-3xl font-semibold text-emerald-400 mb-8">
                    {goal.title}
                </h2>

                {/* Summary Stats */}
                <div className="max-w-lg mx-auto mb-10 space-y-4">
                    {/* Target Value and Unit - Hide for OneTime */}
                    {goal.type !== 'onetime' && goal.targetValue && (
                        <div className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Target</div>
                            <div className="text-2xl font-bold text-white">
                                {goal.targetValue}
                                {goal.unit && <span className="text-emerald-400"> {goal.unit}</span>}
                            </div>
                        </div>
                    )}

                    {/* Time Span */}
                    {timeSpan !== null && createdDateFormatted && completedDateFormatted && (
                        <div className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Time Span</div>
                            <div className="text-lg font-semibold text-white">
                                {timeSpan === 0 ? 'Same day' : `${timeSpan} ${timeSpan === 1 ? 'day' : 'days'}`}
                            </div>
                            <div className="text-neutral-400 text-xs mt-1">
                                {createdDateFormatted} → {completedDateFormatted}
                            </div>
                        </div>
                    )}

                    {/* Habit Count */}
                    <div className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Habits Involved</div>
                        <div className="text-2xl font-bold text-white">
                            {habitCount} {habitCount === 1 ? 'habit' : 'habits'}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                    {/* Primary CTA: View Win Archive */}
                    <button
                        onClick={() => onViewWinArchive?.()}
                        className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold rounded-lg transition-colors text-lg"
                    >
                        <Trophy size={20} />
                        View Win Archive
                    </button>

                    {/* Secondary CTA: Continue */}
                    <button
                        onClick={() => {
                            if (onViewGoalDetail) {
                                onViewGoalDetail(goalId);
                            } else if (onBack) {
                                onBack();
                            }
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Continue
                    </button>
                </div>

                {/* What's Next? Decision Flow */}
                {goal.type !== 'onetime' && (
                    <div className="max-w-lg mx-auto mt-12 pt-8 border-t border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-2">What feels right next?</h3>
                        <p className="text-neutral-400 text-sm mb-6">
                            Choose how you want to continue.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => onLevelUp?.(goalId)}
                                className="p-4 bg-neutral-800/50 border border-white/10 rounded-xl hover:bg-neutral-800 hover:border-emerald-500/30 transition-all text-left"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <TrendingUp size={16} className="text-emerald-400" />
                                    <span className="text-emerald-400 font-medium">Level Up</span>
                                </div>
                                <div className="text-neutral-500 text-xs">
                                    Raise the target and keep pushing
                                </div>
                            </button>
                            <button
                                onClick={() => onRepeat?.(goalId)}
                                className="p-4 bg-neutral-800/50 border border-white/10 rounded-xl hover:bg-neutral-800 hover:border-blue-500/30 transition-all text-left"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <RotateCcw size={16} className="text-blue-400" />
                                    <span className="text-blue-400 font-medium">Repeat</span>
                                </div>
                                <div className="text-neutral-500 text-xs">
                                    Same target, fresh start
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Confetti CSS Animation */}
            <style>{`
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100dvh) rotate(720deg);
                        opacity: 0;
                    }
                }

                .confetti-particle {
                    animation: confetti-fall linear forwards;
                    border-radius: 2px;
                }

                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.6s ease-out;
                }
            `}</style>
        </div>
    );
};
