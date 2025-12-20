/**
 * Truth Query Service
 * 
 * All history reads must go through truthQuery.
 * DayLogs are legacy; do not read them outside truthQuery.
 * 
 * This module provides the canonical interface for reading habit history.
 * It ensures all reads come from HabitEntry (the source of truth) and
 * returns a normalized EntryView structure suitable for charts, day views,
 * goal aggregation, and debugging.
 * 
 * DayKey is the aggregation boundary. All entries are normalized to DayKey
 * using the user's timezone before being returned.
 */

import { getHabitEntriesByHabit, getHabitEntriesByUser } from '../repositories/habitEntryRepository';
import type { HabitEntry } from '../../models/persistenceTypes';
import type { DayKey } from '../../domain/time/dayKey';
import { formatDayKeyFromDate, isValidDayKey } from '../../domain/time/dayKey';

/**
 * EntryView - Canonical view of a habit entry for reading/aggregation
 * 
 * This is the normalized shape that all history/progress reads should use.
 * It provides a consistent interface regardless of how the entry was created
 * or what legacy fields it may contain.
 */
export interface EntryView {
  /** Habit ID this entry belongs to */
  habitId: string;

  /** DayKey (YYYY-MM-DD) - the aggregation boundary */
  dayKey: DayKey;

  /** UTC timestamp (ISO 8601) - for ordering and auditing */
  timestampUtc: string;

  /** Value contribution (null if not applicable) */
  value: number | null;

  /** Unit snapshot at time of entry (e.g., "miles", "reps") */
  unit?: string;

  /** Source of the entry */
  source: 'manual' | 'routine' | 'quick' | 'import' | 'legacy' | 'test';

  /** Provenance information */
  provenance: {
    /** Routine ID if entry came from a routine */
    routineId?: string;
    /** Routine execution ID if available */
    routineExecutionId?: string;
  };

  /** Soft delete timestamp (null if active) */
  deletedAt?: string | null;

  /** Conflict marker (for future conflict resolution) */
  conflict?: boolean;

  /** Legacy value if entry was migrated (for debugging) */
  legacyValue?: number | null;
}

/**
 * Get entry views for a single habit.
 * 
 * @param habitId - Habit ID
 * @param userId - User ID
 * @param args - Query arguments
 * @param args.startDayKey - Optional start DayKey (inclusive)
 * @param args.endDayKey - Optional end DayKey (inclusive)
 * @param args.timeZone - User's timezone for DayKey derivation
 * @returns Array of EntryView, sorted by dayKey asc, then timestampUtc asc
 */
export async function getEntryViewsForHabit(
  habitId: string,
  userId: string,
  args: { startDayKey?: DayKey; endDayKey?: DayKey; timeZone: string }
): Promise<EntryView[]> {
  // Fetch entries from repository
  const entries = await getHabitEntriesByHabit(habitId, userId);

  // Map to EntryView and filter by date range
  const views = entries
    .map(entry => mapEntryToView(entry, args.timeZone))
    .filter(view => {
      // Filter by date range if specified
      if (args.startDayKey && view.dayKey < args.startDayKey) {
        return false;
      }
      if (args.endDayKey && view.dayKey > args.endDayKey) {
        return false;
      }
      return true;
    });

  // Sort: primary by dayKey asc, secondary by timestampUtc asc
  views.sort((a, b) => {
    if (a.dayKey !== b.dayKey) {
      return a.dayKey.localeCompare(b.dayKey);
    }
    return a.timestampUtc.localeCompare(b.timestampUtc);
  });

  return views;
}

/**
 * Get entry views for multiple habits (batch query).
 * 
 * @param habitIds - Array of habit IDs
 * @param userId - User ID
 * @param args - Query arguments
 * @param args.startDayKey - Optional start DayKey (inclusive)
 * @param args.endDayKey - Optional end DayKey (inclusive)
 * @param args.timeZone - User's timezone for DayKey derivation
 * @returns Array of EntryView, sorted by dayKey asc, then timestampUtc asc
 */
export async function getEntryViewsForHabits(
  habitIds: string[],
  userId: string,
  args: { startDayKey?: DayKey; endDayKey?: DayKey; timeZone: string }
): Promise<EntryView[]> {
  // For batch queries, fetch all user entries and filter by habitIds
  // This is more efficient than N queries for N habits
  const allEntries = await getHabitEntriesByUser(userId);

  // Filter to requested habits
  const habitIdSet = new Set(habitIds);
  const relevantEntries = allEntries.filter(entry => habitIdSet.has(entry.habitId));

  // Map to EntryView and filter by date range
  const views = relevantEntries
    .map(entry => mapEntryToView(entry, args.timeZone))
    .filter(view => {
      // Filter by date range if specified
      if (args.startDayKey && view.dayKey < args.startDayKey) {
        return false;
      }
      if (args.endDayKey && view.dayKey > args.endDayKey) {
        return false;
      }
      return true;
    });

  // Sort: primary by dayKey asc, secondary by timestampUtc asc
  views.sort((a, b) => {
    if (a.dayKey !== b.dayKey) {
      return a.dayKey.localeCompare(b.dayKey);
    }
    return a.timestampUtc.localeCompare(b.timestampUtc);
  });

  return views;
}

/**
 * Maps a HabitEntry to an EntryView.
 * 
 * @param entry - HabitEntry from repository
 * @param timeZone - User's timezone for DayKey derivation
 * @returns EntryView
 */
function mapEntryToView(entry: HabitEntry, timeZone: string): EntryView {
  // Derive dayKey: prefer dateKey, then date, then derive from timestamp
  let dayKey: DayKey;
  
  if (entry.dateKey && isValidDayKey(entry.dateKey)) {
    dayKey = entry.dateKey;
  } else if (entry.date && isValidDayKey(entry.date)) {
    dayKey = entry.date;
  } else {
    // Derive from timestamp + timezone
    // TODO: This should not happen in production - all entries should have dayKey
    console.warn(
      `HabitEntry ${entry.id} missing dayKey/date. Deriving from timestamp ${entry.timestamp} in timezone ${timeZone}`
    );
    try {
      dayKey = formatDayKeyFromDate(new Date(entry.timestamp), timeZone);
    } catch (error) {
      throw new Error(
        `Failed to derive dayKey for entry ${entry.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Map source - handle legacy values
  let source: EntryView['source'];
  if (entry.source === 'manual' || entry.source === 'routine' || entry.source === 'quick' || entry.source === 'import' || entry.source === 'test') {
    source = entry.source;
  } else {
    // Unknown source - default to manual and log warning
    // TODO: Investigate unknown sources and map appropriately
    source = 'manual';
  }

  // Build provenance
  const provenance: EntryView['provenance'] = {};
  if (entry.routineId) {
    provenance.routineId = entry.routineId;
    // TODO: Add routineExecutionId when available in HabitEntry schema
  }

  return {
    habitId: entry.habitId,
    dayKey,
    timestampUtc: entry.timestamp,
    value: entry.value ?? null,
    unit: entry.unitSnapshot,
    source,
    provenance,
    deletedAt: entry.deletedAt ?? null,
    conflict: false, // TODO: Implement conflict detection
    legacyValue: undefined, // TODO: Populate if entry was migrated from DayLog
  };
}

