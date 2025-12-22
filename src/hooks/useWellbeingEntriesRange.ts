import { useEffect, useMemo, useState } from 'react';
import { fetchWellbeingEntries } from '../lib/persistenceClient';
import type { WellbeingEntry, WellbeingMetricKey, WellbeingTimeOfDay } from '../models/persistenceTypes';
import { formatDayKeyFromDate } from '../domain/time/dayKey';

type WindowDays = 7 | 14 | 30 | 90 | 180;

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function getDayKeyNDaysAgo(daysAgo: number, timeZone: string): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return formatDayKeyFromDate(d, timeZone);
}

export function useWellbeingEntriesRange(windowDays: WindowDays) {
  const [entries, setEntries] = useState<WellbeingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const timeZone = useMemo(() => getTimeZone(), []);
  const endDayKey = useMemo(() => getDayKeyNDaysAgo(0, timeZone), [timeZone]);
  const startDayKey = useMemo(() => getDayKeyNDaysAgo(windowDays - 1, timeZone), [timeZone, windowDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWellbeingEntries({ startDayKey, endDayKey })
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load wellbeing entries');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [startDayKey, endDayKey, refreshTick]);

  // Allow external invalidation (e.g., after demo seed/reset) without a full page reload.
  useEffect(() => {
    const handler = () => setRefreshTick((x) => x + 1);
    window.addEventListener('habitflow:demo-data-changed', handler as any);
    return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, WellbeingEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.dayKey) || [];
      arr.push(e);
      map.set(e.dayKey, arr);
    }
    return map;
  }, [entries]);

  function getDailyAverage(
    dayKey: string,
    metricKey: WellbeingMetricKey,
    timeOfDay?: WellbeingTimeOfDay | null
  ): number | null {
    const dayEntries = byDay.get(dayKey);
    if (!dayEntries) return null;
    const values = dayEntries
      .filter((e) => {
        if (e.metricKey !== metricKey) return false;
        if (typeof e.value !== 'number') return false;
        if (timeOfDay === undefined) return true;
        return (e.timeOfDay ?? null) === timeOfDay;
      })
      .map((e) => e.value as number);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  return { entries, loading, error, startDayKey, endDayKey, getDailyAverage };
}


