import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Play, Pause, RotateCcw } from 'lucide-react';
import type { Routine } from '../models/persistenceTypes';
import { submitRoutine } from '../lib/persistenceClient';
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
    const { refreshDayLogs } = useHabitStore();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isCompletionView, setIsCompletionView] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Timer State
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const steps = routine?.steps || [];
    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex === steps.length - 1;

    // Reset state when modal opens/closes or routine changes
    useEffect(() => {
        if (isOpen && routine) {
            setCurrentStepIndex(0);
            setIsCompletionView(false);
        }
    }, [isOpen, routine]);

    // Initialize Timer when step changes
    useEffect(() => {
        if (currentStep?.timerSeconds) {
            setTimeLeft(currentStep.timerSeconds);
            setIsTimerRunning(false); // Wait for user to start
        } else {
            setTimeLeft(null);
            setIsTimerRunning(false);
        }
    }, [currentStepIndex, currentStep]);

    // Timer Logic
    useEffect(() => {
        if (isTimerRunning && timeLeft !== null && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev === null || prev <= 0) {
                        setIsTimerRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isTimerRunning, timeLeft]);


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

    const handleFinish = async (logHabits: boolean = false) => {
        if (!routine) return;
        setSubmitting(true);
        try {
            await submitRoutine(routine.id, {
                submittedAt: new Date().toISOString(),
                // Only include habitIdsToComplete if user explicitly chooses to log habits
                habitIdsToComplete: logHabits ? routine.linkedHabitIds : undefined,
            });
            await refreshDayLogs();
            onClose();
        } catch (error) {
            console.error('Failed to submit routine:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
    const resetTimer = () => {
        if (currentStep?.timerSeconds) {
            setTimeLeft(currentStep.timerSeconds);
            setIsTimerRunning(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen || !routine) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-4xl h-[85vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">

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
                <div className="flex-1 overflow-y-auto flex flex-col items-center justify-between p-8 pt-16 mt-4">
                    {isCompletionView ? (
                        <div className="max-w-md w-full space-y-8 animate-fade-in-up my-auto">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <h3 className="text-3xl font-bold text-white">All Done!</h3>
                                <p className="text-neutral-400">Great job completing your routine.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-2xl w-full flex flex-col items-center gap-6 animate-fade-in h-full">

                            {/* TOP: Timer & Title */}
                            <div className="text-center space-y-4 w-full">
                                {timeLeft !== null && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="text-6xl font-mono font-bold text-emerald-400 tabular-nums tracking-tight">
                                            {formatTime(timeLeft)}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={toggleTimer}
                                                className="px-6 py-2 bg-neutral-800 rounded-full text-white hover:bg-neutral-700 transition-colors flex items-center gap-2 font-medium"
                                            >
                                                {isTimerRunning ? (
                                                    <><Pause size={18} fill="currentColor" /> Pause</>
                                                ) : (
                                                    <><Play size={18} fill="currentColor" /> Start</>
                                                )}
                                            </button>
                                            <button
                                                onClick={resetTimer}
                                                className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
                                                title="Reset Timer"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                                    {currentStep?.title}
                                </h3>
                            </div>

                            {/* CENTER: Visual (Image or Placeholder) */}
                            <div className={`w-full aspect-video max-h-[40vh] bg-neutral-800/50 rounded-2xl overflow-hidden shadow-lg border border-white/5 flex items-center justify-center relative flex-shrink-0 ${!currentStep?.imageUrl ? 'bg-neutral-900 border-dashed opacity-50' : ''}`}>
                                {currentStep?.imageUrl ? (
                                    <img
                                        src={currentStep.imageUrl}
                                        alt={currentStep.title}
                                        className="w-full h-full object-contain bg-black/40 backdrop-blur-sm"
                                    />
                                ) : (
                                    <div className="text-neutral-700 text-6xl font-black opacity-20 select-none">
                                        {currentStepIndex + 1}
                                    </div>
                                )}
                            </div>

                            {/* BOTTOM: Instructions */}
                            {currentStep?.instruction && (
                                <div className="w-full bg-neutral-800/50 rounded-xl p-5 border border-white/5 text-center">
                                    <p className="text-neutral-200 text-lg whitespace-pre-wrap leading-relaxed">
                                        {currentStep.instruction}
                                    </p>
                                </div>
                            )}
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
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleFinish(false)}
                                        disabled={submitting}
                                        className="flex items-center gap-2 px-6 py-3 bg-neutral-700 text-white font-semibold rounded-lg hover:bg-neutral-600 transition-colors"
                                    >
                                        {submitting ? 'Saving...' : 'Complete Routine'}
                                    </button>
                                    {routine.linkedHabitIds && routine.linkedHabitIds.length > 0 && (
                                        <button
                                            onClick={() => handleFinish(true)}
                                            disabled={submitting}
                                            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-neutral-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                                        >
                                            {submitting ? 'Saving...' : 'Complete + Log Habits'}
                                            <Check size={20} />
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};
