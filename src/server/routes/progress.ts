/**
 * Progress Routes
 * 
 * Routes for fetching progress overview data combining habits and goals.
 */

import type { Request, Response } from 'express';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getDayLogsByUser } from '../repositories/dayLogRepository';
import { computeGoalsWithProgress } from '../utils/goalProgressUtils';
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
    const habitsToday = activeHabits.map(habit => {
      // Find today's log for this habit
      const logKey = `${habit.id}-${todayDate}`;
      const todayLog = allLogs[logKey];

      // Determine completion status
      const completed = todayLog?.completed || false;

      // Get value if quantified habit
      const value = todayLog?.value !== undefined ? todayLog.value : undefined;

      return {
        habit,
        completed,
        value,
      };
    });

    // Fetch goals with progress (reuses efficient batch computation)
    const goalsWithProgress = await computeGoalsWithProgress(userId);

    // Return combined response
    res.status(200).json({
      todayDate,
      habitsToday,
      goalsWithProgress,
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
