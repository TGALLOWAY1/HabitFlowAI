/**
 * Goal Progress Utilities
 * 
 * Helper functions for computing goal progress and inactivity.
 */

import { getGoalById } from '../repositories/goalRepository';
import { getDayLogsByHabit } from '../repositories/dayLogRepository';
import { getGoalManualLogsByGoal } from '../repositories/goalManualLogRepository';
import type { Goal, GoalProgress, DayLog, GoalManualLog } from '../../models/persistenceTypes';

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
 * For cumulative goals: sums all log values from linked habits + manual logs.
 * For frequency goals: counts days where any linked habit was completed.
 * 
 * @param goalId - Goal ID
 * @param userId - User ID to verify ownership
 * @returns GoalProgress with currentValue, percent, lastSevenDays, and inactivityWarning, or null if goal not found
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

  // Fetch manual logs for cumulative goals
  let manualLogs: GoalManualLog[] = [];
  if (goal.type === 'cumulative') {
    manualLogs = await getGoalManualLogsByGoal(goalId, userId);
  }

  // Use the optimized function to compute full progress
  return computeFullGoalProgress(goal, allLogs, manualLogs);
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

/**
 * Compute full goal progress including last 7 days data and inactivity warning.
 * 
 * This is an optimized version that computes all progress data in a single pass.
 * 
 * For cumulative goals, includes both habit-derived progress and manual logs:
 * - currentValue = sum of all habit log values + sum of all manual log values
 * - lastSevenDays: for each day, sums habit log values + manual log values for that date
 * - Manual logs are matched to dates by extracting YYYY-MM-DD from loggedAt ISO timestamp
 * 
 * For frequency goals, manual logs are ignored (only habit completion counts).
 * 
 * @param goal - Goal entity
 * @param allLogs - All day logs for linked habits (pre-fetched)
 * @param manualLogs - All manual logs for the goal (pre-fetched, only for cumulative goals)
 * @returns GoalProgress with currentValue, percent, lastSevenDays, and inactivityWarning
 */
export function computeFullGoalProgress(
  goal: Goal,
  allLogs: DayLog[],
  manualLogs: GoalManualLog[] = []
): GoalProgress {
  // Get date range for last 30 days (most recent first)
  const last30Days: string[] = [];
  for (let i = 0; i < 30; i++) {
    last30Days.push(getDateString(i));
  }

  // Build map of logs by date for efficient lookup
  const logsByDate = new Map<string, DayLog[]>();
  for (const log of allLogs) {
    if (!logsByDate.has(log.date)) {
      logsByDate.set(log.date, []);
    }
    logsByDate.get(log.date)!.push(log);
  }

  // Build map of manual logs by date (for cumulative goals only)
  // Convert loggedAt ISO string to YYYY-MM-DD format for date matching
  const manualLogsByDate = new Map<string, GoalManualLog[]>();
  if (goal.type === 'cumulative') {
    for (const manualLog of manualLogs) {
      // Extract date from ISO timestamp (YYYY-MM-DD)
      const loggedDate = manualLog.loggedAt.split('T')[0];
      if (!manualLogsByDate.has(loggedDate)) {
        manualLogsByDate.set(loggedDate, []);
      }
      manualLogsByDate.get(loggedDate)!.push(manualLog);
    }
  }

  // Compute current value
  let currentValue: number;
  if (goal.type === 'cumulative') {
    // Sum all habit log values
    const habitValue = allLogs.reduce((sum, log) => sum + log.value, 0);
    // Sum all manual log values
    const manualValue = manualLogs.reduce((sum, log) => sum + log.value, 0);
    currentValue = habitValue + manualValue;
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

  // Compute last 30 days data
  const lastThirtyDaysData = last30Days.map(date => {
    const dayLogs = logsByDate.get(date) || [];
    let dayValue = 0;
    let hasProgress = false;

    if (goal.type === 'cumulative') {
      // Sum habit log values for this day
      const habitValue = dayLogs.reduce((sum, log) => sum + log.value, 0);
      // Sum manual log values for this day
      const dayManualLogs = manualLogsByDate.get(date) || [];
      const manualValue = dayManualLogs.reduce((sum, log) => sum + log.value, 0);
      dayValue = habitValue + manualValue;
      hasProgress = dayValue > 0;
    } else {
      // Check if any log was completed on this day
      hasProgress = dayLogs.some(log => log.completed);
      dayValue = hasProgress ? 1 : 0;
    }

    return {
      date,
      value: dayValue,
      hasProgress,
    };
  });

  // Extract last 7 days from the 30-day set for backward compatibility/specific UI needs
  const lastSevenDaysData = lastThirtyDaysData.slice(0, 7);

  // Compute inactivity warning (≥4 days without progress in the last 7 days)
  const daysWithoutProgress = lastSevenDaysData.filter(day => !day.hasProgress).length;
  const inactivityWarning = daysWithoutProgress >= 4;

  return {
    currentValue,
    percent,
    lastSevenDays: lastSevenDaysData,
    lastThirtyDays: lastThirtyDaysData,
    inactivityWarning,
  };
}

/**
 * Compute progress for multiple goals efficiently.
 * 
 * Fetches all goals and their logs in batch to avoid N+1 queries.
 * 
 * @param userId - User ID to filter goals and logs
 * @returns Array of goals with their computed progress
 */
export async function computeGoalsWithProgress(
  userId: string
): Promise<Array<{ goal: Goal; progress: GoalProgress }>> {
  const { getGoalsByUser } = await import('../repositories/goalRepository');
  const { getDayLogsByHabit } = await import('../repositories/dayLogRepository');
  const { getGoalManualLogsByGoals } = await import('../repositories/goalManualLogRepository');

  // Fetch all goals for the user
  const goals = await getGoalsByUser(userId);

  // Collect all unique habit IDs from all goals
  const allHabitIds = new Set<string>();
  for (const goal of goals) {
    for (const habitId of goal.linkedHabitIds) {
      allHabitIds.add(habitId);
    }
  }

  // Fetch all logs for all habits in one batch
  const allLogsMap = new Map<string, DayLog[]>();
  for (const habitId of allHabitIds) {
    const habitLogs = await getDayLogsByHabit(habitId, userId);
    const logsArray = Object.values(habitLogs);
    allLogsMap.set(habitId, logsArray);
  }

  // Fetch all manual logs for all cumulative goals in one batch
  const cumulativeGoalIds = goals.filter(g => g.type === 'cumulative').map(g => g.id);
  const allManualLogs = cumulativeGoalIds.length > 0
    ? await getGoalManualLogsByGoals(cumulativeGoalIds, userId)
    : [];

  // Build map of manual logs by goal ID
  const manualLogsByGoalId = new Map<string, GoalManualLog[]>();
  for (const manualLog of allManualLogs) {
    if (!manualLogsByGoalId.has(manualLog.goalId)) {
      manualLogsByGoalId.set(manualLog.goalId, []);
    }
    manualLogsByGoalId.get(manualLog.goalId)!.push(manualLog);
  }

  // Compute progress for each goal
  const results: Array<{ goal: Goal; progress: GoalProgress }> = [];

  for (const goal of goals) {
    // Collect all logs for this goal's linked habits
    const goalLogs: DayLog[] = [];
    for (const habitId of goal.linkedHabitIds) {
      const habitLogs = allLogsMap.get(habitId) || [];
      goalLogs.push(...habitLogs);
    }

    // Get manual logs for this goal (only for cumulative goals)
    const goalManualLogs = goal.type === 'cumulative'
      ? (manualLogsByGoalId.get(goal.id) || [])
      : [];

    // Compute full progress
    const progress = computeFullGoalProgress(goal, goalLogs, goalManualLogs);

    results.push({
      goal,
      progress,
    });
  }

  return results;
}
