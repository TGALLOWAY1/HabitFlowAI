import React from 'react';
import { Edit, Check, GripVertical, Clock, CalendarCheck } from 'lucide-react';
import type { GoalWithProgress } from '../../types';
import { MiniHeatmap } from './MiniHeatmap';

interface GoalGridCardProps {
    goalWithProgress: GoalWithProgress;
    onViewDetails: (goalId: string) => void;
    onEdit: (goalId: string) => void;
    onNavigateToCompleted?: (goalId: string) => void;
    dragHandleProps?: Record<string, unknown>;
    isDragging?: boolean;
}

/**
 * Compact card for onetime and frequency goals — single row, minimal height.
 */
const CompactGoalCard: React.FC<GoalGridCardProps> = ({
    goalWithProgress,
    onViewDetails,
    onEdit,
    dragHandleProps,
    isDragging,
}) => {
    const { goal, progress } = goalWithProgress;

    const isCompleted = !!goal.completedAt;

    // Format deadline
    const deadlineLabel = goal.deadline
        ? new Date(goal.deadline + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;

    // Frequency progress text
    const frequencyLabel = goal.type === 'frequency' && goal.targetValue
        ? `${progress.currentValue}/${goal.targetValue}`
        : null;

    return (
        <div
            className={`group flex items-center gap-2 bg-neutral-900/50 hover:bg-neutral-800/80 border rounded-xl px-3 py-2.5 transition-all cursor-pointer ${
                isCompleted
                    ? 'border-emerald-500/30'
                    : progress.inactivityWarning
                        ? 'border-amber-500/40'
                        : 'border-white/5 hover:border-white/10'
            } ${isDragging ? 'opacity-50 shadow-2xl' : ''}`}
            onClick={() => onViewDetails(goal.id)}
        >
            {/* Drag handle */}
            <div
                {...dragHandleProps}
                className="flex-shrink-0 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing touch-none"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={16} />
            </div>

            {/* Status icon */}
            <div className="flex-shrink-0">
                {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check size={12} className="text-emerald-400" />
                    </div>
                ) : goal.type === 'onetime' ? (
                    <div className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-neutral-600" />
                    </div>
                ) : (
                    <div className="w-5 h-5 rounded-full border border-emerald-500/40 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                    </div>
                )}
            </div>

            {/* Title */}
            <span className={`flex-1 text-sm font-medium truncate ${
                isCompleted ? 'text-neutral-500 line-through' : 'text-neutral-100'
            }`}>
                {goal.title}
            </span>

            {/* Metadata chips */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {/* Frequency progress */}
                {frequencyLabel && (
                    <span className="text-xs text-neutral-400 font-medium tabular-nums">
                        {frequencyLabel}
                    </span>
                )}

                {/* Deadline */}
                {deadlineLabel && !isCompleted && (
                    <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <Clock size={11} />
                        {deadlineLabel}
                    </span>
                )}

                {/* Completed date */}
                {isCompleted && goal.completedAt && (
                    <span className="flex items-center gap-1 text-xs text-emerald-500/70">
                        <CalendarCheck size={11} />
                        Done
                    </span>
                )}

                {/* Edit button - hover only */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(goal.id);
                    }}
                    className="p-1 text-neutral-600 hover:text-white hover:bg-white/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit Goal"
                >
                    <Edit size={14} />
                </button>
            </div>
        </div>
    );
};

/**
 * Full card for cumulative goals — shows progress visualization.
 */
const CumulativeGoalCard: React.FC<GoalGridCardProps> = ({
    goalWithProgress,
    onViewDetails,
    onEdit,
    dragHandleProps,
    isDragging,
}) => {
    const { goal, progress } = goalWithProgress;

    const historyData = progress.lastThirtyDays || progress.lastSevenDays || [];
    const isLowTarget = !!goal.targetValue && goal.targetValue <= 10;
    const target = goal.targetValue || 0;
    const isCompleted = !!goal.completedAt;

    return (
        <div
            className={`group relative flex flex-col bg-neutral-900/50 hover:bg-neutral-800/80 border rounded-xl transition-all overflow-hidden cursor-pointer ${
                isCompleted
                    ? 'border-emerald-500/30'
                    : progress.inactivityWarning
                        ? 'border-amber-500/40'
                        : 'border-white/5 hover:border-white/10'
            } ${isDragging ? 'opacity-50 shadow-2xl' : ''}`}
            onClick={() => onViewDetails(goal.id)}
        >
            {/* Header */}
            <div className="px-3 pt-3 pb-1 flex items-start gap-2">
                {/* Drag handle */}
                <div
                    {...dragHandleProps}
                    className="flex-shrink-0 mt-0.5 text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing touch-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={16} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-100 truncate text-sm leading-tight">
                        {goal.title}
                    </h3>
                    <div className="text-xs text-neutral-500 mt-0.5">
                        {goal.targetValue} {goal.unit} total
                        {goal.deadline && (
                            <span> · by {new Date(goal.deadline + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        )}
                    </div>
                </div>

                {/* Edit button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(goal.id);
                    }}
                    className="flex-shrink-0 p-1 text-neutral-600 hover:text-white hover:bg-white/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit Goal"
                >
                    <Edit size={14} />
                </button>
            </div>

            {/* Progress visualization */}
            <div className="px-3 pb-3">
                {isLowTarget ? (
                    <div className="w-full py-1">
                        <div className="relative h-2.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ease-out ${
                                    progress.percent >= 100
                                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                        : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, progress.percent)}%` }}
                            />
                            {Array.from({ length: target - 1 }, (_, i) => (
                                <div
                                    key={i}
                                    className="absolute top-0 h-full w-px bg-neutral-700"
                                    style={{ left: `${((i + 1) / target) * 100}%` }}
                                />
                            ))}
                        </div>
                        <div className="mt-1 text-xs text-neutral-400 font-medium text-center tabular-nums">
                            {progress.currentValue} / {target} {goal.unit || ''}
                        </div>
                    </div>
                ) : (
                    <>
                        <MiniHeatmap
                            data={historyData}
                            goalType={goal.type as 'cumulative' | 'frequency'}
                            targetValue={target}
                        />
                        <div className="mt-1.5">
                            <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                                        progress.percent >= 100
                                            ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                            : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, progress.percent)}%` }}
                                />
                            </div>
                            <div className="mt-1 text-xs text-neutral-400 font-medium text-center tabular-nums">
                                {progress.currentValue} / {target} {goal.unit || ''}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/**
 * GoalGridCard — renders compact row for onetime/frequency, full card for cumulative.
 */
export const GoalGridCard: React.FC<GoalGridCardProps> = (props) => {
    const { goal } = props.goalWithProgress;

    if (goal.type === 'cumulative') {
        return <CumulativeGoalCard {...props} />;
    }

    return <CompactGoalCard {...props} />;
};
