import type { Habit } from '../../models/persistenceTypes';
import { addDaysToDayKey, getDayOfWeekForDayKey, type DayKey } from '../time/dayKey';
import { deriveDailyHabitCompletion } from './completion';

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
  const targetValue = habit.timesPerWeek ?? 1;
  const entriesByDay = new Map<DayKey, WeeklyProgressEntry[]>();

  for (const entry of entries) {
    if (
      entry.habitId !== habit.id
      || entry.dayKey < weekStartDayKey
      || entry.dayKey > weekEndDayKey
      || entry.deletedAt
      || entry.note?.startsWith('freeze:')
      || (habit.assignedDays?.length && !habit.assignedDays.includes(getDayOfWeekForDayKey(entry.dayKey)))
    ) {
      continue;
    }

    const dayEntries = entriesByDay.get(entry.dayKey) ?? [];
    dayEntries.push(entry);
    entriesByDay.set(entry.dayKey, dayEntries);
  }

  const currentValue = Array.from(entriesByDay.values())
    .filter(dayEntries => deriveDailyHabitCompletion(habit, dayEntries).isComplete)
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
