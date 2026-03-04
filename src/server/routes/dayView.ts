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
import { resolveTimeZone } from '../utils/dayKey';
import type { DayKey } from '../../domain/time/dayKey';
import { getRequestIdentity } from '../middleware/identity';

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

    // Use canonical default (America/New_York) when timeZone missing or invalid
    const resolvedTimeZone = resolveTimeZone(typeof timeZone === 'string' ? timeZone : undefined);
    const timeZoneValidation = assertTimeZone(resolvedTimeZone);
    if (!timeZoneValidation.valid) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: timeZoneValidation.error,
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const dayView = await computeDayView(householdId, userId, dayKey as DayKey, resolvedTimeZone);

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

