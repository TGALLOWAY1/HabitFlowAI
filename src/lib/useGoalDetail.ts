import { useState, useEffect } from 'react';
import { fetchGoalDetail } from './persistenceClient';
import type { GoalDetail } from '../types';

/**
 * Hook to fetch goal detail information.
 * 
 * Returns loading state, error state, and the goal detail data.
 * Automatically fetches on mount and when goalId changes.
 * 
 * @param goalId - The ID of the goal to fetch
 * @returns Object with loading, error, and data properties
 */
export function useGoalDetail(goalId: string): {
    data?: GoalDetail;
    loading: boolean;
    error?: Error;
} {
    const [data, setData] = useState<GoalDetail | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
        // Don't fetch if goalId is empty
        if (!goalId) {
            setLoading(false);
            setError(undefined);
            setData(undefined);
            return;
        }

        let cancelled = false;

        const loadGoalDetail = async () => {
            setLoading(true);
            setError(undefined);
            try {
                const fetchedDetail = await fetchGoalDetail(goalId);
                if (cancelled) return;
                setData(fetchedDetail);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                const error = err instanceof Error ? err : new Error('Failed to load goal detail');
                console.error('Error fetching goal detail:', error.message);
                setError(error);
                setLoading(false);
            }
        };

        loadGoalDetail();

        return () => {
            cancelled = true;
        };
    }, [goalId]);

    return {
        data,
        loading,
        error,
    };
}
