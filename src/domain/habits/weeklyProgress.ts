import type { Habit } from '../../models/persistenceTypes';
import { addDaysToDayKey, type DayKey } from '../time/dayKey';
import { deriveDailyHabitCompletion } from './completion';
import { isHabitScheduledOnDay } from './schedule';
import { resolveHabitTrackingForDay } from './trackingHistory';

export interface WeeklyProgressEntry {
  habitId: string;
  dayKey: DayKey;
  value?: number | null;
  deletedAt?: string | null;
  note?: string;
}

export interface WeeklyHabitProgress {
  isComplete: boolean;
  isPartial: boolean;
  currentValue: number;
  targetValue: number;
}

/**
 * Derive a weekly quota from distinct, completed, scheduled calendar days.
 * Raw quantities and duplicate entries never inflate the occurrence count.
 */
export function deriveWeeklyHabitProgress(
  habit: Habit,
  weekStartDayKey: DayKey,
  weekEndDayKey: DayKey,
  entries: WeeklyProgressEntry[],
): WeeklyHabitProgress {
  const targetValue = resolveHabitTrackingForDay(habit, weekEndDayKey).timesPerWeek ?? 1;
  const entriesByDay = new Map<DayKey, WeeklyProgressEntry[]>();

  for (const entry of entries) {
    if (
      entry.habitId !== habit.id
      || entry.dayKey < weekStartDayKey
      || entry.dayKey > weekEndDayKey
      || entry.deletedAt
      || entry.note?.startsWith('freeze:')
      || !isHabitScheduledOnDay(habit, entry.dayKey)
    ) {
      continue;
    }

    const dayEntries = entriesByDay.get(entry.dayKey) ?? [];
    dayEntries.push(entry);
    entriesByDay.set(entry.dayKey, dayEntries);
  }

  const currentValue = Array.from(entriesByDay.values())
    .filter(dayEntries => deriveDailyHabitCompletion(habit, dayEntries, dayEntries[0]?.dayKey).isComplete)
    .length;

  return {
    isComplete: targetValue > 0 && currentValue >= targetValue,
    isPartial: currentValue > 0 && currentValue < targetValue,
    currentValue,
    targetValue,
  };
}

/** Convenience helper for an ISO (Monday-start) week. */
export function getIsoWeekEndDayKey(weekStartDayKey: DayKey): DayKey {
  return addDaysToDayKey(weekStartDayKey, 6);
}
