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
import { saveRoutineLog } from '../repositories/routineLogRepository';
import { upsertHabitEntry } from '../repositories/habitEntryRepository';
import { recomputeDayLogForHabit } from '../utils/recomputeUtils';
import { validateDayKey } from '../domain/canonicalValidators';
import type { Routine, RoutineStep, RoutineLog } from '../../models/persistenceTypes';
import multer from 'multer';
import {
  getRoutineImageByRoutineId,
  deleteRoutineImageByRoutineId,
  upsertRoutineImage,
} from '../repositories/routineImageRepository';

// Configure multer for routine image uploads (MongoDB storage)
// Validates: jpeg, png, webp only; max 5MB
const routineImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Explicitly allow only jpeg, png, and webp
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

export const uploadRoutineImageMiddleware = routineImageUpload.single('file');

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
 * Helper function to check if a routine has an image and return the imageUrl.
 * 
 * @param routineId - ID of the routine
 * @returns Promise<string | null> - Image URL if image exists, null otherwise
 */
async function getRoutineImageUrl(routineId: string): Promise<string | null> {
  const image = await getRoutineImageByRoutineId(routineId);
  return image ? `/api/routines/${routineId}/image` : null;
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

    // Add imageUrl to each routine
    const routinesWithImages = await Promise.all(
      routines.map(async (routine) => {
        const imageUrl = await getRoutineImageUrl(routine.id);
        return {
          ...routine,
          imageUrl,
        };
      })
    );

    // Return full list including steps
    res.status(200).json({
      routines: routinesWithImages,
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

    // Add imageUrl to routine
    const imageUrl = await getRoutineImageUrl(routine.id);

    res.status(200).json({
      routine: {
        ...routine,
        imageUrl,
      },
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

    // Add imageUrl to routine
    const imageUrl = await getRoutineImageUrl(routine.id);

    res.status(201).json({
      routine: {
        ...routine,
        imageUrl,
      },
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

    // Add imageUrl to routine
    const imageUrl = await getRoutineImageUrl(routine.id);

    res.status(200).json({
      routine: {
        ...routine,
        imageUrl,
      },
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
 * Get a routine image by routine ID.
 * 
 * GET /api/routines/:routineId/image
 * Returns image bytes with appropriate Content-Type header.
 */
export async function getRoutineImageRoute(req: Request, res: Response): Promise<void> {
  try {
    const { routineId } = req.params;

    if (!routineId) {
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

    // Verify routine exists and belongs to user
    const routine = await getRoutine(userId, routineId);
    if (!routine) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    // Fetch image from repository
    const image = await getRoutineImageByRoutineId(routineId);
    if (!image) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine image not found',
        },
      });
      return;
    }

    // Set headers
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Send image bytes
    res.status(200).send(image.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching routine image:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch routine image',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a routine image by routine ID.
 * 
 * DELETE /api/routines/:routineId/image
 * Deletes the image document from MongoDB.
 */
export async function deleteRoutineImageRoute(req: Request, res: Response): Promise<void> {
  try {
    const { routineId } = req.params;

    if (!routineId) {
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

    // Verify routine exists and belongs to user
    const routine = await getRoutine(userId, routineId);
    if (!routine) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    // Delete image from repository
    await deleteRoutineImageByRoutineId(routineId);

    res.status(200).json({
      ok: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting routine image:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete routine image',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Upload a routine image.
 * 
 * POST /api/routines/:routineId/image
 * Stores image in MongoDB and updates routine with imageId reference.
 */
export async function uploadRoutineImageRoute(req: Request, res: Response): Promise<void> {
  try {
    const { routineId } = req.params;

    if (!routineId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Routine ID is required',
        },
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No image file provided. Please upload a file with field name "file".',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Verify routine exists and belongs to user
    const routine = await getRoutine(userId, routineId);
    if (!routine) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Routine not found',
        },
      });
      return;
    }

    // Validate file
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype.toLowerCase())) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid image type. Only JPEG, PNG, and WebP images are allowed.',
        },
      });
      return;
    }

    if (req.file.size > 5 * 1024 * 1024) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Image file size exceeds 5MB limit.',
        },
      });
      return;
    }

    // Store image in MongoDB
    const { imageId } = await upsertRoutineImage({
      routineId,
      contentType: req.file.mimetype,
      data: req.file.buffer,
    });

    // Update routine with imageId reference
    await updateRoutine(userId, routineId, {
      imageId,
    });

    res.status(200).json({
      imageId,
      imageUrl: `/api/routines/${routineId}/image`,
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

    // Validate dateOverride if provided (must be valid DayKey)
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
      const dayKeyValidation = validateDayKey(dateOverride);
      if (!dayKeyValidation.valid) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: dayKeyValidation.error,
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
    
    // Determine timestamp for entries (use submittedAt if provided, otherwise current time)
    const entryTimestamp = submittedAt ? new Date(submittedAt).toISOString() : new Date().toISOString();

    // Do not write DayLogs directly. DayLogs are derived from HabitEntries.
    // Create HabitEntries for each requested habit
    const habitIds = habitIdsToComplete || [];

    // Create entries in parallel for better performance
    const entryPromises = habitIds.map(async (habitId) => {
      // Security check: Only allow completing habits that are actually linked to this routine?
      // For now, implicit trust if user requests it, assuming frontend filters correctly.
      // Ideally, check if habitId is in routine.linkedHabitIds or allow flexibility.

      // Upsert HabitEntry with routine provenance
      const entry = await upsertHabitEntry(habitId, logDate, userId, {
        timestamp: entryTimestamp,
        value: 1, // Assume bool completion for simple flow
        source: 'routine',
        routineId: routine.id,
        dayKey: logDate, // Canonical dayKey
        date: logDate, // Legacy alias
      });

      // Recompute DayLog to keep derived cache in sync
      await recomputeDayLogForHabit(habitId, logDate, userId);

      return entry;
    });

    await Promise.all(entryPromises);
    const createdOrUpdatedCount = habitIds.length;

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
