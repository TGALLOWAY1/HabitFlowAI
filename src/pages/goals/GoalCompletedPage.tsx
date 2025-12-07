import React, { useEffect, useState } from 'react';
import { Trophy, Sparkles, ArrowLeft, Award } from 'lucide-react';
import { useGoalDetail } from '../../lib/useGoalDetail';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface GoalCompletedPageProps {
    goalId: string;
    onBack?: () => void;
}

/**
 * Celebration page shown when a goal is completed.
 * Displays confetti animation and goal completion details.
 */
export const GoalCompletedPage: React.FC<GoalCompletedPageProps> = ({ goalId, onBack }) => {
    const { data, loading } = useGoalDetail(goalId);
    const [showConfetti, setShowConfetti] = useState(true);

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
    const completedDate = goal.completedAt ? format(parseISO(goal.completedAt), 'MMMM d, yyyy') : '';

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

            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-6 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={18} />
                    Back to Goals
                </button>
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
                    Goal Completed!
                </h1>
                <h2 className="text-2xl sm:text-3xl font-semibold text-emerald-400 mb-6">
                    {goal.title}
                </h2>

                {/* Completion Date */}
                {completedDate && (
                    <p className="text-neutral-400 text-lg mb-8">
                        Completed on {completedDate}
                    </p>
                )}

                {/* Progress Summary */}
                <div className="max-w-md mx-auto mb-8 p-6 bg-neutral-800/50 border border-white/10 rounded-lg">
                    <div className="text-neutral-300 text-sm mb-2">Final Progress</div>
                    <div className="text-3xl font-bold text-emerald-400">
                        {data.progress.currentValue} / {goal.targetValue}
                        {goal.unit && ` ${goal.unit}`}
                    </div>
                    <div className="mt-4 w-full bg-neutral-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors"
                    >
                        <Award size={18} />
                        View in Win Archive
                    </button>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-lg transition-colors"
                        >
                            Back to Goals
                        </button>
                    )}
                </div>
            </div>

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
