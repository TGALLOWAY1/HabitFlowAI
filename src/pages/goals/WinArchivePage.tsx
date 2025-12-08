import React, { useEffect } from 'react';
import { Trophy, Award, Calendar } from 'lucide-react';
import { useCompletedGoals } from '../../lib/useCompletedGoals';
import { format, parseISO } from 'date-fns';
import { Loader2, AlertCircle } from 'lucide-react';

interface WinArchivePageProps {
    onViewGoal?: (goalId: string) => void;
}

export const WinArchivePage: React.FC<WinArchivePageProps> = ({ onViewGoal }) => {
    const { data, loading, error, refetch } = useCompletedGoals();
    
    // Refetch when component becomes visible to ensure deleted goals are removed
    // This handles the case where a goal is deleted while viewing the archive
    useEffect(() => {
        // Refetch on mount to ensure we have the latest data
        // (e.g., if user navigated here after deleting a goal)
        const timer = setTimeout(() => {
            refetch();
        }, 100);
        
        return () => clearTimeout(timer);
    }, [refetch]);

    if (loading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm sm:text-base">Loading your wins...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Your Win Archive</h1>
                    <p className="text-neutral-400 text-sm sm:text-base">
                        Every goal you've ever completed becomes a badge of who you are becoming.
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
            const date = parseISO(completedAt);
            return format(date, 'MMM d, yyyy');
        } catch {
            return completedAt;
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {/* Header */}
            <div className="mb-8 sm:mb-12">
                <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Your Win Archive</h1>
                <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl">
                    Every goal you've ever completed becomes a badge of who you are becoming.
                </p>
            </div>

            {/* Empty State */}
            {!data || data.length === 0 ? (
                <div className="text-center py-16 sm:py-20">
                    <div className="max-w-md mx-auto">
                        <div className="mb-6">
                            <div className="w-20 h-20 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                                <Trophy className="text-neutral-500" size={40} />
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Your archive is empty</h2>
                        <p className="text-neutral-400 text-sm sm:text-base">
                            Your first win will appear here!
                        </p>
                    </div>
                </div>
            ) : (
                /* Badge Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {data.map((goal, index) => (
                        <button
                            key={goal.id}
                            onClick={() => {
                                if (onViewGoal) {
                                    onViewGoal(goal.id);
                                }
                            }}
                            className="group relative bg-neutral-800/50 border border-white/10 rounded-xl p-4 sm:p-6 hover:border-emerald-500/50 hover:bg-neutral-800 transition-all duration-200 text-left animate-fade-in-up"
                            style={{
                                animationDelay: `${index * 50}ms`,
                                animationFillMode: 'both',
                            }}
                        >
                            {/* Badge Image or Fallback */}
                            <div className="mb-4 aspect-square w-full rounded-lg overflow-hidden bg-neutral-900/50 flex items-center justify-center animate-scale-in">
                                {goal.badgeImageUrl ? (
                                    <img
                                        src={goal.badgeImageUrl}
                                        alt={`Badge for ${goal.title}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Award className="text-neutral-600 group-hover:text-emerald-500 transition-colors" size={64} />
                                    </div>
                                )}
                            </div>

                            {/* Goal Title */}
                            <h3 className="text-base sm:text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                                {goal.title}
                            </h3>

                            {/* Completed Date */}
                            {goal.completedAt && (
                                <div className="flex items-center gap-2 text-neutral-400 text-sm">
                                    <Calendar size={14} />
                                    <span>{formatCompletedDate(goal.completedAt)}</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Animations CSS */}
            <style>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fade-in-up {
                    animation: fade-in-up 0.5s ease-out;
                }

                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .animate-scale-in {
                    animation: scale-in 0.4s ease-out;
                }
            `}</style>
        </div>
    );
};
