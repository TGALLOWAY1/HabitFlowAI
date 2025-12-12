import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { Routine } from '../models/persistenceTypes';
import { submitRoutine } from '../lib/persistenceClient'; // Function to be created
import { useHabitStore } from '../store/HabitContext';

interface RoutineRunnerModalProps {
    isOpen: boolean;
    routine?: Routine;
    onClose: () => void;
}

export const RoutineRunnerModal: React.FC<RoutineRunnerModalProps> = ({
    isOpen,
    routine,
    onClose,
}) => {
    const { habits, refreshDayLogs } = useHabitStore();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isCompletionView, setIsCompletionView] = useState(false);
    const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    const steps = routine?.steps || [];
    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex === steps.length - 1;

    // Reset state when modal opens/closes or routine changes
    useEffect(() => {
        if (isOpen && routine) {
            setCurrentStepIndex(0);
            setIsCompletionView(false);
            // Default select all linked habits
            setSelectedHabitIds(new Set(routine.linkedHabitIds || []));
        }
    }, [isOpen, routine]);

    // Timer logic could go here (useEffect with Interval)

    const handleNext = () => {
        if (isLastStep) {
            setIsCompletionView(true);
        } else {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (isCompletionView) {
            setIsCompletionView(false);
        } else if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const toggleHabitSelection = (habitId: string) => {
        setSelectedHabitIds(prev => {
            const next = new Set(prev);
            if (next.has(habitId)) {
                next.delete(habitId);
            } else {
                next.add(habitId);
            }
            return next;
        });
    };

    const handleFinish = async () => {
        if (!routine) return;
        setSubmitting(true);
        try {
            await submitRoutine(routine.id, {
                habitIdsToComplete: Array.from(selectedHabitIds),
                submittedAt: new Date().toISOString()
            });
            await refreshDayLogs();
            onClose();
        } catch (error) {
            console.error('Failed to submit routine:', error);
            // Could add error state/display here
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !routine) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-4xl h-[80vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">

                {/* Header / Progress Bar */}
                <div className="absolute top-0 left-0 w-full z-10">
                    {!isCompletionView && (
                        <div className="h-1 bg-white/10 w-full">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
                        <h2 className="text-sm font-medium text-white/70 uppercase tracking-wider">
                            {isCompletionView ? 'Routine Complete' : routine.title}
                        </h2>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-8 mt-8">
                    {isCompletionView ? (
                        <div className="max-w-md w-full space-y-8 animate-fade-in-up">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <h3 className="text-3xl font-bold text-white">All Done!</h3>
                                <p className="text-neutral-400">Great job completing your routine.</p>
                            </div>

                            {(routine.linkedHabitIds?.length ?? 0) > 0 && (
                                <div className="bg-neutral-800/50 rounded-xl p-6 border border-white/5 space-y-4">
                                    <h4 className="text-sm font-medium text-white/70 uppercase tracking-wider mb-2">
                                        Mark linked habits as complete?
                                    </h4>
                                    <div className="space-y-2">
                                        {routine.linkedHabitIds!.map(habitId => {
                                            const habit = habits.find(h => h.id === habitId);
                                            if (!habit) return null;
                                            const isSelected = selectedHabitIds.has(habitId);
                                            return (
                                                <div
                                                    key={habitId}
                                                    onClick={() => toggleHabitSelection(habitId)}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                                        ? 'bg-emerald-500/10 border-emerald-500/50'
                                                        : 'bg-neutral-800 border-white/5 hover:bg-neutral-700'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 text-neutral-900' : 'bg-neutral-700'
                                                        }`}>
                                                        {isSelected && <Check size={14} strokeWidth={3} />}
                                                    </div>
                                                    <span className={isSelected ? 'text-white' : 'text-neutral-400'}>
                                                        {habit.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="max-w-3xl w-full flex flex-col md:flex-row gap-8 items-center md:items-start animate-fade-in">
                            {/* Step Image */}
                            {currentStep?.imageUrl && (
                                <div className="w-full md:w-1/2 aspect-video bg-neutral-800 rounded-xl overflow-hidden shadow-lg border border-white/5">
                                    <img
                                        src={currentStep.imageUrl}
                                        alt={currentStep.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            {/* Step Details */}
                            <div className={`w-full ${currentStep?.imageUrl ? 'md:w-1/2' : 'md:w-full max-w-2xl text-center md:text-left'}`}>
                                <h3 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                                    {currentStep?.title}
                                </h3>
                                {currentStep?.instruction && (
                                    <div className="prose prose-invert prose-lg text-neutral-300">
                                        <p>{currentStep.instruction}</p>
                                    </div>
                                )}
                                {currentStep?.timerSeconds && (
                                    <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-full text-emerald-400 font-mono">
                                        ⏱️ {Math.floor(currentStep.timerSeconds / 60)}:{(currentStep.timerSeconds % 60).toString().padStart(2, '0')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Controls */}
                <div className="p-6 border-t border-white/10 bg-neutral-900/50 backdrop-blur-md">
                    <div className="flex justify-between items-center max-w-4xl mx-auto w-full">
                        {!isCompletionView ? (
                            <>
                                <button
                                    onClick={handlePrevious}
                                    disabled={currentStepIndex === 0}
                                    className="flex items-center gap-2 px-4 py-2 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                    Back
                                </button>

                                <div className="flex items-center gap-2 text-neutral-500 font-mono text-sm">
                                    {currentStepIndex + 1} / {steps.length}
                                </div>

                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
                                >
                                    {isLastStep ? 'Finish' : 'Next Step'}
                                    {isLastStep ? <Check size={20} /> : <ChevronRight size={20} />}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handlePrevious}
                                    className="flex items-center gap-2 px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                                >
                                    Back to Routine
                                </button>
                                <button
                                    onClick={handleFinish}
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-neutral-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                                >
                                    {submitting ? 'Saving...' : 'Complete Routine'}
                                    <Check size={20} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

