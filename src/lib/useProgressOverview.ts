import { useState, useEffect, useMemo } from 'react';
import { fetchProgressOverview } from './persistenceClient';
import type { ProgressOverview } from '../types';
import { getCachedProgressOverview, setCachedProgressOverview } from './goalDataCache';

/**
 * Hook to fetch progress overview combining habits and goals.
 * 
 * Returns loading state, error state, and the progress overview data.
 * Automatically fetches on mount, but checks cache first to avoid redundant requests.
 * 
 * Performance optimizations:
 * - Checks cache before fetching
 * - Memoizes return value to prevent unnecessary re-renders
 * 
 * Note: This endpoint includes goalsWithProgress, which overlaps with /goals-with-progress.
 * The cache helps avoid redundant fetches when both endpoints are used.
 * 
 * TODO: Consider splitting this endpoint or implementing a more sophisticated cache
 * that can share goal data between endpoints to further reduce redundancy.
 * 
 * TODO: If both useGoalsWithProgress and useProgressOverview are used on the same page,
 * consider extracting goalsWithProgress from progress overview and reusing cached data
 * from useGoalsWithProgress to avoid fetching the same goal data twice.
 * 
 * @returns Object with loading, error, and data properties
 */
export function useProgressOverview(): {
    data?: ProgressOverview;
    loading: boolean;
    error?: Error;
} {
    const [data, setData] = useState<ProgressOverview | undefined>(() => {
        // Initialize from cache if available (prevents initial loading flash)
        return getCachedProgressOverview() || undefined;
    });
    const [loading, setLoading] = useState<boolean>(() => {
        // Only show loading if cache is empty
        return getCachedProgressOverview() === null;
    });
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        const loadProgress = async () => {
            // Check cache first
            const cached = getCachedProgressOverview();
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
                const fetchedData = await fetchProgressOverview();
                if (cancelled) return;
                // Update cache
                setCachedProgressOverview(fetchedData);
                setData(fetchedData);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                const error = err instanceof Error ? err : new Error('Failed to load progress overview');
                console.error('Error fetching progress overview:', error.message);
                setError(error);
                setLoading(false);
            }
        };

        loadProgress();

        return () => {
            cancelled = true;
        };
    }, []);

    // Memoize return value to prevent unnecessary re-renders
    return useMemo(() => ({
        data,
        loading,
        error,
    }), [data, loading, error]);
}
