/**
 * WellbeingLog Routes
 * 
 * REST API endpoints for DailyWellbeing entities.
 * Uses feature flag to enable/disable MongoDB persistence.
 */

import type { Request, Response } from 'express';
import { getUseMongoPersistence } from '../config';
import {
  upsertWellbeingLog,
  getWellbeingLogsByUser,
  getWellbeingLog,
  deleteWellbeingLog,
} from '../repositories/wellbeingLogRepository';
import type { DailyWellbeing } from '../../models/persistenceTypes';

/**
 * Get all wellbeing logs for the current user.
 * 
 * GET /api/wellbeingLogs
 */
export async function getWellbeingLogs(req: Request, res: Response): Promise<void> {
  try {
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const logs = await getWellbeingLogsByUser(userId);

    res.status(200).json({
      wellbeingLogs: logs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching wellbeing logs:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch wellbeing logs',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create or update a wellbeing log.
 * 
 * POST /api/wellbeingLogs
 * PUT /api/wellbeingLogs
 */
export async function upsertWellbeingLogRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env',
        },
      });
      return;
    }

    // Validate request body
    const { date, morning, evening, ...legacyFields } = req.body;

    if (!date || typeof date !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date is required and must be a string (YYYY-MM-DD)',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const log: DailyWellbeing = {
      date,
      morning,
      evening,
      // Include legacy fields for backward compatibility
      ...(legacyFields.depression !== undefined && { depression: legacyFields.depression }),
      ...(legacyFields.anxiety !== undefined && { anxiety: legacyFields.anxiety }),
      ...(legacyFields.energy !== undefined && { energy: legacyFields.energy }),
      ...(legacyFields.sleepScore !== undefined && { sleepScore: legacyFields.sleepScore }),
      ...(legacyFields.notes !== undefined && { notes: legacyFields.notes }),
    };

    const result = await upsertWellbeingLog(log, userId);

    res.status(200).json({
      wellbeingLog: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error upserting wellbeing log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save wellbeing log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single wellbeing log by date.
 * 
 * GET /api/wellbeingLogs/:date
 */
export async function getWellbeingLogRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env',
        },
      });
      return;
    }

    const { date } = req.params;

    if (!date) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const log = await getWellbeingLog(date, userId);

    if (!log) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Wellbeing log not found',
        },
      });
      return;
    }

    res.status(200).json({
      wellbeingLog: log,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching wellbeing log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch wellbeing log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a wellbeing log.
 * 
 * DELETE /api/wellbeingLogs/:date
 */
export async function deleteWellbeingLogRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env',
        },
      });
      return;
    }

    const { date } = req.params;

    if (!date) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const deleted = await deleteWellbeingLog(date, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Wellbeing log not found',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Wellbeing log deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting wellbeing log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete wellbeing log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

