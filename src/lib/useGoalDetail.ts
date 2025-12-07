import { useState, useEffect, useCallback } from 'react';
import { fetchGoalDetail } from './persistenceClient';
import type { GoalDetail } from '../types';

/**
 * Hook to fetch goal detail information.
 * 
 * Returns loading state, error state, the goal detail data, and a refetch function.
 * Automatically fetches on mount and when goalId changes.
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
    const [data, setData] = useState<GoalDetail | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);

    const loadGoalDetail = useCallback(async () => {
        // Don't fetch if goalId is empty
        if (!goalId) {
            setLoading(false);
            setError(undefined);
            setData(undefined);
            return;
        }

        setLoading(true);
        setError(undefined);
        try {
            const fetchedDetail = await fetchGoalDetail(goalId);
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

    return {
        data,
        loading,
        error,
        refetch: loadGoalDetail,
    };
}
