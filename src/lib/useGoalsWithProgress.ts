import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchGoalsWithProgress } from './persistenceClient';
import type { GoalWithProgress } from '../models/persistenceTypes';
import { getCachedGoalsWithProgress, setCachedGoalsWithProgress } from './goalDataCache';

/**
 * Hook to fetch goals with progress information.
 * 
 * Returns loading state, error state, and the goals data.
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
export function useGoalsWithProgress() {
    const [goals, setGoals] = useState<GoalWithProgress[]>(() => {
        // Initialize from cache if available (prevents initial loading flash)
        const cached = getCachedGoalsWithProgress();
        return cached || [];
    });
    const [loading, setLoading] = useState<boolean>(() => {
        // Only show loading if cache is empty
        return getCachedGoalsWithProgress() === null;
    });
    const [error, setError] = useState<string | null>(null);

    const loadGoals = useCallback(async () => {
        // Check cache first
        const cached = getCachedGoalsWithProgress();
        if (cached) {
            setGoals(cached);
            setLoading(false);
            setError(null);
            // Still fetch in background to ensure freshness (stale-while-revalidate pattern)
            // but don't show loading state
        } else {
            setLoading(true);
        }

        setError(null);
        try {
            const fetchedGoals = await fetchGoalsWithProgress();
            // Update cache
            setCachedGoalsWithProgress(fetchedGoals);
            setGoals(fetchedGoals);
            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load goals';
            console.error('Error fetching goals with progress:', errorMessage);
            setError(errorMessage);
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
        data: goals,
        loading,
        error,
        refetch: loadGoals,
    }), [goals, loading, error, loadGoals]);
}
