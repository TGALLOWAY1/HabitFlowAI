import React from 'react';
import { Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CelebratoryBadgeIcon } from '../CelebratoryBadgeIcon';
import { MilestoneNodes } from './MilestoneNodes';
import type { IterationChain } from '../../../utils/goalIterationChains';

interface ProgressiveAchievementCardProps {
    chain: IterationChain;
    onClick?: (goalId: string) => void;
    animationDelayMs?: number;
    /**
     * Optional parallel array of completion flags for each node in `chain.targets`.
     * Used by milestone-bearing goals where some milestones may not yet be reached.
     * For iteration chains (the original use case), omit this — all nodes render
     * as completed.
     */
    completed?: boolean[];
}

function formatCompletedDate(completedAt: string): string {
    try {
        return format(parseISO(completedAt), 'MMM yyyy');
    } catch {
        return completedAt;
    }
}

export const ProgressiveAchievementCard: React.FC<ProgressiveAchievementCardProps> = ({
    chain,
    onClick,
    animationDelayMs,
    completed,
}) => {
    const { head, targets } = chain;
    const milestoneLabel = head.targetValue
        ? `Milestone: ${head.targetValue}${head.unit ? ` ${head.unit}` : ''}`
        : 'Milestone reached';

    return (
        <button
            onClick={() => onClick?.(head.id)}
            className="group bg-neutral-800/40 border border-white/[0.06] rounded-xl p-3 sm:p-4 text-left hover:border-emerald-500/40 hover:bg-neutral-800/70 transition-all duration-200 win-card-animate focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 w-full"
            style={animationDelayMs !== undefined ? {
                animationDelay: `${animationDelayMs}ms`,
                animationFillMode: 'both',
            } : undefined}
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0">
                    <CelebratoryBadgeIcon
                        goalId={head.id}
                        badgeImageUrl={head.badgeImageUrl}
                        size={36}
                        className="group-hover:scale-105 transition-transform duration-300"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-100 line-clamp-1 leading-tight group-hover:text-emerald-400 transition-colors">
                        {head.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-neutral-400 mt-0.5 line-clamp-1">
                        {milestoneLabel}
                    </p>
                </div>
            </div>
            <div className="px-1 sm:px-2">
                <MilestoneNodes targets={targets} completed={completed} />
            </div>
            {head.completedAt && (
                <div className="flex items-center justify-end gap-1 mt-3 text-neutral-500 text-[10px] sm:text-xs">
                    <Calendar size={10} />
                    <span>Completed {formatCompletedDate(head.completedAt)}</span>
                </div>
            )}
        </button>
    );
};
