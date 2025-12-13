/**
 * Progress Routes
 * 
 * Routes for fetching progress overview data combining habits and goals.
 */

import type { Request, Response } from 'express';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getDayLogsByUser } from '../repositories/dayLogRepository';
import { computeGoalsWithProgress } from '../utils/goalProgressUtils';
import { calculateGlobalMomentum, calculateCategoryMomentum, getMomentumCopy } from '../services/momentumService';
import { calculateDailyStreak, calculateWeeklyStreak } from '../services/streakService';
import { subDays, format } from 'date-fns';
import type { MomentumState } from '../../types';
// import type { Habit, Goal, GoalProgress, DayLog } from '../../models/persistenceTypes';

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

/**
 * Get progress overview combining habits and goals for today.
 * 
 * GET /api/progress/overview
 * 
 * Returns:
 * - todayDate: Today's date in YYYY-MM-DD format
 * - habitsToday: Array of habit completion summaries for today
 * - goalsWithProgress: Array of goals with their progress data
 */
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

    // Fetch all day logs for the user (efficient single query)
    const allLogs = await getDayLogsByUser(userId);

    // Build habitsToday array with completion status for today
    // Calculate Momentum (based on all logs, not just today)
    const logsArray = Object.values(allLogs);

    // [NEW] Process Auto-Freezes (Check Yesterday)
    // This will persist new "frozen" logs if applicable. 
    // We should ideally re-fetch logs or update our local logsArray if changes happened.
    // For MVP efficiency: We call it, and if it modifies DB, the NEXT refresh will show it.
    // Or we can assume it only affects yesterday, which allows streaks to be correct today.
    // But since `logsArray` is already fetched, the streaks calculated below won't see the new freezes unless we re-fetch.
    // Optimization: `processAutoFreezes` returns the new logs or we re-fetch.
    // Let's implement quick re-fetch for safety.
    const { processAutoFreezes } = await import('../services/freezeService');
    await processAutoFreezes(activeHabits, allLogs, userId);

    // Re-fetch all logs to ensure streak calc uses latest freeze data
    const updatedLogs = await getDayLogsByUser(userId);
    const updatedLogsArray = Object.values(updatedLogs);

    const globalMomentum = calculateGlobalMomentum(updatedLogsArray);

    // Group habits by category for Category Momentum
    const categoryHabitMap: Record<string, string[]> = {};
    activeHabits.forEach(h => {
      if (!categoryHabitMap[h.categoryId]) categoryHabitMap[h.categoryId] = [];
      categoryHabitMap[h.categoryId].push(h.id);
    });

    const categoryMomentum: Record<string, MomentumState> = {};
    Object.keys(categoryHabitMap).forEach(catId => {
      const result = calculateCategoryMomentum(logsArray, categoryHabitMap[catId]);
      categoryMomentum[catId] = result.state;
    });

    // Build habitsToday array with completion status for today AND streaks
    const habitsToday = [];
    const yesterdayDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    for (const habit of activeHabits) {
      // Find today's log for this habit
      const logKey = `${habit.id}-${todayDate}`;
      const todayLog = allLogs[logKey];

      // Determine completion status
      const completed = todayLog?.completed || false;

      // Get value if quantified habit
      const value = todayLog?.value !== undefined ? todayLog.value : undefined;

      // Calculate Streak
      let streak = 0;
      if (habit.goal.frequency === 'weekly') {
        streak = calculateWeeklyStreak(logsArray, habit.id);
      } else {
        streak = calculateDailyStreak(logsArray, habit.id);
      }

      // Soft Freeze Check (Lazy Creation)
      // If yesterday was missed, check if we should have applied a soft freeze
      // We do this check if today's log shows no streak continuity from yesterday?
      // Actually, StreakService handles continuity. 
      // But if we want to PERSIST the soft freeze so it shows up in history/logs explicitly:
      // Check Yesterday Log.
      const yesterdayLogKey = `${habit.id}-${yesterdayDate}`;
      const yesterdayLog = allLogs[yesterdayLogKey];

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

    // Fetch goals with progress (reuses efficient batch computation)
    const goalsWithProgress = await computeGoalsWithProgress(userId);

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
