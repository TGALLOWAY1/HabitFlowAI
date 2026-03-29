import { useState, useEffect, useRef, useCallback } from 'react';
import type { RoutineStep } from '../models/persistenceTypes';

export type TimerMode = 'countdown' | 'stopwatch' | 'none';

interface StepTimerResult {
    /** Current display time in seconds (counts down or up depending on mode) */
    displayTime: number | null;
    /** Whether the timer is actively running */
    isRunning: boolean;
    /** The resolved timer mode for the current step */
    mode: TimerMode;
    /** Toggle play/pause */
    toggle: () => void;
    /** Reset timer to initial state */
    reset: () => void;
    /** Format seconds as MM:SS */
    formatTime: (seconds: number) => string;
    /** Total elapsed seconds on the current step (accumulated across pause/resume) */
    elapsedSeconds: number;
}

function resolveTimerMode(step: RoutineStep | undefined): TimerMode {
    if (!step) return 'none';
    if (step.timerMode === 'stopwatch') return 'stopwatch';
    if (step.timerMode === 'countdown' || step.timerSeconds) return 'countdown';
    return 'none';
}

export function useStepTimer(
    currentStep: RoutineStep | undefined,
    currentStepIndex: number,
): StepTimerResult {
    const mode = resolveTimerMode(currentStep);

    // Countdown state
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    // Stopwatch state
    const [elapsedTime, setElapsedTime] = useState(0);
    // Common state
    const [isRunning, setIsRunning] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Track total elapsed for timing data (only for steps with a timer)
    const stepEnteredAt = useRef<number>(0);
    const accumulatedPauseTime = useRef(0);
    const lastPauseAt = useRef<number | null>(null);

    // Reset timer state when step changes
    useEffect(() => {
        // Clear any running interval
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsRunning(false);
        stepEnteredAt.current = Date.now();
        accumulatedPauseTime.current = 0;
        lastPauseAt.current = null;

        if (mode === 'countdown' && currentStep?.timerSeconds) {
            setTimeLeft(currentStep.timerSeconds);
            setElapsedTime(0);
        } else if (mode === 'stopwatch') {
            setTimeLeft(null);
            setElapsedTime(0);
        } else {
            setTimeLeft(null);
            setElapsedTime(0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally reset only on step change, not on mode/timerSeconds change
    }, [currentStepIndex, currentStep?.id]);

    // Timer tick effect
    useEffect(() => {
        if (!isRunning) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        if (mode === 'countdown' && timeLeft !== null && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 1) {
                        setIsRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (mode === 'stopwatch') {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRunning, mode, timeLeft]);

    const toggle = useCallback(() => {
        setIsRunning(prev => {
            const newRunning = !prev;
            if (newRunning) {
                // Resuming: accumulate pause duration
                if (lastPauseAt.current !== null) {
                    accumulatedPauseTime.current += Date.now() - lastPauseAt.current;
                    lastPauseAt.current = null;
                }
            } else {
                // Pausing: record pause start
                lastPauseAt.current = Date.now();
            }
            return newRunning;
        });
    }, []);

    const reset = useCallback(() => {
        setIsRunning(false);
        stepEnteredAt.current = Date.now();
        accumulatedPauseTime.current = 0;
        lastPauseAt.current = null;

        if (mode === 'countdown' && currentStep?.timerSeconds) {
            setTimeLeft(currentStep.timerSeconds);
        }
        setElapsedTime(0);
    }, [mode, currentStep?.timerSeconds]);

    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Compute display time based on mode
    const displayTime = mode === 'countdown' ? timeLeft
        : mode === 'stopwatch' ? elapsedTime
        : null;

    // Compute elapsed seconds for timing data
    const computeElapsed = (): number => {
        if (mode === 'none') return 0;
        if (mode === 'stopwatch') return elapsedTime;
        // For countdown, compute from step entry time minus pauses
        if (currentStep?.timerSeconds && timeLeft !== null) {
            return currentStep.timerSeconds - timeLeft;
        }
        return 0;
    };

    return {
        displayTime,
        isRunning,
        mode,
        toggle,
        reset,
        formatTime,
        elapsedSeconds: computeElapsed(),
    };
}
