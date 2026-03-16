/**
 * Progress Routes
 * 
 * Routes for fetching progress overview data combining habits and goals.
 */

import type { Request, Response } from 'express';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';

import { getHabitsByUser } from '../repositories/habitRepository';
import { getGoalsByUser } from '../repositories/goalRepository';
import { computeGoalsWithProgressFromData } from '../utils/goalProgressUtilsV2';
import { calculateGlobalMomentum, calculateCategoryMomentum, getMomentumCopy } from '../services/momentumService';
import { calculateHabitStreakMetrics, type HabitDayState } from '../services/streakService';
import { resolveTimeZone, getNowDayKey, getCanonicalDayKeyFromEntry } from '../utils/dayKey';
import type { MomentumState } from '../../types';
import type { DayLog } from '../../models/persistenceTypes';
import { getRequestIdentity } from '../middleware/identity';

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
