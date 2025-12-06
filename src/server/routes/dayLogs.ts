/**
 * DayLog Routes
 * 
 * REST API endpoints for DayLog entities (habit tracking results).
 * Uses feature flag to enable/disable MongoDB persistence.
 */

import type { Request, Response } from 'express';
import {
  upsertDayLog,
  getDayLogsByUser,
  getDayLogsByHabit,
  getDayLog,
  deleteDayLog,
} from '../repositories/dayLogRepository';
import type { DayLog } from '../../models/persistenceTypes';

/**
 * Get all day logs for the current user.
 * 
 * GET /api/dayLogs
 * GET /api/dayLogs?habitId=xxx (optional filter)
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

    res.status(200).json({
      logs,
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
 */
export async function upsertDayLogRoute(req: Request, res: Response): Promise<void> {
  try {

    // Validate request body
    const { habitId, date, value, completed } = req.body;

    if (!habitId || typeof habitId !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habit ID is required and must be a string',
        },
      });
      return;
    }

    if (!date || typeof date !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date is required and must be a string (YYYY-MM-DD)',
        },
      });
      return;
    }

    if (typeof value !== 'number') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Value is required and must be a number',
        },
      });
      return;
    }

    if (typeof completed !== 'boolean') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Completed is required and must be a boolean',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const log: DayLog = {
      habitId,
      date,
      value,
      completed,
    };

    const result = await upsertDayLog(log, userId);

    res.status(200).json({
      log: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error upserting day log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save day log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single day log.
 * 
 * GET /api/dayLogs/:habitId/:date
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

    res.status(200).json({
      log,
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
 */
export async function deleteDayLogRoute(req: Request, res: Response): Promise<void> {
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

    const deleted = await deleteDayLog(habitId, date, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Day log not found',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Day log deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting day log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete day log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

