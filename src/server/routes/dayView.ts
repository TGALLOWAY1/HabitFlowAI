/**
 * Day View Routes
 * 
 * REST API endpoint for day view state derived from truthQuery EntryViews.
 * 
 * Completion is always derived, never stored.
 * No DayLogs are read directly.
 */

import type { Request, Response } from 'express';
import { computeDayView } from '../services/dayViewService';
import { validateDayKey, assertTimeZone } from '../domain/canonicalValidators';
import type { DayKey } from '../../domain/time/dayKey';

/**
 * Get day view for a specific dayKey.
 * 
 * GET /api/dayView?dayKey=YYYY-MM-DD&timeZone=...
 * 
 * Returns completion/progress state for all active habits on the requested day,
 * derived strictly from truthQuery EntryViews.
 * 
 * Query parameters:
 * - dayKey (required): DayKey in YYYY-MM-DD format
 * - timeZone (required): User's timezone (e.g., "America/Los_Angeles", "UTC")
 * 
 * Response:
 * - dayKey: The requested dayKey
 * - habits: Array of habit statuses with completion/progress derived from EntryViews
 */
export async function getDayView(req: Request, res: Response): Promise<void> {
  try {
    const { dayKey, timeZone } = req.query;

    // Validate dayKey
    if (!dayKey || typeof dayKey !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'dayKey is required (YYYY-MM-DD format)',
        },
      });
      return;
    }

    const dayKeyValidation = validateDayKey(dayKey);
    if (!dayKeyValidation.valid) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: dayKeyValidation.error,
        },
      });
      return;
    }

    // Validate timeZone
    if (!timeZone || typeof timeZone !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'timeZone is required (e.g., "America/Los_Angeles", "UTC")',
        },
      });
      return;
    }

    const timeZoneValidation = assertTimeZone(timeZone);
    if (!timeZoneValidation.valid) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: timeZoneValidation.error,
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Compute day view from truthQuery
    const dayView = await computeDayView(userId, dayKey as DayKey, timeZone);

    res.status(200).json(dayView);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching day view:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch day view',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

