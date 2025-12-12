import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Routine, RoutineLog } from '../models/persistenceTypes';
import {
    fetchRoutines,
    fetchRoutineLogs,
    createRoutine as createRoutineApi,
    updateRoutine as updateRoutineApi,
    deleteRoutine as deleteRoutineApi,
} from '../lib/persistenceClient';

interface RoutineContextType {
    routines: Routine[];
    routineLogs: Record<string, RoutineLog>;
    loading: boolean;
    error?: string;
    refreshRoutines: () => Promise<void>;
    addRoutine: (data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<Routine>;
    updateRoutine: (id: string, patch: Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>) => Promise<Routine>;
    deleteRoutine: (id: string) => Promise<void>;
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
            }}
        >
            {children}
        </RoutineContext.Provider>
    );
};
