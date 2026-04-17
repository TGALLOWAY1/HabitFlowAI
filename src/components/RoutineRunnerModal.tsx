import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Play, Pause, RotateCcw, CircleCheck, Forward } from 'lucide-react';
import type { Routine } from '../models/persistenceTypes';
import { submitRoutine, batchCreateEntries } from '../lib/persistenceClient';
import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useToast } from './Toast';
import { CompletedHabitsModal } from './CompletedHabitsModal';
import { resolveSteps, resolveVariant } from '../lib/routineVariantUtils';
import { useStepTimer } from '../hooks/useStepTimer';
import { TrackingFieldInput } from './TrackingFieldInput';

interface RoutineRunnerModalProps {
    isOpen: boolean;
    routine?: Routine;
    variantId?: string;
    onClose: () => void;
}

export const RoutineRunnerModal: React.FC<RoutineRunnerModalProps> = ({
    isOpen,
    routine,
    variantId,
    onClose,
}) => {
    const { refreshDayLogs, habits } = useHabitStore();
    const {
        selectRoutine, startRoutine, exitRoutine,
        stepStates, setStepState, startedAt,
        stepTrackingData, stepTimingData,
        setStepTrackingValue, recordStepTime,
    } = useRoutineStore();
    const { showToast } = useToast();

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isCompletionView, setIsCompletionView] = useState(false);
    const [showCompletedHabitsModal, setShowCompletedHabitsModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [loggingHabits, setLoggingHabits] = useState(false);

    const getHabitName = (habitId: string) => habits.find((h) => h.id === habitId)?.name ?? 'Habit';

    const steps = routine ? resolveSteps(routine, variantId) : [];
    const currentStep = steps[currentStepIndex];
    const isLastStep = currentStepIndex === steps.length - 1;
    const activeVariant = routine ? resolveVariant(routine, variantId) : undefined;
    const variantLinkedHabitIds = activeVariant?.linkedHabitIds || routine?.linkedHabitIds || [];

    // Timer hook (handles both countdown and stopwatch)
    const timer = useStepTimer(currentStep, currentStepIndex);

    // Track previous step index to record timing on step change
    const prevStepIndexRef = useRef(currentStepIndex);

    // Sync execution state with context: init stepStates when runner opens
    useEffect(() => {
        if (isOpen && routine) {
            selectRoutine(routine.id);
            startRoutine(variantId);
        }
    }, [isOpen, routine?.id, variantId]);

    const handleClose = () => {
        exitRoutine();
        onClose();
    };

    // Reset local UI state when modal opens/closes or routine changes
    useEffect(() => {
        if (isOpen && routine) {
            setCurrentStepIndex(0);
            setIsCompletionView(false);
        }
    }, [isOpen, routine]);

    // Record step timing when navigating away from a step (only for steps with timers)
    const captureStepTime = () => {
        const prevStep = steps[prevStepIndexRef.current];
        if (prevStep && timer.mode !== 'none' && timer.elapsedSeconds > 0) {
            recordStepTime(prevStep.id, timer.elapsedSeconds);
        }
    };

    const handleNext = () => {
        captureStepTime();
        if (isLastStep) {
            setIsCompletionView(true);
        } else {
            const nextIndex = currentStepIndex + 1;
            prevStepIndexRef.current = nextIndex;
            setCurrentStepIndex(nextIndex);
        }
    };

    const handlePrevious = () => {
        captureStepTime();
        if (isCompletionView) {
            setIsCompletionView(false);
        } else if (currentStepIndex > 0) {
            const prevIndex = currentStepIndex - 1;
            prevStepIndexRef.current = prevIndex;
            setCurrentStepIndex(prevIndex);
        }
    };

    const handleFinish = async (logHabits: boolean = false) => {
        if (!routine) return;
        setSubmitting(true);
        try {
            // Filter out empty tracking data
            const filteredTrackingData = Object.keys(stepTrackingData).length > 0
                ? Object.fromEntries(
                    Object.entries(stepTrackingData).filter(([, fields]) =>
                        Object.values(fields).some(v => v !== '' && v !== undefined)
                    )
                )
                : undefined;

            const filteredTimingData = Object.keys(stepTimingData).length > 0
                ? stepTimingData
                : undefined;

            await submitRoutine(routine.id, {
                submittedAt: new Date().toISOString(),
                habitIdsToComplete: logHabits ? variantLinkedHabitIds : undefined,
                variantId,
                startedAt: startedAt || undefined,
                stepResults: stepStates,
                stepTrackingData: filteredTrackingData,
                stepTimingData: filteredTimingData,
            });
            await refreshDayLogs();
            exitRoutine();
            onClose();
        } catch (error) {
            console.error('Failed to submit routine:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !routine) return null;

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90dvh] h-[85vh] bg-surface-0 border border-line-subtle rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">

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
                        <h2 className="text-sm font-medium text-content-primary/70 uppercase tracking-wider">
                            {isCompletionView ? 'Routine Complete' : (
                                <>
                                    {routine.title}
                                    {activeVariant && activeVariant.name !== 'Default' && (
                                        <span className="text-purple-400/70 ml-1.5">· {activeVariant.name}</span>
                                    )}
                                </>
                            )}
                        </h2>
                        <button onClick={handleClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-content-primary/50 hover:text-content-primary transition-colors -mr-2" aria-label="Close">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto modal-scroll flex flex-col items-center justify-between p-8 pt-16 mt-4">
                    {isCompletionView ? (
                        <div className="max-w-md w-full space-y-8 animate-fade-in-up my-auto">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-soft text-accent-contrast mb-4">
                                    <Check size={32} strokeWidth={3} />
                                </div>
                                <h3 className="text-3xl font-bold text-content-primary">All Done!</h3>
                                <p className="text-content-secondary">Great job completing your routine.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-2xl w-full flex flex-col items-center gap-6 animate-fade-in h-full">

                            {/* TOP: Timer & Title */}
                            <div className="text-center space-y-4 w-full">
                                {timer.displayTime !== null && (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className={`text-6xl font-mono font-bold tabular-nums tracking-tight ${
                                            timer.mode === 'stopwatch' ? 'text-blue-400' : 'text-accent-contrast'
                                        }`}>
                                            {timer.formatTime(timer.displayTime)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {timer.mode === 'stopwatch' && (
                                                <span className="text-xs text-blue-400/60 uppercase tracking-wider font-medium mr-1">Stopwatch</span>
                                            )}
                                            <button
                                                onClick={timer.toggle}
                                                className="px-6 py-2 bg-surface-1 rounded-full text-content-primary hover:bg-surface-2 transition-colors flex items-center gap-2 font-medium"
                                            >
                                                {timer.isRunning ? (
                                                    <><Pause size={18} fill="currentColor" /> Pause</>
                                                ) : (
                                                    <><Play size={18} fill="currentColor" /> Start</>
                                                )}
                                            </button>
                                            <button
                                                onClick={timer.reset}
                                                className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-surface-1 rounded-full text-content-secondary hover:text-content-primary hover:bg-surface-2 transition-colors"
                                                title="Reset Timer"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <h3 className="text-2xl md:text-3xl font-bold text-content-primary leading-tight">
                                    {currentStep?.title}
                                </h3>
                            </div>

                            {/* CENTER: Visual (Image or Placeholder) */}
                            <div className={`w-full aspect-video max-h-[40vh] bg-surface-1/50 rounded-2xl overflow-hidden shadow-lg border border-line-subtle flex items-center justify-center relative flex-shrink-0 ${!currentStep?.imageUrl ? 'bg-surface-0 border-dashed opacity-50' : ''}`}>
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
                                <div className="w-full bg-surface-1/50 rounded-xl p-5 border border-line-subtle text-center">
                                    <p className="text-content-primary text-lg whitespace-pre-wrap leading-relaxed">
                                        {currentStep.instruction}
                                    </p>
                                </div>
                            )}

                            {/* Tracking Fields */}
                            {currentStep?.trackingFields && currentStep.trackingFields.length > 0 && (
                                <div className="w-full bg-surface-1/50 rounded-xl p-5 border border-line-subtle space-y-3">
                                    <h4 className="text-xs font-medium text-content-muted uppercase tracking-wider">Track</h4>
                                    {currentStep.trackingFields.map(field => (
                                        <TrackingFieldInput
                                            key={field.id}
                                            field={field}
                                            value={stepTrackingData[currentStep.id]?.[field.id]}
                                            onChange={(val) => setStepTrackingValue(currentStep.id, field.id, val)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Step status indicators */}
                            {steps.length > 1 && (
                                <div className="flex flex-wrap justify-center gap-1.5" role="list" aria-label="Step progress">
                                    {steps.map((s, idx) => {
                                        const status = stepStates[s.id] ?? 'neutral';
                                        const isCurrent = idx === currentStepIndex;
                                        return (
                                            <span
                                                key={s.id}
                                                role="listitem"
                                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                                                    status === 'done'
                                                        ? 'bg-emerald-500/30 text-accent-contrast'
                                                        : status === 'skipped'
                                                            ? 'bg-surface-2/50 text-content-muted'
                                                            : isCurrent
                                                                ? 'bg-white/20 text-content-primary ring-1 ring-white/30'
                                                                : 'bg-white/5 text-content-secondary'
                                                }`}
                                                title={status === 'done' ? `${s.title} – Done` : status === 'skipped' ? `${s.title} – Skipped` : s.title}
                                            >
                                                {status === 'done' ? <Check size={14} strokeWidth={2.5} /> : status === 'skipped' ? <Forward size={14} /> : idx + 1}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Mark step done / skip (per-step completion, no habit logging) */}
                            {currentStep && (
                                <div className="flex flex-wrap justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setStepState(currentStep.id, 'done')}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-soft text-accent-contrast hover:bg-accent-strong/30 transition-colors text-sm font-medium"
                                    >
                                        <CircleCheck size={18} />
                                        Mark done
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStepState(currentStep.id, 'skipped')}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2/50 text-content-secondary hover:bg-surface-2/70 hover:text-content-secondary transition-colors text-sm font-medium"
                                    >
                                        <Forward size={18} />
                                        Skip step
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer / Controls */}
                <div className="p-6 border-t border-line-subtle bg-surface-0/50 backdrop-blur-md">
                    <div className="flex justify-between items-center max-w-4xl mx-auto w-full">
                        {!isCompletionView ? (
                            <>
                                <button
                                    onClick={handlePrevious}
                                    disabled={currentStepIndex === 0}
                                    className="flex items-center gap-2 px-4 py-2 text-content-secondary hover:text-content-primary disabled:opacity-30 disabled:hover:text-content-secondary transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                    Back
                                </button>

                                <div className="flex items-center gap-2 text-content-muted font-mono text-sm">
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
                                    className="flex items-center gap-2 px-4 py-2 text-content-secondary hover:text-content-primary transition-colors"
                                >
                                    Back to Routine
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCompletedHabitsModal(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-surface-2 text-content-primary font-semibold rounded-lg hover:bg-surface-2 transition-colors touch-manipulation"
                                    >
                                        Complete Routine
                                    </button>
                                    {variantLinkedHabitIds.length > 0 && (
                                        <button
                                            onClick={() => handleFinish(true)}
                                            disabled={submitting}
                                            className="flex items-center gap-2 px-6 py-3 bg-accent text-content-on-accent font-bold rounded-lg hover:bg-accent-strong transition-colors shadow-lg shadow-emerald-500/20"
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

                <CompletedHabitsModal
                    isOpen={showCompletedHabitsModal}
                    routine={routine ?? null}
                    variantId={variantId}
                    stepStates={stepStates}
                    getHabitName={getHabitName}
                    onClose={() => setShowCompletedHabitsModal(false)}
                    submitting={loggingHabits}
                    onLogSelected={async (habitIds) => {
                        if (habitIds.length === 0) {
                            setShowCompletedHabitsModal(false);
                            return;
                        }
                        setLoggingHabits(true);
                        try {
                            const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
                            await batchCreateEntries({
                                habitIds,
                                routineId: routine?.id,
                                timezone,
                            });
                            await refreshDayLogs();
                            setShowCompletedHabitsModal(false);
                            exitRoutine();
                            onClose();
                        } catch (err) {
                            const message = err instanceof Error ? err.message : 'Failed to log habits';
                            showToast(message, 'error');
                        } finally {
                            setLoggingHabits(false);
                        }
                    }}
                />
            </div>
        </div>
    );
};
