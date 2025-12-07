/**
 * Goal Routes
 * 
 * REST API endpoints for Goal entities.
 * Provides CRUD operations for goals with validation.
 */

import type { Request, Response } from 'express';
import multer from 'multer';
import {
  createGoal,
  getGoalsByUser,
  getGoalById,
  updateGoal,
  deleteGoal,
  validateHabitIds,
} from '../repositories/goalRepository';
import { getHabitById } from '../repositories/habitRepository';
import { createGoalManualLog, getGoalManualLogsByGoal } from '../repositories/goalManualLogRepository';
import { computeGoalProgress, computeGoalsWithProgress } from '../utils/goalProgressUtils';
import { saveUploadedFile } from '../utils/fileStorage';
import type { Goal, GoalProgress, GoalWithProgress, GoalManualLog } from '../../models/persistenceTypes';

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Validate that all habit IDs in linkedHabitIds exist in the database.
 * 
 * @param habitIds - Array of habit IDs to validate
 * @param userId - User ID to verify ownership
 * @returns Array of invalid habit IDs (empty if all are valid)
 */
async function validateHabitIdsExist(
  habitIds: string[],
  userId: string
): Promise<string[]> {
  const invalidIds: string[] = [];
  
  for (const habitId of habitIds) {
    const habit = await getHabitById(habitId, userId);
    if (!habit) {
      invalidIds.push(habitId);
    }
  }
  
  return invalidIds;
}

/**
 * Validate goal data.
 * 
 * @param data - Goal data to validate
 * @returns Error message if invalid, null if valid
 */
function validateGoalData(data: any): string | null {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    return 'title is required and must be a non-empty string';
  }

  if (!data.type || (data.type !== 'cumulative' && data.type !== 'frequency')) {
    return 'type is required and must be either "cumulative" or "frequency"';
  }

  if (typeof data.targetValue !== 'number' || data.targetValue <= 0) {
    return 'targetValue is required and must be a positive number';
  }

  if (data.unit !== undefined && typeof data.unit !== 'string') {
    return 'unit must be a string if provided';
  }

  if (!Array.isArray(data.linkedHabitIds)) {
    return 'linkedHabitIds is required and must be an array';
  }

  if (!validateHabitIds(data.linkedHabitIds)) {
    return 'linkedHabitIds must be an array of non-empty strings';
  }

  if (data.deadline !== undefined) {
    if (typeof data.deadline !== 'string') {
      return 'deadline must be a string if provided';
    }
    // Basic date format validation (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.deadline)) {
      return 'deadline must be in YYYY-MM-DD format';
    }
  }

  if (data.completedAt !== undefined && typeof data.completedAt !== 'string') {
    return 'completedAt must be a string if provided';
  }

  if (data.notes !== undefined && typeof data.notes !== 'string') {
    return 'notes must be a string if provided';
  }

  if (data.badgeImageUrl !== undefined && typeof data.badgeImageUrl !== 'string') {
    return 'badgeImageUrl must be a string if provided';
  }

  return null;
}

/**
 * Get all goals for the current user.
 * 
 * GET /api/goals
 */
export async function getGoals(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const goals = await getGoalsByUser(userId);

    res.status(200).json({
      goals,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goals:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goals',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single goal by ID.
 * 
 * GET /api/goals/:id
 */
export async function getGoal(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const goal = await getGoalById(id, userId);

    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    res.status(200).json({
      goal,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goal:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goal',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get all goals with progress information.
 * 
 * GET /api/goals-with-progress
 * 
 * Efficiently fetches all goals with their progress data in a single request,
 * avoiding N+1 query patterns.
 */
export async function getGoalsWithProgress(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const goalsWithProgress = await computeGoalsWithProgress(userId);

    res.status(200).json({
      goals: goalsWithProgress,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goals with progress:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goals with progress',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get goal progress.
 * 
 * GET /api/goals/:id/progress
 */
export async function getGoalProgress(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const progress = await computeGoalProgress(id, userId);

    if (!progress) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    res.status(200).json({
      progress,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goal progress:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goal progress',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create a new goal.
 * 
 * POST /api/goals
 */
export async function createGoalRoute(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const validationError = validateGoalData(req.body);
    if (validationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError,
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Validate that all linked habit IDs exist
    const invalidHabitIds = await validateHabitIdsExist(req.body.linkedHabitIds, userId);
    if (invalidHabitIds.length > 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `The following habit IDs do not exist: ${invalidHabitIds.join(', ')}`,
        },
      });
      return;
    }

    const goal = await createGoal(
      {
        title: req.body.title.trim(),
        type: req.body.type,
        targetValue: req.body.targetValue,
        unit: req.body.unit?.trim(),
        linkedHabitIds: req.body.linkedHabitIds,
        deadline: req.body.deadline,
        completedAt: req.body.completedAt,
        notes: req.body.notes?.trim(),
        badgeImageUrl: req.body.badgeImageUrl?.trim(),
      },
      userId
    );

    res.status(201).json({
      goal,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating goal:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create goal',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Update a goal.
 * 
 * PUT /api/goals/:id
 */
export async function updateGoalRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // Validate update data
    const patch: Partial<Omit<Goal, 'id' | 'createdAt'>> = {};

    if (req.body.title !== undefined) {
      if (typeof req.body.title !== 'string' || req.body.title.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'title must be a non-empty string',
          },
        });
        return;
      }
      patch.title = req.body.title.trim();
    }

    if (req.body.type !== undefined) {
      if (req.body.type !== 'cumulative' && req.body.type !== 'frequency') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'type must be either "cumulative" or "frequency"',
          },
        });
        return;
      }
      patch.type = req.body.type;
    }

    if (req.body.targetValue !== undefined) {
      if (typeof req.body.targetValue !== 'number' || req.body.targetValue <= 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'targetValue must be a positive number',
          },
        });
        return;
      }
      patch.targetValue = req.body.targetValue;
    }

    if (req.body.unit !== undefined) {
      if (typeof req.body.unit !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'unit must be a string',
          },
        });
        return;
      }
      patch.unit = req.body.unit.trim() || undefined;
    }

    if (req.body.linkedHabitIds !== undefined) {
      if (!Array.isArray(req.body.linkedHabitIds)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'linkedHabitIds must be an array',
          },
        });
        return;
      }

      if (!validateHabitIds(req.body.linkedHabitIds)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'linkedHabitIds must be an array of non-empty strings',
          },
        });
        return;
      }
      patch.linkedHabitIds = req.body.linkedHabitIds;
    }

    if (req.body.deadline !== undefined) {
      if (req.body.deadline !== null && typeof req.body.deadline !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'deadline must be a string or null',
          },
        });
        return;
      }
      if (req.body.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.deadline)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'deadline must be in YYYY-MM-DD format',
          },
        });
        return;
      }
      patch.deadline = req.body.deadline || undefined;
    }

    if (req.body.completedAt !== undefined) {
      if (req.body.completedAt !== null && typeof req.body.completedAt !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'completedAt must be a string or null',
          },
        });
        return;
      }
      patch.completedAt = req.body.completedAt || undefined;
    }

    if (req.body.notes !== undefined) {
      patch.notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : req.body.notes || undefined;
    }

    if (req.body.badgeImageUrl !== undefined) {
      patch.badgeImageUrl = typeof req.body.badgeImageUrl === 'string' ? req.body.badgeImageUrl.trim() : req.body.badgeImageUrl || undefined;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field must be provided for update',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // If linkedHabitIds is being updated, validate that all IDs exist
    if (patch.linkedHabitIds) {
      const invalidHabitIds = await validateHabitIdsExist(patch.linkedHabitIds, userId);
      if (invalidHabitIds.length > 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `The following habit IDs do not exist: ${invalidHabitIds.join(', ')}`,
          },
        });
        return;
      }
    }

    const goal = await updateGoal(id, userId, patch);

    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    res.status(200).json({
      goal,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating goal:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update goal',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create a manual log for a goal.
 * 
 * POST /api/goals/:id/manual-logs
 * 
 * Body: { value: number; loggedAt?: string }
 * - value: amount added toward the goal (must be > 0)
 * - loggedAt: ISO 8601 timestamp (optional, defaults to now)
 * 
 * Only works for cumulative goals.
 */
export async function createGoalManualLogRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Verify goal exists and get it
    const goal = await getGoalById(id, userId);
    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    // Only cumulative goals support manual logging
    if (goal.type !== 'cumulative') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Manual logging is only supported for cumulative goals',
        },
      });
      return;
    }

    // Validate request body
    const { value, loggedAt } = req.body;

    if (typeof value !== 'number' || value <= 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'value must be a positive number',
        },
      });
      return;
    }

    // Validate loggedAt if provided
    if (loggedAt !== undefined) {
      if (typeof loggedAt !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'loggedAt must be a string (ISO 8601 format)',
          },
        });
        return;
      }
      // Validate it's a valid ISO 8601 date
      const date = new Date(loggedAt);
      if (isNaN(date.getTime())) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'loggedAt must be a valid ISO 8601 date string',
          },
        });
        return;
      }
    }

    const log = await createGoalManualLog(
      {
        goalId: id,
        value,
        loggedAt: loggedAt || new Date().toISOString(),
      },
      userId
    );

    res.status(201).json({
      log,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating goal manual log:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create goal manual log',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get all manual logs for a goal.
 * 
 * GET /api/goals/:id/manual-logs
 * 
 * Returns all manual logs for the goal, sorted by loggedAt ascending.
 */
export async function getGoalManualLogsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Verify goal exists
    const goal = await getGoalById(id, userId);
    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    const logs = await getGoalManualLogsByGoal(id, userId);

    res.status(200).json({
      logs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goal manual logs:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goal manual logs',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get goal detail with progress, manual logs, and history.
 * 
 * GET /api/goals/:id/detail
 * 
 * Returns comprehensive data for the goal detail page:
 * - goal: The goal entity
 * - progress: Current progress (currentValue, percent, lastSevenDays, inactivityWarning)
 * - manualLogs: All manual logs for the goal
 * - history: Optional aggregated history for last 30 days (date -> total value)
 */
export async function getGoalDetailRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Fetch the goal
    const goal = await getGoalById(id, userId);
    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    // Compute progress (includes habit logs and manual logs)
    const progress = await computeGoalProgress(id, userId);
    if (!progress) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute goal progress',
        },
      });
      return;
    }

    // Fetch manual logs (only for cumulative goals, but fetch for all to be consistent)
    const manualLogs = goal.type === 'cumulative'
      ? await getGoalManualLogsByGoal(id, userId)
      : [];

    // Build aggregated history for last 30 days
    // This aggregates both habit logs and manual logs by date
    const { getDayLogsByHabit } = await import('../repositories/dayLogRepository');
    
    // Fetch all logs for linked habits
    const allLogs: Array<{ date: string; value: number }> = [];
    for (const habitId of goal.linkedHabitIds) {
      const habitLogs = await getDayLogsByHabit(habitId, userId);
      const logsArray = Object.values(habitLogs);
      for (const log of logsArray) {
        if (goal.type === 'cumulative') {
          allLogs.push({ date: log.date, value: log.value });
        } else {
          // For frequency goals, count completed logs as 1
          if (log.completed) {
            allLogs.push({ date: log.date, value: 1 });
          }
        }
      }
    }

    // Add manual logs to the aggregation (only for cumulative goals)
    if (goal.type === 'cumulative') {
      for (const manualLog of manualLogs) {
        // Extract date from ISO timestamp (YYYY-MM-DD)
        const loggedDate = manualLog.loggedAt.split('T')[0];
        allLogs.push({ date: loggedDate, value: manualLog.value });
      }
    }

    // Aggregate by date for last 30 days
    const historyMap = new Map<string, number>();
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      const dateStr = getDateStringForHistory(i);
      last30Days.push(dateStr);
      historyMap.set(dateStr, 0); // Initialize to 0
    }

    // Aggregate values by date
    for (const log of allLogs) {
      if (historyMap.has(log.date)) {
        const currentValue = historyMap.get(log.date) || 0;
        historyMap.set(log.date, currentValue + log.value);
      }
    }

    // Build history array (most recent first)
    const history = last30Days.reverse().map(date => ({
      date,
      value: historyMap.get(date) || 0,
    }));

    res.status(200).json({
      goal,
      progress,
      manualLogs,
      history,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goal detail:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goal detail',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Helper function to get date string in YYYY-MM-DD format for N days ago.
 * Used for history aggregation.
 */
function getDateStringForHistory(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Upload badge image for a completed goal.
 * 
 * POST /api/goals/:id/badge
 * 
 * Accepts multipart/form-data with an 'image' field.
 * Only allowed for completed goals (goal.completedAt != null).
 * 
 * Returns: { success: true, badgeImageUrl: string }
 */
export async function uploadGoalBadgeRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Verify goal exists
    const goal = await getGoalById(id, userId);
    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    // Validate that goal is completed
    if (!goal.completedAt) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal must be completed before uploading a badge.',
        },
      });
      return;
    }

    // Check if file was uploaded
    const file = (req as any).file;
    if (!file) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Image file is required',
        },
      });
      return;
    }

    // Save file and get URL
    const badgeImageUrl = saveUploadedFile(file, 'badges');

    // Update goal with badge URL
    const updatedGoal = await updateGoal(id, userId, {
      badgeImageUrl,
    });

    if (!updatedGoal) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update goal with badge URL',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      badgeImageUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading goal badge:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload badge',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Multer middleware for badge upload.
 * Single file upload with field name 'image'.
 */
export const uploadBadgeMiddleware = upload.single('image');

/**
 * Get goal detail with progress, manual logs, and history.
 * 
 * GET /api/goals/:id/detail
 * 
 * Returns comprehensive data for the goal detail page:
 * - goal: The goal entity
 * - progress: Current progress (currentValue, percent, lastSevenDays, inactivityWarning)
 * - manualLogs: All manual logs for the goal
 * - history: Aggregated history for last 30 days (date -> total value)
 */
export async function getGoalDetailRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Fetch the goal
    const goal = await getGoalById(id, userId);
    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    // Compute progress (includes habit logs and manual logs)
    const progress = await computeGoalProgress(id, userId);
    if (!progress) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute goal progress',
        },
      });
      return;
    }

    // Fetch manual logs (only for cumulative goals, but fetch for all to be consistent)
    const manualLogs = goal.type === 'cumulative'
      ? await getGoalManualLogsByGoal(id, userId)
      : [];

    // Build aggregated history for last 30 days
    // This aggregates both habit logs and manual logs by date
    const { getDayLogsByHabit } = await import('../repositories/dayLogRepository');
    
    // Fetch all logs for linked habits
    const allLogs: Array<{ date: string; value: number }> = [];
    for (const habitId of goal.linkedHabitIds) {
      const habitLogs = await getDayLogsByHabit(habitId, userId);
      const logsArray = Object.values(habitLogs);
      for (const log of logsArray) {
        if (goal.type === 'cumulative') {
          allLogs.push({ date: log.date, value: log.value });
        } else {
          // For frequency goals, count completed logs as 1
          if (log.completed) {
            allLogs.push({ date: log.date, value: 1 });
          }
        }
      }
    }

    // Add manual logs to the aggregation (only for cumulative goals)
    if (goal.type === 'cumulative') {
      for (const manualLog of manualLogs) {
        // Extract date from ISO timestamp (YYYY-MM-DD)
        const loggedDate = manualLog.loggedAt.split('T')[0];
        allLogs.push({ date: loggedDate, value: manualLog.value });
      }
    }

    // Aggregate by date for last 30 days
    const historyMap = new Map<string, number>();
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      last30Days.push(dateStr);
      historyMap.set(dateStr, 0); // Initialize to 0
    }

    // Aggregate values by date
    for (const log of allLogs) {
      if (historyMap.has(log.date)) {
        const currentValue = historyMap.get(log.date) || 0;
        historyMap.set(log.date, currentValue + log.value);
      }
    }

    // Build history array (most recent first)
    const history = last30Days.reverse().map(date => ({
      date,
      value: historyMap.get(date) || 0,
    }));

    res.status(200).json({
      goal,
      progress,
      manualLogs,
      history,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching goal detail:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch goal detail',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a goal.
 * 
 * DELETE /api/goals/:id
 */
export async function deleteGoalRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const deleted = await deleteGoal(id, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Goal deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting goal:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete goal',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
