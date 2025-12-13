/**
 * Routine Routes
 * 
 * REST API endpoints for Routine entities.
 * Provides CRUD operations for routines with validation.
 */

import type { Request, Response } from 'express';
import {
  createRoutine,
  getRoutines,
  getRoutine,
  updateRoutine,
  deleteRoutine,
} from '../repositories/routineRepository';
import { upsertDayLog } from '../repositories/dayLogRepository';
import { saveRoutineLog } from '../repositories/routineLogRepository';
import type { Routine, RoutineStep, DayLog, RoutineLog } from '../../models/persistenceTypes';
import multer from 'multer';
import { saveUploadedFile } from '../utils/fileStorage';

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const uploadRoutineImageMiddleware = upload.single('image');

/**
 * Validate a RoutineStep object.
 * 
 * @param step - Step object to validate
 * @returns Error message if invalid, null if valid
 */
function validateRoutineStep(step: any, index: number): string | null {
  if (!step || typeof step !== 'object') {
    return `Step ${index}: must be an object`;
  }

  if (!step.id || typeof step.id !== 'string' || step.id.trim().length === 0) {
    return `Step ${index}: id is required and must be a non-empty string`;
  }

  if (!step.title || typeof step.title !== 'string' || step.title.trim().length === 0) {
    return `Step ${index}: title is required and must be a non-empty string`;
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
    const error = validateRoutineStep(steps[i], i);
    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Get all routines for the current user.
 * 
 * GET /api/routines
 * Returns list with id, title, and steps count.
 */
export async function getRoutinesRoute(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const routines = await getRoutines(userId);

    // Return full list including steps
    res.status(200).json({
      routines,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching routines:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch routines',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single routine by ID.
 * 
 * GET /api/routines/:id
 * Returns full Routine with all steps.
 */
export async function getRoutineRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Routine ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const routine = await getRoutine(userId, id);

    if (!routine) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    res.status(200).json({
      routine,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching routine:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch routine',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create a new routine.
 * 
 * POST /api/routines
 */
export async function createRoutineRoute(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    // Validate request body
    const { title, categoryId, steps, linkedHabitIds } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Routine title is required and must be a non-empty string',
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

    if (linkedHabitIds && !Array.isArray(linkedHabitIds)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'linkedHabitIds must be an array if provided'
        }
      });
      return;
    }

    if (categoryId && typeof categoryId !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'categoryId must be a string if provided'
        }
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

    const routine = await createRoutine(
      userId,
      {
        title: title.trim(),
        categoryId: categoryId || undefined,
        steps: steps as RoutineStep[],
        linkedHabitIds: linkedHabitIds || [],
      }
    );

    res.status(201).json({
      routine,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating routine:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create routine',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Partially update a routine.
 * 
 * PATCH /api/routines/:id
 */
export async function updateRoutineRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, categoryId, steps, linkedHabitIds } = req.body;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Routine ID is required',
        },
      });
      return;
    }

    // Validate update data
    const patch: Partial<Omit<Routine, 'id' | 'userId' | 'createdAt'>> = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Routine title must be a non-empty string',
          },
        });
        return;
      }
      patch.title = title.trim();
    }

    if (categoryId !== undefined) {
      if (categoryId !== null && typeof categoryId !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Category ID must be a string or null',
          },
        });
        return;
      }
      patch.categoryId = categoryId || undefined;
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
      patch.steps = steps as RoutineStep[];
    }

    if (linkedHabitIds !== undefined) {
      if (!Array.isArray(linkedHabitIds)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'linkedHabitIds must be an array',
          }
        });
        return;
      }
      patch.linkedHabitIds = linkedHabitIds;
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

    const routine = await updateRoutine(userId, id, patch);

    if (!routine) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    res.status(200).json({
      routine,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating routine:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update routine',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a routine.
 * 
 * DELETE /api/routines/:id
 */
export async function deleteRoutineRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Routine ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const deleted = await deleteRoutine(userId, id);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Routine deleted successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting routine:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete routine',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Upload a routine step image.
 * 
 * POST /api/upload/routine-image
 */
export async function uploadRoutineImageRoute(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No image file provided',
        },
      });
      return;
    }

    // Save file using existing utility
    const publicUrl = saveUploadedFile(req.file, 'routine-images');

    res.status(200).json({
      url: publicUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading routine image:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to upload image',
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
 * Submit routine completion and optionally complete linked habits.
 * 
 * POST /api/routines/:id/submit
 */
export async function submitRoutineRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { habitIdsToComplete, submittedAt, dateOverride } = req.body;

    // Validate routine ID
    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Routine ID is required',
        },
      });
      return;
    }

    // Validate request body
    if (habitIdsToComplete && !Array.isArray(habitIdsToComplete)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'habitIdsToComplete must be an array of strings',
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

    // Load the Routine
    const routine = await getRoutine(userId, id);

    if (!routine) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    // Determine the log date
    const logDate = dateOverride || deriveDateString(submittedAt);

    // Create DayLogs for each requested habit
    let createdOrUpdatedCount = 0;
    const habitIds = habitIdsToComplete || [];

    for (const habitId of habitIds) {
      // Security check: Only allow completing habits that are actually linked to this routine?
      // For now, implicit trust if user requests it, assuming frontend filters correctly.
      // Ideally, check if habitId is in routine.linkedHabitIds or allow flexibility.

      const dayLog: DayLog = {
        habitId,
        date: logDate,
        value: 1, // Assume bool completion for simple flow
        completed: true,
        source: 'routine',
        routineId: routine.id,
      };

      await upsertDayLog(dayLog, userId);
      createdOrUpdatedCount++;
    }

    // Save RoutineLog to record completion of the routine itself
    const routineLog: RoutineLog = {
      routineId: routine.id,
      date: logDate,
      completedAt: submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString(),
    };
    await saveRoutineLog(routineLog, userId);

    res.status(200).json({
      message: 'Routine submitted successfully',
      createdOrUpdatedCount,
      completedHabitIds: habitIds,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error submitting routine:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to submit routine',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
