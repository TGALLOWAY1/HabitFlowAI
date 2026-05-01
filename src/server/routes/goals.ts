/**
 * Goal Routes
 * 
 * REST API endpoints for Goal entities.
 * Provides CRUD operations for goals with validation.
 */

import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
  createGoal,
  getGoalsByUser,
  getCompletedGoalsByUser,
  getGoalById,
  updateGoal,
  deleteGoal,
  reorderGoals,
  validateHabitIds,
} from '../repositories/goalRepository';
import { getHabitsByUser, linkHabitsToGoal, unlinkHabitsFromGoal } from '../repositories/habitRepository';
// getHabitEntriesByUser removed — entries are now fetched filtered by habit ID in computeGoalsWithProgressFromData
import { computeGoalProgressV2, computeGoalListProgress } from '../utils/goalProgressUtilsV2';
import type { Goal, GoalMilestone } from '../../models/persistenceTypes';
import { getRequestIdentity } from '../middleware/identity';
import { generateBadgeForGoal, backfillGoalBadges } from '../services/badgeGenerationService';
import { invalidateUserCaches } from '../lib/cacheInstances';

/**
 * Validate that all habit IDs in linkedHabitIds exist in the database.
 * 
 * @param habitIds - Array of habit IDs to validate
 * @param userId - User ID to verify ownership
 * @returns Array of invalid habit IDs (empty if all are valid)
 */
async function validateHabitIdsExist(
  habitIds: string[],
  householdId: string,
  userId: string
): Promise<string[]> {
  if (habitIds.length === 0) return [];

  // Single batch fetch instead of N individual queries
  const allHabits = await getHabitsByUser(householdId, userId);
  const existingIds = new Set(allHabits.map((h) => h.id));

  return habitIds.filter((id) => !existingIds.has(id));
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

  if (!data.type || (data.type !== 'cumulative' && data.type !== 'onetime')) {
    return 'type is required and must be either "cumulative" or "onetime"';
  }

  // targetValue required only for cumulative
  if (data.type !== 'onetime') {
    if (typeof data.targetValue !== 'number' || data.targetValue <= 0) {
      return 'targetValue is required and must be a positive number for cumulative goals';
    }
  }

  if (data.unit !== undefined && typeof data.unit !== 'string') {
    return 'unit must be a string if provided';
  }

  // Validate aggregationMode if provided. Treat null as "not provided" so legacy
  // documents (where MongoDB stored a missing field as null) fall through to defaults.
  if (data.aggregationMode !== undefined && data.aggregationMode !== null) {
    if (data.aggregationMode !== 'count' && data.aggregationMode !== 'sum') {
      return 'aggregationMode must be either "count" or "sum"';
    }
  }

  // Validate countMode if provided. Same null tolerance as aggregationMode.
  if (data.countMode !== undefined && data.countMode !== null) {
    if (data.countMode !== 'distinctDays' && data.countMode !== 'entries') {
      return 'countMode must be either "distinctDays" or "entries"';
    }
    // countMode only applies to count aggregation
    const aggregationMode = data.aggregationMode || (data.type === 'cumulative' ? 'sum' : 'count');
    if (aggregationMode !== 'count') {
      return 'countMode can only be set when aggregationMode is "count"';
    }
  }

  if (!Array.isArray(data.linkedHabitIds)) {
    return 'linkedHabitIds is required and must be an array';
  }

  if (!validateHabitIds(data.linkedHabitIds)) {
    return 'linkedHabitIds must be an array of non-empty strings';
  }

  // Deadline is optional for one-time goals (no validation needed)

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

  if (data.sortOrder !== undefined) {
    if (typeof data.sortOrder !== 'number' || !Number.isInteger(data.sortOrder) || data.sortOrder < 0) {
      return 'sortOrder must be a non-negative integer if provided';
    }
  }

  if (data.iteratedFromGoalId !== undefined && typeof data.iteratedFromGoalId !== 'string') {
    return 'iteratedFromGoalId must be a string if provided';
  }

  return null;
}

const MAX_MILESTONES = 20;

/**
 * Validate a raw milestones payload and return a normalized array (sorted
 * ascending by value, server-assigned IDs where missing). Returns either
 * `{ error }` for a 400 message or `{ milestones }` for the normalized list.
 *
 * `effectiveType` and `effectiveTargetValue` are the values the goal will have
 * after the operation completes — for PUT, callers must merge in patch + existing.
 *
 * When `acknowledgedAt` is present on an input entry, it is preserved as-is;
 * the dedicated POST /goals/:id/milestones/:mid/acknowledge route is the
 * primary writer, but PUT-replace round-tripping must not silently lose marks.
 */
function validateAndNormalizeMilestones(
  raw: unknown,
  effectiveType: 'cumulative' | 'onetime',
  effectiveTargetValue: number | undefined,
): { error: string | null; milestones?: GoalMilestone[] } {
  if (raw === null) return { error: null, milestones: [] };
  if (!Array.isArray(raw)) return { error: 'milestones must be an array' };
  if (raw.length === 0) return { error: null, milestones: [] };
  if (effectiveType !== 'cumulative') {
    return { error: 'milestones are only allowed on cumulative goals' };
  }
  if (typeof effectiveTargetValue !== 'number' || !(effectiveTargetValue > 0)) {
    return { error: 'milestones require a positive targetValue' };
  }
  if (raw.length > MAX_MILESTONES) {
    return { error: `at most ${MAX_MILESTONES} milestones are allowed` };
  }

  const seen = new Set<number>();
  const normalized: GoalMilestone[] = [];
  for (const m of raw as Array<Record<string, unknown>>) {
    if (!m || typeof m !== 'object') {
      return { error: 'each milestone must be an object' };
    }
    const value = m.value;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return { error: 'each milestone.value must be a positive finite number' };
    }
    if (value >= effectiveTargetValue) {
      return { error: 'each milestone.value must be strictly less than targetValue' };
    }
    if (seen.has(value)) {
      return { error: 'milestone values must be unique' };
    }
    seen.add(value);

    const entry: GoalMilestone = {
      id: typeof m.id === 'string' && m.id.length > 0 ? m.id : randomUUID(),
      value,
    };
    if (m.acknowledgedAt !== undefined && m.acknowledgedAt !== null) {
      if (typeof m.acknowledgedAt !== 'string') {
        return { error: 'milestone.acknowledgedAt must be a string if provided' };
      }
      entry.acknowledgedAt = m.acknowledgedAt;
    }
    normalized.push(entry);
  }

  normalized.sort((a, b) => a.value - b.value);
  return { error: null, milestones: normalized };
}

function buildIteratedGoalData(goal: Goal, currentValue: number | null): Omit<Goal, 'id' | 'createdAt'> {
  const baseTargetValue = (typeof goal.targetValue === 'number' && goal.targetValue > 0)
    ? goal.targetValue
    : Math.max(1, Math.ceil(currentValue ?? 1));
  const resolvedCurrentValue = Number.isFinite(currentValue) ? currentValue ?? 0 : 0;

  const nextTargetValue = goal.type === 'onetime'
    ? goal.targetValue
    : Math.max(resolvedCurrentValue, baseTargetValue) + baseTargetValue;

  // Only forward mode fields if they hold a recognized value. Legacy goals can have
  // these stored as null or other junk; passing them through would trip validation.
  const aggregationMode = (goal.aggregationMode === 'count' || goal.aggregationMode === 'sum')
    ? goal.aggregationMode
    : undefined;
  const countMode = (goal.countMode === 'distinctDays' || goal.countMode === 'entries')
    ? goal.countMode
    : undefined;

  return {
    title: goal.title,
    type: goal.type,
    targetValue: goal.type === 'onetime' ? goal.targetValue : nextTargetValue,
    unit: goal.unit,
    linkedHabitIds: goal.linkedHabitIds,
    aggregationMode,
    countMode,
    linkedTargets: goal.linkedTargets,
    deadline: goal.deadline,
    completedAt: undefined,
    notes: goal.notes,
    badgeImageUrl: undefined,
    categoryId: goal.categoryId,
    sortOrder: goal.sortOrder,
    iteratedFromGoalId: goal.id,
  };
}


/**
 * Get all goals for the current user.
 * 
 * GET /api/goals
 */
export async function getGoals(req: Request, res: Response): Promise<void> {
  try {
    // TODO: Extract userId from authentication token/session
    const { householdId, userId } = getRequestIdentity(req);

    const goals = await getGoalsByUser(householdId, userId);

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
 * Get all completed goals for the current user.
 * 
 * GET /api/goals/completed
 * 
 * Returns all goals where completedAt is not null, sorted by completedAt descending.
 * Used for the Win Archive page.
 */
export async function getCompletedGoals(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);

    const goals = await getCompletedGoalsByUser(householdId, userId);

    // Return array of goal objects (progress optional for V1, not included here)
    res.status(200).json(goals.map(goal => ({ goal })));

    // Fire-and-forget: regenerate badges for goals that are missing them or
    // have corrupt data URLs from the old generation code.
    backfillGoalBadges(goals, householdId, userId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching completed goals:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch completed goals',
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

    const { householdId, userId } = getRequestIdentity(req);

    const goal = await getGoalById(id, householdId, userId);

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
    const { householdId, userId } = getRequestIdentity(req);
    const { timeZone } = req.query;

    const userTimeZone = (timeZone && typeof timeZone === 'string') ? timeZone : 'UTC';

    // Fetch goals and habits in parallel; entries are fetched filtered by
    // linked habit IDs inside computeGoalsWithProgressFromData (via truthQuery)
    const [goals, allHabits] = await Promise.all([
      getGoalsByUser(householdId, userId),
      getHabitsByUser(householdId, userId),
    ]);

    const goalsWithProgress = await computeGoalListProgress(
      goals, allHabits, householdId, userId, userTimeZone
    );

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
 * Get goal progress (via truthQuery).
 * 
 * GET /api/goals/:id/progress?timeZone=...
 * 
 * Computes goal progress from EntryViews via truthQuery (unified HabitEntries + legacy DayLogs).
 * No longer reads DayLogs directly.
 */
export async function getGoalProgress(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { timeZone } = req.query;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Goal ID is required',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const userTimeZone = (timeZone && typeof timeZone === 'string') ? timeZone : 'UTC';

    const { computeGoalProgressV2 } = await import('../utils/goalProgressUtilsV2');
    const progress = await computeGoalProgressV2(id, householdId, userId, userTimeZone);

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

    const { householdId, userId } = getRequestIdentity(req);

    const invalidHabitIds = await validateHabitIdsExist(req.body.linkedHabitIds, householdId, userId);
    if (invalidHabitIds.length > 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `The following habit IDs do not exist: ${invalidHabitIds.join(', ')}`,
        },
      });
      return;
    }

    let normalizedMilestones: GoalMilestone[] | undefined;
    if (req.body.milestones !== undefined) {
      const result = validateAndNormalizeMilestones(
        req.body.milestones,
        req.body.type,
        req.body.targetValue,
      );
      if (result.error) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: result.error },
        });
        return;
      }
      // Drop any client-supplied acknowledgedAt on create — the goal hasn't
      // existed yet, so no celebration could have been dismissed.
      normalizedMilestones = (result.milestones ?? []).map(({ id, value }) => ({ id, value }));
    }

    // Set default aggregationMode and countMode if not provided
    const aggregationMode = req.body.aggregationMode || (req.body.type === 'cumulative' ? 'sum' : 'count');
    const countMode = req.body.countMode || (aggregationMode === 'count' ? 'distinctDays' : undefined);

    // Determine sortOrder: if provided, use it; otherwise assign to end of category
    let sortOrder: number | undefined = req.body.sortOrder;
    if (sortOrder === undefined) {
      // Fetch existing goals in the same category to determine next sortOrder
      const existingGoals = await getGoalsByUser(householdId, userId);
      const goalsInCategory = existingGoals.filter(
        g => g.categoryId === req.body.categoryId || (!g.categoryId && !req.body.categoryId)
      );
      
      if (goalsInCategory.length > 0) {
        // Find the maximum sortOrder in the category and add 1
        const maxSortOrder = Math.max(
          ...goalsInCategory.map(g => g.sortOrder ?? -1),
          -1
        );
        sortOrder = maxSortOrder + 1;
      } else {
        // First goal in category, start at 0
        sortOrder = 0;
      }
    }

    const goal = await createGoal(
      {
        title: req.body.title.trim(),
        type: req.body.type,
        targetValue: req.body.targetValue,
        unit: req.body.unit?.trim(),
        linkedHabitIds: req.body.linkedHabitIds,
        aggregationMode,
        countMode,
        deadline: req.body.deadline,
        completedAt: req.body.completedAt,
        notes: req.body.notes?.trim(),
        badgeImageUrl: req.body.badgeImageUrl?.trim(),
        categoryId: req.body.categoryId,
        sortOrder,
        ...(normalizedMilestones !== undefined ? { milestones: normalizedMilestones } : {}),
      },
      householdId,
      userId
    );

    // Sync linkedGoalId on linked habits (bidirectional link)
    if (goal.linkedHabitIds.length > 0) {
      await linkHabitsToGoal(goal.linkedHabitIds, goal.id, householdId, userId);
    }

    // Fire-and-forget badge generation — never blocks the response
    generateBadgeForGoal(goal.id, goal.title, householdId, userId);

    invalidateUserCaches(userId);
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
      if (req.body.type !== 'cumulative' && req.body.type !== 'onetime') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'type must be either "cumulative" or "onetime"',
          },
        });
        return;
      }
      patch.type = req.body.type;
    }

    if (req.body.targetValue !== undefined) {
      // If setting targetValue, it must be valid number > 0
      // Exception: we might allow setting it to undefined/null for onetime goals if we supported that in API,
      // but for now let's just valid numbers if provided.
      // Actually, if we are switching TO onetime, targetValue might be ignored.
      // But if provided, it should be a number.
      if (typeof req.body.targetValue !== 'number' || req.body.targetValue <= 0) {
        // If type is onetime (either existing or being updated to), we can ignore targetValue or allow null?
        // Let's enforce strictness: if you send targetValue, it must be > 0.
        // But the front end might send null/undefined.
        // Let's just check number > 0 if it's not null.
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'targetValue must be a positive number',
          },
        });
        return;
      }
      patch.targetValue = req.body.targetValue;
    } else if ((patch.type && patch.type !== 'onetime') || (!patch.type && req.body.type !== 'onetime')) {
      // If we are NOT a onetime goal, we must have a targetValue.
      // This is tricky in PATCH. If existing goal is onetime and we switch to cumulative, we MUST provide targetValue.
      // This logic is complex for PATCH.
      // Let's assume frontend sends targetValue when switching types.
      // We will perform a final consistency check if possible, or just trust individual field validation.
      // Basic check: If type is updated to cumulative/frequency, check if targetValue is provided OR was already present.
      // Since we don't fetch existing goal here efficiently before validation (it's done later), we might skip deep validation.
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
      // Preserve null to allow clearing completion (reopening a goal)
      patch.completedAt = req.body.completedAt === null ? null : req.body.completedAt;
    }

    if (req.body.notes !== undefined) {
      patch.notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : req.body.notes || undefined;
    }

    if (req.body.badgeImageUrl !== undefined) {
      patch.badgeImageUrl = typeof req.body.badgeImageUrl === 'string' ? req.body.badgeImageUrl.trim() : req.body.badgeImageUrl || undefined;
    }

    if (req.body.categoryId !== undefined) {
      if (req.body.categoryId !== null && typeof req.body.categoryId !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'categoryId must be a string or null',
          },
        });
        return;
      }
      patch.categoryId = req.body.categoryId || undefined;
    }

    // Block category changes for tracked goals (must match track category).
    // Only reject when the category is ACTUALLY changing — the Edit Goal modal
    // re-sends the existing categoryId on every save, so checking presence alone
    // produces false-positive errors on ordinary edits (title, habits, deadline).
    if (patch.categoryId !== undefined) {
      const { householdId: hid, userId: uid } = getRequestIdentity(req);
      const existingForCategoryCheck = await getGoalById(id, hid, uid);
      const currentCat = existingForCategoryCheck?.categoryId ?? undefined;
      const newCat = patch.categoryId ?? undefined;
      if (existingForCategoryCheck?.trackId && newCat !== currentCat) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot change category of a goal that belongs to a track. Remove it from the track first.',
          },
        });
        return;
      }
    }

    if (req.body.sortOrder !== undefined) {
      if (typeof req.body.sortOrder !== 'number' || !Number.isInteger(req.body.sortOrder) || req.body.sortOrder < 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'sortOrder must be a non-negative integer',
          },
        });
        return;
      }
      patch.sortOrder = req.body.sortOrder;
    }

    // Milestones: validate against the goal's effective type/targetValue after
    // applying the patch, and merge acknowledgedAt from existing milestones by
    // id so the celebration marker survives PUT-replace round-trips.
    if (req.body.milestones !== undefined) {
      const { householdId: hid, userId: uid } = getRequestIdentity(req);
      const existingForMilestones = await getGoalById(id, hid, uid);
      if (!existingForMilestones) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Goal not found' },
        });
        return;
      }

      const effectiveType = (patch.type ?? existingForMilestones.type) as 'cumulative' | 'onetime';
      const effectiveTargetValue = patch.targetValue ?? existingForMilestones.targetValue;

      const result = validateAndNormalizeMilestones(
        req.body.milestones,
        effectiveType,
        effectiveTargetValue,
      );
      if (result.error) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: result.error },
        });
        return;
      }

      const existingById = new Map(
        (existingForMilestones.milestones ?? []).map((m) => [m.id, m]),
      );
      const merged = (result.milestones ?? []).map((m) => {
        const prior = existingById.get(m.id);
        if (prior?.acknowledgedAt && !m.acknowledgedAt) {
          return { ...m, acknowledgedAt: prior.acknowledgedAt };
        }
        return m;
      });
      patch.milestones = merged;
    } else if (patch.type === 'onetime') {
      // Type is being switched to onetime; existing milestones (if any) become
      // invalid. Reject so the user explicitly clears them rather than silently
      // dropping celebration history.
      const { householdId: hid, userId: uid } = getRequestIdentity(req);
      const existingForTypeChange = await getGoalById(id, hid, uid);
      if (existingForTypeChange?.milestones && existingForTypeChange.milestones.length > 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot switch to onetime while milestones are configured. Clear milestones first.',
          },
        });
        return;
      }
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

    // If targetValue is being lowered without an explicit milestones patch,
    // ensure existing milestones still respect `value < targetValue`.
    if (patch.targetValue !== undefined && patch.milestones === undefined) {
      const { householdId: hid, userId: uid } = getRequestIdentity(req);
      const existingForTargetCheck = await getGoalById(id, hid, uid);
      const ms = existingForTargetCheck?.milestones ?? [];
      const violating = ms.find((m) => m.value >= patch.targetValue!);
      if (violating) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Cannot set targetValue at or below existing milestone (${violating.value}). Adjust milestones first.`,
          },
        });
        return;
      }
    }

    const { householdId, userId } = getRequestIdentity(req);

    let existingGoal: Goal | null = null;
    let shouldIterateGoal = false;
    let currentValueForIteration = 0;

    if (patch.completedAt) {
      existingGoal = await getGoalById(id, householdId, userId);
      if (!existingGoal) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Goal not found',
          },
        });
        return;
      }

      if (!existingGoal.completedAt) {
        const { computeGoalProgressV2 } = await import('../utils/goalProgressUtilsV2');
        const progress = await computeGoalProgressV2(id, householdId, userId, 'UTC');
        currentValueForIteration = progress?.currentValue ?? 0;
        // Only iterate if explicitly requested by the client
        shouldIterateGoal = req.body.iterate === true;
      }
    }

    // If linkedHabitIds is being updated, validate only the NEWLY-ADDED IDs.
    // Pre-existing IDs are allowed through even if they now reference a deleted
    // habit: deleted habits' entries are intentionally preserved as historical
    // contributions to goal progress (see `computeGoalProgressV2` and the comment
    // in `deleteHabitRoute`). Stripping those refs on every edit would silently
    // erase historical progress, which was the cause of the previous "GHOST HABIT
    // IDs" frontend workaround.
    let previousLinkedHabitIds: string[] | null = null;
    if (patch.linkedHabitIds) {
      const existing = existingGoal || await getGoalById(id, householdId, userId);
      previousLinkedHabitIds = existing?.linkedHabitIds || [];

      const priorSet = new Set(previousLinkedHabitIds);
      const newlyAddedIds = patch.linkedHabitIds.filter((hid) => !priorSet.has(hid));
      const invalidHabitIds = await validateHabitIdsExist(newlyAddedIds, householdId, userId);
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

    let goal = await updateGoal(id, householdId, userId, patch);

    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    // Sync linkedGoalId on habits when linkedHabitIds changes
    if (patch.linkedHabitIds && previousLinkedHabitIds !== null) {
      // Clear linkedGoalId from habits no longer linked to this goal
      const currentSet = new Set(patch.linkedHabitIds);
      const hasRemovals = previousLinkedHabitIds.some(hid => !currentSet.has(hid));
      if (hasRemovals) {
        await unlinkHabitsFromGoal(id, householdId, userId);
      }

      // Set linkedGoalId on all currently linked habits
      if (patch.linkedHabitIds.length > 0) {
        await linkHabitsToGoal(patch.linkedHabitIds, id, householdId, userId);
      }
    }

    // Track advancement: when a tracked goal is completed, close its window and activate next
    if (patch.completedAt && goal.trackId && existingGoal && !existingGoal.completedAt) {
      const today = new Date();
      const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Close active window and mark as completed in track
      await updateGoal(id, householdId, userId, {
        activeWindowEnd: dayKey,
        trackStatus: 'completed',
      } as Partial<Goal>);

      // Advance the track to the next goal
      const { advanceTrack } = await import('./goalTracks');
      await advanceTrack(goal.trackId, householdId, userId);

      // Re-fetch to include track fields in response
      const updatedGoal = await getGoalById(id, householdId, userId);
      if (updatedGoal) {
        goal = updatedGoal;
      }
    }

    let iteratedGoal: Goal | null = null;
    if (shouldIterateGoal) {
      iteratedGoal = await createGoal(buildIteratedGoalData(goal, currentValueForIteration), householdId, userId);
    }

    invalidateUserCaches(userId);
    res.status(200).json({
      goal,
      iteratedGoal,
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
 * Get goal detail with progress and history.
 *
 * GET /api/goals/:id/detail
 *
 * Returns: goal, progress (entries-derived), and history (last 30 days from EntryViews).
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

    const { householdId, userId } = getRequestIdentity(req);
    const { timeZone } = req.query;
    const userTimeZone = (timeZone && typeof timeZone === 'string') ? timeZone : 'UTC';

    const goal = await getGoalById(id, householdId, userId);
    if (!goal) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    const progress = await computeGoalProgressV2(id, householdId, userId, userTimeZone);
    if (!progress) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to compute goal progress',
        },
      });
      return;
    }

    const { getEntryViewsForHabits } = await import('../services/truthQuery');
    const { getAggregationMode, getCountMode } = await import('../utils/goalLinkSemantics');

    // Build habit map including soft-deleted so orphan entries resolve a name
    // and boolean-target multipliers still apply.
    const allHabits = await getHabitsByUser(householdId, userId, { includeDeleted: true });
    const habitMap = new Map(allHabits.map(h => [h.id, h]));

    const entryViews = await getEntryViewsForHabits(goal.linkedHabitIds, householdId, userId, {
      timeZone: userTimeZone,
    });

    const activeEntries = entryViews.filter(e => !e.deletedAt);

    // Respect the goal's active window if it is a tracked goal.
    const dateWindow = goal.activeWindowStart
      ? { start: goal.activeWindowStart, end: goal.activeWindowEnd || undefined }
      : undefined;
    const windowedEntries = dateWindow
      ? activeEntries.filter(e => {
          if (e.dayKey < dateWindow.start) return false;
          if (dateWindow.end && e.dayKey > dateWindow.end) return false;
          return true;
        })
      : activeEntries;

    // Build the canonical per-entry contributions list. All derived views on
    // the frontend (cumulative chart, weekly summary, day-by-day list) must
    // render from this so the sum matches progress.currentValue by construction.
    const aggregationMode = getAggregationMode(goal);
    const countMode = getCountMode(goal);

    // For count-mode='distinctDays', dedupe by dayKey server-side. currentValue =
    // distinct-day count, so we emit one contribution per day (worth 1) so
    // that sum(contributions[].value) === currentValue.
    const sourceEntries = (aggregationMode === 'count' && countMode === 'distinctDays')
      ? (() => {
          const seen = new Map<string, typeof windowedEntries[number]>();
          for (const e of windowedEntries) {
            if (!seen.has(e.dayKey)) seen.set(e.dayKey, e);
          }
          return Array.from(seen.values());
        })()
      : windowedEntries;

    const contributions = sourceEntries.map((entry, idx) => {
      const habit = habitMap.get(entry.habitId);
      let value: number;
      if (aggregationMode === 'sum') {
        // Boolean habits contribute their target per entry (e.g. "do 25 pull ups"
        // records 1 entry but counts for 25). Missing habit (shouldn't happen
        // post soft-delete, but guard): fall back to the entry's raw value.
        if (habit?.goal.type === 'boolean') {
          value = habit.goal.target ?? 1;
        } else {
          value = entry.value ?? 0;
        }
      } else {
        // count-mode: each unit of progress is worth 1 (entry or day).
        value = 1;
      }

      return {
        // EntryView has no stable id; synthesize one per row (stable for a
        // given fetched response — the frontend only needs it for React keys).
        id: `${entry.habitId}-${entry.dayKey}-${entry.timestampUtc ?? idx}`,
        date: entry.dayKey,
        habitId: entry.habitId,
        habitName: habit?.name ?? 'Removed habit',
        habitDeleted: !!habit?.deletedAt,
        value,
        unit: habit?.goal.unit ?? goal.unit,
        source: entry.source,
      };
    });

    // Legacy 30-day history (kept for transitional clients until removed).
    const historyMap = new Map<string, number>();
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      const dateStr = getDateStringForHistory(i);
      last30Days.push(dateStr);
      historyMap.set(dateStr, 0);
    }
    for (const c of contributions) {
      if (!historyMap.has(c.date)) continue;
      historyMap.set(c.date, (historyMap.get(c.date) || 0) + c.value);
    }
    const history = last30Days.reverse().map(date => ({
      date,
      value: historyMap.get(date) || 0,
    }));

    res.status(200).json({
      goal,
      progress,
      contributions,
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
 * Reorder goals.
 * 
 * PATCH /api/goals/reorder
 * 
 * Body: { goalIds: string[] }
 * - goalIds: Array of goal IDs in the desired order
 */
export async function reorderGoalsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { goalIds } = req.body;

    if (!Array.isArray(goalIds) || !goalIds.every(id => typeof id === 'string')) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'goalIds must be an array of goal IDs',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    const success = await reorderGoals(householdId, userId, goalIds);

    if (!success) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reorder goals',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Goals reordered successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error reordering goals:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reorder goals',
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

    const { householdId, userId } = getRequestIdentity(req);

    // If goal is in a track, handle track advancement before deletion
    const goalToDelete = await getGoalById(id, householdId, userId);
    if (goalToDelete?.trackId && goalToDelete.trackStatus === 'active') {
      const { advanceTrack } = await import('./goalTracks');
      await advanceTrack(goalToDelete.trackId, householdId, userId);
    }

    const deleted = await deleteGoal(id, householdId, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Goal not found',
        },
      });
      return;
    }

    // Clean up orphaned linkedGoalId references on habits
    const unlinkedCount = await unlinkHabitsFromGoal(id, householdId, userId);
    if (unlinkedCount > 0) {
      console.log(`[Goal Delete] Cleared linkedGoalId from ${unlinkedCount} habit(s) for deleted goal ${id}`);
    }

    invalidateUserCaches(userId);
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

/**
 * Acknowledge a milestone celebration.
 *
 * POST /api/goals/:id/milestones/:milestoneId/acknowledge
 *
 * Sets `acknowledgedAt = now` on the matching milestone. Idempotent — calling
 * twice returns the goal unchanged with the original acknowledgedAt preserved.
 */
export async function acknowledgeMilestoneRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id, milestoneId } = req.params;
    if (!id || !milestoneId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Goal ID and milestone ID are required' },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const existing = await getGoalById(id, householdId, userId);
    if (!existing) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Goal not found' },
      });
      return;
    }

    const milestones = existing.milestones ?? [];
    const targetIndex = milestones.findIndex((m) => m.id === milestoneId);
    if (targetIndex === -1) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Milestone not found' },
      });
      return;
    }

    // Idempotent: do not overwrite an existing acknowledgedAt.
    if (milestones[targetIndex].acknowledgedAt) {
      res.status(200).json({ goal: existing });
      return;
    }

    const updatedMilestones: GoalMilestone[] = milestones.map((m, idx) =>
      idx === targetIndex ? { ...m, acknowledgedAt: new Date().toISOString() } : m,
    );

    const goal = await updateGoal(id, householdId, userId, { milestones: updatedMilestones });
    if (!goal) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Goal not found' },
      });
      return;
    }

    invalidateUserCaches(userId);
    res.status(200).json({ goal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error acknowledging milestone:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to acknowledge milestone',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
