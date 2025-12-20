/**
 * DayLog Routes
 * 
 * REST API endpoints for DayLog entities (habit tracking results).
 * 
 * ⚠️ LEGACY: DayLogs are derived caches from HabitEntries.
 * 
 * Write operations (POST, PUT, DELETE) are DEPRECATED and return 410 Gone.
 * DayLogs should only be written via recomputeDayLogForHabit() after HabitEntry mutations.
 * 
 * Read operations (GET) remain temporarily for debugging/legacy support but will be removed after Milestone B.
 */

import type { Request, Response } from 'express';
import {
  getDayLogsByUser,
  getDayLogsByHabit,
  getDayLog,
} from '../repositories/dayLogRepository';
import type { DayLog } from '../../models/persistenceTypes';

/**
 * Get all day logs for the current user.
 * 
 * GET /api/dayLogs
 * GET /api/dayLogs?habitId=xxx (optional filter)
 * 
 * ⚠️ LEGACY: This endpoint is deprecated and will be removed after Milestone B.
 * DayLogs are derived caches. Use HabitEntry endpoints for source of truth.
 */
export async function getDayLogs(req: Request, res: Response): Promise<void> {
  try {

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const habitId = req.query.habitId as string | undefined;

    let logs: Record<string, DayLog>;
    if (habitId) {
      logs = await getDayLogsByHabit(habitId, userId);
    } else {
      logs = await getDayLogsByUser(userId);
    }

    res.status(200)
      .setHeader('X-Legacy-Endpoint', 'true')
      .json({
        logs,
        legacy: true, // Mark as legacy in response body
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching day logs:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch day logs',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create or update a day log.
 * 
 * POST /api/dayLogs
 * PUT /api/dayLogs
 * 
 * ⚠️ DEPRECATED: DayLogs are derived caches and must not be written directly.
 * Write HabitEntries instead. DayLogs will be automatically recomputed.
 * 
 * Returns 410 Gone to indicate this endpoint is permanently removed.
 */
export async function upsertDayLogRoute(_req: Request, res: Response): Promise<void> {
  // Do not write DayLogs directly. DayLogs are derived from HabitEntries.
  res.status(410).json({
    error: 'DayLogs are deprecated. Write HabitEntries instead.',
    message: 'DayLogs are derived caches and must not be written directly. Use POST /api/entries to create HabitEntries. DayLogs will be automatically recomputed.',
    deprecated: true,
  });
}

/**
 * Get a single day log.
 * 
 * GET /api/dayLogs/:habitId/:date
 * 
 * ⚠️ LEGACY: This endpoint is deprecated and will be removed after Milestone B.
 * DayLogs are derived caches. Use HabitEntry endpoints for source of truth.
 */
export async function getDayLogRoute(req: Request, res: Response): Promise<void> {
  try {

    const { habitId, date } = req.params;

    if (!habitId || !date) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habit ID and date are required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const log = await getDayLog(habitId, date, userId);

    if (!log) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Day log not found',
        },
      });
      return;
    }

    res.status(200)
      .setHeader('X-Legacy-Endpoint', 'true')
      .json({
        log,
        legacy: true, // Mark as legacy in response body
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching day log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch day log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a day log.
 * 
 * DELETE /api/dayLogs/:habitId/:date
 * 
 * ⚠️ DEPRECATED: DayLogs are derived caches and must not be deleted directly.
 * Delete HabitEntries instead. DayLogs will be automatically recomputed.
 * 
 * Returns 410 Gone to indicate this endpoint is permanently removed.
 */
export async function deleteDayLogRoute(_req: Request, res: Response): Promise<void> {
  // Do not delete DayLogs directly. DayLogs are derived from HabitEntries.
  res.status(410).json({
    error: 'DayLogs are deprecated. Delete HabitEntries instead.',
    message: 'DayLogs are derived caches and must not be deleted directly. Use DELETE /api/entries to delete HabitEntries. DayLogs will be automatically recomputed.',
    deprecated: true,
  });
}

