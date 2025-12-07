import { useState, useEffect } from 'react';
import { fetchCompletedGoals } from './persistenceClient';
import type { CompletedGoal } from '../types';

/**
 * Hook to fetch completed goals for the Win Archive.
 * 
 * Returns loading state, error state, and the completed goals data.
 * Automatically fetches on mount.
 * 
 * @returns Object with loading, error, and data properties
 */
export function useCompletedGoals(): {
    data?: CompletedGoal[];
    loading: boolean;
    error?: Error;
} {
    const [goals, setGoals] = useState<CompletedGoal[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        const loadGoals = async () => {
            setLoading(true);
            setError(undefined);
            try {
                const fetchedGoals = await fetchCompletedGoals();
                if (cancelled) return;
                setGoals(fetchedGoals);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                const error = err instanceof Error ? err : new Error('Failed to load completed goals');
                console.error('Error fetching completed goals:', error.message);
                setError(error);
                setLoading(false);
            }
        };

        loadGoals();

        return () => {
            cancelled = true;
        };
    }, []);

    return {
        data: goals.length > 0 ? goals : undefined,
        loading,
        error,
    };
}
