import React from 'react';
import { Trophy, Calendar } from 'lucide-react';
import { useCompletedGoals } from '../../lib/useCompletedGoals';
import { format, parseISO } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';
import { CelebratoryBadgeIcon } from '../../components/goals/CelebratoryBadgeIcon';

interface WinArchivePageProps {
    onViewGoal?: (goalId: string) => void;
}

export const WinArchivePage: React.FC<WinArchivePageProps> = ({ onViewGoal }) => {
    const { data, loading, error } = useCompletedGoals();

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-content-secondary text-sm sm:text-base">Loading your wins...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-content-primary mb-2">Win Archive</h1>
                    <p className="text-content-secondary text-sm sm:text-base">
                        Every goal you've completed becomes a badge of who you are becoming.
                    </p>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <div className="text-red-400 font-medium mb-1">Error</div>
                        <div className="text-red-300 text-sm">{error.message}</div>
                    </div>
                </div>
            </div>
        );
    }

    const formatCompletedDate = (completedAt: string): string => {
        try {
            return format(parseISO(completedAt), 'MMM yyyy');
        } catch {
            return completedAt;
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-content-primary mb-1">Win Archive</h1>
                <p className="text-sm sm:text-base text-content-secondary">
                    Every completed goal becomes a badge of who you are becoming.
                </p>
            </div>

            {/* Empty State */}
            {!data || data.length === 0 ? (
                <div className="text-center py-16 sm:py-20">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 mx-auto bg-surface-1 rounded-full flex items-center justify-center mb-4">
                            <Trophy className="text-amber-400/50" size={32} />
                        </div>
                        <h2 className="text-lg font-semibold text-content-primary mb-2">Your Win Archive Awaits</h2>
                        <p className="text-content-secondary text-sm mb-1">
                            Every completed goal becomes a badge of achievement here.
                        </p>
                        <p className="text-content-muted text-xs">
                            Complete your first goal to see it celebrated in your archive!
                        </p>
                    </div>
                </div>
            ) : (
                /* Gallery Grid — compact cards */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {data.map((goal, index) => (
                        <button
                            key={goal.id}
                            onClick={() => onViewGoal?.(goal.id)}
                            className="group relative bg-surface-1/40 border border-white/[0.06] rounded-xl overflow-hidden hover:border-emerald-500/40 hover:bg-surface-1/70 transition-all duration-200 text-left win-card-animate focus:outline-none focus-visible:ring-2 focus-visible:ring-focus/50"
                            style={{
                                animationDelay: `${index * 40}ms`,
                                animationFillMode: 'both',
                            }}
                        >
                            {/* Badge icon area — square aspect */}
                            <div className="relative aspect-square w-full bg-surface-0/60 overflow-hidden p-4">
                                <CelebratoryBadgeIcon
                                    goalId={goal.id}
                                    badgeImageUrl={goal.badgeImageUrl}
                                    size={44}
                                    className="group-hover:scale-105 transition-transform duration-300"
                                />
                            </div>

                            {/* Info — compact */}
                            <div className="px-2.5 py-2">
                                <h3 className="text-xs sm:text-sm font-medium text-content-primary line-clamp-2 leading-tight group-hover:text-accent-contrast transition-colors duration-200">
                                    {goal.title}
                                </h3>
                                {goal.completedAt && (
                                    <div className="flex items-center gap-1 mt-1 text-content-muted text-[10px] sm:text-xs">
                                        <Calendar size={10} />
                                        <span>{formatCompletedDate(goal.completedAt)}</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes win-card-enter {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(0.97);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .win-card-animate {
                    animation: win-card-enter 0.35s ease-out;
                }
            `}</style>
        </div>
    );
};
