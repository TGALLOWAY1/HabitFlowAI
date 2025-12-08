import React, { useEffect, useState, useMemo } from 'react';
import { Trophy, Sparkles, Award, Image } from 'lucide-react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { BadgeUploadModal } from '../../components/goals/BadgeUploadModal';

interface GoalCompletedPageProps {
    goalId: string;
    onBack?: () => void;
    onAddBadge?: (goalId: string) => void;
    onViewGoalDetail?: (goalId: string) => void;
}

/**
 * Celebration page shown when a goal is completed.
 * Displays confetti animation and goal completion details.
 * This is the first screen users see when they finish a goal.
 */
export const GoalCompletedPage: React.FC<GoalCompletedPageProps> = ({ 
    goalId, 
    onBack, 
    onAddBadge,
    onViewGoalDetail 
}) => {
    const { data, loading, refetch } = useGoalDetail(goalId);
    const [showConfetti, setShowConfetti] = useState(true);
    const [showBadgeModal, setShowBadgeModal] = useState(false);

    // Hide confetti after animation completes
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowConfetti(false);
        }, 3000); // Hide after 3 seconds
        return () => clearTimeout(timer);
    }, []);

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="flex flex-col items-center gap-4 py-12">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm">Loading...</div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="text-center py-12 text-neutral-500">
                    <p>Goal not found</p>
                </div>
            </div>
        );
    }

    const { goal } = data;
    
    // Calculate time span
    const timeSpan = useMemo(() => {
        if (!goal.createdAt || !goal.completedAt) return null;
        try {
            const startDate = parseISO(goal.createdAt);
            const endDate = parseISO(goal.completedAt);
            const days = differenceInDays(endDate, startDate);
            return days;
        } catch {
            return null;
        }
    }, [goal.createdAt, goal.completedAt]);

    // Format dates for display
    const createdDateFormatted = goal.createdAt 
        ? format(parseISO(goal.createdAt), 'MMM d, yyyy') 
        : '';
    const completedDateFormatted = goal.completedAt 
        ? format(parseISO(goal.completedAt), 'MMM d, yyyy') 
        : '';

    // Get habit count
    const habitCount = goal.linkedHabitIds.length;

    return (
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative overflow-hidden">
            {/* Confetti Animation */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50">
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute confetti-particle"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: '-10px',
                                width: `${Math.random() * 10 + 5}px`,
                                height: `${Math.random() * 10 + 5}px`,
                                backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#a855f7'][
                                    Math.floor(Math.random() * 5)
                                ],
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${Math.random() * 2 + 2}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Main Content */}
            <div className="text-center py-12 sm:py-16">
                {/* Trophy Icon with Animation */}
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <Trophy
                            className="text-yellow-400 animate-bounce"
                            size={120}
                            style={{
                                filter: 'drop-shadow(0 0 20px rgba(250, 204, 21, 0.5))',
                            }}
                        />
                        <Sparkles
                            className="absolute -top-4 -right-4 text-emerald-400 animate-pulse"
                            size={40}
                        />
                        <Sparkles
                            className="absolute -bottom-4 -left-4 text-blue-400 animate-pulse"
                            size={40}
                            style={{ animationDelay: '0.5s' }}
                        />
                    </div>
                </div>

                {/* Celebration Message */}
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 animate-fade-in">
                    You completed your goal!
                </h1>
                <h2 className="text-2xl sm:text-3xl font-semibold text-emerald-400 mb-8">
                    {goal.title}
                </h2>

                {/* Summary Stats */}
                <div className="max-w-lg mx-auto mb-10 space-y-4">
                    {/* Target Value and Unit */}
                    <div className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Target</div>
                        <div className="text-2xl font-bold text-white">
                            {goal.targetValue}
                            {goal.unit && <span className="text-emerald-400"> {goal.unit}</span>}
                        </div>
                    </div>

                    {/* Time Span */}
                    {timeSpan !== null && createdDateFormatted && completedDateFormatted && (
                        <div className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                            <div className="text-neutral-400 text-sm mb-1">Time Span</div>
                            <div className="text-lg font-semibold text-white">
                                {timeSpan === 0 ? 'Same day' : `${timeSpan} ${timeSpan === 1 ? 'day' : 'days'}`}
                            </div>
                            <div className="text-neutral-400 text-xs mt-1">
                                {createdDateFormatted} → {completedDateFormatted}
                            </div>
                        </div>
                    )}

                    {/* Habit Count */}
                    <div className="p-4 bg-neutral-800/50 border border-white/10 rounded-lg">
                        <div className="text-neutral-400 text-sm mb-1">Habits Involved</div>
                        <div className="text-2xl font-bold text-white">
                            {habitCount} {habitCount === 1 ? 'habit' : 'habits'}
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                    {/* Primary CTA: Add your badge */}
                    <button
                        onClick={() => setShowBadgeModal(true)}
                        className="flex items-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold rounded-lg transition-colors text-lg"
                    >
                        <Image size={20} />
                        Add your badge
                    </button>
                    
                    {/* Secondary CTA: Skip for now */}
                    <button
                        onClick={() => {
                            if (onViewGoalDetail) {
                                onViewGoalDetail(goalId);
                            } else if (onBack) {
                                onBack();
                            }
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg transition-colors"
                    >
                        Skip for now
                    </button>
                </div>
            </div>

            {/* Badge Upload Modal */}
            <BadgeUploadModal
                isOpen={showBadgeModal}
                onClose={() => setShowBadgeModal(false)}
                goalId={goalId}
                onSuccess={(badgeImageUrl) => {
                    // Refetch goal data to get updated badge (allows badge replacement)
                    refetch();
                    
                    // Auto-redirect to Win Archive after 1 second
                    setTimeout(() => {
                        if (onAddBadge) {
                            onAddBadge(goalId);
                        }
                    }, 1000);
                }}
            />

            {/* Confetti CSS Animation */}
            <style>{`
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }

                .confetti-particle {
                    animation: confetti-fall linear forwards;
                    border-radius: 2px;
                }

                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.6s ease-out;
                }
            `}</style>
        </div>
    );
};
