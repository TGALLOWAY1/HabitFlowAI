import React from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { GoalWithProgress } from '../../models/persistenceTypes';

interface GoalCardProps {
    goalWithProgress: GoalWithProgress;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
    goalWithProgress,
    isExpanded,
    onToggleExpand,
}) => {
    const { goal, progress } = goalWithProgress;

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
                className="w-full p-4 hover:bg-neutral-800/70 transition-colors text-left"
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
                                    <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
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
                <div className="px-4 pb-4 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="space-y-4">
                        {/* Goal Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-neutral-400 mb-1">Type</div>
                                <div className="text-white capitalize">{goal.type}</div>
                            </div>
                            {goal.deadline && (
                                <div>
                                    <div className="text-neutral-400 mb-1">Deadline</div>
                                    <div className="text-white">{goal.deadline}</div>
                                </div>
                            )}
                        </div>

                        {/* Progress Details */}
                        <div>
                            <div className="text-neutral-400 text-sm mb-2">Last 7 Days</div>
                            <div className="flex gap-1">
                                {progress.lastSevenDays.map((day, index) => (
                                    <div
                                        key={day.date}
                                        className={`flex-1 h-8 rounded flex items-center justify-center text-xs transition-colors ${
                                            day.hasProgress
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-neutral-700/50 text-neutral-500 border border-neutral-600/30'
                                        }`}
                                        title={`${day.date}: ${day.value} ${goal.unit || ''}`}
                                    >
                                        {day.hasProgress ? '✓' : '—'}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        {goal.notes && (
                            <div>
                                <div className="text-neutral-400 text-sm mb-1">Notes</div>
                                <div className="text-white text-sm">{goal.notes}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
