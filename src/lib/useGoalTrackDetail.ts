import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchGoalTrack } from './persistenceClient';
import type { GoalTrackWithGoals } from '../types';
import { getCachedGoalTrackDetail, setCachedGoalTrackDetail, subscribeToCacheInvalidation } from './goalDataCache';

/**
 * Hook to fetch a single goal track with its ordered goals.
 * Follows the same pattern as useGoalDetail.
 */
export function useGoalTrackDetail(trackId: string) {
    const [data, setData] = useState<GoalTrackWithGoals | null>(() => {
        if (!trackId) return null;
        return getCachedGoalTrackDetail(trackId);
    });
    const [loading, setLoading] = useState<boolean>(() => {
        if (!trackId) return false;
        return getCachedGoalTrackDetail(trackId) === null;
    });
    const [error, setError] = useState<string | null>(null);

    const loadTrack = useCallback(async () => {
        if (!trackId) return;

        const cached = getCachedGoalTrackDetail(trackId);
        if (cached) {
            setData(cached);
            setLoading(false);
            setError(null);
        } else {
            setLoading(true);
        }

        try {
            const fetched = await fetchGoalTrack(trackId);
            setCachedGoalTrackDetail(trackId, fetched);
            setData(fetched);
            setLoading(false);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load goal track';
            console.error('Error fetching goal track detail:', errorMessage);
            setError(errorMessage);
            setLoading(false);
        }
    }, [trackId]);

    useEffect(() => {
        return subscribeToCacheInvalidation(() => {
            loadTrack();
        });
    }, [loadTrack]);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            await loadTrack();
            if (cancelled) return;
        };
        fetchData();
        return () => { cancelled = true; };
    }, [loadTrack]);

    return useMemo(() => ({
        data,
        loading,
        error,
        refetch: loadTrack,
    }), [data, loading, error, loadTrack]);
}
