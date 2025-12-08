import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchCompletedGoals } from './persistenceClient';
import type { CompletedGoal } from '../types';
import { getCachedCompletedGoals, setCachedCompletedGoals } from './goalDataCache';

/**
 * Hook to fetch completed goals for the Win Archive.
 * 
 * Returns loading state, error state, and the completed goals data.
 * Automatically fetches on mount, but checks cache first to avoid redundant requests.
 * 
 * Performance optimizations:
 * - Checks cache before fetching
 * - Memoizes data to prevent unnecessary re-renders
 * - Uses useCallback for stable refetch function
 * 
 * TODO: Consider using React Query for more sophisticated caching, background refetching,
 * and automatic invalidation on mutations.
 * 
 * @returns Object with loading, error, data, and refetch properties
 */
export function useCompletedGoals(): {
    data?: CompletedGoal[];
    loading: boolean;
    error?: Error;
    refetch: () => Promise<void>;
} {
    const [goals, setGoals] = useState<CompletedGoal[]>(() => {
        // Initialize from cache if available (prevents initial loading flash)
        const cached = getCachedCompletedGoals();
        return cached || [];
    });
    const [loading, setLoading] = useState<boolean>(() => {
        // Only show loading if cache is empty
        return getCachedCompletedGoals() === null;
    });
    const [error, setError] = useState<Error | undefined>(undefined);

    const loadGoals = useCallback(async () => {
        // Check cache first
        const cached = getCachedCompletedGoals();
        if (cached) {
            setGoals(cached);
            setLoading(false);
            setError(undefined);
            // Still fetch in background to ensure freshness (stale-while-revalidate pattern)
            // but don't show loading state
        } else {
            setLoading(true);
        }

        setError(undefined);
        try {
            const fetchedGoals = await fetchCompletedGoals();
            // Update cache
            setCachedCompletedGoals(fetchedGoals);
            setGoals(fetchedGoals);
            setLoading(false);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load completed goals');
            console.error('Error fetching completed goals:', error.message);
            setError(error);
            setLoading(false);
        }
    }, []);

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
    }, [loadGoals]);

    // Memoize return value to prevent unnecessary re-renders
    return useMemo(() => ({
        data: goals.length > 0 ? goals : undefined,
        loading,
        error,
        refetch: loadGoals,
    }), [goals, loading, error, loadGoals]);
}
