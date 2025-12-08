import { useState, useEffect } from 'react';
import { fetchProgressOverview } from './persistenceClient';
import type { ProgressOverview } from '../types';

/**
 * Hook to fetch progress overview combining habits and goals.
 * 
 * Returns loading state, error state, and the progress overview data.
 * Automatically fetches on mount.
 * 
 * @returns Object with loading, error, and data properties
 */
export function useProgressOverview(): {
    data?: ProgressOverview;
    loading: boolean;
    error?: Error;
} {
    const [data, setData] = useState<ProgressOverview | undefined>(undefined);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        const loadProgress = async () => {
            setLoading(true);
            setError(undefined);
            try {
                const fetchedData = await fetchProgressOverview();
                if (cancelled) return;
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

    return {
        data,
        loading,
        error,
    };
}
