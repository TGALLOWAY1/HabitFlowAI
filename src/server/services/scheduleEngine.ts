/**
 * Schedule Engine
 *
 * Shared module for determining when a habit is "scheduled" (expected).
 * Used by analyticsService, streakService, and progress views to ensure
 * consistent opportunity counting.
 *
 * Handles: daily, daily+assignedDays, weekly, scheduled-daily (requiredDaysPerWeek).
 */

import { parseISO, differenceInCalendarDays, startOfWeek, format } from 'date-fns';
import type { Habit } from '../../models/persistenceTypes';

/**
 * Returns the day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD dayKey.
 * Uses noon UTC to avoid DST edge cases.
 */
function dayOfWeek(dayKey: string): number {
  return new Date(dayKey + 'T12:00:00Z').getUTCDay();
}

/**
 * Returns the Monday-based ISO week start dayKey for a given dayKey.
 */
function weekStartDayKey(dayKey: string): string {
  const date = parseISO(dayKey);
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
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
  return !habit.archived && habit.type !== 'bundle';
}

/**
 * Determines if a habit is "scheduled" (expected) on a specific day.
 *
 * Rules:
 * - Daily habit, no assignedDays → every day
 * - Daily habit, with assignedDays → only on those days
 * - Weekly habit → once per week (on Monday, or first assignedDay if set)
 * - Scheduled-daily (assignedDays + requiredDaysPerWeek) → on assigned days
 */
export function isHabitScheduledOnDay(habit: Habit, dayKey: string): boolean {
  const freq = habit.goal.frequency;
  const dow = dayOfWeek(dayKey);

  if (freq === 'weekly') {
    // Weekly habits count as scheduled once per week.
    // Use the first assignedDay if set, otherwise Monday (1).
    const scheduledDay = habit.assignedDays?.length ? habit.assignedDays[0] : 1;
    return dow === scheduledDay;
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
  const start = parseISO(startDayKey);
  const end = parseISO(endDayKey);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  if (totalDays <= 0) return 0;

  const freq = habit.goal.frequency;

  if (freq === 'weekly') {
    // Count distinct weeks in the range
    const weeks = new Set<string>();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dk = format(d, 'yyyy-MM-dd');
      weeks.add(weekStartDayKey(dk));
    }
    return weeks.size;
  }

  if (habit.assignedDays && habit.assignedDays.length > 0) {
    // Count days in range that fall on assigned days
    let count = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dow = d.getUTCDay();
      if (habit.assignedDays.includes(dow)) count++;
    }
    return count;
  }

  // Daily, no restrictions → every day
  return totalDays;
}
