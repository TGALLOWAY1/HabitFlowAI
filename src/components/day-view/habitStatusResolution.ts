import type { DayLog, Habit } from '../../types';
import { deriveDailyHabitCompletion } from '../../domain/habits/completion';
import { getIsoWeekStartDayKey } from '../../domain/time/dayKey';
import { deriveWeeklyHabitProgress, getIsoWeekEndDayKey } from '../../domain/habits/weeklyProgress';

export interface DayViewHabitStatus {
  habit: Habit;
  isComplete: boolean;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  weekComplete?: boolean;
  completedChildrenCount?: number;
  totalChildrenCount?: number;
}

interface ResolveLocalHabitStatusesInput {
  baseStatuses: Map<string, DayViewHabitStatus>;
  habits: Habit[];
  logs: Record<string, DayLog>;
  dayKey: string;
}

/**
 * Merge authoritative server statuses with the local entry cache used for
 * optimistic UI. Every numeric indicator is derived from the same completion
 * function; a missing server row receives a type-correct baseline instead of
 * the old hard-coded boolean target of 1.
 */
export function resolveLocalHabitStatuses({
  baseStatuses,
  habits,
  logs,
  dayKey,
}: ResolveLocalHabitStatusesInput): Map<string, DayViewHabitStatus> {
  const resolved = new Map(baseStatuses);

  for (const habit of habits) {
    if (habit.type === 'bundle') continue;

    const existing = resolved.get(habit.id);
    const currentDayLog = logs[`${habit.id}-${dayKey}`];

    if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
      // Recompute only when the local cache has evidence for this week or the
      // server has not returned the newly-created habit yet.
      const weekStartDayKey = getIsoWeekStartDayKey(dayKey);
      const weekEndDayKey = getIsoWeekEndDayKey(weekStartDayKey);
      const weekLogs = Object.values(logs)
        .filter(log => log.habitId === habit.id && log.date >= weekStartDayKey && log.date <= weekEndDayKey)
        .map(log => ({ habitId: log.habitId, dayKey: log.date, value: log.value }));

      if (weekLogs.length > 0 || !existing) {
        const progress = deriveWeeklyHabitProgress(habit, weekStartDayKey, weekEndDayKey, weekLogs);
        resolved.set(habit.id, {
          ...(existing ?? { habit }),
          habit,
          ...progress,
          weekComplete: progress.isComplete,
          progressPercent: progress.targetValue > 0
            ? Math.min(100, Math.round((progress.currentValue / progress.targetValue) * 100))
            : 0,
        });
      }
      continue;
    }

    if (currentDayLog !== undefined || !existing) {
      const completion = deriveDailyHabitCompletion(
        habit,
        currentDayLog ? [{ value: currentDayLog.value }] : [],
      );
      resolved.set(habit.id, {
        ...(existing ?? { habit }),
        habit,
        ...completion,
      });
    }
  }

  return resolved;
}
