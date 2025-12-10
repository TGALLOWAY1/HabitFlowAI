/**
 * Activity Routes
 * 
 * REST API endpoints for Activity entities.
 * Provides CRUD operations for activities with validation.
 */

import type { Request, Response } from 'express';
import {
  createActivity,
  getActivitiesByUser,
  getActivityById,
  updateActivity,
  deleteActivity,
} from '../repositories/activityRepository';
import { upsertDayLog } from '../repositories/dayLogRepository';
import { saveActivityLog } from '../repositories/activityLogRepository';
import type { Activity, ActivityStep, DayLog, ActivityLog } from '../../models/persistenceTypes';

/**
 * Validate an ActivityStep object.
 * 
 * @param step - Step object to validate
 * @returns Error message if invalid, null if valid
 */
function validateActivityStep(step: any, index: number): string | null {
  if (!step || typeof step !== 'object') {
    return `Step ${index}: must be an object`;
  }

  if (!step.id || typeof step.id !== 'string' || step.id.trim().length === 0) {
    return `Step ${index}: id is required and must be a non-empty string`;
  }

  if (!step.type || (step.type !== 'habit' && step.type !== 'task')) {
    return `Step ${index}: type must be either 'habit' or 'task'`;
  }

  if (!step.title || typeof step.title !== 'string' || step.title.trim().length === 0) {
    return `Step ${index}: title is required and must be a non-empty string`;
  }

  // If type is 'habit', habitId must be provided
  if (step.type === 'habit') {
    if (!step.habitId || typeof step.habitId !== 'string' || step.habitId.trim().length === 0) {
      return `Step ${index}: habitId is required when type is 'habit'`;
    }
  }

  // Optional fields validation
  if (step.instruction !== undefined && typeof step.instruction !== 'string') {
    return `Step ${index}: instruction must be a string if provided`;
  }

  if (step.imageUrl !== undefined && typeof step.imageUrl !== 'string') {
    return `Step ${index}: imageUrl must be a string if provided`;
  }

  if (step.durationSeconds !== undefined && (typeof step.durationSeconds !== 'number' || step.durationSeconds < 0)) {
    return `Step ${index}: durationSeconds must be a non-negative number if provided`;
  }

  if (step.timeEstimateMinutes !== undefined && (typeof step.timeEstimateMinutes !== 'number' || step.timeEstimateMinutes < 0)) {
    return `Step ${index}: timeEstimateMinutes must be a non-negative number if provided`;
  }

  return null;
}

/**
 * Validate steps array.
 * 
 * @param steps - Steps array to validate
 * @returns Error message if invalid, null if valid
 */
function validateSteps(steps: any): string | null {
  if (!Array.isArray(steps)) {
    return 'steps must be an array';
  }

  for (let i = 0; i < steps.length; i++) {
    const error = validateActivityStep(steps[i], i);
    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Get all activities for the current user.
 * 
 * GET /api/activities
 * Returns list with id, title, and steps count.
 */
export async function getActivities(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const activities = await getActivitiesByUser(userId);

    // Return full list including steps
    res.status(200).json({
      activities,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching activities:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch activities',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single activity by ID.
 * 
 * GET /api/activities/:id
 * Returns full Activity with all steps.
 */
export async function getActivity(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const activity = await getActivityById(id, userId);

    if (!activity) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      return;
    }

    res.status(200).json({
      activity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching activity:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch activity',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create a new activity.
 * 
 * POST /api/activities
 */
export async function createActivityRoute(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const { title, steps, nonNegotiable } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity title is required and must be a non-empty string',
        },
      });
      return;
    }

    if (!steps || !Array.isArray(steps)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'steps is required and must be an array',
        },
      });
      return;
    }

    // Validate steps
    const stepsError = validateSteps(steps);
    if (stepsError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: stepsError,
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const activity = await createActivity(
      {
        title: title.trim(),
        steps: steps as ActivityStep[],
        nonNegotiable,
      },
      userId
    );

    res.status(201).json({
      activity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating activity:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create activity',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Replace an activity (full update).
 * 
 * PUT /api/activities/:id
 */
export async function replaceActivityRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, steps } = req.body;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity ID is required',
        },
      });
      return;
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity title is required and must be a non-empty string',
        },
      });
      return;
    }

    if (!steps || !Array.isArray(steps)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'steps is required and must be an array',
        },
      });
      return;
    }

    // Validate steps
    const stepsError = validateSteps(steps);
    if (stepsError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: stepsError,
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const activity = await updateActivity(
      id,
      userId,
      {
        title: title.trim(),
        steps: steps as ActivityStep[],
      }
    );

    if (!activity) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      return;
    }

    res.status(200).json({
      activity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error replacing activity:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to replace activity',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Partially update an activity.
 * 
 * PATCH /api/activities/:id
 */
export async function updateActivityRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, steps, nonNegotiable } = req.body;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity ID is required',
        },
      });
      return;
    }

    // Validate update data
    const patch: Partial<Omit<Activity, 'id' | 'userId' | 'createdAt'>> = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Activity title must be a non-empty string',
          },
        });
        return;
      }
      patch.title = title.trim();
    }

    if (steps !== undefined) {
      if (!Array.isArray(steps)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'steps must be an array',
          },
        });
        return;
      }

      // Validate steps
      const stepsError = validateSteps(steps);
      if (stepsError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: stepsError,
          },
        });
        return;
      }
      patch.steps = steps as ActivityStep[];
    }

    if (nonNegotiable !== undefined) {
      patch.nonNegotiable = !!nonNegotiable;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field (title or steps) must be provided for update',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const activity = await updateActivity(id, userId, patch);

    if (!activity) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      return;
    }

    res.status(200).json({
      activity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating activity:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update activity',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete an activity.
 * 
 * DELETE /api/activities/:id
 */
export async function deleteActivityRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const deleted = await deleteActivity(id, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting activity:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete activity',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Derive YYYY-MM-DD date string from ISO datetime string or Date object.
 * 
 * @param dateInput - ISO datetime string, Date object, or undefined
 * @returns YYYY-MM-DD formatted string
 */
function deriveDateString(dateInput?: string | Date): string {
  let date: Date;

  if (dateInput) {
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }
  } else {
    date = new Date();
  }

  // Extract YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Submit activity completion and create DayLogs for habit steps.
 * 
 * POST /api/activities/:id/submit
 */
export async function submitActivityRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { mode, completedStepIds, submittedAt, dateOverride } = req.body;

    // Validate activity ID
    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Activity ID is required',
        },
      });
      return;
    }

    // Validate request body
    if (!mode || (mode !== 'habit' && mode !== 'image' && mode !== 'text')) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'mode is required and must be one of: "habit", "image", "text"',
        },
      });
      return;
    }

    if (!Array.isArray(completedStepIds)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'completedStepIds is required and must be an array',
        },
      });
      return;
    }

    // Validate dateOverride if provided
    if (dateOverride !== undefined) {
      if (typeof dateOverride !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'dateOverride must be a string in YYYY-MM-DD format',
          },
        });
        return;
      }
      // Basic format validation
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'dateOverride must be in YYYY-MM-DD format',
          },
        });
        return;
      }
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Load the Activity
    const activity = await getActivityById(id, userId);

    if (!activity) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      return;
    }

    // Build map of steps by id
    const stepsMap = new Map<string, ActivityStep>();
    for (const step of activity.steps) {
      stepsMap.set(step.id, step);
    }

    // Determine the log date
    const logDate = dateOverride || deriveDateString(submittedAt);

    // Filter completedStepIds to only include valid habit steps
    const validHabitSteps: ActivityStep[] = [];
    const completedHabitStepIds: string[] = [];

    for (const stepId of completedStepIds) {
      const step = stepsMap.get(stepId);
      if (step && step.type === 'habit' && step.habitId && step.habitId.trim().length > 0) {
        validHabitSteps.push(step);
        completedHabitStepIds.push(stepId);
      }
    }

    // Count total habit steps in activity
    const totalHabitStepsInActivity = activity.steps.filter(
      step => step.type === 'habit' && step.habitId && step.habitId.trim().length > 0
    ).length;

    // Create DayLogs for each valid habit step
    let createdOrUpdatedCount = 0;

    for (const step of validHabitSteps) {
      // Create DayLog as plain object to ensure all fields are included
      const dayLog = {
        habitId: step.habitId!,
        date: logDate,
        value: 1, // Boolean completion (1 = completed)
        completed: true, // Repository will recalculate, but we set it for clarity
        activityId: activity.id, // Explicitly include activity metadata
        activityStepId: step.id, // Explicitly include activity metadata
      } as DayLog;

      await upsertDayLog(dayLog, userId);
      createdOrUpdatedCount++;
    }

    // Save ActivityLog to record completion of the activity itself
    const activityLog: ActivityLog = {
      activityId: activity.id,
      date: logDate,
      completedAt: submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString(),
    };
    await saveActivityLog(activityLog, userId);

    res.status(200).json({
      message: 'Activity submitted successfully',
      createdOrUpdatedCount,
      completedHabitStepIds,
      totalHabitStepsInActivity,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error submitting activity:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to submit activity',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
