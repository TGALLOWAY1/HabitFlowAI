/**
 * Progress Routes
 * 
 * Routes for fetching progress overview data combining habits and goals.
 */

import type { Request, Response } from 'express';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';

import { getHabitsByUser } from '../repositories/habitRepository';
import { getGoalsByUser } from '../repositories/goalRepository';
import { getMembershipsByParent } from '../repositories/bundleMembershipRepository';
import { computeGoalsWithProgressFromData } from '../utils/goalProgressUtilsV2';
import { calculateGlobalMomentum, calculateCategoryMomentum, getMomentumCopy } from '../services/momentumService';
import { calculateHabitStreakMetrics, type HabitDayState } from '../services/streakService';
import { resolveTimeZone, getNowDayKey, getCanonicalDayKeyFromEntry } from '../utils/dayKey';
import type { MomentumState } from '../../types';
import type { DayLog } from '../../models/persistenceTypes';
import type { BundleMembershipRecord } from '../domain/canonicalTypes';
import { getRequestIdentity } from '../middleware/identity';
import { evaluateChecklistSuccess } from '../services/checklistSuccessService';
import type { Habit } from '../../models/persistenceTypes';

function parseFreezeType(note?: string): 'manual' | 'auto' | 'soft' | undefined {
  if (!note || !note.startsWith('freeze:')) return undefined;
  const raw = note.slice('freeze:'.length);
  if (raw === 'manual' || raw === 'auto' || raw === 'soft') return raw;
  return 'auto';
}

export async function getProgressOverview(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const requestedTimeZone = resolveTimeZone(typeof req.query?.timeZone === 'string' ? req.query.timeZone : undefined);

    const todayDate = getNowDayKey(requestedTimeZone);

    // Fetch habits, entries, and goals in parallel (previously sequential + redundant)
    const [habits, habitEntries, goals] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
      getGoalsByUser(householdId, userId),
    ]);

    const activeHabits = habits.filter(h => !h.archived);

    // Aggregate entries by habit + dayKey for canonical completion/value derivation (dayKey only in prod; legacy fallback in dev with log)
    const dayStatesByHabit = new Map<string, Map<string, HabitDayState>>();
    habitEntries.forEach(entry => {
      const dayKey = getCanonicalDayKeyFromEntry(entry, { timeZone: requestedTimeZone });
      if (!dayKey) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[progress] Entry ${entry.id} missing canonical dayKey, skipping`);
        }
        return;
      }

      const habitDayMap = dayStatesByHabit.get(entry.habitId) ?? new Map<string, HabitDayState>();
      const existing = habitDayMap.get(dayKey) ?? {
        dayKey,
        value: 0,
        completed: false,
      };

      const freezeType = parseFreezeType(entry.note);
      if (freezeType) {
        existing.isFrozen = true;
      } else {
        existing.completed = true;
        existing.value += typeof entry.value === 'number' ? entry.value : 1;
      }

      habitDayMap.set(dayKey, existing);
      dayStatesByHabit.set(entry.habitId, habitDayMap);
    });

    // Derive bundle parent dayStates from children using temporal membership
    const bundleParents = activeHabits.filter(
      h => h.type === 'bundle' && (h.bundleType === 'choice' || h.bundleType === 'checklist')
    );

    for (const parent of bundleParents) {
      const memberships = await getMembershipsByParent(parent.id, householdId, userId);
      const parentDayMap = new Map<string, HabitDayState>();

      if (memberships.length > 0) {
        if (parent.bundleType === 'checklist') {
          // Checklist bundles: evaluate success rule per day
          deriveChecklistBundleParentDayStates(parent, memberships, dayStatesByHabit, parentDayMap);
        } else {
          // Choice bundles: any child complete = parent complete
          deriveBundleParentDayStates(memberships, dayStatesByHabit, parentDayMap);
        }
      } else if (parent.subHabitIds && parent.subHabitIds.length > 0) {
        // Fallback: use static subHabitIds (pre-migration)
        if (parent.bundleType === 'checklist') {
          deriveChecklistBundleParentDayStatesFallback(parent, parent.subHabitIds, dayStatesByHabit, parentDayMap);
        } else {
          deriveBundleParentDayStatesFallback(parent.subHabitIds, dayStatesByHabit, parentDayMap);
        }
      }

      if (parentDayMap.size > 0) {
        dayStatesByHabit.set(parent.id, parentDayMap);
      }
    }

    // Build a completion-only log array for momentum calculations
    const completionLogs: DayLog[] = Array.from(dayStatesByHabit.entries()).flatMap(([habitId, dayMap]) =>
      Array.from(dayMap.values())
        .filter(state => state.completed)
        .map(state => ({
          habitId,
          date: state.dayKey,
          value: state.value,
          completed: true,
        }))
    );

    const globalMomentum = calculateGlobalMomentum(completionLogs);

    // Group habits by category for Category Momentum
    const categoryHabitMap: Record<string, string[]> = {};
    activeHabits.forEach(h => {
      if (!categoryHabitMap[h.categoryId]) categoryHabitMap[h.categoryId] = [];
      categoryHabitMap[h.categoryId].push(h.id);
    });

    const categoryMomentum: Record<string, MomentumState> = {};
    Object.keys(categoryHabitMap).forEach(catId => {
      const result = calculateCategoryMomentum(completionLogs, categoryHabitMap[catId]);
      categoryMomentum[catId] = result.state;
    });

    // Build habitsToday array with canonical streak metrics
    const habitsToday = [];
    const referenceDate = new Date();

    for (const habit of activeHabits) {
      const dayStates = Array.from(dayStatesByHabit.get(habit.id)?.values() ?? []);
      const todayState = dayStatesByHabit.get(habit.id)?.get(todayDate);
      const streakMetrics = calculateHabitStreakMetrics(habit, dayStates, referenceDate, todayDate);

      const completed = streakMetrics.completedToday;
      const value = habit.goal.type === 'number' && todayState ? todayState.value : undefined;
      const streak = streakMetrics.currentStreak;

      const formattedStreak = habit.goal.frequency === 'weekly'
        ? `${streak} ${streak === 1 ? 'week' : 'weeks'}`
        : `${streak} ${streak === 1 ? 'day' : 'days'}`;

      habitsToday.push({
        habit,
        completed,
        value,
        streak,
        currentStreak: streakMetrics.currentStreak,
        bestStreak: streakMetrics.bestStreak,
        lastCompletedDayKey: streakMetrics.lastCompletedDayKey,
        atRisk: streakMetrics.atRisk,
        formattedStreak,
        freezeStatus: 'none',
        weekSatisfied: streakMetrics.weekSatisfied,
        weekProgress: streakMetrics.weekProgress,
        weekTarget: streakMetrics.weekTarget,
      });
    }

    // Compute goals with progress using pre-fetched habits and entries (no redundant DB calls)
    const goalsWithProgress = await computeGoalsWithProgressFromData(
      goals, habits, householdId, userId, requestedTimeZone, habitEntries
    );

    // Return combined response
    res.status(200).json({
      todayDate,
      habitsToday,
      goalsWithProgress,
      momentum: {
        global: {
          ...globalMomentum,
          copy: getMomentumCopy(globalMomentum.state)
        },
        category: categoryMomentum
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching progress overview:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch progress overview',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Derive bundle parent dayStates from children using temporal memberships.
 * A parent is "completed" on a dayKey if any child with an active membership
 * on that day has a completed dayState.
 */
function deriveBundleParentDayStates(
  memberships: BundleMembershipRecord[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>,
  parentDayMap: Map<string, HabitDayState>
): void {
  for (const membership of memberships) {
    const childDayMap = dayStatesByHabit.get(membership.childHabitId);
    if (!childDayMap) continue;

    for (const [dayKey, childState] of childDayMap) {
      // Check if this dayKey falls within the membership period
      if (dayKey < membership.activeFromDayKey) continue;
      if (membership.activeToDayKey && dayKey > membership.activeToDayKey) continue;

      if (childState.completed || childState.isFrozen) {
        const existing = parentDayMap.get(dayKey);
        if (!existing) {
          parentDayMap.set(dayKey, {
            dayKey,
            value: 1,
            completed: childState.completed,
            isFrozen: childState.isFrozen && !childState.completed ? true : undefined,
          });
        } else if (!existing.completed && childState.completed) {
          existing.completed = true;
        }
      }
    }
  }
}

/**
 * Fallback: derive bundle parent dayStates from static subHabitIds (pre-migration).
 */
function deriveBundleParentDayStatesFallback(
  subHabitIds: string[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>,
  parentDayMap: Map<string, HabitDayState>
): void {
  for (const childId of subHabitIds) {
    const childDayMap = dayStatesByHabit.get(childId);
    if (!childDayMap) continue;

    for (const [dayKey, childState] of childDayMap) {
      if (childState.completed || childState.isFrozen) {
        const existing = parentDayMap.get(dayKey);
        if (!existing) {
          parentDayMap.set(dayKey, {
            dayKey,
            value: 1,
            completed: childState.completed,
            isFrozen: childState.isFrozen && !childState.completed ? true : undefined,
          });
        } else if (!existing.completed && childState.completed) {
          existing.completed = true;
        }
      }
    }
  }
}

/**
 * Derive checklist bundle parent dayStates using temporal memberships.
 *
 * For each day where any child has data, determines which children were
 * active+scheduled on that day and evaluates the success rule.
 */
function deriveChecklistBundleParentDayStates(
  parent: Habit,
  memberships: BundleMembershipRecord[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>,
  parentDayMap: Map<string, HabitDayState>
): void {
  // Collect all dayKeys across all children
  const allDayKeys = new Set<string>();
  for (const membership of memberships) {
    const childDayMap = dayStatesByHabit.get(membership.childHabitId);
    if (childDayMap) {
      for (const dayKey of childDayMap.keys()) {
        if (dayKey >= membership.activeFromDayKey &&
            (!membership.activeToDayKey || dayKey <= membership.activeToDayKey)) {
          allDayKeys.add(dayKey);
        }
      }
    }
  }

  for (const dayKey of allDayKeys) {
    const dayOfWeek = new Date(dayKey + 'T12:00:00Z').getUTCDay();

    // Find memberships active and scheduled on this day
    const activeMemberships = memberships.filter(m => {
      if (dayKey < m.activeFromDayKey) return false;
      if (m.activeToDayKey && dayKey > m.activeToDayKey) return false;
      if (m.daysOfWeek && m.daysOfWeek.length > 0 && !m.daysOfWeek.includes(dayOfWeek)) return false;
      return true;
    });

    if (activeMemberships.length === 0) continue;

    let completedCount = 0;
    let hasFrozen = false;

    for (const m of activeMemberships) {
      const childState = dayStatesByHabit.get(m.childHabitId)?.get(dayKey);
      if (childState?.completed) {
        completedCount++;
      } else if (childState?.isFrozen) {
        hasFrozen = true;
      }
    }

    const { meetsSuccessRule } = evaluateChecklistSuccess(
      completedCount,
      activeMemberships.length,
      parent.checklistSuccessRule
    );

    parentDayMap.set(dayKey, {
      dayKey,
      value: completedCount,
      completed: meetsSuccessRule,
      isFrozen: hasFrozen && !meetsSuccessRule ? true : undefined,
    });
  }
}

/**
 * Fallback: derive checklist bundle parent dayStates from static subHabitIds.
 * Evaluates success rule against all children (no temporal/scheduling awareness).
 */
function deriveChecklistBundleParentDayStatesFallback(
  parent: Habit,
  subHabitIds: string[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>,
  parentDayMap: Map<string, HabitDayState>
): void {
  // Collect all dayKeys across all children
  const allDayKeys = new Set<string>();
  for (const childId of subHabitIds) {
    const childDayMap = dayStatesByHabit.get(childId);
    if (childDayMap) {
      for (const dayKey of childDayMap.keys()) {
        allDayKeys.add(dayKey);
      }
    }
  }

  for (const dayKey of allDayKeys) {
    let completedCount = 0;
    let hasFrozen = false;

    for (const childId of subHabitIds) {
      const childState = dayStatesByHabit.get(childId)?.get(dayKey);
      if (childState?.completed) {
        completedCount++;
      } else if (childState?.isFrozen) {
        hasFrozen = true;
      }
    }

    const { meetsSuccessRule } = evaluateChecklistSuccess(
      completedCount,
      subHabitIds.length,
      parent.checklistSuccessRule
    );

    parentDayMap.set(dayKey, {
      dayKey,
      value: completedCount,
      completed: meetsSuccessRule,
      isFrozen: hasFrozen && !meetsSuccessRule ? true : undefined,
    });
  }
}
