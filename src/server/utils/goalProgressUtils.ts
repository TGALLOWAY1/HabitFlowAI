/**
 * Goal Progress Utilities
 * 
 * Helper functions for computing goal progress and inactivity.
 */

import { getGoalById } from '../repositories/goalRepository';
import { getDayLogsByHabit } from '../repositories/dayLogRepository';
import type { Goal, GoalProgress, DayLog } from '../../models/persistenceTypes';

/**
 * Get date string in YYYY-MM-DD format for N days ago.
 * 
 * @param daysAgo - Number of days ago (0 = today)
 * @returns Date string in YYYY-MM-DD format
 */
function getDateString(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string is within the last N days.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to look back
 * @returns True if date is within the last N days
 */
function isWithinLastDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

/**
 * Compute goal progress.
 * 
 * For cumulative goals: sums all log values from linked habits.
 * For frequency goals: counts days where any linked habit was completed.
 * 
 * @param goalId - Goal ID
 * @param userId - User ID to verify ownership
 * @returns GoalProgress with currentValue and percent, or null if goal not found
 */
export async function computeGoalProgress(
  goalId: string,
  userId: string
): Promise<GoalProgress | null> {
  // Fetch the goal
  const goal = await getGoalById(goalId, userId);
  if (!goal) {
    return null;
  }

  // Fetch all logs for linked habits
  const allLogs: DayLog[] = [];
  for (const habitId of goal.linkedHabitIds) {
    const habitLogs = await getDayLogsByHabit(habitId, userId);
    // Convert Record to array
    const logsArray = Object.values(habitLogs);
    allLogs.push(...logsArray);
  }

  let currentValue: number;

  if (goal.type === 'cumulative') {
    // Sum all log values
    currentValue = allLogs.reduce((sum, log) => sum + log.value, 0);
  } else {
    // Frequency: count unique days where any linked habit was completed
    const completedDates = new Set<string>();
    for (const log of allLogs) {
      if (log.completed) {
        completedDates.add(log.date);
      }
    }
    currentValue = completedDates.size;
  }

  // Calculate percentage
  const percent = goal.targetValue > 0
    ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
    : 0;

  return {
    currentValue,
    percent,
  };
}

/**
 * Get goal inactivity status.
 * 
 * Checks the last 7 days for progress (currentValue > 0).
 * Returns true if user had no progress for ≥ 4 days.
 * 
 * @param goalId - Goal ID
 * @param userId - User ID to verify ownership
 * @returns True if inactive (≥4 days with no progress), false otherwise, or null if goal not found
 */
export async function getGoalInactivity(
  goalId: string,
  userId: string
): Promise<boolean | null> {
  // Fetch the goal
  const goal = await getGoalById(goalId, userId);
  if (!goal) {
    return null;
  }

  // Get date range for last 7 days
  const last7Days: string[] = [];
  for (let i = 0; i < 7; i++) {
    last7Days.push(getDateString(i));
  }

  // Fetch all logs for linked habits
  const allLogs: DayLog[] = [];
  for (const habitId of goal.linkedHabitIds) {
    const habitLogs = await getDayLogsByHabit(habitId, userId);
    // Convert Record to array
    const logsArray = Object.values(habitLogs);
    allLogs.push(...logsArray);
  }

  // Track which days had progress
  const daysWithProgress = new Set<string>();

  for (const log of allLogs) {
    // Only consider logs from the last 7 days
    if (last7Days.includes(log.date)) {
      let hasProgress = false;

      if (goal.type === 'cumulative') {
        // For cumulative: any log with value > 0 counts as progress
        hasProgress = log.value > 0;
      } else {
        // For frequency: completed logs count as progress
        hasProgress = log.completed;
      }

      if (hasProgress) {
        daysWithProgress.add(log.date);
      }
    }
  }

  // Count days without progress
  const daysWithoutProgress = last7Days.length - daysWithProgress.size;

  // Return true if ≥ 4 days without progress
  return daysWithoutProgress >= 4;
}
