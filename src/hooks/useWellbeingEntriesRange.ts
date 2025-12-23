import { useEffect, useMemo, useState, useCallback } from 'react';
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
    type DemoDataChangedDetail = { reason?: 'seed' | 'reset' | 'other' };
    const handler = (evt: Event) => {
      const custom = evt as CustomEvent<DemoDataChangedDetail>;
      // Only refresh for seed/reset operations
      if (custom.detail?.reason === 'seed' || custom.detail?.reason === 'reset') {
        setRefreshTick((x) => x + 1);
      }
    };
    window.addEventListener('habitflow:demo-data-changed', handler as any);
    return () => window.removeEventListener('habitflow:demo-data-changed', handler as any);
  }, []);

  // Listen for individual wellbeing entry updates and merge locally (no refetch)
  useEffect(() => {
    type WellbeingEntryUpsertDetail = {
      dayKey: string;
      timeOfDay: 'morning' | 'evening' | null;
      metricKey: string;
      value: number;
    };
    const handler = (evt: Event) => {
      const custom = evt as CustomEvent<WellbeingEntryUpsertDetail>;
      if (!custom.detail) return;

      const { dayKey, timeOfDay, metricKey, value } = custom.detail;

      // Merge the entry into local state without refetching
      setEntries((prev) => {
        // Check if entry already exists
        const existingIndex = prev.findIndex(
          (e) =>
            e.dayKey === dayKey &&
            e.metricKey === metricKey &&
            (e.timeOfDay ?? null) === timeOfDay
        );

        const newEntry: WellbeingEntry = {
          id: existingIndex >= 0 ? prev[existingIndex].id : `temp-${Date.now()}`,
          userId: existingIndex >= 0 ? prev[existingIndex].userId : 'anonymous-user',
          dayKey,
          timeOfDay: timeOfDay ?? null,
          metricKey: metricKey as WellbeingMetricKey,
          value,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
          createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
          // Update existing entry
          const next = [...prev];
          next[existingIndex] = newEntry;
          return next;
        } else {
          // Add new entry
          return [...prev, newEntry];
        }
      });
    };
    window.addEventListener('habitflow:wellbeing-entry-upsert', handler as any);
    return () => window.removeEventListener('habitflow:wellbeing-entry-upsert', handler as any);
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

  const getDailyAverage = useCallback(
    (
      dayKey: string,
      metricKey: WellbeingMetricKey,
      timeOfDay?: WellbeingTimeOfDay | null
    ): number | null => {
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
    },
    [byDay]
  );

  return { entries, loading, error, startDayKey, endDayKey, getDailyAverage };
}


