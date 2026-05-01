import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CelebratoryBadgeIcon } from './CelebratoryBadgeIcon';
import type { PendingMilestone } from '../../store/GoalCompletionContext';

interface MilestoneCelebrationModalProps {
    milestone: PendingMilestone;
    onDismiss: () => void;
}

/**
 * Full-screen celebration shown when a user crosses an intermediate milestone.
 * Mirrors the visual language of GoalCompletedPage (badge + sparkles + confetti)
 * but tailored to a single milestone — no Extend/Repeat actions, just dismiss.
 */
export const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
    milestone,
    onDismiss,
}) => {
    const [showConfetti, setShowConfetti] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setShowConfetti(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-hidden">
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none">
                    {Array.from({ length: 50 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute milestone-confetti-particle"
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

            <button
                onClick={onDismiss}
                aria-label="Dismiss celebration"
                className="absolute top-6 right-6 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-300 hover:text-white"
            >
                <X size={24} />
            </button>

            <div className="relative w-full max-w-lg mx-auto px-6 text-center">
                <div className="mb-8 flex justify-center">
                    <div className="relative">
                        <div
                            className="w-32 h-32 animate-bounce"
                            style={{ filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.4))' }}
                        >
                            <CelebratoryBadgeIcon
                                goalId={milestone.goalId}
                                badgeImageUrl={milestone.badgeImageUrl}
                                size={64}
                            />
                        </div>
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

                <p className="text-sm uppercase tracking-widest text-emerald-400 font-semibold mb-3">
                    Milestone Reached
                </p>
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">
                    {milestone.value}
                    {milestone.unit ? ` ${milestone.unit}` : ''}
                </h1>
                <p className="text-lg text-neutral-300 mb-8">
                    on your way to <span className="text-emerald-400 font-semibold">{milestone.goalTitle}</span>
                </p>

                <button
                    onClick={onDismiss}
                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-semibold rounded-lg transition-colors"
                >
                    Keep Going
                </button>
            </div>

            <style>{`
                @keyframes milestone-confetti-fall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100dvh) rotate(720deg); opacity: 0; }
                }
                .milestone-confetti-particle {
                    animation: milestone-confetti-fall linear forwards;
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
};
