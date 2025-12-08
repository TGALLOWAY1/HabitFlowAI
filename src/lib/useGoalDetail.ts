import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchGoalDetail } from './persistenceClient';
import type { GoalDetail } from '../types';
import { getCachedGoalDetail, setCachedGoalDetail } from './goalDataCache';

/**
 * Hook to fetch goal detail information.
 * 
 * Returns loading state, error state, the goal detail data, and a refetch function.
 * Automatically fetches on mount and when goalId changes, but checks cache first.
 * 
 * Performance optimizations:
 * - Checks cache before fetching
 * - Memoizes return value to prevent unnecessary re-renders
 * - Uses useCallback for stable refetch function
 * 
 * TODO: Consider using React Query for more sophisticated caching, background refetching,
 * and automatic invalidation on mutations.
 * 
 * @param goalId - The ID of the goal to fetch
 * @returns Object with loading, error, data, and refetch properties
 */
export function useGoalDetail(goalId: string): {
    data?: GoalDetail;
    loading: boolean;
    error?: Error;
    refetch: () => Promise<void>;
} {
    const [data, setData] = useState<GoalDetail | undefined>(() => {
        // Initialize from cache if available
        if (!goalId) return undefined;
        return getCachedGoalDetail(goalId) || undefined;
    });
    const [loading, setLoading] = useState<boolean>(() => {
        // Only show loading if cache is empty
        if (!goalId) return false;
        return getCachedGoalDetail(goalId) === null;
    });
    const [error, setError] = useState<Error | undefined>(undefined);

    const loadGoalDetail = useCallback(async () => {
        // Don't fetch if goalId is empty
        if (!goalId) {
            setLoading(false);
            setError(undefined);
            setData(undefined);
            return;
        }

        // Check cache first
        const cached = getCachedGoalDetail(goalId);
        if (cached) {
            setData(cached);
            setLoading(false);
            setError(undefined);
            // Still fetch in background to ensure freshness (stale-while-revalidate pattern)
            // but don't show loading state
        } else {
            setLoading(true);
        }

        setError(undefined);
        try {
            const fetchedDetail = await fetchGoalDetail(goalId);
            // Update cache
            setCachedGoalDetail(goalId, fetchedDetail);
            setData(fetchedDetail);
            setLoading(false);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load goal detail');
            console.error('Error fetching goal detail:', error.message);
            setError(error);
            setLoading(false);
        }
    }, [goalId]);

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            await loadGoalDetail();
            if (cancelled) return;
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [loadGoalDetail]);

    // Memoize return value to prevent unnecessary re-renders
    return useMemo(() => ({
        data,
        loading,
        error,
        refetch: loadGoalDetail,
    }), [data, loading, error, loadGoalDetail]);
}
