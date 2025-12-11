import React from 'react';
import { Plus, Edit, ArrowUpRight, Check } from 'lucide-react';
import type { GoalWithProgress } from '../../types';
import { MiniHeatmap } from './MiniHeatmap';

interface GoalGridCardProps {
    goalWithProgress: GoalWithProgress;
    onViewDetails: (goalId: string) => void;
    onEdit: (goalId: string) => void;
    onAddManualProgress: (goalId: string, event: React.MouseEvent) => void;
    onNavigateToCompleted?: (goalId: string) => void;
}

export const GoalGridCard: React.FC<GoalGridCardProps> = ({
    goalWithProgress,
    onViewDetails,
    onEdit,
    onAddManualProgress
}) => {
    const { goal, progress } = goalWithProgress;

    // Safely fallback if lastThirtyDays is missing (during migration/dev)
    const historyData = progress.lastThirtyDays || progress.lastSevenDays || [];

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
                            <span className="capitalize">{goal.type}</span>
                            {goal.type === 'cumulative' && <span>• {goal.targetValue} {goal.unit} total</span>}
                            {goal.type === 'frequency' && <span>• {goal.targetValue}x {goal.unit}/week</span>}
                        </div>
                    </div>
                </div>

                {/* Status Icons Absolute Top Right */}
                <div className="absolute top-4 right-4 flex items-center gap-1">

                    {/* Actions - Hover only */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/80 backdrop-blur-sm rounded-lg ml-1">
                        {!goal.completedAt && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddManualProgress(goal.id, e);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                                title="Log Progress"
                            >
                                <Plus size={16} />
                            </button>
                        )}
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

                {/* 1. Heatmap (Full Width) */}
                <div className="w-full">
                    <MiniHeatmap
                        data={historyData}
                        goalType={goal.type}
                        targetValue={goal.targetValue}
                    />
                </div>

                {/* 2. Progress Bar (Compact, with tooltip) */}
                <div
                    className="w-full mt-2 mb-1 group/progress relative"
                    title={`Progress: ${progress.percent}%`}
                >
                    {/* Bar Container */}
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${progress.percent >= 100
                                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                    : 'bg-emerald-500'
                                }`}
                            style={{ width: `${Math.min(100, progress.percent)}%` }}
                        />
                    </div>
                </div>
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
