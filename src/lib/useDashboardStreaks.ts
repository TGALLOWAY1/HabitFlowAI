import { useEffect, useMemo, useState } from 'react';
import type { DashboardStreaksOverview } from '../types';
import { fetchDashboardStreaks } from './persistenceClient';

export function useDashboardStreaks(): {
  data?: DashboardStreaksOverview;
  loading: boolean;
  error?: Error;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<DashboardStreaksOverview | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    setError(undefined);
    try {
      const next = await fetchDashboardStreaks();
      setData(next);
    } catch (err) {
      const asError = err instanceof Error ? err : new Error('Failed to fetch streak dashboard');
      setError(asError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return useMemo(
    () => ({
      data,
      loading,
      error,
      refresh,
    }),
    [data, loading, error]
  );
}

