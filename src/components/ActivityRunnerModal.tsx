import React, { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Activity } from '../types';
import { submitActivity, type SubmitActivityResponse } from '../lib/persistenceClient';

type ActivityRunnerMode = 'habit' | 'image' | 'text';

interface ActivityRunnerModalProps {
    isOpen: boolean;
    activity?: Activity;
    onClose: () => void;
}

export const ActivityRunnerModal: React.FC<ActivityRunnerModalProps> = ({
    isOpen,
    activity,
    onClose,
}) => {
    const [mode, setMode] = useState<ActivityRunnerMode>('habit');
    const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitResult, setSubmitResult] = useState<SubmitActivityResponse | null>(null);

    // For Image and Text Views: treat all steps as part of the carousel
    // Only Habit steps contribute to completedStepIds tracking
    const allSteps = activity?.steps ?? [];
    const steps = allSteps; // Alias for consistency with existing code
    const currentStep = steps[currentIndex] ?? null;

    const habitSteps = useMemo(
        () => activity?.steps.filter(step => step.type === 'habit') ?? [],
        [activity]
    );

    const toggleStep = (stepId: string) => {
        setCompletedStepIds(prev => {
            const next = new Set(prev);
            if (next.has(stepId)) {
                next.delete(stepId);
            } else {
                next.add(stepId);
            }
            return next;
        });
    };

    // Reset all state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCompletedStepIds(new Set());
            setSubmitError(null);
            setSubmitResult(null);
            setMode('habit');
            setCurrentIndex(0);
        }
    }, [isOpen]);

    // Reset currentIndex when activity changes or mode switches to 'image' or 'text'
    useEffect(() => {
        if (mode === 'image' || mode === 'text') {
            setCurrentIndex(0);
        }
    }, [activity, mode]);

    const handleCompleteStep = () => {
        if (currentStep?.type === 'habit' && currentStep.id) {
            setCompletedStepIds(prev => {
                const next = new Set(prev);
                next.add(currentStep.id);
                return next;
            });
        }
        // Move to next step if not at the end (stays on last step if already there)
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handleSkip = () => {
        // Move to next step if not at the end (stays on last step if already there)
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handleSubmitActivity = async () => {
        if (!activity) return;

        setSubmitting(true);
        setSubmitError(null);
        setSubmitResult(null);

        try {
            const result = await submitActivity(activity.id, {
                mode,
                completedStepIds: Array.from(completedStepIds),
                submittedAt: new Date().toISOString(),
            });

            setSubmitResult(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to submit activity';
            setSubmitError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-bold text-white">
                        {activity?.title || 'Activity Runner'}
                    </h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Mode Selector */}
                    <div className="p-6 border-b border-white/10">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('habit')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'habit'
                                        ? 'bg-emerald-500 text-neutral-900'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                }`}
                            >
                                Checklist
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('image')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'image'
                                        ? 'bg-emerald-500 text-neutral-900'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                }`}
                            >
                                Images
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('text')}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    mode === 'text'
                                        ? 'bg-emerald-500 text-neutral-900'
                                        : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                }`}
                            >
                                Text
                            </button>
                        </div>
                    </div>

                    {/* Mode Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {mode === 'habit' && (
                            <div className="space-y-4">
                                {habitSteps.length === 0 ? (
                                    <div className="text-neutral-400 text-center py-12">
                                        This activity has no habit steps; nothing to track in checklist mode.
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            {habitSteps.map((step) => (
                                                <label
                                                    key={step.id}
                                                    className="flex items-center gap-3 p-3 bg-neutral-800/50 border border-white/5 rounded-lg hover:bg-neutral-800/70 transition-colors cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={completedStepIds.has(step.id)}
                                                        onChange={() => toggleStep(step.id)}
                                                        className="w-5 h-5 rounded border-neutral-700 bg-neutral-800 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-white font-medium">{step.title}</div>
                                                        {step.timeEstimateMinutes && (
                                                            <div className="text-sm text-neutral-400 mt-1">
                                                                ~{step.timeEstimateMinutes} min
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="text-sm text-neutral-400 pt-2">
                                            Completed {completedStepIds.size} of {habitSteps.length} habit steps
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {mode === 'image' && (
                            <div className="space-y-6">
                                {steps.length === 0 ? (
                                    <div className="text-neutral-400 text-center py-12">
                                        No steps in this activity.
                                    </div>
                                ) : (
                                    <>
                                        {/* Image Area */}
                                        <div className="w-full aspect-video bg-neutral-800/50 border border-white/5 rounded-lg overflow-hidden flex items-center justify-center">
                                            {currentStep?.imageUrl ? (
                                                <img
                                                    src={currentStep.imageUrl}
                                                    alt={currentStep.title}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-neutral-500 text-center p-8">
                                                    No image for this step
                                                </div>
                                            )}
                                        </div>

                                        {/* Step Info */}
                                        <div className="space-y-2">
                                            <h4 className="text-lg font-semibold text-white">
                                                {currentStep?.title || 'Untitled Step'}
                                            </h4>
                                            {currentStep?.instruction && (
                                                <p className="text-neutral-300">
                                                    {currentStep.instruction}
                                                </p>
                                            )}
                                            {currentStep?.durationSeconds && (
                                                <div className="text-sm text-neutral-400">
                                                    Suggested: {currentStep.durationSeconds} seconds
                                                </div>
                                            )}
                                        </div>

                                        {/* Navigation Buttons */}
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={handleSkip}
                                                className="flex-1 px-4 py-2 bg-neutral-700 text-neutral-300 font-medium rounded-lg hover:bg-neutral-600 transition-colors"
                                            >
                                                Skip
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCompleteStep}
                                                className="flex-1 px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
                                            >
                                                Complete Step
                                            </button>
                                        </div>

                                        {/* End of steps message */}
                                        {currentIndex >= steps.length - 1 && (
                                            <div className="text-center text-neutral-400 text-sm py-2">
                                                End of activity steps
                                            </div>
                                        )}

                                        {/* Summary */}
                                        <div className="text-sm text-neutral-400 pt-2 border-t border-white/5">
                                            Completed {completedStepIds.size} of {habitSteps.length} habit steps
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {mode === 'text' && (
                            <div className="space-y-6">
                                {allSteps.length === 0 ? (
                                    <div className="text-neutral-400 text-center py-12">
                                        No steps in this activity.
                                    </div>
                                ) : (
                                    <>
                                        {/* Centered Card */}
                                        <div className="max-w-2xl mx-auto bg-neutral-800/50 border border-white/5 rounded-lg p-8 space-y-6">
                                            {/* Step Title */}
                                            <h4 className="text-2xl font-bold text-white text-center">
                                                {currentStep?.title || 'Untitled Step'}
                                            </h4>

                                            {/* Instruction */}
                                            {currentStep?.instruction && (
                                                <p className="text-neutral-300 text-center leading-relaxed">
                                                    {currentStep.instruction}
                                                </p>
                                            )}

                                            {/* Habit Step Note */}
                                            {currentStep?.type === 'habit' && (
                                                <div className="text-sm text-emerald-400 text-center">
                                                    This can count toward your tracking.
                                                </div>
                                            )}

                                            {/* Habit Step Toggle */}
                                            {currentStep?.type === 'habit' && currentStep.id && (
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleStep(currentStep.id)}
                                                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                                            completedStepIds.has(currentStep.id)
                                                                ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                                                                : 'bg-emerald-500 text-neutral-900 hover:bg-emerald-400'
                                                        }`}
                                                    >
                                                        {completedStepIds.has(currentStep.id) ? 'Undo' : 'Mark done'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Navigation Buttons */}
                                        <div className="flex gap-3 max-w-2xl mx-auto">
                                            <button
                                                type="button"
                                                onClick={handlePrevious}
                                                disabled={currentIndex === 0}
                                                className="flex-1 px-4 py-2 bg-neutral-700 text-neutral-300 font-medium rounded-lg hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleNext}
                                                disabled={currentIndex >= steps.length - 1}
                                                className="flex-1 px-4 py-2 bg-neutral-700 text-neutral-300 font-medium rounded-lg hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>

                                        {/* Summary */}
                                        <div className="text-sm text-neutral-400 pt-2 border-t border-white/5 text-center">
                                            Completed {completedStepIds.size} of {habitSteps.length} habit steps
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 space-y-3">
                    {/* Error Message */}
                    {submitError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                            {submitError}
                        </div>
                    )}

                    {/* Success Message */}
                    {submitResult && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-400 text-sm">
                            Logged {submitResult.createdOrUpdatedCount} of {submitResult.totalHabitStepsInActivity} habit steps for today.
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitActivity}
                            disabled={!activity || completedStepIds.size === 0 || submitting}
                            className="px-4 py-2 bg-emerald-500 text-neutral-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : 'Submit Activity'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
