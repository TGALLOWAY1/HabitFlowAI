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
  reorderHabits,
  recoverCategoryDeletedHabits,
} from '../repositories/habitRepository';
import { createCategory, getCategoriesByUser, getCategoryById } from '../repositories/categoryRepository';
import { deleteHabitEntriesByHabit } from '../repositories/habitEntryRepository';
import type { Habit } from '../../models/persistenceTypes';
import { getRequestIdentity } from '../middleware/identity';

// One-time recovery: track which users have been recovered to avoid repeated DB calls
const recoveredUsers = new Set<string>();

/**
 * Get all habits for the current user.
 *
 * GET /api/habits
 * GET /api/habits?categoryId=xxx (optional filter)
 */
export async function getHabits(req: Request, res: Response): Promise<void> {
  try {

    const { householdId, userId } = getRequestIdentity(req);
    const categoryId = req.query.categoryId as string | undefined;

    // One-time recovery: unarchive habits that were archived due to category deletion
    const recoveryKey = `${householdId}:${userId}`;
    if (!recoveredUsers.has(recoveryKey)) {
      recoveredUsers.add(recoveryKey);
      const recovered = await recoverCategoryDeletedHabits(householdId, userId);
      if (recovered > 0) {
        console.log(`[Recovery] Unarchived ${recovered} habits for user ${userId} (previously archived by category deletion)`);
      }
    }

    let habits: Habit[];
    if (categoryId) {
      habits = await getHabitsByCategory(categoryId, householdId, userId);
    } else {
      habits = await getHabitsByUser(householdId, userId);

      // Self-heal legacy/orphaned habits:
      // Any habit with missing/invalid categoryId (or archived due old category-delete behavior)
      // is reassigned to a real "No Category" bucket so it is visible and manageable in UI.
      const categories = await getCategoriesByUser(householdId, userId);
      const categoryIds = new Set(categories.map(c => c.id));
      const noCategoryName = 'No Category';
      let noCategory = categories.find(c => c.name.trim().toLowerCase() === noCategoryName.toLowerCase());

      const habitsNeedingRecovery = habits.filter(h => {
        const missingCategoryId = typeof h.categoryId !== 'string' || h.categoryId.trim().length === 0;
        const invalidCategoryId = !!h.categoryId && !categoryIds.has(h.categoryId);
        const archivedAndOrphaned = h.archived === true && (missingCategoryId || invalidCategoryId);
        return missingCategoryId || invalidCategoryId || archivedAndOrphaned;
      });

      if (habitsNeedingRecovery.length > 0) {
        if (!noCategory) {
          noCategory = await createCategory(
            { name: noCategoryName, color: 'bg-neutral-600' },
            householdId,
            userId
          );
        }

        const updatedHabits = await Promise.all(
          habitsNeedingRecovery.map(h =>
            updateHabit(h.id, householdId, userId, {
              categoryId: noCategory!.id,
              archived: false,
            })
          )
        );

        const updatedMap = new Map(updatedHabits.filter(Boolean).map(h => [h!.id, h!]));
        habits = habits.map(h => updatedMap.get(h.id) ?? h);
      }
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
    // Validate request body
    const {
      name, categoryId, goal, description, assignedDays, scheduledTime, durationMinutes,
      nonNegotiable, nonNegotiableDays, deadline, type, subHabitIds, bundleParentId, order,
      bundleType, bundleOptions,
      pinned, timeEstimate,
      linkedGoalId, linkedRoutineIds
    } = req.body;

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

    const { householdId, userId } = getRequestIdentity(req);

    const habit = await createHabit(
      {
        name: name.trim(),
        categoryId,
        goal,
        description: description?.trim(),
        assignedDays,
        scheduledTime,
        durationMinutes: durationMinutes || 30, // Default to 30 mins if not provided
        nonNegotiable,
        nonNegotiableDays,
        deadline,
        type,
        subHabitIds,
        bundleParentId,
        order,
        bundleType,
        bundleOptions,
        pinned,
        timeEstimate,
        linkedGoalId,
        linkedRoutineIds,
      },
      householdId,
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

    const { householdId, userId } = getRequestIdentity(req);

    const habit = await getHabitById(id, householdId, userId);

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
    const {
      name, categoryId, goal, description, archived, assignedDays, scheduledTime, durationMinutes,
      nonNegotiable, nonNegotiableDays, deadline, type, subHabitIds, bundleParentId, order,
      bundleType, bundleOptions,
      pinned, timeEstimate,
      linkedGoalId, linkedRoutineIds
    } = req.body;

    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Habit ID is required' } });
      return;
    }

    const patch: Partial<Omit<Habit, 'id' | 'createdAt'>> = {};

    if (name !== undefined) patch.name = name.trim();
    if (categoryId !== undefined) patch.categoryId = categoryId;
    if (goal !== undefined) patch.goal = goal;
    if (description !== undefined) patch.description = description;
    if (archived !== undefined) patch.archived = archived;
    if (assignedDays !== undefined) patch.assignedDays = assignedDays;
    if (scheduledTime !== undefined) patch.scheduledTime = scheduledTime;
    if (durationMinutes !== undefined) patch.durationMinutes = durationMinutes;
    if (nonNegotiable !== undefined) patch.nonNegotiable = !!nonNegotiable;
    if (nonNegotiableDays !== undefined) patch.nonNegotiableDays = nonNegotiableDays;
    if (deadline !== undefined) patch.deadline = deadline;
    if (type !== undefined) patch.type = type;
    if (subHabitIds !== undefined) patch.subHabitIds = subHabitIds;
    if (bundleParentId !== undefined) patch.bundleParentId = bundleParentId;
    if (order !== undefined) patch.order = order;
    if (bundleType !== undefined) patch.bundleType = bundleType;
    if (bundleOptions !== undefined) patch.bundleOptions = bundleOptions;
    if (pinned !== undefined) patch.pinned = !!pinned;
    if (timeEstimate !== undefined) patch.timeEstimate = timeEstimate;
    if (linkedGoalId !== undefined) patch.linkedGoalId = linkedGoalId;
    if (linkedRoutineIds !== undefined) patch.linkedRoutineIds = linkedRoutineIds;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one field must be provided for update' } });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    if (patch.categoryId) {
      const targetCategory = await getCategoryById(patch.categoryId, householdId, userId);
      if (!targetCategory) {
        res.status(400).json({
          error: {
            code: 'INVALID_CATEGORY',
            message: 'Target category does not exist',
          },
        });
        return;
      }
    }

    const habit = await updateHabit(id, householdId, userId, patch);

    if (!habit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found' } });
      return;
    }

    res.status(200).json({ habit });
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

    const { householdId, userId } = getRequestIdentity(req);

    const existing = await getHabitById(id, householdId, userId);
    if (!existing) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Habit not found',
        },
      });
      return;
    }

    const deletedEntriesCount = await deleteHabitEntriesByHabit(id, householdId, userId);

    const deleted = await deleteHabit(id, householdId, userId);

    if (!deleted) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete habit',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Habit deleted successfully',
      deletedEntriesCount,
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

/**
 * Reorder habits.
 * 
 * PATCH /api/habits/reorder
 */
export async function reorderHabitsRoute(req: Request, res: Response): Promise<void> {
  try {

    const { habits } = req.body;

    if (!Array.isArray(habits) || !habits.every(id => typeof id === 'string')) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Habits must be an array of habit IDs',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const success = await reorderHabits(householdId, userId, habits);

    if (!success) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reorder habits',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Habits reordered successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error reordering habits:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reorder habits',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
