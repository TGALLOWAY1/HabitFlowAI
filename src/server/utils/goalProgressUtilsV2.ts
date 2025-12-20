/**
 * Goal Progress Utilities V2
 * 
 * Refactored to use truthQuery (EntryViews) instead of DayLogs.
 * This is the canonical implementation for goal progress computation.
 * 
 * All goal progress reads must go through truthQuery.
 */

import { getGoalById } from '../repositories/goalRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getGoalManualLogsByGoal } from '../repositories/goalManualLogRepository';
import { getEntryViewsForHabits } from '../services/truthQuery';
import type { Goal, GoalProgress, GoalManualLog, Habit } from '../../models/persistenceTypes';
import type { EntryView } from '../services/truthQuery';
import type { DayKey } from '../../domain/time/dayKey';

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
 * Helper to resolve bundle IDs to their sub-habit IDs.
 * If a habit is a bundle, returns its subHabitIds.
 * If a habit is not a bundle, returns the habit ID itself.
 * 
 * @param habitIds - List of habit IDs to resolve
 * @param userId - User ID
 * @returns Array of resolved habit IDs (flattened)
 */
async function resolveBundleIds(habitIds: string[], userId: string): Promise<string[]> {
  const resolvedIds = new Set<string>();
  const allHabits = await getHabitsByUser(userId);
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  for (const id of habitIds) {
    const habit = habitMap.get(id);
    if (habit?.type === 'bundle' && habit.subHabitIds) {
      habit.subHabitIds.forEach(subId => resolvedIds.add(subId));
    } else {
      resolvedIds.add(id);
    }
  }

  return Array.from(resolvedIds);
}

/**
 * Compute goal progress using truthQuery (EntryViews).
 * 
 * For cumulative goals: sums all entry values from linked habits + manual logs.
 * For frequency goals: counts distinct dayKeys where entries exist.
 * 
 * @param goalId - Goal ID
 * @param userId - User ID to verify ownership
 * @param timeZone - User's timezone for DayKey operations (defaults to UTC)
 * @returns GoalProgress with currentValue, percent, lastSevenDays, and inactivityWarning, or null if goal not found
 */
export async function computeGoalProgressV2(
  goalId: string,
  userId: string,
  timeZone: string = 'UTC'
): Promise<GoalProgress | null> {
  // Fetch the goal
  const goal = await getGoalById(goalId, userId);
  if (!goal) {
    return null;
  }

  // Resolve any bundles in linkedHabitIds to their sub-habits
  const resolvedHabitIds = await resolveBundleIds(goal.linkedHabitIds, userId);

  // Fetch EntryViews via truthQuery (unified HabitEntries + legacy DayLogs)
  const entryViews = await getEntryViewsForHabits(resolvedHabitIds, userId, {
    timeZone,
  });

  // Filter out deleted entries
  const activeEntries = entryViews.filter(entry => !entry.deletedAt);

  // Fetch manual logs for cumulative goals
  let manualLogs: GoalManualLog[] = [];
  if (goal.type === 'cumulative') {
    manualLogs = await getGoalManualLogsByGoal(goalId, userId);
  }

  // Fetch relevant habits for unit checking
  const allHabits = await getHabitsByUser(userId);
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  // Use the optimized function to compute full progress
  return computeFullGoalProgressV2(goal, activeEntries, manualLogs, habitMap, timeZone);
}

/**
 * Compute full goal progress from EntryViews.
 * 
 * @param goal - Goal object
 * @param entryViews - EntryViews from truthQuery (already filtered to linked habits)
 * @param manualLogs - Manual logs for cumulative goals
 * @param habitMap - Map of habitId -> Habit for unit checking
 * @param timeZone - User's timezone for date operations
 * @returns GoalProgress
 */
export function computeFullGoalProgressV2(
  goal: Goal,
  entryViews: EntryView[],
  manualLogs: GoalManualLog[] = [],
  habitMap?: Map<string, Habit>,
  timeZone: string = 'UTC'
): GoalProgress {
  // Get date range for last 30 days (most recent first)
  const last30Days: DayKey[] = [];
  for (let i = 0; i < 30; i++) {
    last30Days.push(getDateString(i) as DayKey);
  }

  // Build map of entries by date for efficient lookup
  const entriesByDate = new Map<DayKey, EntryView[]>();
  for (const entry of entryViews) {
    if (!entriesByDate.has(entry.dayKey)) {
      entriesByDate.set(entry.dayKey, []);
    }
    entriesByDate.get(entry.dayKey)!.push(entry);
  }

  // Build map of manual logs by date (for cumulative goals only)
  const manualLogsByDate = new Map<DayKey, GoalManualLog[]>();
  if (goal.type === 'cumulative') {
    for (const manualLog of manualLogs) {
      // Extract date from ISO timestamp (YYYY-MM-DD)
      const loggedDate = manualLog.loggedAt.split('T')[0] as DayKey;
      if (!manualLogsByDate.has(loggedDate)) {
        manualLogsByDate.set(loggedDate, []);
      }
      manualLogsByDate.get(loggedDate)!.push(manualLog);
    }
  }

  // Compute current value
  let currentValue: number;
  if (goal.type === 'cumulative') {
    // Sum all entry values (STRICT AGGREGATION)
    const habitValue = entryViews.reduce((sum, entry) => {
      // Type-Based Aggregation Logic
      if (habitMap && goal.unit) {
        const habit = habitMap.get(entry.habitId);
        if (!habit) return sum;

        // Exclude Boolean habits from Cumulative/Numeric goals
        if (habit.goal.type === 'boolean') {
          return sum;
        }
        // Include all Numeric habits regardless of unit typo
      }
      return sum + (entry.value ?? 0);
    }, 0);
    // Sum all manual log values
    const manualValue = manualLogs.reduce((sum, log) => sum + log.value, 0);
    currentValue = habitValue + manualValue;
  } else {
    // Frequency OR OneTime: count distinct dayKeys where entries exist
    const completedDayKeys = new Set<DayKey>();
    for (const entry of entryViews) {
      completedDayKeys.add(entry.dayKey);
    }
    currentValue = completedDayKeys.size;
  }

  // Calculate percentage
  let percent = 0;
  if (goal.type === 'onetime') {
    // OneTime goals are binary: 0% or 100% based on completedAt
    percent = goal.completedAt ? 100 : 0;
  } else {
    // Cumulative or Frequency
    // Ensure targetValue exists and is > 0 to avoid division by zero/undefined
    percent = (goal.targetValue && goal.targetValue > 0)
      ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
      : 0;
  }

  // Compute last 30 days data
  const lastThirtyDaysData = last30Days.map(date => {
    const dayEntries = entriesByDate.get(date) || [];
    let dayValue = 0;
    let hasProgress = false;

    if (goal.type === 'cumulative') {
      // Sum entry values for this day (STRICT AGGREGATION)
      const habitValue = dayEntries.reduce((sum, entry) => {
        if (habitMap && goal.unit) {
          const habit = habitMap.get(entry.habitId);
          if (!habit) return sum;

          // Type-Based Aggregation (Daily History Loop)
          // Exclude Boolean habits from Cumulative/Numeric goals
          if (habit.goal.type === 'boolean') {
            return sum;
          }
          // Include all Numeric habits (ignore unit string mismatch)
        }
        return sum + (entry.value ?? 0);
      }, 0);
      // Sum manual log values for this day
      const dayManualLogs = manualLogsByDate.get(date) || [];
      const manualValue = dayManualLogs.reduce((sum, log) => sum + log.value, 0);
      dayValue = habitValue + manualValue;
      hasProgress = dayValue > 0;
    } else {
      // Frequency OR OneTime
      // Check if any entry exists on this day
      hasProgress = dayEntries.length > 0;
      dayValue = hasProgress ? 1 : 0;
    }

    return {
      date,
      value: dayValue,
      hasProgress,
    };
  });

  // Extract last 7 days from the 30-day set
  const lastSevenDaysData = lastThirtyDaysData.slice(0, 7);

  // Compute inactivity warning (≥4 days without progress in the last 7 days)
  const daysWithoutProgress = lastSevenDaysData.filter(day => !day.hasProgress).length;

  // Only show inactivity warning if goal is NOT completed
  const inactivityWarning = !goal.completedAt && daysWithoutProgress >= 4;

  return {
    currentValue,
    percent,
    lastSevenDays: lastSevenDaysData,
    lastThirtyDays: lastThirtyDaysData,
    inactivityWarning,
  };
}

/**
 * Compute progress for multiple goals efficiently using truthQuery.
 * 
 * Fetches all goals and their EntryViews in batch to avoid N+1 queries.
 * 
 * @param userId - User ID to filter goals and entries
 * @param timeZone - User's timezone for DayKey operations (defaults to UTC)
 * @returns Array of goals with their computed progress
 */
export async function computeGoalsWithProgressV2(
  userId: string,
  timeZone: string = 'UTC'
): Promise<Array<{ goal: Goal; progress: GoalProgress }>> {
  const { getGoalsByUser } = await import('../repositories/goalRepository');
  const { getGoalManualLogsByGoals } = await import('../repositories/goalManualLogRepository');

  // Fetch all goals for the user
  const goals = await getGoalsByUser(userId);

  // Fetch all habits for the user to resolve bundles
  const { getHabitsByUser } = await import('../repositories/habitRepository');
  const allHabits = await getHabitsByUser(userId);
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  // Collect all unique habit IDs from all goals, resolving bundles
  const allHabitIds = new Set<string>();

  // Helper to resolve a single goal's habits synchronously using the pre-fetched map
  const getResolvedHabitsForGoal = (goal: Goal): string[] => {
    const resolved = new Set<string>();
    for (const habitId of goal.linkedHabitIds) {
      const habit = habitMap.get(habitId);
      if (habit?.type === 'bundle' && habit.subHabitIds) {
        habit.subHabitIds.forEach(subId => resolved.add(subId));
      } else {
        resolved.add(habitId);
      }
    }
    return Array.from(resolved);
  };

  for (const goal of goals) {
    const resolvedIds = getResolvedHabitsForGoal(goal);
    for (const id of resolvedIds) {
      allHabitIds.add(id);
    }
  }

  // Fetch all EntryViews for all habits in one batch via truthQuery
  const allEntryViews = await getEntryViewsForHabits(Array.from(allHabitIds), userId, {
    timeZone,
  });

  // Filter out deleted entries
  const activeEntryViews = allEntryViews.filter(entry => !entry.deletedAt);

  // Build map of entries by habitId for efficient lookup
  const entriesByHabitId = new Map<string, EntryView[]>();
  for (const entry of activeEntryViews) {
    if (!entriesByHabitId.has(entry.habitId)) {
      entriesByHabitId.set(entry.habitId, []);
    }
    entriesByHabitId.get(entry.habitId)!.push(entry);
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
    // Collect all EntryViews for this goal's linked habits
    const goalEntryViews: EntryView[] = [];
    const resolvedIds = getResolvedHabitsForGoal(goal);

    for (const habitId of resolvedIds) {
      const habitEntries = entriesByHabitId.get(habitId) || [];
      goalEntryViews.push(...habitEntries);
    }

    // Get manual logs for this goal (only for cumulative goals)
    const goalManualLogs = goal.type === 'cumulative'
      ? (manualLogsByGoalId.get(goal.id) || [])
      : [];

    // Compute full progress
    const progress = computeFullGoalProgressV2(goal, goalEntryViews, goalManualLogs, habitMap, timeZone);

    results.push({
      goal,
      progress,
    });
  }

  return results;
}

