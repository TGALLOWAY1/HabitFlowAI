import {
  addDaysToDayKey,
  differenceInDayKeys,
  formatDayKeyFromDate,
  getDayOfWeekForDayKey,
  getIsoWeekStartDayKey,
  isValidDayKey,
} from '../time/dayKey';

export interface SchedulableHabit {
  archived?: boolean;
  deletedAt?: string;
  type?: string;
  createdAt?: string;
  timesPerWeek?: number;
  assignedDays?: number[];
  requiredDaysPerWeek?: number;
}

/**
 * Flexible weekly quotas are measured in completed weeks. A strict schedule
 * (every assigned day is required) remains an occurrence-based habit, so its
 * streak is expressed in completed scheduled days rather than collapsing a
 * long daily run into a single week.
 */
export function usesWeeklyQuotaStreak(habit: SchedulableHabit): boolean {
  if (habit.timesPerWeek != null && habit.timesPerWeek > 0) return true;

  return !!(
    habit.assignedDays?.length
    && habit.requiredDaysPerWeek != null
    && habit.requiredDaysPerWeek < habit.assignedDays.length
  );
}

export function getHabitCreatedDayKey(habit: SchedulableHabit, timeZone?: string): string | null {
  if (timeZone && habit.createdAt) {
    const createdAt = new Date(habit.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      try {
        return formatDayKeyFromDate(createdAt, timeZone);
      } catch {
        // Fall through to the stored ISO prefix for invalid timezone input.
      }
    }
  }

  const candidate = habit.createdAt?.slice(0, 10);
  return candidate && isValidDayKey(candidate) ? candidate : null;
}

export function isTrackableHabit(habit: SchedulableHabit): boolean {
  return !habit.archived && !habit.deletedAt && habit.type !== 'bundle';
}

export function isHabitScheduledOnDay(
  habit: SchedulableHabit,
  dayKey: string,
  timeZone?: string,
): boolean {
  const createdDayKey = getHabitCreatedDayKey(habit, timeZone);
  if (createdDayKey && dayKey < createdDayKey) return false;

  const dayOfWeek = getDayOfWeekForDayKey(dayKey);
  if (habit.assignedDays?.length) return habit.assignedDays.includes(dayOfWeek);
  return true;
}

export function getScheduledHabitsForDay<T extends SchedulableHabit>(
  habits: T[],
  dayKey: string,
  timeZone?: string,
): T[] {
  return habits.filter(habit => isHabitScheduledOnDay(habit, dayKey, timeZone));
}

export function getExpectedOpportunitiesInRange(
  habit: SchedulableHabit,
  startDayKey: string,
  endDayKey: string,
  timeZone?: string,
): number {
  const createdDayKey = getHabitCreatedDayKey(habit, timeZone);
  const effectiveStartDayKey = createdDayKey && createdDayKey > startDayKey
    ? createdDayKey
    : startDayKey;
  const totalDays = differenceInDayKeys(endDayKey, effectiveStartDayKey) + 1;

  if (totalDays <= 0) return 0;

  if (habit.timesPerWeek != null && habit.timesPerWeek > 0 && !habit.assignedDays?.length) {
    const weeks = new Set<string>();
    for (let offset = 0; offset < totalDays; offset++) {
      weeks.add(getIsoWeekStartDayKey(addDaysToDayKey(effectiveStartDayKey, offset)));
    }
    return weeks.size;
  }

  if (habit.assignedDays?.length) {
    let count = 0;
    for (let offset = 0; offset < totalDays; offset++) {
      const dayOfWeek = getDayOfWeekForDayKey(addDaysToDayKey(effectiveStartDayKey, offset));
      if (habit.assignedDays.includes(dayOfWeek)) count++;
    }
    return count;
  }

  return totalDays;
}
