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
import { getDayLogsByHabit, getDayLogsByUser } from '../repositories/dayLogRepository';
import type { HabitEntry, DayLog } from '../../models/persistenceTypes';
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
 * Fetches both HabitEntries (primary truth) and DayLogs (legacy fallback),
 * merges them with HabitEntries taking precedence, and returns unified EntryViews.
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
  // Fetch both HabitEntries (primary) and DayLogs (legacy)
  const [entries, dayLogsRecord] = await Promise.all([
    getHabitEntriesByHabit(habitId, userId),
    getDayLogsByHabit(habitId, userId),
  ]);

  // Convert DayLog Record to array
  const dayLogs = Object.values(dayLogsRecord);

  // Map both sources to EntryView
  const entryViews = entries.map(entry => mapEntryToView(entry, args.timeZone));
  const legacyViews = dayLogs.map(log => mapDayLogToView(log, args.timeZone));

  // Merge and dedupe: prefer HabitEntry over DayLog
  const mergedViews = mergeEntryViews(entryViews, legacyViews);

  // Filter by date range if specified
  const filteredViews = mergedViews.filter(view => {
    if (args.startDayKey && view.dayKey < args.startDayKey) {
      return false;
    }
    if (args.endDayKey && view.dayKey > args.endDayKey) {
      return false;
    }
    return true;
  });

  // Sort: primary by dayKey asc, secondary by timestampUtc asc
  // Guard against undefined dayKey or timestampUtc
  filteredViews.sort((a, b) => {
    const aDayKey = a.dayKey || '';
    const bDayKey = b.dayKey || '';
    if (aDayKey !== bDayKey) {
      return aDayKey.localeCompare(bDayKey);
    }
    const aTimestamp = a.timestampUtc || '';
    const bTimestamp = b.timestampUtc || '';
    return aTimestamp.localeCompare(bTimestamp);
  });

  return filteredViews;
}

/**
 * Get entry views for multiple habits (batch query).
 * 
 * Fetches both HabitEntries (primary truth) and DayLogs (legacy fallback),
 * merges them with HabitEntries taking precedence, and returns unified EntryViews.
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
  // For batch queries, fetch all user entries and dayLogs, then filter by habitIds
  // This is more efficient than N queries for N habits
  const [allEntries, allDayLogsRecord] = await Promise.all([
    getHabitEntriesByUser(userId),
    getDayLogsByUser(userId),
  ]);

  // Filter to requested habits
  const habitIdSet = new Set(habitIds);
  const relevantEntries = allEntries.filter(entry => habitIdSet.has(entry.habitId));
  const relevantDayLogs = Object.values(allDayLogsRecord).filter(log => habitIdSet.has(log.habitId));

  // Map both sources to EntryView
  const entryViews = relevantEntries.map(entry => mapEntryToView(entry, args.timeZone));
  const legacyViews = relevantDayLogs.map(log => mapDayLogToView(log, args.timeZone));

  // Merge and dedupe: prefer HabitEntry over DayLog
  const mergedViews = mergeEntryViews(entryViews, legacyViews);

  // Filter by date range if specified
  const filteredViews = mergedViews.filter(view => {
    if (args.startDayKey && view.dayKey < args.startDayKey) {
      return false;
    }
    if (args.endDayKey && view.dayKey > args.endDayKey) {
      return false;
    }
    return true;
  });

  // Sort: primary by dayKey asc, secondary by timestampUtc asc
  // Guard against undefined dayKey or timestampUtc
  filteredViews.sort((a, b) => {
    const aDayKey = a.dayKey || '';
    const bDayKey = b.dayKey || '';
    if (aDayKey !== bDayKey) {
      return aDayKey.localeCompare(bDayKey);
    }
    const aTimestamp = a.timestampUtc || '';
    const bTimestamp = b.timestampUtc || '';
    return aTimestamp.localeCompare(bTimestamp);
  });

  return filteredViews;
}

/**
 * Maps a HabitEntry to an EntryView.
 * 
 * @param entry - HabitEntry from repository
 * @param timeZone - User's timezone for DayKey derivation
 * @returns EntryView
 */
function mapEntryToView(entry: HabitEntry, timeZone: string): EntryView {
  // Derive dayKey: prefer dayKey (canonical), then date (legacy), then dateKey (deprecated), then derive from timestamp
  let dayKey: DayKey;
  
  if (entry.dayKey && isValidDayKey(entry.dayKey)) {
    // Canonical dayKey field (preferred)
    dayKey = entry.dayKey;
  } else if (entry.date && isValidDayKey(entry.date)) {
    // Legacy date field (backward compatibility)
    dayKey = entry.date;
  } else if (entry.dateKey && isValidDayKey(entry.dateKey)) {
    // Deprecated dateKey field (backward compatibility)
    dayKey = entry.dateKey;
  } else {
    // Derive from timestamp + timezone (fallback for legacy entries)
    // TODO: This should not happen in production - all entries should have dayKey
    console.warn(
      `HabitEntry ${entry.id} missing dayKey/date/dateKey. Deriving from timestamp ${entry.timestamp} in timezone ${timeZone}`
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
    timestampUtc: entry.timestamp || new Date().toISOString(), // Fallback to current time if missing
    value: entry.value ?? null,
    unit: entry.unitSnapshot,
    source,
    provenance,
    deletedAt: entry.deletedAt ?? null,
    conflict: false, // Set during merge if conflict detected
    legacyValue: undefined,
  };
}

/**
 * Maps a DayLog (legacy) to an EntryView.
 * 
 * DayLogs represent completion/value for a habit on a day but lack granularity
 * of individual entries. This mapping creates a synthetic EntryView for compatibility.
 * 
 * @param log - DayLog from repository
 * @param _timeZone - User's timezone for DayKey validation (unused but kept for API consistency)
 * @returns EntryView
 */
function mapDayLogToView(log: DayLog, _timeZone: string): EntryView {
  // Validate and use date as dayKey
  let dayKey: DayKey;
  if (log.date && isValidDayKey(log.date)) {
    dayKey = log.date;
  } else {
    throw new Error(`DayLog has invalid date format: ${log.date}`);
  }

  // Determine value: for boolean completion, use null (existence represents completion)
  // For numeric habits, use the value
  // Store original value in legacyValue for conflict detection
  let value: number | null;
  const originalValue = log.value ?? null;
  
  if (log.value !== undefined && log.value !== null) {
    // If completed is true but value is 0, this is a boolean completion
    // Use null to represent "completed but no numeric value"
    if (log.completed && log.value === 0) {
      value = null;
    } else {
      value = log.value;
    }
  } else {
    // No value - use null
    value = null;
  }

  // Synthesize timestamp: DayLogs don't have timestamps, so use deterministic synthetic time
  // Use noon (12:00:00) on the day in UTC to avoid timezone edge cases
  const timestampUtc = `${dayKey}T12:00:00.000Z`;

  // Map source
  const source: EntryView['source'] = log.source === 'routine' ? 'routine' : 'legacy';

  // Build provenance
  const provenance: EntryView['provenance'] = {};
  if (log.routineId) {
    provenance.routineId = log.routineId;
  }

  return {
    habitId: log.habitId,
    dayKey,
    timestampUtc,
    value,
    unit: undefined, // DayLogs don't store unit
    source,
    provenance,
    deletedAt: null, // DayLogs don't have soft delete
    conflict: false, // Set during merge if conflict detected
    legacyValue: originalValue, // Store original value for debugging/conflict detection
  };
}

/**
 * Merges EntryViews from HabitEntries (primary) and DayLogs (legacy).
 * 
 * Deduplication rules:
 * - Allow multiple HabitEntries per (habitId, dayKey) - they are all kept
 * - For each (habitId, dayKey), check if a DayLog exists
 * - If DayLog exists and no HabitEntry exists for that day, add DayLog
 * - If both exist, keep all HabitEntries and mark conflicts on entries that disagree with DayLog
 * 
 * @param entryViews - Views from HabitEntries (primary truth) - can have multiple per day
 * @param legacyViews - Views from DayLogs (legacy fallback) - one per (habitId, dayKey)
 * @returns Merged EntryViews with deduplication applied
 */
function mergeEntryViews(entryViews: EntryView[], legacyViews: EntryView[]): EntryView[] {
  // Build a map of (habitId, dayKey) -> DayLog EntryView (only one per day)
  const legacyMap = new Map<string, EntryView>();
  for (const legacyView of legacyViews) {
    const key = `${legacyView.habitId}:${legacyView.dayKey}`;
    // DayLogs are one per day, so we can safely set (not append)
    legacyMap.set(key, legacyView);
  }

  // Start with all HabitEntry views
  const merged: EntryView[] = [...entryViews];

  // For each legacy view, check if we need to add it or mark conflicts
  for (const legacyView of legacyViews) {
    // Find all HabitEntry views for this (habitId, dayKey)
    const entriesForDay = entryViews.filter(
      v => v.habitId === legacyView.habitId && v.dayKey === legacyView.dayKey
    );

    if (entriesForDay.length === 0) {
      // No HabitEntry exists for this (habitId, dayKey) - add legacy
      merged.push(legacyView);
    } else {
      // Both exist - check for conflicts on each HabitEntry
      for (const entryView of entriesForDay) {
        const hasConflict = detectConflict(entryView, legacyView);
        if (hasConflict) {
          entryView.conflict = true;
          // Store legacy value for debugging
          entryView.legacyValue = legacyView.legacyValue ?? legacyView.value;
        }
      }
    }
  }

  return merged;
}

/**
 * Detects if two EntryViews conflict (same habit/day but different values).
 * 
 * @param entryView - View from HabitEntry (primary)
 * @param legacyView - View from DayLog (legacy)
 * @returns True if there's a meaningful conflict
 */
function detectConflict(entryView: EntryView, legacyView: EntryView): boolean {
  // Both have numeric values and they differ
  if (entryView.value !== null && legacyView.value !== null) {
    return entryView.value !== legacyView.value;
  }

  // One has value, other is null - check if this represents a conflict
  // If entry has value but legacy is null (completed but no value), not a conflict
  // If entry is null but legacy has value, this could be a conflict
  // However, for boolean completion: entry value=1 vs legacy value=null (from 0) is a conflict
  if (entryView.value !== null && legacyView.value === null) {
    // Entry has value, legacy is null
    // Check if legacy had a value originally (stored in legacyValue)
    // If legacyValue exists and differs from entry value, it's a conflict
    if (legacyView.legacyValue !== null && legacyView.legacyValue !== undefined) {
      // Legacy had a value originally - compare with entry
      // For boolean: legacyValue 0 vs entry value 1 is a conflict
      return legacyView.legacyValue !== entryView.value;
    }
    return false; // Legacy never had a value - no conflict
  }
  if (entryView.value === null && legacyView.value !== null) {
    // Entry is null but legacy has value - this is a conflict
    return true;
  }

  // Both null - no conflict
  return false;
}

