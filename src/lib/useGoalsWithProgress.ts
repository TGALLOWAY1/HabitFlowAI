import { useState, useEffect } from 'react';
import { fetchGoalsWithProgress } from './persistenceClient';
import type { GoalWithProgress } from '../models/persistenceTypes';

/**
 * Hook to fetch goals with progress information.
 * 
 * Returns loading state, error state, and the goals data.
 * Automatically fetches on mount.
 * 
 * @returns Object with loading, error, and data properties
 */
export function useGoalsWithProgress() {
    const [goals, setGoals] = useState<GoalWithProgress[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const loadGoals = async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedGoals = await fetchGoalsWithProgress();
            setGoals(fetchedGoals);
            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load goals';
            console.error('Error fetching goals with progress:', errorMessage);
            setError(errorMessage);
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            await loadGoals();
            if (cancelled) return;
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, []);

    return {
        data: goals,
        loading,
        error,
        refetch: loadGoals,
    };
}
