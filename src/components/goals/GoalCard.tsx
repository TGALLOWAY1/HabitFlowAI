import React, { useMemo, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Check, ExternalLink, Edit, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useHabitStore } from '../../store/HabitContext';
import type { GoalWithProgress } from '../../models/persistenceTypes';
import { InactivityCoachingPopup } from './InactivityCoachingPopup';

interface GoalCardProps {
    goalWithProgress: GoalWithProgress;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onViewDetails?: (goalId: string) => void;
    onEdit?: (goalId: string) => void;
    onAddManualProgress?: (goalId: string) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
    goalWithProgress,
    isExpanded,
    onToggleExpand,
    onViewDetails,
    onEdit,
    onAddManualProgress,
}) => {
    const { goal, progress } = goalWithProgress;
    const { habits } = useHabitStore();
    const [showCoachingPopup, setShowCoachingPopup] = useState(false);
    const warningBadgeRef = useRef<HTMLDivElement>(null);

    // Create habit lookup map for efficient access
    const habitMap = useMemo(() => {
        const map = new Map<string, typeof habits[0]>();
        habits.forEach(habit => map.set(habit.id, habit));
        return map;
    }, [habits]);

    // Get linked habits
    const linkedHabits = useMemo(() => {
        return goal.linkedHabitIds
            .map(habitId => habitMap.get(habitId))
            .filter((habit): habit is NonNullable<typeof habit> => habit !== undefined);
    }, [goal.linkedHabitIds, habitMap]);

    // Calculate popup position based on badge position
    const getPopupPosition = (): { top: number; left: number } => {
        if (warningBadgeRef.current) {
            const rect = warningBadgeRef.current.getBoundingClientRect();
            return {
                top: rect.bottom + 8,
                left: rect.left,
            };
        }
        return { top: 0, left: 0 };
    };

    const handleWarningClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card expansion
        setShowCoachingPopup(true);
    };

    // Calculate milestone values
    const milestones = useMemo(() => {
        const milestones = [
            { percent: 25, label: 'Quarter', value: goal.targetValue * 0.25 },
            { percent: 50, label: 'Halfway', value: goal.targetValue * 0.5 },
            { percent: 75, label: 'Almost there', value: goal.targetValue * 0.75 },
            { percent: 100, label: 'Goal!', value: goal.targetValue },
        ];
        return milestones.map(milestone => ({
            ...milestone,
            reached: progress.currentValue >= milestone.value,
        }));
    }, [goal.targetValue, progress.currentValue]);

    // Calculate max value for sparkline scaling
    const maxSparklineValue = useMemo(() => {
        if (progress.lastSevenDays.length === 0) return 1;
        const max = Math.max(...progress.lastSevenDays.map(day => day.value));
        return max > 0 ? max : 1;
    }, [progress.lastSevenDays]);

    // Format deadline for display
    const formatDeadline = (deadline: string): string => {
        try {
            const date = parseISO(deadline);
            return format(date, 'MMM d');
        } catch {
            return deadline;
        }
    };

    // Generate milestone dots (0%, 10%, 20%, ..., 100%)
    const milestoneThresholds = Array.from({ length: 11 }, (_, i) => i * 10);

    // Determine numerical progress display
    const progressText = goal.type === 'cumulative'
        ? `${progress.currentValue} / ${goal.targetValue} ${goal.unit || ''}`
        : `${progress.currentValue} / ${goal.targetValue} days`;

    return (
        <div className="bg-neutral-800/50 border border-white/10 rounded-lg overflow-hidden transition-all">
            <button
                onClick={onToggleExpand}
                className="w-full p-4 sm:p-5 hover:bg-neutral-800/70 transition-colors text-left"
            >
                {/* Collapsed View */}
                {!isExpanded && (
                    <div className="space-y-3">
                        {/* Header: Title and Chevron */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-white mb-2 truncate">
                                    {goal.title}
                                </h3>
                                
                                {/* Progress Bar */}
                                <div className="w-full h-2 bg-neutral-700 rounded-full overflow-hidden mb-2">
                                    <div
                                        className="h-full bg-emerald-500 transition-all"
                                        style={{ width: `${Math.min(100, progress.percent)}%` }}
                                    />
                                </div>

                                {/* Mini Milestone Dots */}
                                <div className="flex items-center gap-1 mb-2">
                                    {milestoneThresholds.map((threshold) => {
                                        const isFilled = progress.percent >= threshold;
                                        return (
                                            <div
                                                key={threshold}
                                                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                                    isFilled
                                                        ? 'bg-emerald-500'
                                                        : 'bg-neutral-600'
                                                }`}
                                                title={`${threshold}%`}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Numerical Progress and Metadata Row */}
                                <div className="flex items-center gap-3 flex-wrap text-sm">
                                    <span className="text-neutral-300 font-medium">
                                        {progressText}
                                    </span>
                                    <span className="text-emerald-400 font-medium">
                                        {progress.percent}%
                                    </span>
                                    <span className="text-neutral-500">
                                        {goal.linkedHabitIds.length} {goal.linkedHabitIds.length === 1 ? 'habit' : 'habits'}
                                    </span>
                                    {goal.deadline && (
                                        <span className="px-2 py-0.5 bg-neutral-700/50 text-neutral-300 rounded text-xs">
                                            Due {formatDeadline(goal.deadline)}
                                        </span>
                                    )}
                                </div>

                                {/* Inactivity Warning Badge */}
                                {progress.inactivityWarning && (
                                    <div
                                        ref={warningBadgeRef}
                                        onClick={handleWarningClick}
                                        className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400 cursor-pointer hover:bg-amber-500/20 transition-colors"
                                    >
                                        <AlertTriangle size={12} />
                                        <span>No progress 4 of last 7 days</span>
                                    </div>
                                )}
                            </div>

                            {/* Chevron Icon */}
                            <ChevronRight className="text-neutral-400 flex-shrink-0 mt-1" size={20} />
                        </div>
                    </div>
                )}

                {/* Expanded View Header */}
                {isExpanded && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <ChevronDown className="text-neutral-400 flex-shrink-0" size={20} />
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-white truncate">
                                    {goal.title}
                                </h3>
                            </div>
                        </div>
                    </div>
                )}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 pt-4 border-t border-white/5 bg-neutral-900/30 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-6">
                        {/* Linked Habits List */}
                        <div>
                            <div className="text-neutral-400 text-sm font-medium mb-2">Linked Habits</div>
                            {linkedHabits.length === 0 ? (
                                <div className="text-neutral-500 text-sm">No habits linked</div>
                            ) : (
                                <div className="space-y-2">
                                    {linkedHabits.map((habit) => (
                                        <div
                                            key={habit.id}
                                            className="flex items-center gap-3 p-2 bg-neutral-800/50 rounded-lg"
                                        >
                                            {/* Habit Icon Placeholder */}
                                            {habit.goal.unit && (
                                                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <span className="text-emerald-400 text-xs font-medium">
                                                        {habit.goal.unit.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-white text-sm font-medium truncate">
                                                    {habit.name}
                                                </div>
                                                {habit.goal.unit && (
                                                    <div className="text-neutral-400 text-xs">
                                                        {habit.goal.type === 'number' ? 'Quantified' : 'Binary'} • {habit.goal.unit}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Milestone List */}
                        <div>
                            <div className="text-neutral-400 text-sm font-medium mb-2">Milestones</div>
                            <div className="space-y-2">
                                {milestones.map((milestone) => {
                                    const milestoneValue = goal.type === 'cumulative'
                                        ? `${milestone.value.toFixed(1)} ${goal.unit || ''} of ${goal.targetValue} ${goal.unit || ''}`
                                        : `${milestone.value.toFixed(0)} days of ${goal.targetValue} days`;
                                    
                                    return (
                                        <div
                                            key={milestone.percent}
                                            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                                milestone.reached
                                                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                                                    : 'bg-neutral-800/50 border border-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {milestone.reached ? (
                                                    <Check className="text-emerald-400 flex-shrink-0" size={16} />
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border-2 border-neutral-600 flex-shrink-0" />
                                                )}
                                                <div>
                                                    <div className="text-white text-sm font-medium">
                                                        {milestone.percent}% • {milestone.label}
                                                    </div>
                                                    <div className="text-neutral-400 text-xs">
                                                        {milestoneValue}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sparkline Placeholder */}
                        <div>
                            <div className="text-neutral-400 text-sm font-medium mb-2">Last 7 Days</div>
                            <div className="flex items-end gap-1 h-16 bg-neutral-800/50 rounded-lg p-2">
                                {progress.lastSevenDays.map((day) => {
                                    const heightPercent = (day.value / maxSparklineValue) * 100;
                                    return (
                                        <div
                                            key={day.date}
                                            className="flex-1 flex flex-col items-center gap-1"
                                            title={`${day.date}: ${day.value} ${goal.unit || ''}`}
                                        >
                                            <div
                                                className={`w-full rounded-t transition-all ${
                                                    day.hasProgress
                                                        ? 'bg-emerald-500'
                                                        : 'bg-neutral-600'
                                                }`}
                                                style={{ height: `${Math.max(4, heightPercent)}%` }}
                                            />
                                            <div className="text-[8px] text-neutral-500 leading-tight">
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
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                            {goal.type === 'cumulative' && onAddManualProgress && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddManualProgress(goal.id);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                                >
                                    <Plus size={14} />
                                    Add manual progress
                                </button>
                            )}
                            {onViewDetails && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewDetails(goal.id);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    View full goal details
                                </button>
                            )}
                            {onEdit && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit(goal.id);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                                >
                                    <Edit size={14} />
                                    Edit goal
                                </button>
                            )}
                        </div>

                        {/* Notes */}
                        {goal.notes && (
                            <div className="pt-2 border-t border-white/5">
                                <div className="text-neutral-400 text-sm font-medium mb-1">Notes</div>
                                <div className="text-white text-sm">{goal.notes}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Inactivity Coaching Popup */}
            <InactivityCoachingPopup
                isOpen={showCoachingPopup}
                onClose={() => setShowCoachingPopup(false)}
                goal={goal}
                linkedHabits={linkedHabits}
                position={getPopupPosition()}
            />
        </div>
    );
};
