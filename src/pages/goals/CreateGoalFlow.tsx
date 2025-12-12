import React, { useState } from 'react';
import { CreateGoalPage } from './CreateGoalPage';
import { CreateGoalLinkHabits } from './CreateGoalLinkHabits';
import { createGoal } from '../../lib/persistenceClient';
import { invalidateAllGoalCaches } from '../../lib/goalDataCache';
import { Loader2, AlertCircle } from 'lucide-react';

interface CreateGoalFlowProps {
    onComplete?: () => void;
    onCancel?: () => void;
}

type Step = 'details' | 'habits';

interface GoalDraft {
    title: string;
    type: 'cumulative' | 'frequency' | 'onetime';
    targetValue: number;
    unit?: string;
    deadline?: string;
}

export const CreateGoalFlow: React.FC<CreateGoalFlowProps> = ({
    onComplete,
    onCancel,
}) => {
    const [currentStep, setCurrentStep] = useState<Step>('details');
    const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStep1Next = (data: GoalDraft) => {
        setGoalDraft(data);
        setCurrentStep('habits');
        setError(null);
    };

    const handleStep2Back = () => {
        setCurrentStep('details');
        setError(null);
    };

    const handleStep2Next = (habitIds: string[]) => {
        // Trigger final submission
        handleFinalSubmit(habitIds);
    };

    const handleFinalSubmit = async (habitIds: string[]) => {
        if (!goalDraft) {
            setError('Goal data is missing. Please go back and complete Step 1.');
            return;
        }

        // Validate required fields
        if (!goalDraft.title.trim()) {
            setError('Goal title is required.');
            return;
        }

        if (goalDraft.type === 'onetime') {
            if (!goalDraft.deadline) {
                setError('Event date is required for One-Time goals.');
                return;
            }
        } else {
            if (goalDraft.targetValue <= 0) {
                setError('Target value must be greater than 0.');
                return;
            }
        }

        if (!habitIds || habitIds.length === 0) {
            setError('At least one habit must be selected.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createGoal({
                title: goalDraft.title,
                type: goalDraft.type,
                targetValue: goalDraft.targetValue,
                unit: goalDraft.unit,
                linkedHabitIds: habitIds,
                deadline: goalDraft.deadline,
            });

            // Invalidate all goal caches to ensure fresh data on navigation
            invalidateAllGoalCaches();

            // Success - redirect to goals page
            if (onComplete) {
                onComplete();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create goal';
            setError(errorMessage);
            console.error('Error creating goal:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (currentStep === 'details') {
        return (
            <div className="w-full">
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="mb-4 text-neutral-400 hover:text-white transition-colors"
                    >
                        ← Cancel
                    </button>
                )}
                <CreateGoalPage onNext={handleStep1Next} />
            </div>
        );
    }

    return (
        <div className="w-full">
            {onCancel && (
                <button
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="mb-4 text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                >
                    ← Cancel
                </button>
            )}

            {/* Error Display */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <div className="text-red-400 font-medium mb-1">Error</div>
                        <div className="text-red-300 text-sm">{error}</div>
                    </div>
                </div>
            )}

            <CreateGoalLinkHabits
                goalDraft={goalDraft!}
                onNext={handleStep2Next}
                onBack={handleStep2Back}
                isSubmitting={isSubmitting}
            />

            {/* Loading Overlay */}
            {isSubmitting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4">
                        <Loader2 className="text-emerald-500 animate-spin" size={32} />
                        <div className="text-white font-medium">Creating goal...</div>
                        <div className="text-neutral-400 text-sm">Please wait</div>
                    </div>
                </div>
            )}
        </div>
    );
};
