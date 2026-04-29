import React from 'react';
import { Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Goal } from '../../../types';
import { CelebratoryBadgeIcon } from '../CelebratoryBadgeIcon';

interface SingleAchievementCardProps {
    goal: Goal;
    onClick?: (goalId: string) => void;
    animationDelayMs?: number;
}

function formatCompletedDate(completedAt: string): string {
    try {
        return format(parseISO(completedAt), 'MMM yyyy');
    } catch {
        return completedAt;
    }
}

export const SingleAchievementCard: React.FC<SingleAchievementCardProps> = ({
    goal,
    onClick,
    animationDelayMs,
}) => {
    return (
        <button
            onClick={() => onClick?.(goal.id)}
            className="group relative bg-neutral-800/40 border border-white/[0.06] rounded-xl overflow-hidden hover:border-emerald-500/40 hover:bg-neutral-800/70 transition-all duration-200 text-left win-card-animate focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            style={animationDelayMs !== undefined ? {
                animationDelay: `${animationDelayMs}ms`,
                animationFillMode: 'both',
            } : undefined}
        >
            <div className="relative aspect-square w-full bg-neutral-900/60 overflow-hidden p-4">
                <CelebratoryBadgeIcon
                    goalId={goal.id}
                    badgeImageUrl={goal.badgeImageUrl}
                    size={44}
                    className="group-hover:scale-105 transition-transform duration-300"
                />
            </div>
            <div className="px-2.5 py-2">
                <h3 className="text-xs sm:text-sm font-medium text-neutral-200 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors duration-200">
                    {goal.title}
                </h3>
                {goal.completedAt && (
                    <div className="flex items-center gap-1 mt-1 text-neutral-500 text-[10px] sm:text-xs">
                        <Calendar size={10} />
                        <span>{formatCompletedDate(goal.completedAt)}</span>
                    </div>
                )}
            </div>
        </button>
    );
};
