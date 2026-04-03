import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchGoalSummary, type GoalAnalyticsSummary } from './analyticsClient';

/**
 * Hook to fetch goal analytics summary (pace, status, forecasts).
 * Used by the Schedule view to derive calendar events.
 */
export function useGoalAnalytics() {
    const [data, setData] = useState<GoalAnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const summary = await fetchGoalSummary(365);
            setData(summary);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load goal analytics';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return useMemo(() => ({
        data,
        loading,
        error,
        refetch: load,
    }), [data, loading, error, load]);
}
