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
  archiveHabit,
  unarchiveHabit,
  reorderHabits,
  recoverCategoryDeletedHabits,
  releaseBundleChildren,
} from '../repositories/habitRepository';
import { createCategory, getCategoriesByUser, getCategoryById } from '../repositories/categoryRepository';
import { addHabitToGoalLinkedIds, removeHabitFromGoalLinkedIds } from '../repositories/goalRepository';
// deleteHabitEntriesByHabit intentionally not imported — entries persist after
// habit deletion so goal progress includes historical contributions.
import { endMembership } from '../repositories/bundleMembershipRepository';
import { convertHabitToBundle, ConversionError } from '../services/habitConversionService';
import type { Habit } from '../../models/persistenceTypes';
import { getRequestIdentity } from '../middleware/identity';
import { invalidateUserCaches } from '../lib/cacheInstances';
import { validateHabitDefinition } from '../../domain/habits/definitionValidation';
import { getHabitCreatedDayKey } from '../../domain/habits/schedule';
import {
  recordHabitTrackingRevision,
  trackingRulesEqual,
} from '../../domain/habits/trackingHistory';
import { isValidDayKey } from '../../domain/time/dayKey';
import { getNowDayKey, resolveTimeZone } from '../utils/dayKey';

// One-time recovery: track which users have been recovered to avoid repeated DB calls.
// Both recovery layers run at most once per user per server process to avoid
// mutating state on every GET request (audit finding: read-path side effects).
const recoveredUsers = new Set<string>();
const selfHealedUsers = new Set<string>();

// 24h "HH:mm" — the format stored for reminderTime.
const REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidReminderTime(value: unknown): value is string {
  return typeof value === 'string' && REMINDER_TIME_PATTERN.test(value);
}

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

      // Self-heal legacy/orphaned habits (one-time per user per server process):
      // Any habit with missing/invalid categoryId (or archived due old category-delete behavior)
      // is reassigned to a real "No Category" bucket so it is visible and manageable in UI.
      // NOTE: This should eventually move to a dedicated migration/admin endpoint to avoid
      // read-path side effects entirely. Gated to once-per-session to limit mutation frequency.
      const selfHealKey = `${householdId}:${userId}`;
      if (!selfHealedUsers.has(selfHealKey)) {
        selfHealedUsers.add(selfHealKey);

        const categories = await getCategoriesByUser(householdId, userId);
        const categoryIds = new Set(categories.map(c => c.id));
        const noCategoryName = 'No Category';
        let noCategory = categories.find(c => c.name.trim().toLowerCase() === noCategoryName.toLowerCase());

        const habitsNeedingRecovery = habits.filter(h => {
          const missingCategoryId = typeof h.categoryId !== 'string' || h.categoryId.trim().length === 0;
          const invalidCategoryId = !!h.categoryId && !categoryIds.has(h.categoryId);
          // Also recover habits that are archived but have NO archivedReason —
          // these were stranded by a bug where uncategorizeHabitsByCategory cleared
          // archivedReason without setting archived: false. User-driven archives
          // always set archivedReason: 'user', so they are preserved here.
          const archivedWithoutReason = h.archived === true && !h.archivedReason;
          return missingCategoryId || invalidCategoryId || archivedWithoutReason;
        });

        if (habitsNeedingRecovery.length > 0) {
          console.log(`[Self-heal] Found ${habitsNeedingRecovery.length} orphaned habits for user ${userId}`);
          // Only create "No Category" if any habit actually needs reassignment
          const needsReassignment = habitsNeedingRecovery.some(h => !h.categoryId || !categoryIds.has(h.categoryId));
          if (needsReassignment && !noCategory) {
            noCategory = await createCategory(
              { name: noCategoryName, color: 'bg-neutral-600' },
              householdId,
              userId
            );
          }

          const updatedHabits = await Promise.all(
            habitsNeedingRecovery.map(h => {
              // If the habit has a valid categoryId, keep it — just unarchive.
              // Only reassign to "No Category" if categoryId is missing/invalid.
              const hasValidCategory = !!h.categoryId && categoryIds.has(h.categoryId);
              return updateHabit(h.id, householdId, userId, {
                categoryId: hasValidCategory ? h.categoryId : noCategory!.id,
                archived: false,
              });
            })
          );

          const updatedMap = new Map(updatedHabits.filter(Boolean).map(h => [h!.id, h!]));
          habits = habits.map(h => updatedMap.get(h.id) ?? h);
        }

        // Clear dangling bundleParentId on children whose parent bundle no
        // longer exists (deleting a bundle never cascades to its children).
        // A dangling parent reference hides the habit from every habit view
        // (All/Today/Schedule treat any bundleParentId as "rendered under the
        // parent") while per-category counts still include it. Archived
        // parents are left intact — unarchiving restores the bundle.
        const habitIds = new Set(habits.map(h => h.id));
        const orphanedChildren = habits.filter(
          h => h.bundleParentId && !habitIds.has(h.bundleParentId)
        );
        if (orphanedChildren.length > 0) {
          console.log(`[Self-heal] Clearing dangling bundleParentId on ${orphanedChildren.length} habits for user ${userId}`);
          const updatedOrphans = await Promise.all(
            orphanedChildren.map(h =>
              updateHabit(h.id, householdId, userId, { bundleParentId: null })
            )
          );
          const orphanMap = new Map(updatedOrphans.filter(Boolean).map(h => [h!.id, h!]));
          habits = habits.map(h => orphanMap.get(h.id) ?? h);
        }
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
      linkedGoalId, linkedRoutineIds,
      requiredDaysPerWeek, timesPerWeek,
      checklistSuccessRule, streakType,
      reminderTime, reminderEnabled,
    } = req.body;

    // null is treated as "no reminder" so create and PATCH share one contract
    if (reminderTime !== undefined && reminderTime !== null && !isValidReminderTime(reminderTime)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'reminderTime must be a 24h "HH:mm" string (e.g. "09:00")',
        },
      });
      return;
    }

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

    if (description !== undefined && typeof description !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Description must be a string' } });
      return;
    }

    const habitData = {
        name: name.trim(),
        categoryId,
        goal,
        description: description?.trim() || undefined,
        assignedDays,
        scheduledTime,
        durationMinutes: durationMinutes ?? 30,
        nonNegotiable,
        nonNegotiableDays,
        deadline,
        type,
        subHabitIds,
        bundleParentId,
        order,
        bundleType,
        bundleOptions,
        checklistSuccessRule,
        streakType,
        pinned,
        timeEstimate,
        linkedGoalId,
        linkedRoutineIds,
        requiredDaysPerWeek,
        timesPerWeek,
        reminderTime: reminderTime ?? undefined,
        reminderEnabled: reminderEnabled === undefined ? undefined : !!reminderEnabled,
      };

    const definitionValidation = validateHabitDefinition(habitData);
    if (!definitionValidation.valid) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: definitionValidation.error },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const category = await getCategoryById(categoryId, householdId, userId);
    if (!category) {
      res.status(400).json({ error: { code: 'INVALID_CATEGORY', message: 'Target category does not exist' } });
      return;
    }

    const habit = await createHabit(habitData, householdId, userId);

    // Sync goal's linkedHabitIds when habit is created with a goal link
    if (linkedGoalId) {
      await addHabitToGoalLinkedIds(linkedGoalId, habit.id, householdId, userId);
    }

    invalidateUserCaches(userId);
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
      name, categoryId, goal, description, archived, archivedAt, archivedReason,
      assignedDays, scheduledTime, durationMinutes,
      nonNegotiable, nonNegotiableDays, deadline, type, subHabitIds, bundleParentId, order,
      bundleType, bundleOptions,
      pinned, timeEstimate,
      linkedGoalId, linkedRoutineIds,
      requiredDaysPerWeek, timesPerWeek,
      checklistSuccessRule, streakType,
      reminderTime, reminderEnabled,
      trackingEffectiveDayKey, timeZone,
    } = req.body;

    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Habit ID is required' } });
      return;
    }

    const patch: Partial<Omit<Habit, 'id' | 'createdAt'>> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Habit name must be a non-empty string' } });
        return;
      }
      patch.name = name.trim();
    }
    if (categoryId !== undefined) patch.categoryId = categoryId;
    if (goal !== undefined) patch.goal = goal;
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Description must be a string' } });
        return;
      }
      patch.description = description === null ? undefined : description.trim();
    }
    if (archived !== undefined) patch.archived = archived;
    // Allow callers to clear archive metadata by sending null, or set it by
    // sending an ISO string / valid reason. Undefined means "leave as-is".
    if (archivedAt !== undefined) patch.archivedAt = archivedAt === null ? undefined : archivedAt;
    if (archivedReason !== undefined) patch.archivedReason = archivedReason === null ? undefined : archivedReason;
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
    if (checklistSuccessRule !== undefined) patch.checklistSuccessRule = checklistSuccessRule;
    if (streakType !== undefined) patch.streakType = streakType;
    if (pinned !== undefined) patch.pinned = !!pinned;
    if (timeEstimate !== undefined) patch.timeEstimate = timeEstimate;
    if (linkedGoalId !== undefined) patch.linkedGoalId = linkedGoalId;
    if (linkedRoutineIds !== undefined) patch.linkedRoutineIds = linkedRoutineIds;
    if (requiredDaysPerWeek !== undefined) patch.requiredDaysPerWeek = requiredDaysPerWeek;
    if (timesPerWeek !== undefined) patch.timesPerWeek = timesPerWeek;
    // Clear with null, set with a valid "HH:mm" string (same contract as archivedAt).
    if (reminderTime !== undefined) {
      if (reminderTime !== null && !isValidReminderTime(reminderTime)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'reminderTime must be a 24h "HH:mm" string (e.g. "09:00")',
          },
        });
        return;
      }
      patch.reminderTime = reminderTime === null ? undefined : reminderTime;
    }
    if (reminderEnabled !== undefined) patch.reminderEnabled = !!reminderEnabled;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one field must be provided for update' } });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const existingHabit = await getHabitById(id, householdId, userId);
    if (!existingHabit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found' } });
      return;
    }

    const definitionValidation = validateHabitDefinition({ ...existingHabit, ...patch });
    if (!definitionValidation.valid) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: definitionValidation.error },
      });
      return;
    }

    const updatedHabitDefinition = { ...existingHabit, ...patch };
    if (!trackingRulesEqual(existingHabit, updatedHabitDefinition)) {
      if (trackingEffectiveDayKey !== undefined && !isValidDayKey(trackingEffectiveDayKey)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'trackingEffectiveDayKey must use YYYY-MM-DD format',
          },
        });
        return;
      }

      const effectiveDayKey = trackingEffectiveDayKey ?? getNowDayKey(timeZone);
      const baselineDayKey = getHabitCreatedDayKey(existingHabit, resolveTimeZone(timeZone))
        ?? effectiveDayKey;
      patch.trackingRevisions = recordHabitTrackingRevision(
        existingHabit,
        updatedHabitDefinition,
        effectiveDayKey,
        baselineDayKey,
      );
    }

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

    // If linkedGoalId is changing, fetch old habit to know previous goal link
    const oldLinkedGoalId = linkedGoalId !== undefined
      ? existingHabit.linkedGoalId ?? null
      : undefined;

    const habit = await updateHabit(id, householdId, userId, patch);

    if (!habit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found' } });
      return;
    }

    // Sync goal's linkedHabitIds when habit's linkedGoalId changes
    if (linkedGoalId !== undefined && linkedGoalId !== oldLinkedGoalId) {
      if (oldLinkedGoalId) {
        await removeHabitFromGoalLinkedIds(oldLinkedGoalId, id, householdId, userId);
      }
      if (linkedGoalId) {
        await addHabitToGoalLinkedIds(linkedGoalId, id, householdId, userId);
      }
    }

    invalidateUserCaches(userId);
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

    // Entries are intentionally NOT cascade-deleted. They persist as orphans
    // so that goal progress still includes historical contributions from
    // deleted habits. Orphaned entries are invisible in normal views (day view
    // only iterates over existing habits) but remain queryable by habitId for
    // goal aggregation.
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

    // Release any bundle children of the deleted habit so they become root
    // habits instead of pointing at a soft-deleted parent (which would hide
    // them from every habit view while category counts still include them).
    const released = await releaseBundleChildren(id, householdId, userId);
    if (released > 0) {
      console.log(`[Habits] Released ${released} bundle children of deleted habit ${id} for user ${userId}`);
    }

    invalidateUserCaches(userId);
    res.status(200).json({
      message: 'Habit deleted successfully',
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
 * Archive a habit (user-initiated). Hides it from active views but keeps
 * all entries intact so it can be restored later via /unarchive.
 *
 * POST /api/habits/:id/archive
 */
export async function archiveHabitRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Habit ID is required' } });
      return;
    }

    const { trackingEffectiveDayKey, timeZone } = req.body ?? {};
    if (trackingEffectiveDayKey !== undefined && !isValidDayKey(trackingEffectiveDayKey)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'trackingEffectiveDayKey must use YYYY-MM-DD format' },
      });
      return;
    }
    const archiveDayKey = trackingEffectiveDayKey ?? getNowDayKey(timeZone);
    const { householdId, userId } = getRequestIdentity(req);
    const habit = await archiveHabit(id, householdId, userId, archiveDayKey);

    if (!habit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found' } });
      return;
    }

    invalidateUserCaches(userId);
    res.status(200).json({ habit });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error archiving habit:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to archive habit',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Restore a habit from archive. Returns it to active views with all entries
 * intact.
 *
 * POST /api/habits/:id/unarchive
 */
export async function unarchiveHabitRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Habit ID is required' } });
      return;
    }

    const { trackingEffectiveDayKey, timeZone } = req.body ?? {};
    if (trackingEffectiveDayKey !== undefined && !isValidDayKey(trackingEffectiveDayKey)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'trackingEffectiveDayKey must use YYYY-MM-DD format' },
      });
      return;
    }
    const restoreDayKey = trackingEffectiveDayKey ?? getNowDayKey(timeZone);
    const { householdId, userId } = getRequestIdentity(req);
    const habit = await unarchiveHabit(
      id,
      householdId,
      userId,
      restoreDayKey,
      resolveTimeZone(timeZone),
    );

    if (!habit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found' } });
      return;
    }

    invalidateUserCaches(userId);
    res.status(200).json({ habit });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error unarchiving habit:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to unarchive habit',
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

/**
 * POST /api/habits/:id/unlink-child
 *
 * Atomically unlinks a child from a bundle parent:
 * 1. Removes childId from parent's subHabitIds
 * 2. Clears child's bundleParentId
 * 3. Ends the active BundleMembership
 *
 * Body: { childId: string, activeToDayKey: string }
 */
export async function unlinkBundleChildRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id: parentId } = req.params;
    const { childId, activeToDayKey } = req.body;

    if (!parentId || !childId || !activeToDayKey) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'parentId, childId, and activeToDayKey are required' },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const parent = await getHabitById(parentId, householdId, userId);
    if (!parent || parent.type !== 'bundle') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bundle parent not found' } });
      return;
    }

    const child = await getHabitById(childId, householdId, userId);
    if (!child) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Child habit not found' } });
      return;
    }

    // 1. Remove child from parent's subHabitIds
    const updatedSubIds = (parent.subHabitIds ?? []).filter(id => id !== childId);
    await updateHabit(parentId, householdId, userId, { subHabitIds: updatedSubIds });

    // 2. Clear child's bundleParentId
    await updateHabit(childId, householdId, userId, { bundleParentId: null });

    // 3. End active membership
    await endMembership(parentId, childId, activeToDayKey, householdId, userId);

    invalidateUserCaches(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error unlinking bundle child:', msg);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to unlink bundle child' },
    });
  }
}

/**
 * POST /api/habits/:id/convert-to-bundle
 *
 * Converts a regular habit into a bundle (choice or checklist).
 * Creates child habits from the provided list, preserves historical
 * entries via a hidden legacy child habit.
 *
 * Body: { bundleType, children: [{name, goal?}], checklistSuccessRule?, timeZone? }
 */
export async function convertToBundleRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { bundleType, children, checklistSuccessRule, timeZone } = req.body;

    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Habit ID is required' } });
      return;
    }

    if (bundleType !== 'choice' && bundleType !== 'checklist') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'bundleType must be "choice" or "checklist"' } });
      return;
    }

    if (!Array.isArray(children) || children.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one child is required' } });
      return;
    }

    for (const child of children) {
      if (!child.name || typeof child.name !== 'string' || child.name.trim().length === 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Each child must have a non-empty name' } });
        return;
      }
    }

    const { householdId, userId } = getRequestIdentity(req);

    const result = await convertHabitToBundle(id, householdId, userId, {
      bundleType,
      children,
      checklistSuccessRule,
      timeZone,
    });

    invalidateUserCaches(userId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ConversionError) {
      const statusCode = error.code === 'HABIT_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error converting habit to bundle:', msg);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to convert habit to bundle' },
    });
  }
}
