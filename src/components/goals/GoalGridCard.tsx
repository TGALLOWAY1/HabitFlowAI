import React from 'react';
import { Edit, ArrowUpRight, Check } from 'lucide-react';
import type { GoalWithProgress } from '../../types';
import { MiniHeatmap } from './MiniHeatmap';

interface GoalGridCardProps {
    goalWithProgress: GoalWithProgress;
    onViewDetails: (goalId: string) => void;
    onEdit: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
}

export const GoalGridCard: React.FC<GoalGridCardProps> = ({
    goalWithProgress,
    onViewDetails,
    onEdit,
}) => {
    const { goal, progress } = goalWithProgress;

    // Safely fallback if lastThirtyDays is missing (during migration/dev)
    const historyData = progress.lastThirtyDays || progress.lastSevenDays || [];

    // For low-target goals (<=10), show a tick-mark progress bar instead of the 28-box heatmap
    const isLowTarget = goal.type !== 'onetime' && !!goal.targetValue && goal.targetValue <= 10;
    const target = goal.targetValue || 0;

    // Determine border color based on status
    const getBorderClass = () => {
        if (goal.completedAt) return "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
        if (progress.inactivityWarning) return "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]";
        return "border-white/5 hover:border-emerald-500/30";
    };

    return (
        <div
            className={`group relative flex flex-col bg-neutral-900/50 hover:bg-neutral-800/80 border rounded-2xl transition-all duration-300 overflow-hidden cursor-pointer ${getBorderClass()}`}
            onClick={() => onViewDetails(goal.id)}
        >
            {/* Header */}
            <div className="p-4 pb-0 relative">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-8">
                        {/* Title */}
                        <h3 className="font-bold text-neutral-100 truncate text-lg leading-tight mb-1">
                            {goal.title}
                        </h3>
                        {/* Description / Metadata - Left aligned below title */}
                        <div className="text-xs text-neutral-400 flex items-center gap-1.5 font-medium">
                            <span className="capitalize">{goal.type === 'onetime' ? 'One-Time Event' : goal.type}</span>
                            {goal.type === 'cumulative' && <span>• {goal.targetValue} {goal.unit} total</span>}
                            {goal.type === 'frequency' && <span>• {goal.targetValue}x {goal.unit}/week</span>}
                            {goal.type === 'onetime' && (
                                <span>
                                    • {goal.deadline
                                        ? new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'No Date'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Icons Absolute Top Right */}
                <div className="absolute top-4 right-4 flex items-center gap-1">

                    {/* Actions - Hover only */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/80 backdrop-blur-sm rounded-lg ml-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(goal.id);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                            title="Edit Goal"
                        >
                            <Edit size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Visuals Body */}
            <div className="px-4 py-2 flex-1 flex flex-col gap-1">

                {/* 1. Visualization - Hide for OneTime */}
                {isLowTarget && (
                    <div className="w-full py-2">
                        <div className="relative h-3 w-full bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${progress.percent >= 100
                                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                    : 'bg-emerald-500'
                                    }`}
                                style={{ width: `${Math.min(100, progress.percent)}%` }}
                            />
                            {/* Tick marks */}
                            {Array.from({ length: target - 1 }, (_, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 h-full w-px bg-neutral-700"
                                    style={{ left: `${((i + 1) / target) * 100}%` }}
                                />
                            ))}
                        </div>
                        <div className="mt-1.5 text-xs text-neutral-400 font-medium text-center">
                            {progress.currentValue} / {target} {goal.unit || ''}
                        </div>
                    </div>
                )}

                {/* Heatmap for high-target goals */}
                {goal.type !== 'onetime' && !isLowTarget && (
                    <div className="w-full">
                        <MiniHeatmap
                            data={historyData}
                            goalType={goal.type}
                            targetValue={target}
                        />
                    </div>
                )}

                {/* Progress Bar (Compact) - only for high-target goals (low-target already has one above) */}
                {goal.type !== 'onetime' && !isLowTarget && (
                    <div
                        className="w-full mt-2 mb-1 group/progress relative"
                        title={`Progress: ${progress.percent}%`}
                    >
                        <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${progress.percent >= 100
                                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                    : 'bg-emerald-500'
                                    }`}
                                style={{ width: `${Math.min(100, progress.percent)}%` }}
                            />
                        </div>
                        <div className="mt-1.5 text-xs text-neutral-400 font-medium text-center">
                            {progress.currentValue} / {target} {goal.unit || ''}{goal.type === 'frequency' ? ' days' : ''}
                        </div>
                    </div>
                )}

                {/* OneTime Goal Status Placeholder */}
                {goal.type === 'onetime' && (
                    <div className="flex-1 flex items-center justify-center py-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${goal.completedAt
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400 border-white/5'
                            }`}>
                            {goal.completedAt ? 'Completed' : 'Goal in Progress'}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Status */}
            {(goal.completedAt || !progress.inactivityWarning) && (
                <div className="px-4 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        {!progress.inactivityWarning && (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                                <ArrowUpRight size={12} />
                                <span>On track</span>
                            </div>
                        )}
                    </div>

                    {goal.completedAt && (
                        <div className="flex items-center gap-1 text-emerald-500 font-medium">
                            <Check size={12} />
                            <span>Done</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
