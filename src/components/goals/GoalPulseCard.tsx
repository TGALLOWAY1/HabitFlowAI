import React, { useMemo } from 'react';
import type { GoalWithProgress } from '../../types';
import { format, isPast, isToday, isTomorrow, isFuture, differenceInDays } from 'date-fns';

interface GoalPulseCardProps {
    goalWithProgress: GoalWithProgress;
    onClick: () => void;
}

export const GoalPulseCard: React.FC<GoalPulseCardProps> = ({ goalWithProgress, onClick }) => {
    const { goal, progress } = goalWithProgress;
    const isCumulative = goal.type === 'cumulative' || goal.type === 'frequency';

    // Helper to format deadline for one-time goals
    const deadlineLabel = useMemo(() => {
        if (!goal.deadline) return 'Pending';

        // Use deadline string directly (e.g. "2023-12-25" or "HH:mm")
        // If it's a date string YYYY-MM-DD
        const deadlineDate = new Date(goal.deadline);
        // Check if valid date
        if (isNaN(deadlineDate.getTime())) return 'Pending';

        if (isToday(deadlineDate)) return 'Due Today';
        if (isTomorrow(deadlineDate)) return 'Due Tomorrow';

        if (isPast(deadlineDate)) return 'Overdue';

        return `Due ${format(deadlineDate, 'MMM d')}`;
    }, [goal.deadline]);

    // Determine if goal has upcoming deadline and status label
    const deadlineInfo = useMemo(() => {
        if (!goal.deadline || goal.completedAt) return null;

        const deadlineDate = new Date(goal.deadline);
        if (isNaN(deadlineDate.getTime())) return null;

        if (isPast(deadlineDate)) return null; // Don't show label for overdue

        if (isFuture(deadlineDate)) {
            const daysUntil = differenceInDays(deadlineDate, new Date());
            // "Upcoming" for goals within 7 days, "Preparing" for goals 7-30 days away
            if (daysUntil <= 7) {
                return { label: 'Upcoming', daysUntil };
            } else if (daysUntil <= 30) {
                return { label: 'Preparing', daysUntil };
            }
        }

        return null;
    }, [goal.deadline, goal.completedAt]);

    // Determine if goal should have subtle emphasis (has deadline and is upcoming)
    const hasUpcomingDeadline = deadlineInfo !== null;
    const emphasisClass = hasUpcomingDeadline
        ? 'border-emerald-500/20 bg-neutral-900/60'
        : 'border-white/5 bg-neutral-900/50';

    return (
        <button
            onClick={onClick}
            className={`group w-full text-left ${emphasisClass} hover:bg-neutral-800 border hover:border-white/10 rounded-xl p-3 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full`}
        >
            <div className="flex items-start justify-between w-full mb-2">
                <div className="flex-1 min-w-0 pr-2">
                    <h4 className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">
                        {goal.title}
                    </h4>
                    {/* Optional "Upcoming" / "Preparing" label */}
                    {deadlineInfo && (
                        <div className="text-[10px] text-emerald-400/80 font-medium mt-0.5">
                            {deadlineInfo.label}
                        </div>
                    )}
                </div>

                {/* One-Time Goal Status / Cumulative Value */}
                {isCumulative ? (
                    <span className="text-xs font-mono text-neutral-500 group-hover:text-neutral-400 whitespace-nowrap">
                        {Math.round(progress.percent)}%
                    </span>
                ) : (
                    <span className="text-[10px] uppercase tracking-wide font-medium text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded border border-white/5">
                        {deadlineLabel}
                    </span>
                )}
            </div>

            {/* Progress Bar (Only for Cumulative/Frequency) */}
            {isCumulative && (
                <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500/80 transition-all duration-500"
                        style={{ width: `${Math.min(100, progress.percent)}%` }}
                    />
                </div>
            )}

            {/* One-Time Goal Extra Context (Optional, keep minimal) */}
            {!isCumulative && (
                <div className="text-xs text-neutral-600 truncate">
                    {goal.completedAt ? 'Completed' : 'One-time goal'}
                </div>
            )}
        </button>
    );
};
