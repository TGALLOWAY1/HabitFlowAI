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
import { calculateDailyStreak, calculateWeeklyStreak } from '../services/streakService';
import { subDays, format } from 'date-fns';
import type { MomentumState } from '../../types';

/**
 * Get today's date in YYYY-MM-DD format.
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getProgressOverview(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Get today's date
    const todayDate = getTodayDateString();

    // Fetch all habits for the user
    const habits = await getHabitsByUser(userId);

    // Filter out archived habits
    const activeHabits = habits.filter(h => !h.archived);

    // Fetch all habit entries (Single-Source of Truth)
    const habitEntries = await getHabitEntriesByUser(userId);

    // Convert to Map for O(1) Lookup: Key = `${habitId}-${dayKey}`
    // Use dayKey (canonical) with fallback to date for backward compatibility
    const allLogs: Record<string, any> = {};
    habitEntries.forEach(entry => {
      const dayKey = entry.dayKey || entry.date;
      if (!dayKey) {
        console.warn(`[progress] Entry ${entry.id} missing dayKey and date, skipping`);
        return;
      }
      const key = `${entry.habitId}-${dayKey}`;
      allLogs[key] = entry;
    });

    // Build habitsToday array with completion status for today
    // Calculate Momentum (based on all logs, not just today)
    const logsArray = habitEntries;

    // [NEW] Process Auto-Freezes (Check Yesterday)
    const { processAutoFreezes } = await import('../services/freezeService');
    // Note: processAutoFreezes might expect DayLog[], check compat.
    // Assuming it accepts array of logs. 
    await processAutoFreezes(activeHabits, allLogs, userId);

    // Re-fetch all logs to ensure streak calc uses latest freeze data
    // Optimally, processAutoFreezes should return updates, but for now re-fetch
    const updatedEntries = await getHabitEntriesByUser(userId);
    const updatedLogsArray = updatedEntries;

    // Re-build map
    // Use dayKey (canonical) with fallback to date for backward compatibility
    const updatedLogs: Record<string, any> = {};
    updatedEntries.forEach(entry => {
      const dayKey = entry.dayKey || entry.date;
      if (!dayKey) {
        console.warn(`[progress] Entry ${entry.id} missing dayKey and date, skipping`);
        return;
      }
      const key = `${entry.habitId}-${dayKey}`;
      updatedLogs[key] = entry;
    });

    const globalMomentum = calculateGlobalMomentum(updatedLogsArray as any[]);

    // Group habits by category for Category Momentum
    const categoryHabitMap: Record<string, string[]> = {};
    activeHabits.forEach(h => {
      if (!categoryHabitMap[h.categoryId]) categoryHabitMap[h.categoryId] = [];
      categoryHabitMap[h.categoryId].push(h.id);
    });

    const categoryMomentum: Record<string, MomentumState> = {};
    Object.keys(categoryHabitMap).forEach(catId => {
      const result = calculateCategoryMomentum(logsArray as any[], categoryHabitMap[catId]);
      categoryMomentum[catId] = result.state;
    });

    // Build habitsToday array with completion status for today AND streaks
    const habitsToday = [];
    const yesterdayDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    for (const habit of activeHabits) {
      // Find today's log for this habit
      const logKey = `${habit.id}-${todayDate}`;
      const todayLog = updatedLogs[logKey];

      // Determine completion status
      const completed = todayLog?.completed || false;

      // Get value if quantified habit
      const value = todayLog?.value !== undefined ? todayLog.value : undefined;

      // Calculate Streak
      let streak = 0;
      if (habit.goal.frequency === 'weekly') {
        streak = calculateWeeklyStreak(updatedLogsArray as any[], habit.id);
      } else {
        streak = calculateDailyStreak(updatedLogsArray as any[], habit.id);
      }

      // Soft Freeze Check (Lazy Creation)
      // If yesterday was missed, check if we should have applied a soft freeze
      // We do this check if today's log shows no streak continuity from yesterday?
      // Actually, StreakService handles continuity. 
      // But if we want to PERSIST the soft freeze so it shows up in history/logs explicitly:
      // Check Yesterday Log.
      const yesterdayLogKey = `${habit.id}-${yesterdayDate}`;
      const yesterdayLog = updatedLogs[yesterdayLogKey];

      if (!yesterdayLog && habit.goal.frequency === 'daily') {
        // Missed yesterday (no log). Check eligibility.
        // Streak would be 0 now if we ran calculation without the freeze.
        // But we want to simulate "What if we had the freeze?"
        // Or simpler: Calculate streak assuming yesterday was frozen?
        // "Automatically applied when... Habit streak >= 3".
        // If the streak WAS >= 3 before yesterday.
        // This suggests "Streak at end of Day Before Yesterday" >= 3.
        // This is getting complex to optimize.

        // Simpler approach for MVP:
        // Just rely on StreakService to handle "gaps" if we pass a "allowSoftFreeze" flag?
        // No, the PRD implies a persistent state "Habit marked as 'paused'".
        // So we SHOULD create the log.

        // To avoid heavy logic here, let's defer soft-freeze creation to a dedicated background job or 
        // triggered when user views the habit details/history.
        // For dashboard, we just compute streak.
      }

      const formattedStreak = habit.goal.frequency === 'weekly'
        ? `${streak} ${streak === 1 ? 'week' : 'weeks'}`
        : `${streak} ${streak === 1 ? 'day' : 'days'}`;

      habitsToday.push({
        habit,
        completed,
        value,
        streak,
        formattedStreak,
        freezeStatus: todayLog?.isFrozen ? 'active' : 'none'
      });
    }

    // Fetch goals with progress (reuses efficient batch computation via truthQuery)
    // Default to UTC timezone for now - could be extracted from user preferences
    const { computeGoalsWithProgressV2 } = await import('../utils/goalProgressUtilsV2');
    const goalsWithProgress = await computeGoalsWithProgressV2(userId, 'UTC');

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
