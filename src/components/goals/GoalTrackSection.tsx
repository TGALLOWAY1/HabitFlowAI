/**
 * GoalTrackSection
 *
 * Renders a group of goals belonging to a single track within a category stack.
 * Shows track name, progress summary, and ordered goals with visual state indicators.
 */
import React from 'react';
import { Route, Lock, Check, ChevronRight, GripVertical } from 'lucide-react';
import type { GoalWithProgress, GoalTrack, Goal } from '../../types';

interface GoalTrackSectionProps {
    track: GoalTrack;
    goals: Goal[];
    getGoalWithProgress: (goalId: string) => GoalWithProgress | undefined;
    onViewGoal?: (goalId: string) => void;
    onViewTrack?: (trackId: string) => void;
    dragHandleProps?: Record<string, unknown>;
    isDragging?: boolean;
}

export const GoalTrackSection: React.FC<GoalTrackSectionProps> = ({
    track,
    goals,
    getGoalWithProgress,
    onViewGoal,
    onViewTrack,
    dragHandleProps,
    isDragging,
}) => {
    const completedCount = goals.filter(g => g.trackStatus === 'completed').length;
    const totalCount = goals.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div
            className={`bg-neutral-800/30 border border-white/5 rounded-lg overflow-hidden mb-2 ${
                isDragging ? 'opacity-50 shadow-2xl' : ''
            }`}
        >
            {/* Track Header */}
            <div className="flex items-center gap-1 pl-2 pr-0 hover:bg-neutral-800/50 transition-colors">
                {/* Drag handle */}
                {dragHandleProps && (
                    <div
                        {...dragHandleProps}
                        className="flex-shrink-0 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing touch-none py-2.5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical size={16} />
                    </div>
                )}
                <button
                    onClick={() => onViewTrack?.(track.id)}
                    className="flex-1 flex items-center gap-2.5 px-2 py-2.5 text-left"
                >
                <Route size={15} className="text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">{track.name}</span>
                        <span className="text-xs text-neutral-500 flex-shrink-0">
                            {completedCount}/{totalCount}
                        </span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="mt-1 h-1 bg-neutral-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
                <ChevronRight size={14} className="text-neutral-500 flex-shrink-0" />
                </button>
            </div>

            {/* Track Goals */}
            <div className="px-2 pb-2 space-y-1">
                {goals.map((goal, index) => {
                    const gwp = getGoalWithProgress(goal.id);
                    const isLocked = goal.trackStatus === 'locked';
                    const isCompleted = goal.trackStatus === 'completed';
                    const isActive = goal.trackStatus === 'active';

                    return (
                        <button
                            key={goal.id}
                            onClick={() => onViewGoal?.(goal.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
                                isLocked
                                    ? 'opacity-60 hover:bg-neutral-800/50 hover:opacity-100'
                                    : isActive
                                    ? 'bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10'
                                    : isCompleted
                                    ? 'hover:bg-neutral-800/50'
                                    : 'hover:bg-neutral-800/50'
                            }`}
                        >
                            {/* State indicator */}
                            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                                {isCompleted ? (
                                    <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <Check size={11} className="text-emerald-400" />
                                    </div>
                                ) : isLocked ? (
                                    <Lock size={12} className="text-neutral-600" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                            </div>

                            {/* Goal info */}
                            <div className="flex-1 min-w-0">
                                <div className={`text-sm truncate ${
                                    isCompleted ? 'text-neutral-500 line-through' :
                                    isLocked ? 'text-neutral-500' :
                                    'text-white font-medium'
                                }`}>
                                    {goal.title}
                                </div>
                                {isActive && gwp && goal.type === 'cumulative' && gwp.progress.percent > 0 && (
                                    <div className="text-xs text-neutral-400 mt-0.5">
                                        {gwp.progress.percent}% complete
                                    </div>
                                )}
                            </div>

                            {/* Step indicator */}
                            <span className="text-[10px] text-neutral-600 flex-shrink-0">
                                {index + 1}/{totalCount}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
