/**
 * Goal Detail Page
 * 
 * Displays comprehensive details for a single goal including:
 * - Progress tracking and visualization
 * - Linked habits
 * - Milestones
 * - Recent progress history
 * - Manual progress logging (cumulative goals only)
 * 
 * Completed Goals Display Policy:
 * - Completed goals are shown with a "Completed" status chip
 * - Manual progress UI is hidden for completed goals
 * - Manual progress UI is hidden for frequency goals (only cumulative goals support manual logging)
 * - Completed goals can be viewed in the Win Archive
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { useHabitStore } from '../../store/HabitContext';
import { Loader2, AlertCircle, ArrowLeft, Check, Plus, Edit, Trash2, Trophy, Award } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { GoalManualProgressModal } from '../../components/goals/GoalManualProgressModal';
import { DeleteGoalConfirmModal } from '../../components/goals/DeleteGoalConfirmModal';
import { deleteGoal, markGoalAsCompleted } from '../../lib/persistenceClient';
import { invalidateGoalCaches, invalidateAllGoalCaches } from '../../lib/goalDataCache';
import { GoalProgressBar, GoalStatusChip } from '../../components/goals/GoalSharedComponents';

interface GoalDetailPageProps {
    goalId: string;
    onBack?: () => void;
    onNavigateToCompleted?: (goalId: string) => void;
    onViewWinArchive?: () => void;
}

export const GoalDetailPage: React.FC<GoalDetailPageProps> = ({ goalId, onBack, onNavigateToCompleted, onViewWinArchive }) => {
    const { data, loading, error, refetch } = useGoalDetail(goalId);
    const { habits } = useHabitStore();
    const [showManualProgressModal, setShowManualProgressModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Track previous state to prevent infinite loops
    const previousPercentRef = useRef<number | null>(null);
    const previousCompletedAtRef = useRef<string | null | undefined>(null);
    const isCompletingRef = useRef<boolean>(false);

    // Create habit lookup map for efficient access
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

    // Format deadline for display
    const formatDeadline = (deadline: string): string => {
        try {
            const date = parseISO(deadline);
            return format(date, 'MMM d, yyyy');
        } catch {
            return deadline;
        }
    };

    // Handle delete goal
    const handleDeleteGoal = async () => {
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await deleteGoal(goalId);
            // Invalidate all goal caches since goal was deleted
            invalidateAllGoalCaches();
            // Navigate back to goals list on success
            if (onBack) {
                onBack();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete goal';
            setDeleteError(errorMessage);
            console.error('Error deleting goal:', err);
            throw err; // Re-throw so modal can handle it
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle edit goal (placeholder for future implementation)
    const handleEditGoal = () => {
        // TODO: Navigate to goal edit page when implemented
        console.log('Edit goal:', goalId);
        // For now, just show a message
        alert('Goal editing is not yet implemented. This will navigate to /goals/:id/edit in the future.');
    };

    // Detect when goal reaches 100% and automatically mark as completed
    // This handles both habit log updates and manual progress logs that push progress over 100%
    useEffect(() => {
        if (!data || loading || isCompletingRef.current) return;

        const { goal, progress } = data;
        const currentPercent = progress.percent;
        const currentCompletedAt = goal.completedAt;
        const previousPercent = previousPercentRef.current;
        const previousCompletedAt = previousCompletedAtRef.current;

        // Check if goal should be completed:
        // 1. Progress is >= 100%
        // 2. Goal is not already completed (completedAt is null/undefined)
        // 3. We haven't already triggered completion (prevent infinite loop)
        // 4. Progress actually changed (prevent duplicate triggers)
        const shouldComplete = 
            currentPercent >= 100 && 
            !currentCompletedAt && 
            (previousPercent === null || previousPercent < 100) &&
            (previousCompletedAt === null || previousCompletedAt === undefined);

        if (shouldComplete) {
            isCompletingRef.current = true;
            
            markGoalAsCompleted(goalId)
                .then(() => {
                    // Invalidate caches since goal status changed
                    invalidateGoalCaches(goalId);
                    invalidateAllGoalCaches(); // Also invalidate completed goals cache
                    // Refetch to get updated goal data
                    return refetch();
                })
                .then(() => {
                    // Navigate to celebration page
                    if (onNavigateToCompleted) {
                        onNavigateToCompleted(goalId);
                    }
                })
                .catch((err) => {
                    console.error('Error marking goal as completed:', err);
                    // Reset flag on error so user can retry
                    isCompletingRef.current = false;
                });
        }

        // Update refs for next comparison
        previousPercentRef.current = currentPercent;
        previousCompletedAtRef.current = currentCompletedAt;
    }, [data, loading, goalId, refetch, onNavigateToCompleted]);

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col items-center gap-4 py-12">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm sm:text-base">Loading goal details...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back to Goals
                    </button>
                )}
                <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-lg">
                    <div className="flex items-start gap-3 mb-4">
                        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <div className="text-red-400 font-medium mb-1">Unable to Load Goal</div>
                            <div className="text-red-300 text-sm mb-3">
                                {error.message || 'Something went wrong while loading this goal. Please try again.'}
                            </div>
                            <p className="text-neutral-400 text-xs">
                                This might be a temporary issue. Click retry to try loading the goal again.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => refetch()}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors border border-red-500/30 text-sm"
                        >
                            <Loader2 size={16} className="animate-spin" />
                            Retry
                        </button>
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg transition-colors text-sm"
                            >
                                Back to Goals
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back to Goals
                    </button>
                )}
                <div className="text-center py-12 text-neutral-500">
                    <p>Goal not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-6 flex items-center justify-between">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Back to Goals
                    </button>
                )}
                {data && (
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={handleEditGoal}
                            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                        >
                            <Edit size={16} />
                            Edit Goal
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors border border-red-500/30"
                        >
                            <Trash2 size={16} />
                            Delete Goal
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                                {data.goal.title}
                            </h1>
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Goal Type Label */}
                                <span className="px-2.5 py-1 bg-neutral-700/50 text-neutral-300 rounded text-xs font-medium capitalize">
                                    {data.goal.type}
                                </span>
                                {/* Status Chip */}
                                <GoalStatusChip status={data.goal.completedAt ? 'completed' : 'active'}>
                                    {data.goal.completedAt ? 'Completed' : 'Active'}
                                </GoalStatusChip>
                                {/* Completed Date Label */}
                                {data.goal.completedAt && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400">
                                        <Trophy size={12} />
                                        <span>
                                            Completed on {formatDeadline(data.goal.completedAt)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Progress Bar */}
                    <div className="space-y-3">
                        <GoalProgressBar 
                            percent={data.goal.completedAt ? 100 : data.progress.percent} 
                            height="lg" 
                        />

                        {/* Numeric Progress */}
                        <div className="flex items-center justify-between">
                            <div className="text-white font-medium text-sm sm:text-base">
                                {data.goal.type === 'cumulative'
                                    ? `${data.progress.currentValue} / ${data.goal.targetValue} ${data.goal.unit || ''}`
                                    : `${data.progress.currentValue} of ${data.goal.targetValue} days`}
                            </div>
                            <div className="text-emerald-400 font-semibold text-sm sm:text-base">
                                {data.goal.completedAt ? 100 : data.progress.percent}%
                            </div>
                        </div>
                    </div>

                    {/* Milestones Row */}
                    <div className="pt-4">
                        <div className="text-neutral-400 text-sm font-medium mb-3">Milestones</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {useMemo(() => {
                                const milestones = [
                                    { percent: 25, label: 'Quarter', value: data.goal.targetValue * 0.25 },
                                    { percent: 50, label: 'Halfway', value: data.goal.targetValue * 0.5 },
                                    { percent: 75, label: 'Almost there', value: data.goal.targetValue * 0.75 },
                                    { percent: 100, label: 'Goal!', value: data.goal.targetValue },
                                ];
                                // Cap progress at 100% for completed goals
                                const displayPercent = data.goal.completedAt ? 100 : data.progress.percent;
                                return milestones.map(milestone => ({
                                    ...milestone,
                                    reached: displayPercent >= milestone.percent,
                                }));
                            }, [data.goal.targetValue, data.progress.percent, data.goal.completedAt]).map((milestone) => {
                                // For completed goals, mark 100% milestone as reached even if progress < 100
                                const isReached = data.goal.completedAt && milestone.percent === 100
                                    ? true
                                    : milestone.reached;
                                
                                const milestoneValue = data.goal.type === 'cumulative'
                                    ? `${milestone.value.toFixed(1)} ${data.goal.unit || ''} of ${data.goal.targetValue} ${data.goal.unit || ''}`
                                    : `${milestone.value.toFixed(0)} days of ${data.goal.targetValue} days`;
                                
                                return (
                                    <div
                                        key={milestone.percent}
                                        className={`p-3 rounded-lg border transition-colors ${
                                            isReached
                                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                                : 'bg-neutral-800/50 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {isReached ? (
                                                <Check className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-neutral-600 flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-sm font-medium mb-1">
                                                    {milestone.percent}% • {milestone.label}
                                                </div>
                                                <div className="text-neutral-400 text-xs leading-tight">
                                                    {milestoneValue}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* Manual Progress Button (only for cumulative, active goals) */}
                    {data.goal.type === 'cumulative' && !data.goal.completedAt && (
                        <button
                            onClick={() => setShowManualProgressModal(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            Log progress manually
                        </button>
                    )}
                    
                    {/* Win Archive Button (only for completed goals) */}
                    {data.goal.completedAt && (
                        <button
                            onClick={() => {
                                if (onViewWinArchive) {
                                    onViewWinArchive();
                                } else if (onBack) {
                                    onBack();
                                }
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-medium rounded-lg transition-colors border border-amber-500/30"
                        >
                            <Award size={18} />
                            View in Win Archive
                        </button>
                    )}
                    
                    {/* Spacer for layout when neither button shows */}
                    {data.goal.type !== 'cumulative' && !data.goal.completedAt && <div />}
                </div>

                {/* Recent Progress Section */}
                <div className="bg-neutral-800/50 border border-white/10 rounded-lg p-4 sm:p-6">
                    <div className="text-neutral-400 text-sm font-medium mb-4">Recent Progress</div>
                    {(() => {
                        const lastSevenDays = data.progress.lastSevenDays;
                        const maxValue = useMemo(() => {
                            if (lastSevenDays.length === 0) return 1;
                            const max = Math.max(...lastSevenDays.map(day => day.value));
                            return max > 0 ? max : 1;
                        }, [lastSevenDays]);

                        const totalValue = lastSevenDays.reduce((sum, day) => sum + day.value, 0);
                        const hasAnyProgress = totalValue > 0;

                        if (!hasAnyProgress) {
                            return (
                                <div className="text-neutral-500 text-sm text-center py-4">
                                    No progress in the last 7 days.
                                </div>
                            );
                        }

                        // Format dates for labels
                        const startDate = lastSevenDays.length > 0
                            ? (() => {
                                try {
                                    return format(parseISO(lastSevenDays[lastSevenDays.length - 1].date), 'MMM d');
                                } catch {
                                    return lastSevenDays[lastSevenDays.length - 1].date.split('-').slice(1).join('/');
                                }
                            })()
                            : '';
                        const endDate = lastSevenDays.length > 0
                            ? (() => {
                                try {
                                    return format(parseISO(lastSevenDays[0].date), 'MMM d');
                                } catch {
                                    return lastSevenDays[0].date.split('-').slice(1).join('/');
                                }
                            })()
                            : '';

                        return (
                            <div className="space-y-3">
                                <div className="flex items-end gap-1.5 h-24 bg-neutral-900/50 rounded-lg p-3">
                                    {lastSevenDays.map((day) => {
                                        const heightPercent = (day.value / maxValue) * 100;
                                        return (
                                            <div
                                                key={day.date}
                                                className="flex-1 flex flex-col items-center gap-1.5 h-full"
                                                title={`${day.date}: ${day.value} ${data.goal.unit || ''}`}
                                            >
                                                <div className="flex-1 w-full flex items-end">
                                                    <div
                                                        className={`w-full rounded-t transition-all min-h-[2px] ${
                                                            day.hasProgress
                                                                ? 'bg-emerald-500'
                                                                : 'bg-neutral-700'
                                                        }`}
                                                        style={{ height: `${Math.max(2, heightPercent)}%` }}
                                                    />
                                                </div>
                                                <div className="text-[10px] text-neutral-500 leading-tight">
                                                    {(() => {
                                                        try {
                                                            return format(parseISO(day.date), 'd');
                                                        } catch {
                                                            return day.date.split('-')[2] || '';
                                                        }
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {(startDate || endDate) && (
                                    <div className="flex items-center justify-between text-xs text-neutral-500">
                                        <span>{startDate}</span>
                                        <span>{endDate}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Goal Overview Section */}
                <div className="bg-neutral-800/50 border border-white/10 rounded-lg p-4 sm:p-6">
                    <div className="text-neutral-400 text-sm font-medium mb-4">Goal Overview</div>
                    <div className="space-y-4">
                        {/* Deadline */}
                        {data.goal.deadline && (
                            <div>
                                <div className="text-neutral-400 text-xs mb-1">Deadline</div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 bg-neutral-700/50 text-neutral-300 rounded text-sm font-medium">
                                        {formatDeadline(data.goal.deadline)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {data.goal.notes && (
                            <div>
                                <div className="text-neutral-400 text-xs mb-2">Notes</div>
                                <div className="bg-neutral-900/50 border border-white/5 rounded-lg p-3 text-white text-sm leading-relaxed">
                                    {data.goal.notes}
                                </div>
                            </div>
                        )}

                        {!data.goal.deadline && !data.goal.notes && (
                            <div className="text-neutral-500 text-sm">No additional details</div>
                        )}
                    </div>
                </div>

                {/* Linked Habits Section */}
                <div className="bg-neutral-800/50 border border-white/10 rounded-lg p-4 sm:p-6">
                    <div className="text-neutral-400 text-sm font-medium mb-4">Linked Habits</div>
                    {linkedHabits.length === 0 ? (
                        <div className="text-neutral-500 text-sm">
                            No habits linked — this goal relies on manual progress only.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {linkedHabits.map((habit) => (
                                <div
                                    key={habit.id}
                                    className="flex items-center gap-3 p-3 bg-neutral-900/50 rounded-lg hover:bg-neutral-900/70 transition-colors cursor-pointer"
                                    onClick={() => {
                                        // TODO: Navigate to habit detail page when implemented
                                        // For now, this is a placeholder for future navigation
                                        console.log('Navigate to habit:', habit.id);
                                    }}
                                >
                                    {/* Habit Icon Placeholder */}
                                    {habit.goal.unit && (
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-emerald-400 text-sm font-medium">
                                                {habit.goal.unit.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-sm font-medium truncate">
                                            {habit.name}
                                        </div>
                                        <div className="text-neutral-400 text-xs mt-0.5">
                                            {habit.goal.type === 'number' ? 'Quantified' : 'Binary'}
                                            {habit.goal.unit && ` • ${habit.goal.unit}`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Manual Progress Modal */}
            {data && (
                <GoalManualProgressModal
                    isOpen={showManualProgressModal}
                    onClose={() => setShowManualProgressModal(false)}
                    goalId={goalId}
                    unit={data.goal.unit}
                    onSuccess={refetch}
                />
            )}

            {/* Delete Confirmation Modal */}
            {data && (
                <DeleteGoalConfirmModal
                    isOpen={showDeleteConfirm}
                    onClose={() => {
                        setShowDeleteConfirm(false);
                        setDeleteError(null);
                    }}
                    onConfirm={handleDeleteGoal}
                    goalTitle={data.goal.title}
                />
            )}
        </div>
    );
};
