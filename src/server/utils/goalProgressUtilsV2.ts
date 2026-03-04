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
import { getEntryViewsForHabits } from '../services/truthQuery';
import { getAggregationMode, getCountMode, unitsMatch } from './goalLinkSemantics';
import type { Goal, GoalProgress, Habit, GoalProgressWarning } from '../../models/persistenceTypes';
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
async function resolveBundleIds(habitIds: string[], householdId: string, userId: string): Promise<string[]> {
  const resolvedIds = new Set<string>();
  const allHabits = await getHabitsByUser(householdId, userId);
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
  householdId: string,
  userId: string,
  timeZone: string = 'UTC'
): Promise<GoalProgress | null> {
  const goal = await getGoalById(goalId, householdId, userId);
  if (!goal) {
    return null;
  }

  const resolvedHabitIds = await resolveBundleIds(goal.linkedHabitIds, householdId, userId);

  const entryViews = await getEntryViewsForHabits(resolvedHabitIds, householdId, userId, {
    timeZone,
  });

  const activeEntries = entryViews.filter(entry => !entry.deletedAt);

  const allHabits = await getHabitsByUser(householdId, userId);
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  return computeFullGoalProgressV2(goal, activeEntries, [], habitMap, timeZone);
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
  _manualLogs: unknown[] = [],
  habitMap?: Map<string, Habit>,
  _timeZone: string = 'UTC'
): GoalProgress {
  const aggregationMode = getAggregationMode(goal);
  const countMode = getCountMode(goal);

  const last30Days: DayKey[] = [];
  for (let i = 0; i < 30; i++) {
    last30Days.push(getDateString(i) as DayKey);
  }

  const entriesByDate = new Map<DayKey, EntryView[]>();
  for (const entry of entryViews) {
    if (!entriesByDate.has(entry.dayKey)) {
      entriesByDate.set(entry.dayKey, []);
    }
    entriesByDate.get(entry.dayKey)!.push(entry);
  }

  const warnings: GoalProgressWarning[] = [];

  let currentValue: number;
  if (aggregationMode === 'sum') {
    currentValue = entryViews.reduce((sum, entry) => {
      if (habitMap && goal.unit) {
        const habit = habitMap.get(entry.habitId);
        if (!habit) return sum;

        if (habit.goal.type === 'boolean') {
          return sum;
        }

        if (entry.unit && !unitsMatch(goal.unit, entry.unit)) {
          warnings.push({
            type: 'UNIT_MISMATCH',
            habitId: entry.habitId,
            expectedUnit: goal.unit,
            foundUnit: entry.unit,
          });
        }
      }
      return sum + (entry.value ?? 0);
    }, 0);
  } else {
    if (countMode === 'entries') {
      currentValue = entryViews.length;
    } else {
      const completedDayKeys = new Set<DayKey>();
      for (const entry of entryViews) {
        completedDayKeys.add(entry.dayKey);
      }
      currentValue = completedDayKeys.size;
    }
  }

  let percent = 0;
  if (goal.type === 'onetime') {
    percent = goal.completedAt ? 100 : 0;
  } else {
    percent = (goal.targetValue && goal.targetValue > 0)
      ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
      : 0;
  }

  const lastThirtyDaysData = last30Days.map(date => {
    const dayEntries = entriesByDate.get(date) || [];
    let dayValue = 0;
    let hasProgress = false;

    if (aggregationMode === 'sum') {
      dayValue = dayEntries.reduce((sum, entry) => {
        if (habitMap && goal.unit) {
          const habit = habitMap.get(entry.habitId);
          if (!habit) return sum;
          if (habit.goal.type === 'boolean') {
            return sum;
          }
        }
        return sum + (entry.value ?? 0);
      }, 0);
      hasProgress = dayValue > 0;
    } else {
      if (countMode === 'entries') {
        dayValue = dayEntries.length;
        hasProgress = dayValue > 0;
      } else {
        hasProgress = dayEntries.length > 0;
        dayValue = hasProgress ? 1 : 0;
      }
    }

    return {
      date,
      value: dayValue,
      hasProgress,
    };
  });

  const lastSevenDaysData = lastThirtyDaysData.slice(0, 7);

  const daysWithoutProgress = lastSevenDaysData.filter(day => !day.hasProgress).length;

  const inactivityWarning = !goal.completedAt && daysWithoutProgress >= 4;

  return {
    currentValue,
    percent,
    lastSevenDays: lastSevenDaysData,
    lastThirtyDays: lastThirtyDaysData,
    inactivityWarning,
    warnings: warnings.length > 0 ? warnings : undefined,
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
  householdId: string,
  userId: string,
  timeZone: string = 'UTC'
): Promise<Array<{ goal: Goal; progress: GoalProgress }>> {
  const { getGoalsByUser } = await import('../repositories/goalRepository');

  const goals = await getGoalsByUser(householdId, userId);

  const { getHabitsByUser } = await import('../repositories/habitRepository');
  const allHabits = await getHabitsByUser(householdId, userId);
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
  const allEntryViews = await getEntryViewsForHabits(Array.from(allHabitIds), householdId, userId, {
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

  const results: Array<{ goal: Goal; progress: GoalProgress }> = [];

  for (const goal of goals) {
    const goalEntryViews: EntryView[] = [];
    const resolvedIds = getResolvedHabitsForGoal(goal);

    for (const habitId of resolvedIds) {
      const habitEntries = entriesByHabitId.get(habitId) || [];
      goalEntryViews.push(...habitEntries);
    }

    const progress = computeFullGoalProgressV2(goal, goalEntryViews, [], habitMap, timeZone);

    results.push({
      goal,
      progress,
    });
  }

  return results;
}

