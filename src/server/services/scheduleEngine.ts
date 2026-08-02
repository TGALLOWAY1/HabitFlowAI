/**
 * Schedule Engine
 *
 * Shared module for determining when a habit is "scheduled" (expected).
 * Used by analyticsService, streakService, and progress views to ensure
 * consistent opportunity counting.
 *
 * Handles: daily, daily+assignedDays, weekly, scheduled-daily (requiredDaysPerWeek).
 */

import type { Habit } from '../../models/persistenceTypes';
import {
  addDaysToDayKey,
  differenceInDayKeys,
  getDayOfWeekForDayKey,
  getIsoWeekStartDayKey,
  isValidDayKey,
} from '../../domain/time/dayKey';

/**
 * Returns the day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD dayKey.
 * Uses noon UTC to avoid DST edge cases.
 */
function getCreatedDayKey(habit: Habit): string | null {
  const candidate = habit.createdAt?.slice(0, 10);
  return candidate && isValidDayKey(candidate) ? candidate : null;
}

/**
 * Whether a habit is an individually trackable unit for analytics metrics.
 * Bundle parents and archived habits are excluded — analytics counts
 * individual child actions, not the derived bundle parent state.
 *
 * Note: Progress/dashboard views intentionally include bundle parents as
 * a single user-facing unit with derived completion. This is correct for
 * their different purposes:
 * - Analytics → individual action completion rates (children counted)
 * - Progress → user's daily habit list completion (bundles as one unit)
 */
export function isTrackableHabit(habit: Habit): boolean {
  return !habit.archived && !habit.deletedAt && habit.type !== 'bundle';
}

/**
 * Determines if a habit is "scheduled" (expected) on a specific day.
 *
 * Rules:
 * - timesPerWeek + assignedDays → only on assigned days
 * - timesPerWeek, no assignedDays → every day (user picks which days)
 * - Daily habit, with assignedDays → only on those days
 * - Daily habit, no assignedDays → every day
 */
export function isHabitScheduledOnDay(habit: Habit, dayKey: string): boolean {
  const createdDayKey = getCreatedDayKey(habit);
  if (createdDayKey && dayKey < createdDayKey) return false;

  const dow = getDayOfWeekForDayKey(dayKey);

  if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
    // Weekly-quota habit: show on assigned days if set, otherwise every day
    if (habit.assignedDays && habit.assignedDays.length > 0) {
      return habit.assignedDays.includes(dow);
    }
    return true;
  }

  // Daily or total frequency
  if (habit.assignedDays && habit.assignedDays.length > 0) {
    return habit.assignedDays.includes(dow);
  }

  // No assignedDays → scheduled every day
  return true;
}

/**
 * Returns the list of trackable habits scheduled on a given day.
 * Drop-in replacement for the old analyticsService.getScheduledHabitsForDay.
 */
export function getScheduledHabitsForDay(habits: Habit[], dayKey: string): Habit[] {
  return habits.filter(h => isHabitScheduledOnDay(h, dayKey));
}

/**
 * Count the total expected opportunities for a habit across a dayKey range (inclusive).
 */
export function getExpectedOpportunitiesInRange(
  habit: Habit,
  startDayKey: string,
  endDayKey: string
): number {
  const createdDayKey = getCreatedDayKey(habit);
  const effectiveStartDayKey = createdDayKey && createdDayKey > startDayKey
    ? createdDayKey
    : startDayKey;
  const totalDays = differenceInDayKeys(endDayKey, effectiveStartDayKey) + 1;

  if (totalDays <= 0) return 0;

  if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
    if (habit.assignedDays && habit.assignedDays.length > 0) {
      // Count assigned days in range
      let count = 0;
      for (let i = 0; i < totalDays; i++) {
        const dow = getDayOfWeekForDayKey(addDaysToDayKey(effectiveStartDayKey, i));
        if (habit.assignedDays.includes(dow)) count++;
      }
      return count;
    }
    // No assignedDays: count distinct weeks in range
    const weeks = new Set<string>();
    for (let i = 0; i < totalDays; i++) {
      const dayKey = addDaysToDayKey(effectiveStartDayKey, i);
      weeks.add(getIsoWeekStartDayKey(dayKey));
    }
    return weeks.size;
  }

  if (habit.assignedDays && habit.assignedDays.length > 0) {
    // Count days in range that fall on assigned days
    let count = 0;
    for (let i = 0; i < totalDays; i++) {
      const dow = getDayOfWeekForDayKey(addDaysToDayKey(effectiveStartDayKey, i));
      if (habit.assignedDays.includes(dow)) count++;
    }
    return count;
  }

  // Daily, no restrictions → every day
  return totalDays;
}
