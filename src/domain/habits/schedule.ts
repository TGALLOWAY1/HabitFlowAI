import {
  addDaysToDayKey,
  differenceInDayKeys,
  formatDayKeyFromDate,
  getDayOfWeekForDayKey,
  getIsoWeekStartDayKey,
  isValidDayKey,
} from '../time/dayKey';
import type { HabitInactivePeriod, HabitTrackingGoal, HabitTrackingRevision } from '../../shared/habitTracking';
import { isHabitInactiveOnDay, resolveHabitTrackingForDay } from './trackingHistory';

export interface SchedulableHabit {
  archived?: boolean;
  deletedAt?: string;
  type?: string;
  createdAt?: string;
  timesPerWeek?: number;
  assignedDays?: number[];
  requiredDaysPerWeek?: number;
  goal: HabitTrackingGoal;
  trackingRevisions?: HabitTrackingRevision[];
  inactivePeriods?: HabitInactivePeriod[];
}

/**
 * Flexible weekly quotas are measured in completed weeks. A strict schedule
 * (every assigned day is required) remains an occurrence-based habit, so its
 * streak is expressed in completed scheduled days rather than collapsing a
 * long daily run into a single week.
 */
export function usesWeeklyQuotaStreak(habit: SchedulableHabit, dayKey?: string): boolean {
  const tracking = resolveHabitTrackingForDay(habit, dayKey);
  if (tracking.timesPerWeek != null && tracking.timesPerWeek > 0) return true;

  return !!(
    tracking.assignedDays?.length
    && tracking.requiredDaysPerWeek != null
    && tracking.requiredDaysPerWeek < tracking.assignedDays.length
  );
}

export function getWeeklyQuotaTargetOnDay(
  habit: SchedulableHabit,
  dayKey: string,
): number | null {
  const tracking = resolveHabitTrackingForDay(habit, dayKey);
  if (tracking.timesPerWeek != null && tracking.timesPerWeek > 0) {
    return tracking.timesPerWeek;
  }
  if (
    tracking.assignedDays?.length
    && tracking.requiredDaysPerWeek != null
    && tracking.requiredDaysPerWeek < tracking.assignedDays.length
  ) {
    return tracking.requiredDaysPerWeek;
  }
  return null;
}

export function hasExplicitWeeklyQuotaOnDay(
  habit: SchedulableHabit,
  dayKey: string,
): boolean {
  const tracking = resolveHabitTrackingForDay(habit, dayKey);
  return tracking.timesPerWeek != null && tracking.timesPerWeek > 0;
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

/** Match schedule rules without applying the habit document creation boundary. */
export function matchesHabitScheduleOnDay(
  habit: SchedulableHabit,
  dayKey: string,
): boolean {
  if (isHabitInactiveOnDay(habit, dayKey)) return false;

  const tracking = resolveHabitTrackingForDay(habit, dayKey);
  const dayOfWeek = getDayOfWeekForDayKey(dayKey);
  if (tracking.assignedDays?.length) return tracking.assignedDays.includes(dayOfWeek);
  return true;
}

export function isHabitScheduledOnDay(
  habit: SchedulableHabit,
  dayKey: string,
  timeZone?: string,
): boolean {
  const createdDayKey = getHabitCreatedDayKey(habit, timeZone);
  if (createdDayKey && dayKey < createdDayKey) return false;
  return matchesHabitScheduleOnDay(habit, dayKey);
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

  const quotaWeeks = new Set<string>();
  let dailyOpportunities = 0;
  for (let offset = 0; offset < totalDays; offset++) {
    const dayKey = addDaysToDayKey(effectiveStartDayKey, offset);
    if (!isHabitScheduledOnDay(habit, dayKey, timeZone)) continue;
    const tracking = resolveHabitTrackingForDay(habit, dayKey);
    if (tracking.timesPerWeek != null && tracking.timesPerWeek > 0 && !tracking.assignedDays?.length) {
      quotaWeeks.add(getIsoWeekStartDayKey(dayKey));
    } else {
      dailyOpportunities += 1;
    }
  }
  return dailyOpportunities + quotaWeeks.size;
}
