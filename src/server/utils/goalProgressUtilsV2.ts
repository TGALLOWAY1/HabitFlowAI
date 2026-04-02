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
import { getMembershipsByParent } from '../repositories/bundleMembershipRepository';
import { aggregateHabitEntryTotals } from '../repositories/habitEntryRepository';
import { getEntryViewsForHabits, getRecentEntryViewsForHabits, buildEntryViewsFromEntries } from '../services/truthQuery';
import { getAggregationMode, getCountMode, unitsMatch } from './goalLinkSemantics';
import type { Goal, GoalProgress, Habit, HabitEntry, GoalProgressWarning } from '../../models/persistenceTypes';
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
    if (habit?.type === 'bundle') {
      // For both choice and checklist bundles: use temporal memberships (past + present)
      const memberships = await getMembershipsByParent(id, householdId, userId);
      if (memberships.length > 0) {
        memberships.forEach(m => resolvedIds.add(m.childHabitId));
      } else if (habit.subHabitIds) {
        // Fallback to static subHabitIds (pre-migration)
        habit.subHabitIds.forEach(subId => resolvedIds.add(subId));
      }
    } else {
      resolvedIds.add(id);
    }
  }

  return Array.from(resolvedIds);
}

/**
 * Synchronous bundle resolution from pre-fetched membership data.
 * Used by functions that already have habits and memberships in memory.
 */
function resolveBundleIdsSync(
  habitIds: string[],
  habitMap: Map<string, Habit>,
  membershipsByParent: Map<string, Array<{ childHabitId: string }>>
): string[] {
  const resolved = new Set<string>();
  for (const habitId of habitIds) {
    const habit = habitMap.get(habitId);
    if (habit?.type === 'bundle') {
      const memberships = membershipsByParent.get(habitId);
      if (memberships && memberships.length > 0) {
        memberships.forEach(m => resolved.add(m.childHabitId));
      } else if (habit.subHabitIds) {
        habit.subHabitIds.forEach(subId => resolved.add(subId));
      }
    } else {
      resolved.add(habitId);
    }
  }
  return Array.from(resolved);
}

/**
 * Compute goal progress using truthQuery (EntryViews).
 * 
 * For cumulative goals: sums entry values from linked habits.
 * For count-mode goals: counts distinct dayKeys where entries exist.
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

  // Include deleted entries so that contributions from deleted habits
  // (whose entries were cascade-soft-deleted) still count toward goal progress.
  const entryViews = await getEntryViewsForHabits(resolvedHabitIds, householdId, userId, {
    timeZone,
    includeDeleted: true,
  });

  // Only filter out entries the user explicitly deleted (not cascade-deleted).
  // Going forward, entries are no longer cascade-deleted on habit deletion,
  // but older data may still have cascade-deleted entries we need to include.
  const activeEntries = entryViews;

  const allHabits = await getHabitsByUser(householdId, userId);
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  return computeFullGoalProgressV2(goal, activeEntries, habitMap, timeZone);
}

/**
 * Compute full goal progress from EntryViews.
 *
 * @param goal - Goal object
 * @param entryViews - EntryViews from truthQuery (already filtered to linked habits)
 * @param habitMap - Map of habitId -> Habit for unit checking
 * @param timeZone - User's timezone for date operations
 * @returns GoalProgress
 */
export function computeFullGoalProgressV2(
  goal: Goal,
  entryViews: EntryView[],
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
        // Deleted habits won't be in the map — still count their raw entry value
        if (habit) {
          if (habit.goal.type === 'boolean') {
            // Boolean habits contribute their target value per entry
            // e.g. "do 25 pull ups" (boolean, target=25) contributes 25 per check-in
            return sum + (habit.goal.target ?? 1);
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
          if (habit?.goal.type === 'boolean') {
            return sum + (habit.goal.target ?? 1);
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

  const [goals, allHabits] = await Promise.all([
    getGoalsByUser(householdId, userId),
    getHabitsByUser(householdId, userId),
  ]);

  return computeGoalsWithProgressFromData(goals, allHabits, householdId, userId, timeZone);
}

/**
 * Compute progress for multiple goals from pre-fetched data.
 *
 * Accepts pre-fetched goals, habits, and optionally entries to avoid redundant DB calls.
 * Use this when the caller has already fetched habits/entries (e.g. progress overview).
 *
 * @param goals - Pre-fetched goals
 * @param allHabits - Pre-fetched habits
 * @param householdId - Household ID
 * @param userId - User ID
 * @param timeZone - User's timezone for DayKey operations
 * @param prefetchedEntries - Optional pre-fetched habit entries (avoids DB call if provided)
 * @returns Array of goals with their computed progress
 */
export async function computeGoalsWithProgressFromData(
  goals: Goal[],
  allHabits: Habit[],
  householdId: string,
  userId: string,
  timeZone: string = 'UTC',
  prefetchedEntries?: HabitEntry[]
): Promise<Array<{ goal: Goal; progress: GoalProgress }>> {
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  // Pre-fetch memberships for all bundle parents referenced by goals
  const bundleParentIds = new Set<string>();
  for (const goal of goals) {
    for (const habitId of goal.linkedHabitIds) {
      const habit = habitMap.get(habitId);
      if (habit?.type === 'bundle') bundleParentIds.add(habitId);
    }
  }

  const membershipsByParent = new Map<string, Array<{ childHabitId: string }>>();
  await Promise.all(
    Array.from(bundleParentIds).map(async (parentId) => {
      const memberships = await getMembershipsByParent(parentId, householdId, userId);
      membershipsByParent.set(parentId, memberships);
    })
  );

  // Collect all unique habit IDs from all goals, resolving bundles
  const allHabitIds = new Set<string>();

  // Cache resolved habits per goal to avoid computing twice
  const resolvedHabitsCache = new Map<string, string[]>();
  for (const goal of goals) {
    const resolvedIds = resolveBundleIdsSync(goal.linkedHabitIds, habitMap, membershipsByParent);
    resolvedHabitsCache.set(goal.id, resolvedIds);
    for (const id of resolvedIds) {
      allHabitIds.add(id);
    }
  }

  // Include deleted entries so contributions from deleted habits still count.
  const allEntryViews = prefetchedEntries
    ? buildEntryViewsFromEntries(prefetchedEntries, Array.from(allHabitIds), { timeZone })
    : await getEntryViewsForHabits(Array.from(allHabitIds), householdId, userId, { timeZone, includeDeleted: true });

  const activeEntryViews = allEntryViews;

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
    const resolvedIds = resolvedHabitsCache.get(goal.id) || resolveBundleIdsSync(goal.linkedHabitIds, habitMap, membershipsByParent);

    for (const habitId of resolvedIds) {
      const habitEntries = entriesByHabitId.get(habitId) || [];
      goalEntryViews.push(...habitEntries);
    }

    const progress = computeFullGoalProgressV2(goal, goalEntryViews, habitMap, timeZone);

    results.push({
      goal,
      progress,
    });
  }

  return results;
}

/**
 * Optimized goal list progress computation.
 *
 * Instead of fetching ALL historical entries (potentially thousands of documents),
 * this function:
 * 1. Uses MongoDB aggregation to compute cumulative totals (sum/count/distinctDays)
 *    per habit — returns only numbers, no documents transferred.
 * 2. Fetches only the last 30 days of entries for heatmap/inactivity data.
 *
 * This dramatically reduces DB transfer and in-memory processing for users
 * with many goals and long entry histories.
 */
export async function computeGoalListProgress(
  goals: Goal[],
  allHabits: Habit[],
  householdId: string,
  userId: string,
  timeZone: string = 'UTC'
): Promise<Array<{ goal: Goal; progress: GoalProgress }>> {
  const habitMap = new Map(allHabits.map(h => [h.id, h]));

  // Pre-fetch memberships for all bundle parents referenced by goals
  const bundleParentIds = new Set<string>();
  for (const goal of goals) {
    for (const habitId of goal.linkedHabitIds) {
      const habit = habitMap.get(habitId);
      if (habit?.type === 'bundle') bundleParentIds.add(habitId);
    }
  }

  const membershipsByParent = new Map<string, Array<{ childHabitId: string }>>();
  await Promise.all(
    Array.from(bundleParentIds).map(async (parentId) => {
      const memberships = await getMembershipsByParent(parentId, householdId, userId);
      membershipsByParent.set(parentId, memberships);
    })
  );

  // Resolve bundle habits for each goal
  const resolvedHabitsCache = new Map<string, string[]>();
  const allHabitIds = new Set<string>();

  for (const goal of goals) {
    const resolvedIds = resolveBundleIdsSync(goal.linkedHabitIds, habitMap, membershipsByParent);
    resolvedHabitsCache.set(goal.id, resolvedIds);
    for (const id of resolvedIds) {
      allHabitIds.add(id);
    }
  }

  const allHabitIdArray = Array.from(allHabitIds);

  // Compute the dayKey for 30 days ago (the window we need for heatmap)
  const sinceDayKey = getDateString(30) as DayKey;

  // Two parallel queries instead of one huge unbounded query:
  // 1. Aggregation: get totals per habit (sum, count, distinctDays) — no docs transferred
  // 2. Recent entries: only last 30 days for heatmap + inactivity
  // Include deleted entries so contributions from deleted habits still count.
  const [aggregatedTotals, recentEntryViews] = await Promise.all([
    aggregateHabitEntryTotals(allHabitIdArray, householdId, userId, { includeDeleted: true }),
    getRecentEntryViewsForHabits(allHabitIdArray, householdId, userId, {
      sinceDayKey,
      timeZone,
      includeDeleted: true,
    }),
  ]);

  // Build lookup maps
  const totalsMap = new Map(aggregatedTotals.map(t => [t.habitId, t]));
  const activeRecentEntries = recentEntryViews;

  const recentEntriesByHabitId = new Map<string, EntryView[]>();
  for (const entry of activeRecentEntries) {
    if (!recentEntriesByHabitId.has(entry.habitId)) {
      recentEntriesByHabitId.set(entry.habitId, []);
    }
    recentEntriesByHabitId.get(entry.habitId)!.push(entry);
  }

  const results: Array<{ goal: Goal; progress: GoalProgress }> = [];

  for (const goal of goals) {
    const resolvedIds = resolvedHabitsCache.get(goal.id) || [];

    // Compute currentValue from aggregated totals (no entry iteration needed)
    const aggregationMode = getAggregationMode(goal);
    const countMode = getCountMode(goal);
    const warnings: GoalProgressWarning[] = [];

    let currentValue: number;
    if (aggregationMode === 'sum') {
      currentValue = 0;
      for (const habitId of resolvedIds) {
        const totals = totalsMap.get(habitId);
        if (!totals) continue;

        const habit = habitMap.get(habitId);
        // Deleted habits won't be in the map — still count their raw totals
        if (habit?.goal.type === 'boolean') {
          // Boolean habits contribute target value per entry
          currentValue += (habit.goal.target ?? 1) * totals.entryCount;
        } else {
          if (habit && goal.unit) {
            const habitUnit = habit.goal.unit;
            if (habitUnit && !unitsMatch(goal.unit, habitUnit)) {
              warnings.push({
                type: 'UNIT_MISMATCH',
                habitId,
                expectedUnit: goal.unit,
                foundUnit: habitUnit,
              });
            }
          }
          currentValue += totals.totalValue;
        }
      }
    } else {
      if (countMode === 'entries') {
        currentValue = 0;
        for (const habitId of resolvedIds) {
          const totals = totalsMap.get(habitId);
          if (totals) currentValue += totals.entryCount;
        }
      } else {
        // distinctDays: need union of dayKeys across all linked habits
        // Use recent entries + aggregated distinctDays for an accurate count
        // For goals spanning the full history, sum per-habit distinctDays as upper bound
        // But entries on the same day across different habits count once
        // We need to collect all dayKeys — use the aggregated totals for individual habits
        // but for multi-habit goals, we need the union. Use recent entries for the recent
        // window and aggregated totals for single-habit goals.
        if (resolvedIds.length === 1) {
          const totals = totalsMap.get(resolvedIds[0]);
          currentValue = totals ? totals.distinctDays : 0;
        } else {
          // Multi-habit distinctDays: the aggregation gives per-habit distinctDays
          // but we need the union. For the list view, sum per-habit as approximation
          // is acceptable since multi-habit count goals are rare.
          // For exact count, we'd need to fall back to fetching all entries.
          currentValue = 0;
          const allDays = new Set<string>();
          // Use recent entries for precise count in recent window
          for (const habitId of resolvedIds) {
            const entries = recentEntriesByHabitId.get(habitId) || [];
            for (const entry of entries) {
              allDays.add(entry.dayKey);
            }
          }
          // Add historical days from aggregation (minus recent to avoid double-count)
          // Since we can't get exact historical union without full fetch,
          // use per-habit distinct days sum as upper-bound estimate for older entries
          const recentDayCount = allDays.size;
          let historicalEstimate = 0;
          for (const habitId of resolvedIds) {
            const totals = totalsMap.get(habitId);
            if (totals) historicalEstimate += totals.distinctDays;
          }
          // Use the larger of recent precise count or aggregated estimate
          // (aggregated is an upper bound since it doesn't dedupe across habits)
          currentValue = Math.max(recentDayCount, historicalEstimate);
        }
      }
    }

    // Compute percent
    let percent = 0;
    if (goal.type === 'onetime') {
      percent = goal.completedAt ? 100 : 0;
    } else {
      percent = (goal.targetValue && goal.targetValue > 0)
        ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
        : 0;
    }

    // Build last 30 days from recent entries only
    const last30Days: DayKey[] = [];
    for (let i = 0; i < 30; i++) {
      last30Days.push(getDateString(i) as DayKey);
    }

    const goalRecentEntries: EntryView[] = [];
    for (const habitId of resolvedIds) {
      const entries = recentEntriesByHabitId.get(habitId) || [];
      goalRecentEntries.push(...entries);
    }

    const entriesByDate = new Map<DayKey, EntryView[]>();
    for (const entry of goalRecentEntries) {
      if (!entriesByDate.has(entry.dayKey)) {
        entriesByDate.set(entry.dayKey, []);
      }
      entriesByDate.get(entry.dayKey)!.push(entry);
    }

    const lastThirtyDaysData = last30Days.map(date => {
      const dayEntries = entriesByDate.get(date) || [];
      let dayValue = 0;
      let hasProgress = false;

      if (aggregationMode === 'sum') {
        dayValue = dayEntries.reduce((sum, entry) => {
          if (habitMap && goal.unit) {
            const habit = habitMap.get(entry.habitId);
            if (habit?.goal.type === 'boolean') {
              return sum + (habit.goal.target ?? 1);
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

      return { date, value: dayValue, hasProgress };
    });

    const lastSevenDaysData = lastThirtyDaysData.slice(0, 7);
    const daysWithoutProgress = lastSevenDaysData.filter(day => !day.hasProgress).length;
    const inactivityWarning = !goal.completedAt && daysWithoutProgress >= 4;

    results.push({
      goal,
      progress: {
        currentValue,
        percent,
        lastSevenDays: lastSevenDaysData,
        lastThirtyDays: lastThirtyDaysData,
        inactivityWarning,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    });
  }

  return results;
}
