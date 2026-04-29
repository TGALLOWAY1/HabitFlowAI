import React from 'react';
import { Calendar, Flag, Lock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Goal, GoalTrack } from '../../../types';
import { CelebratoryBadgeIcon } from '../CelebratoryBadgeIcon';

interface TrackAchievementRowProps {
    track: GoalTrack;
    goals: Goal[];
    onViewGoal?: (goalId: string) => void;
    onViewTrack?: (trackId: string) => void;
}

function formatCompletedDate(completedAt: string): string {
    try {
        return format(parseISO(completedAt), 'MMM yyyy');
    } catch {
        return completedAt;
    }
}

export const TrackAchievementRow: React.FC<TrackAchievementRowProps> = ({
    track,
    goals,
    onViewGoal,
    onViewTrack,
}) => {
    const ordered = [...goals].sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0));
    const completedCount = ordered.filter(g => g.completedAt).length;
    const totalCount = ordered.length;
    const fullyComplete = completedCount === totalCount && totalCount > 0;

    const summaryAccent = fullyComplete
        ? 'border-emerald-500/40 bg-emerald-500/5'
        : 'border-amber-500/30 bg-amber-500/5';
    const summaryText = fullyComplete ? 'text-emerald-400' : 'text-amber-400';

    return (
        <div className="mb-4">
            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:-mx-0 sm:px-0">
                <button
                    onClick={() => onViewTrack?.(track.id)}
                    className={`flex-shrink-0 w-32 sm:w-36 rounded-xl border ${summaryAccent} p-3 text-left transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50`}
                >
                    <Flag size={18} className={`${summaryText} mb-2`} />
                    <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">{track.name}</h3>
                    <p className={`mt-2 text-[11px] font-medium ${summaryText}`}>
                        {completedCount} of {totalCount} Completed
                    </p>
                </button>
                {ordered.map((goal) => {
                    const isCompleted = !!goal.completedAt;
                    if (isCompleted) {
                        return (
                            <button
                                key={goal.id}
                                onClick={() => onViewGoal?.(goal.id)}
                                className="group flex-shrink-0 w-28 sm:w-32 bg-neutral-800/40 border border-white/[0.06] rounded-xl overflow-hidden hover:border-emerald-500/40 hover:bg-neutral-800/70 transition-all duration-200 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                            >
                                <div className="relative aspect-square w-full bg-neutral-900/60 overflow-hidden p-3">
                                    <CelebratoryBadgeIcon
                                        goalId={goal.id}
                                        badgeImageUrl={goal.badgeImageUrl}
                                        size={36}
                                        className="group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                                <div className="px-2 py-2">
                                    <h4 className="text-[11px] sm:text-xs font-medium text-neutral-200 line-clamp-2 leading-tight group-hover:text-emerald-400 transition-colors">
                                        {goal.title}
                                    </h4>
                                    {goal.completedAt && (
                                        <div className="flex items-center gap-1 mt-1 text-neutral-500 text-[10px]">
                                            <Calendar size={9} />
                                            <span>{formatCompletedDate(goal.completedAt)}</span>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    }
                    return (
                        <div
                            key={goal.id}
                            className="flex-shrink-0 w-28 sm:w-32 bg-neutral-900/40 border border-white/[0.04] rounded-xl overflow-hidden opacity-60"
                        >
                            <div className="relative aspect-square w-full bg-neutral-900/60 overflow-hidden p-3 flex items-center justify-center">
                                <Lock size={28} className="text-neutral-600" />
                            </div>
                            <div className="px-2 py-2">
                                <h4 className="text-[11px] sm:text-xs font-medium text-neutral-500 line-clamp-2 leading-tight">
                                    {goal.title}
                                </h4>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
