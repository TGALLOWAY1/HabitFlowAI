/**
 * Truth Query Service
 *
 * All history reads go through truthQuery from HabitEntry (source of truth).
 * Returns normalized EntryView structure for charts, day views, goal aggregation.
 *
 * DayKey is the aggregation boundary. All entries are normalized to DayKey
 * using the user's timezone before being returned.
 */

import { getHabitEntriesByHabit, getHabitEntriesByHabitIds, getHabitEntriesByHabitIdsSince } from '../repositories/habitEntryRepository';
import { allowDayKeyLegacyFallback } from '../utils/dayKey';
import type { HabitEntry } from '../../models/persistenceTypes';
import type { DayKey } from '../../domain/time/dayKey';
import { formatDayKeyFromDate, isValidDayKey } from '../../domain/time/dayKey';

/**
 * EntryView - Canonical view of a habit entry for reading/aggregation
 */
export interface EntryView {
  habitId: string;
  dayKey: DayKey;
  timestampUtc: string;
  value: number | null;
  unit?: string;
  source: 'manual' | 'routine' | 'quick' | 'import' | 'apple_health' | 'legacy' | 'test';
  provenance: {
    routineId?: string;
    variantId?: string;
    routineExecutionId?: string;
  };
  deletedAt?: string | null;
  conflict?: boolean;
  legacyValue?: number | null;
}

/**
 * Get entry views for a single habit (HabitEntries only).
 */
export async function getEntryViewsForHabit(
  habitId: string,
  householdId: string,
  userId: string,
  args: { startDayKey?: DayKey; endDayKey?: DayKey; timeZone: string }
): Promise<EntryView[]> {
  const entries = await getHabitEntriesByHabit(habitId, householdId, userId);
  const entryViews = entries.map(entry => mapEntryToView(entry, args.timeZone));

  const filteredViews = entryViews.filter(view => {
    if (args.startDayKey && view.dayKey < args.startDayKey) return false;
    if (args.endDayKey && view.dayKey > args.endDayKey) return false;
    return true;
  });

  filteredViews.sort((a, b) => {
    if ((a.dayKey || '') !== (b.dayKey || '')) return (a.dayKey || '').localeCompare(b.dayKey || '');
    return (a.timestampUtc || '').localeCompare(b.timestampUtc || '');
  });

  return filteredViews;
}

/**
 * Get entry views for multiple habits (HabitEntries only).
 * Fetches only entries for the specified habits at the DB level.
 */
export async function getEntryViewsForHabits(
  habitIds: string[],
  householdId: string,
  userId: string,
  args: { startDayKey?: DayKey; endDayKey?: DayKey; timeZone: string }
): Promise<EntryView[]> {
  const entries = await getHabitEntriesByHabitIds(habitIds, householdId, userId);
  return buildEntryViewsFromEntries(entries, habitIds, args);
}

/**
 * Build entry views from pre-fetched entries, avoiding a redundant DB call.
 * Use this when entries have already been fetched (e.g. in progress overview).
 */
export function buildEntryViewsFromEntries(
  allEntries: HabitEntry[],
  habitIds: string[],
  args: { startDayKey?: DayKey; endDayKey?: DayKey; timeZone: string }
): EntryView[] {
  const habitIdSet = new Set(habitIds);
  const relevantEntries = allEntries.filter(entry => habitIdSet.has(entry.habitId));
  const entryViews = relevantEntries.map(entry => mapEntryToView(entry, args.timeZone));

  const filteredViews = entryViews.filter(view => {
    if (args.startDayKey && view.dayKey < args.startDayKey) return false;
    if (args.endDayKey && view.dayKey > args.endDayKey) return false;
    return true;
  });

  filteredViews.sort((a, b) => {
    if ((a.dayKey || '') !== (b.dayKey || '')) return (a.dayKey || '').localeCompare(b.dayKey || '');
    return (a.timestampUtc || '').localeCompare(b.timestampUtc || '');
  });

  return filteredViews;
}

/**
 * Get entry views for multiple habits since a given dayKey.
 * Only fetches entries from the DB with dayKey >= sinceDayKey.
 * Used for efficient recent-window queries (e.g. last 30 days for goal heatmaps).
 */
export async function getRecentEntryViewsForHabits(
  habitIds: string[],
  householdId: string,
  userId: string,
  args: { sinceDayKey: DayKey; timeZone: string }
): Promise<EntryView[]> {
  const entries = await getHabitEntriesByHabitIdsSince(habitIds, householdId, userId, args.sinceDayKey);
  return buildEntryViewsFromEntries(entries, habitIds, { timeZone: args.timeZone });
}

function mapEntryToView(entry: HabitEntry, timeZone: string): EntryView {
  const allowFallback = allowDayKeyLegacyFallback();

  let dayKey: DayKey;

  if (entry.dayKey && isValidDayKey(entry.dayKey)) {
    dayKey = entry.dayKey;
  } else if (allowFallback && entry.date && isValidDayKey(entry.date)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[truthQuery] HabitEntry ${entry.id} using legacy "date" as dayKey. Prefer "dayKey".`);
    }
    dayKey = entry.date;
  } else if (allowFallback && entry.dateKey && isValidDayKey(entry.dateKey)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[truthQuery] HabitEntry ${entry.id} using legacy "dateKey" as dayKey. Prefer "dayKey".`);
    }
    dayKey = entry.dateKey;
  } else {
    try {
      dayKey = formatDayKeyFromDate(new Date(entry.timestamp), timeZone);
      if (!allowFallback && process.env.NODE_ENV === 'production') {
        console.warn(`[truthQuery] HabitEntry ${entry.id} missing dayKey, derived from timestamp.`);
      } else if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[truthQuery] HabitEntry ${entry.id} missing dayKey/date/dateKey. Deriving from timestamp in ${timeZone}.`
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to derive dayKey for entry ${entry.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  let source: EntryView['source'];
  if (
    entry.source === 'manual' ||
    entry.source === 'routine' ||
    entry.source === 'quick' ||
    entry.source === 'import' ||
    entry.source === 'test'
  ) {
    source = entry.source;
  } else {
    source = 'manual';
  }

  const provenance: EntryView['provenance'] = {};
  if (entry.routineId) provenance.routineId = entry.routineId;
  if (entry.variantId) provenance.variantId = entry.variantId;

  return {
    habitId: entry.habitId,
    dayKey,
    timestampUtc: entry.timestamp || new Date().toISOString(),
    value: entry.value ?? null,
    unit: entry.unitSnapshot,
    source,
    provenance,
    deletedAt: entry.deletedAt ?? null,
    conflict: false,
    legacyValue: undefined,
  };
}
