/**
 * Habit Routes
 * 
 * REST API endpoints for Habit entities.
 * Uses feature flag to enable/disable MongoDB persistence.
 */

import type { Request, Response } from 'express';
import {
  createHabit,
  getHabitsByUser,
  getHabitsByCategory,
  getHabitById,
  updateHabit,
  deleteHabit,
} from '../repositories/habitRepository';
import { getActivitiesByUser, updateActivity } from '../repositories/activityRepository';
import type { Habit, ActivityStep } from '../../models/persistenceTypes';

/**
 * Get all habits for the current user.
 * 
 * GET /api/habits
 * GET /api/habits?categoryId=xxx (optional filter)
 */
export async function getHabits(req: Request, res: Response): Promise<void> {
  try {

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const categoryId = req.query.categoryId as string | undefined;

    let habits: Habit[];
    if (categoryId) {
      habits = await getHabitsByCategory(categoryId, userId);
    } else {
      habits = await getHabitsByUser(userId);
    }

    res.status(200).json({
      habits,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching habits:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch habits',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create a new habit.
 * 
 * POST /api/habits
 */
export async function createHabitRoute(req: Request, res: Response): Promise<void> {
  try {

    // Validate request body
    const { name, categoryId, goal, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habit name is required and must be a non-empty string',
        },
      });
      return;
    }

    if (!categoryId || typeof categoryId !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category ID is required',
        },
      });
      return;
    }

    if (!goal || typeof goal !== 'object') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal configuration is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const habit = await createHabit(
      {
        name: name.trim(),
        categoryId,
        goal,
        description: description?.trim(),
      },
      userId
    );

    res.status(201).json({
      habit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating habit:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create habit',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single habit by ID.
 * 
 * GET /api/habits/:id
 */
export async function getHabit(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habit ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const habit = await getHabitById(id, userId);

    if (!habit) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Habit not found',
        },
      });
      return;
    }

    res.status(200).json({
      habit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching habit:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch habit',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Update a habit.
 * 
 * PATCH /api/habits/:id
 */
export async function updateHabitRoute(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;
    const { name, categoryId, goal, description, archived } = req.body;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habit ID is required',
        },
      });
      return;
    }

    // Validate update data
    const patch: Partial<Omit<Habit, 'id' | 'createdAt'>> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Habit name must be a non-empty string',
          },
        });
        return;
      }
      patch.name = name.trim();
    }

    if (categoryId !== undefined) {
      if (typeof categoryId !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Category ID must be a string',
          },
        });
        return;
      }
      patch.categoryId = categoryId;
    }

    if (goal !== undefined) {
      if (typeof goal !== 'object') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Goal must be an object',
          },
        });
        return;
      }
      patch.goal = goal;
    }

    if (description !== undefined) {
      patch.description = typeof description === 'string' ? description.trim() : description;
    }

    if (archived !== undefined) {
      if (typeof archived !== 'boolean') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Archived must be a boolean',
          },
        });
        return;
      }
      patch.archived = archived;
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

    const habit = await updateHabit(id, userId, patch);

    if (!habit) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Habit not found',
        },
      });
      return;
    }

    res.status(200).json({
      habit,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating habit:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update habit',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a habit.
 * 
 * DELETE /api/habits/:id
 */
export async function deleteHabitRoute(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habit ID is required',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // Cascade delete day logs for this habit
    const { deleteDayLogsByHabit } = await import('../repositories/dayLogRepository');
    await deleteDayLogsByHabit(id, userId);

    const deleted = await deleteHabit(id, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Habit not found',
        },
      });
      return;
    }

    // Convert Activity habit steps to tasks (best-effort)
    let convertedStepsCount = 0;
    try {
      const activities = await getActivitiesByUser(userId);

      for (const activity of activities) {
        // Check if any steps reference this habit
        const hasReferencingSteps = activity.steps.some(
          step => step.type === 'habit' && step.habitId === id
        );

        if (hasReferencingSteps) {
          // Transform steps: convert habit steps referencing this habit to tasks
          const updatedSteps: ActivityStep[] = activity.steps.map(step => {
            if (step.type === 'habit' && step.habitId === id) {
              // Convert to task step
              const { habitId, ...stepWithoutHabitId } = step;
              convertedStepsCount++;
              return {
                ...stepWithoutHabitId,
                type: 'task' as const,
              };
            }
            return step;
          });

          // Update the activity
          await updateActivity(activity.id, userId, { steps: updatedSteps });
        }
      }
    } catch (error) {
      // Best-effort: log error but don't break habit deletion
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating activities when deleting habit:', errorMessage);
      // Continue - habit deletion was successful
    }

    res.status(200).json({
      message: 'Habit deleted successfully',
      convertedStepsCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting habit:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete habit',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

