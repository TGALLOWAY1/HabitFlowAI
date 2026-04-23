import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type { Routine, RoutineLog } from '../models/persistenceTypes';
import type { StepStatus } from '../models/persistenceTypes';
import {
    fetchRoutines,
    fetchRoutineLogs,
    createRoutine as createRoutineApi,
    updateRoutine as updateRoutineApi,
    deleteRoutine as deleteRoutineApi,
    recordRoutineStepsReachedBatch,
} from '../lib/persistenceClient';
import { resolveSteps } from '../lib/routineVariantUtils';

// Re-export StepStatus from persistenceTypes (single source of truth)
export type { StepStatus } from '../models/persistenceTypes';

export type StepStates = Record<string, StepStatus>;

interface RoutineContextType {
    routines: Routine[];
    routineLogs: Record<string, RoutineLog>;
    loading: boolean;
    error?: string;
    refreshRoutines: () => Promise<void>;
    addRoutine: (data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<Routine>;
    updateRoutine: (id: string, patch: Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>) => Promise<Routine>;
    deleteRoutine: (id: string) => Promise<void>;

    // Execution State
    activeRoutine: Routine | null;
    activeVariantId: string | null;
    executionState: 'browse' | 'preview' | 'execute';
    currentStepIndex: number;
    stepStates: StepStates;
    startedAt: string | null;

    // Step Tracking Data
    stepTrackingData: Record<string, Record<string, string | number>>;
    stepTimingData: Record<string, number>;
    setStepTrackingValue: (stepId: string, fieldId: string, value: string | number) => void;
    recordStepTime: (stepId: string, seconds: number) => void;

    // Execution Actions
    selectRoutine: (routineId: string) => void;
    selectVariant: (variantId: string) => void;
    startRoutine: (routine: Routine, variantId?: string) => void;
    exitRoutine: () => void;
    nextStep: () => void;
    prevStep: () => void;
    skipStep: () => void;
    setStepState: (stepId: string, status: StepStatus) => void;
}

const RoutineContext = createContext<RoutineContextType | undefined>(undefined);

export const useRoutineStore = () => {
    const context = useContext(RoutineContext);
    if (!context) {
        throw new Error('useRoutineStore must be used within a RoutineProvider');
    }
    return context;
};

export const RoutineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [routineLogs, setRoutineLogs] = useState<Record<string, RoutineLog>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | undefined>(undefined);

    // Execution State
    const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
    const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
    const [executionState, setExecutionState] = useState<'browse' | 'preview' | 'execute'>('browse');
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [stepStates, setStepStates] = useState<StepStates>({});
    const [startedAt, setStartedAt] = useState<string | null>(null);
    const [stepTrackingData, setStepTrackingData] = useState<Record<string, Record<string, string | number>>>({});
    const [stepTimingData, setStepTimingData] = useState<Record<string, number>>({});

    // Accumulate reached steps with linked habits for batch submission (M12 audit fix)
    const reachedStepsRef = useRef<Array<{ stepId: string; date: string; variantId?: string }>>([]);

    // Load routines from MongoDB on mount
    useEffect(() => {
        let cancelled = false;

        const loadRoutinesFromApi = async () => {
            setLoading(true);
            setError(undefined);
            try {
                const [apiRoutines, apiLogs] = await Promise.all([
                    fetchRoutines(),
                    fetchRoutineLogs(),
                ]);
                if (cancelled) return;
                setRoutines(apiRoutines);
                setRoutineLogs(apiLogs);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.error('Failed to fetch routines from API:', errorMessage);
                setError(errorMessage);
                setLoading(false);
            }
        };

        loadRoutinesFromApi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshRoutines = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const [apiRoutines, apiLogs] = await Promise.all([
                fetchRoutines(),
                fetchRoutineLogs(),
            ]);
            setRoutines(apiRoutines);
            setRoutineLogs(apiLogs);
            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to refresh routines from API:', errorMessage);
            setError(errorMessage);
            setLoading(false);
            throw err;
        }
    };

    const addRoutine = async (data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<Routine> => {
        try {
            const newRoutine = await createRoutineApi(data);
            setRoutines([...routines, newRoutine]);
            return newRoutine;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to save routine to API:', errorMessage);
            throw err;
        }
    };

    const updateRoutine = async (
        id: string,
        patch: Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
    ): Promise<Routine> => {
        try {
            const updatedRoutine = await updateRoutineApi(id, patch);
            setRoutines(routines.map(r => (r.id === id ? updatedRoutine : r)));
            return updatedRoutine;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to update routine in API:', errorMessage);
            throw err;
        }
    };

    const deleteRoutine = async (id: string): Promise<void> => {
        try {
            await deleteRoutineApi(id);
            setRoutines(routines.filter(r => r.id !== id));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error('Failed to delete routine from API:', errorMessage);
            throw err;
        }
    };

    // Execution Actions
    const selectRoutine = (routineId: string) => {
        const routine = routines.find(r => r.id === routineId);
        if (routine) {
            setActiveRoutine(routine);
            setExecutionState('preview');
            setCurrentStepIndex(0);
            // Pre-select default variant
            setActiveVariantId(routine.defaultVariantId || routine.variants?.[0]?.id || null);
        }
    };

    const selectVariant = (variantId: string) => {
        setActiveVariantId(variantId);
    };

    // Atomically enter execute mode for the given routine. Accepts the routine
    // directly so step-state initialization never reads a stale closure value
    // (the prior implementation chained selectRoutine → startRoutine and relied
    // on activeRoutine being set, which isn't flushed yet within the same
    // effect — leaving stepStates uninitialized and executionState stuck at
    // 'preview' even though the UI rendered the execute view).
    const startRoutine = (routine: Routine, variantId?: string) => {
        const effectiveVariantId = variantId || routine.defaultVariantId || routine.variants?.[0]?.id || null;

        setActiveRoutine(routine);
        setActiveVariantId(effectiveVariantId);
        setExecutionState('execute');
        setCurrentStepIndex(0);
        setStartedAt(new Date().toISOString());

        // Initialize step states from the resolved variant's steps
        const steps = resolveSteps(routine, effectiveVariantId || undefined);
        const initial: StepStates = {};
        const initialTracking: Record<string, Record<string, string | number>> = {};
        for (const step of steps) {
            initial[step.id] = 'neutral';
            // Pre-populate tracking fields with defaults
            if (step.trackingFields?.length) {
                const fieldValues: Record<string, string | number> = {};
                for (const field of step.trackingFields) {
                    if (field.defaultValue !== undefined) {
                        fieldValues[field.id] = field.defaultValue;
                    }
                }
                if (Object.keys(fieldValues).length > 0) {
                    initialTracking[step.id] = fieldValues;
                }
            }
        }
        setStepStates(initial);
        setStepTrackingData(initialTracking);
        setStepTimingData({});
    };

    const exitRoutine = () => {
        // Batch-submit accumulated step evidence before clearing state (M12 audit fix)
        const routineId = activeRoutine?.id;
        const pendingSteps = reachedStepsRef.current;
        if (routineId && pendingSteps.length > 0) {
            recordRoutineStepsReachedBatch(routineId, pendingSteps).catch(err =>
                console.error('Failed to batch-record step evidence:', err)
            );
        }
        reachedStepsRef.current = [];

        setExecutionState('browse');
        setActiveRoutine(null);
        setActiveVariantId(null);
        setCurrentStepIndex(0);
        setStepStates({});
        setStartedAt(null);
        setStepTrackingData({});
        setStepTimingData({});
    };

    const setStepState = (stepId: string, status: StepStatus) => {
        setStepStates(prev => ({ ...prev, [stepId]: status }));
    };

    const setStepTrackingValue = (stepId: string, fieldId: string, value: string | number) => {
        setStepTrackingData(prev => ({
            ...prev,
            [stepId]: { ...(prev[stepId] || {}), [fieldId]: value },
        }));
    };

    const recordStepTime = (stepId: string, seconds: number) => {
        if (seconds <= 0) return;
        setStepTimingData(prev => ({
            ...prev,
            [stepId]: (prev[stepId] || 0) + seconds,
        }));
    };

    const nextStep = () => {
        if (!activeRoutine) return;
        const steps = resolveSteps(activeRoutine, activeVariantId || undefined);
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            exitRoutine();
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const skipStep = () => {
        nextStep();
    };

    // Accumulate reached steps with linked habits for batch submission on exit (M12 audit fix)
    useEffect(() => {
        if (executionState === 'execute' && activeRoutine) {
            const steps = resolveSteps(activeRoutine, activeVariantId || undefined);
            const step = steps[currentStepIndex];
            if (step && step.linkedHabitId) {
                const today = new Date().toLocaleDateString('en-CA');
                const alreadyRecorded = reachedStepsRef.current.some(s => s.stepId === step.id);
                if (!alreadyRecorded) {
                    reachedStepsRef.current.push({
                        stepId: step.id,
                        date: today,
                        ...(activeVariantId ? { variantId: activeVariantId } : {}),
                    });
                }
            }
        }
    }, [executionState, activeRoutine, activeVariantId, currentStepIndex]);

    const contextValue = useMemo(() => ({
        routines,
        routineLogs,
        loading,
        error,
        refreshRoutines,
        addRoutine,
        updateRoutine,
        deleteRoutine,
        activeRoutine,
        activeVariantId,
        executionState,
        currentStepIndex,
        stepStates,
        startedAt,
        stepTrackingData,
        stepTimingData,
        setStepTrackingValue,
        recordStepTime,
        selectRoutine,
        selectVariant,
        startRoutine,
        exitRoutine,
        nextStep,
        prevStep,
        skipStep,
        setStepState
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [routines, routineLogs, loading, error, activeRoutine, activeVariantId, executionState, currentStepIndex, stepStates, startedAt, stepTrackingData, stepTimingData]);

    return (
        <RoutineContext.Provider value={contextValue}>
            {children}
        </RoutineContext.Provider>
    );
};
