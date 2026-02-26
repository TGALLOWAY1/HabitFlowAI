/**
 * Progress Routes
 * 
 * Routes for fetching progress overview data combining habits and goals.
 */

import type { Request, Response } from 'express';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';

import { getHabitsByUser } from '../repositories/habitRepository';
// Note: computeGoalsWithProgress is now imported dynamically in getProgressOverview
import { calculateGlobalMomentum, calculateCategoryMomentum, getMomentumCopy } from '../services/momentumService';
import { calculateHabitStreakMetrics, type HabitDayState } from '../services/streakService';
import { assertTimeZone } from '../domain/canonicalValidators';
import type { MomentumState } from '../../types';
import type { DayLog } from '../../models/persistenceTypes';

/**
 * Get today's date in YYYY-MM-DD format.
 */
function getTodayDateString(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

function getUserIdFromRequest(req: Request): string {
  const candidate = (req as Request & { userId?: unknown }).userId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'anonymous-user';
}

function parseFreezeType(note?: string): 'manual' | 'auto' | 'soft' | undefined {
  if (!note || !note.startsWith('freeze:')) return undefined;
  const raw = note.slice('freeze:'.length);
  if (raw === 'manual' || raw === 'auto' || raw === 'soft') return raw;
  return 'auto';
}

export async function getProgressOverview(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const userId = getUserIdFromRequest(req);
    const requestedTimeZone = typeof req.query?.timeZone === 'string' ? req.query.timeZone : 'UTC';
    const timeZoneValidation = assertTimeZone(requestedTimeZone);
    if (!timeZoneValidation.valid) {
      res.status(400).json({ error: timeZoneValidation.error });
      return;
    }

    // Get today's date
    const todayDate = getTodayDateString(requestedTimeZone);

    // Fetch all habits for the user
    const habits = await getHabitsByUser(userId);

    // Filter out archived habits
    const activeHabits = habits.filter(h => !h.archived);

    // Fetch all habit entries (single source of truth)
    const habitEntries = await getHabitEntriesByUser(userId);

    // Aggregate entries by habit + dayKey for canonical completion/value derivation
    const dayStatesByHabit = new Map<string, Map<string, HabitDayState>>();
    habitEntries.forEach(entry => {
      const dayKey = entry.dayKey || entry.date;
      if (!dayKey) {
        console.warn(`[progress] Entry ${entry.id} missing dayKey and date, skipping`);
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

    // Fetch goals with progress (reuses efficient batch computation via truthQuery)
    const { computeGoalsWithProgressV2 } = await import('../utils/goalProgressUtilsV2');
    const goalsWithProgress = await computeGoalsWithProgressV2(userId, requestedTimeZone);

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
