import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Routine, RoutineLog } from '../models/persistenceTypes';
import {
    fetchRoutines,
    fetchRoutineLogs,
    createRoutine as createRoutineApi,
    updateRoutine as updateRoutineApi,
    deleteRoutine as deleteRoutineApi,
    recordRoutineStepReached,
} from '../lib/persistenceClient';

/** Per-step completion state during routine execution. No habit logging. */
export type StepStatus = 'neutral' | 'done' | 'skipped';

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
    executionState: 'browse' | 'preview' | 'execute';
    currentStepIndex: number;
    /** Per-step status for current run. Keyed by stepId. Reset on start (all neutral) and cleared on exit. */
    stepStates: StepStates;

    // Execution Actions
    selectRoutine: (routineId: string) => void;
    startRoutine: () => void;
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
    // All persistent data is stored in MongoDB via the backend API.

    // All state starts empty and is loaded from MongoDB via API on mount
    const [routines, setRoutines] = useState<Routine[]>([]);
    const [routineLogs, setRoutineLogs] = useState<Record<string, RoutineLog>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | undefined>(undefined);

    // Execution State
    const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
    const [executionState, setExecutionState] = useState<'browse' | 'preview' | 'execute'>('browse');
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [stepStates, setStepStates] = useState<StepStates>({});

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
            // Optimistic update: add to state immediately
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
            // Update state: replace the routine with the updated one
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
            // Update state: remove the deleted routine
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
        }
    };

    const startRoutine = () => {
        if (activeRoutine) {
            setExecutionState('execute');
            setCurrentStepIndex(0);
            // Initialize all steps to neutral for this run
            const initial: StepStates = {};
            for (const step of activeRoutine.steps) {
                initial[step.id] = 'neutral';
            }
            setStepStates(initial);
        }
    };

    const exitRoutine = () => {
        setExecutionState('browse');
        setActiveRoutine(null);
        setCurrentStepIndex(0);
        setStepStates({});
    };

    const setStepState = (stepId: string, status: StepStatus) => {
        setStepStates(prev => ({ ...prev, [stepId]: status }));
    };

    const nextStep = () => {
        if (!activeRoutine) return;
        if (currentStepIndex < activeRoutine.steps.length - 1) {
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

    // Monitor step changes in Execute mode to generate evidence
    useEffect(() => {
        if (executionState === 'execute' && activeRoutine) {
            const step = activeRoutine.steps[currentStepIndex];
            // Check for Linked Habit ID
            if (step && step.linkedHabitId) {
                const today = new Date().toLocaleDateString('en-CA');
                recordRoutineStepReached(activeRoutine.id, step.id, today).catch(err =>
                    console.error('Failed to record potential evidence:', err)
                );
            }
        }
    }, [executionState, activeRoutine, currentStepIndex]);

    return (
        <RoutineContext.Provider
            value={{
                routines,
                routineLogs,
                loading,
                error,
                refreshRoutines,
                addRoutine,
                updateRoutine,
                deleteRoutine,
                activeRoutine,
                executionState,
                currentStepIndex,
                stepStates,
                selectRoutine,
                startRoutine,
                exitRoutine,
                nextStep,
                prevStep,
                skipStep,
                setStepState
            }}
        >
            {children}
        </RoutineContext.Provider>
    );
};
