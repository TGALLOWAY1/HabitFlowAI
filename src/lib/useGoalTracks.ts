import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchGoalTracks } from './persistenceClient';
import type { GoalTrack } from '../models/persistenceTypes';
import { getCachedGoalTracks, setCachedGoalTracks, isGoalTracksFresh, subscribeToCacheInvalidation } from './goalDataCache';

/**
 * Hook to fetch all goal tracks for the current user.
 * Follows the same pattern as useGoalsWithProgress.
 */
export function useGoalTracks() {
    const [tracks, setTracks] = useState<GoalTrack[]>(() => {
        return getCachedGoalTracks() || [];
    });
    const [loading, setLoading] = useState<boolean>(() => {
        return getCachedGoalTracks() === null;
    });
    const [error, setError] = useState<string | null>(null);
    // Tracks whether we've ever successfully loaded tracks, so cache-invalidation-driven
    // refetches (e.g. after a reorder) can revalidate in the background instead of
    // blanking already-rendered cards with a blocking spinner.
    const hasLoadedRef = useRef<boolean>(getCachedGoalTracks() !== null);

    const loadTracks = useCallback(async () => {
        const cached = getCachedGoalTracks();
        if (cached) {
            setTracks(cached);
            hasLoadedRef.current = true;
            setLoading(false);
            setError(null);
            if (isGoalTracksFresh()) return;
        } else if (!hasLoadedRef.current) {
            setLoading(true);
        }

        setError(null);
        try {
            const fetched = await fetchGoalTracks();
            setCachedGoalTracks(fetched);
            setTracks(fetched);
            hasLoadedRef.current = true;
            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load goal tracks';
            console.error('Error fetching goal tracks:', errorMessage);
            setError(errorMessage);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        return subscribeToCacheInvalidation(() => {
            loadTracks();
        });
    }, [loadTracks]);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            await loadTracks();
            if (cancelled) return;
        };
        fetchData();
        return () => { cancelled = true; };
    }, [loadTracks]);

    return useMemo(() => ({
        data: tracks,
        loading,
        error,
        refetch: loadTracks,
    }), [tracks, loading, error, loadTracks]);
}
