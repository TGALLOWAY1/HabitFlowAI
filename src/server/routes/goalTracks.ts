/**
 * Goal Tracks Routes
 *
 * HTTP handlers for GoalTrack CRUD and track-goal management.
 * Tracks are ordered sequences of goals within a single category.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { invalidateUserCaches } from '../lib/cacheInstances';
import {
  createGoalTrack,
  getGoalTracksByUser,
  getGoalTrackById,
  updateGoalTrack,
  deleteGoalTrack,
  reorderGoalTracks,
} from '../repositories/goalTrackRepository';
import {
  getGoalById,
  getGoalsByTrack,
  updateGoal,
  clearTrackFromGoals,
} from '../repositories/goalRepository';
import type { Goal } from '../../models/persistenceTypes';

// ─── Helpers ─────────────────────────────────────────────

/**
 * Get today's date as a DayKey (YYYY-MM-DD).
 */
function todayDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Advance a track after a goal is completed or removed.
 * Finds the next locked goal by trackOrder and activates it.
 * If no locked goals remain, marks the track as completed.
 */
export async function advanceTrack(
  trackId: string,
  householdId: string,
  userId: string
): Promise<void> {
  const trackGoals = await getGoalsByTrack(trackId, householdId, userId);

  // Find the first locked goal in order
  const nextGoal = trackGoals.find(g => g.trackStatus === 'locked');

  if (nextGoal) {
    await updateGoal(nextGoal.id, householdId, userId, {
      trackStatus: 'active',
      activeWindowStart: todayDayKey(),
    } as Partial<Goal>);
  } else {
    // All goals completed — mark track as completed
    const { updateGoalTrack: updateTrack } = await import('../repositories/goalTrackRepository');
    await updateTrack(trackId, householdId, userId, {
      completedAt: new Date().toISOString(),
    });
  }
}

// ─── Track CRUD ──────────────────────────────────────────

/**
 * GET /api/goal-tracks
 */
export async function getGoalTracks(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const tracks = await getGoalTracksByUser(householdId, userId);
    res.status(200).json(tracks);
  } catch (error) {
    console.error('Error fetching goal tracks:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch goal tracks' } });
  }
}

/**
 * POST /api/goal-tracks
 */
export async function createGoalTrackRoute(req: Request, res: Response): Promise<void> {
  try {
    const { name, categoryId, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
      return;
    }
    if (!categoryId || typeof categoryId !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'categoryId is required' } });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const track = await createGoalTrack(
      {
        name: name.trim(),
        categoryId,
        description: description?.trim() || undefined,
      },
      householdId,
      userId
    );

    invalidateUserCaches(userId);
    res.status(201).json(track);
  } catch (error) {
    console.error('Error creating goal track:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create goal track' } });
  }
}

/**
 * PATCH /api/goal-tracks/reorder
 * Reorder goal tracks. Body: { trackIds: string[] }
 * Each track's sortOrder is set to its index in the provided list.
 */
export async function reorderGoalTracksRoute(req: Request, res: Response): Promise<void> {
  try {
    const { trackIds } = req.body;

    if (!Array.isArray(trackIds) || !trackIds.every(id => typeof id === 'string')) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'trackIds must be an array of track IDs',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const success = await reorderGoalTracks(householdId, userId, trackIds);

    if (!success) {
      res.status(500).json({
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reorder goal tracks' },
      });
      return;
    }

    invalidateUserCaches(userId);
    res.status(200).json({ message: 'Goal tracks reordered successfully' });
  } catch (error) {
    console.error('Error reordering goal tracks:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reorder goal tracks' },
    });
  }
}

/**
 * GET /api/goal-tracks/:id
 */
export async function getGoalTrackRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { householdId, userId } = getRequestIdentity(req);

    const track = await getGoalTrackById(id, householdId, userId);
    if (!track) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal track not found' } });
      return;
    }

    const goals = await getGoalsByTrack(id, householdId, userId);
    res.status(200).json({ track, goals });
  } catch (error) {
    console.error('Error fetching goal track:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch goal track' } });
  }
}

/**
 * PUT /api/goal-tracks/:id
 */
export async function updateGoalTrackRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { householdId, userId } = getRequestIdentity(req);

    const patch: Record<string, unknown> = {};
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || req.body.name.trim().length === 0) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'name must be a non-empty string' } });
        return;
      }
      patch.name = req.body.name.trim();
    }
    if (req.body.description !== undefined) {
      patch.description = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one field must be provided' } });
      return;
    }

    const track = await updateGoalTrack(id, householdId, userId, patch);
    if (!track) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal track not found' } });
      return;
    }

    invalidateUserCaches(userId);
    res.status(200).json(track);
  } catch (error) {
    console.error('Error updating goal track:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update goal track' } });
  }
}

/**
 * DELETE /api/goal-tracks/:id
 * Goals become standalone — they are NOT deleted.
 */
export async function deleteGoalTrackRoute(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { householdId, userId } = getRequestIdentity(req);

    // Clear track fields from all member goals first
    await clearTrackFromGoals(id, householdId, userId);

    const deleted = await deleteGoalTrack(id, householdId, userId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal track not found' } });
      return;
    }

    invalidateUserCaches(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting goal track:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete goal track' } });
  }
}

// ─── Track Goal Management ──────────────────────────────

/**
 * POST /api/goal-tracks/:id/goals
 * Add an existing goal to a track.
 * Body: { goalId: string, position?: number }
 */
export async function addGoalToTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id: trackId } = req.params;
    const { goalId, position } = req.body;
    const { householdId, userId } = getRequestIdentity(req);

    if (!goalId || typeof goalId !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'goalId is required' } });
      return;
    }

    // Validate track exists
    const track = await getGoalTrackById(trackId, householdId, userId);
    if (!track) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal track not found' } });
      return;
    }

    // Validate goal exists
    const goal = await getGoalById(goalId, householdId, userId);
    if (!goal) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found' } });
      return;
    }

    // Goal must not already be in a track
    if (goal.trackId) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Goal is already in a track. Remove it first.' } });
      return;
    }

    // Category must match
    if (goal.categoryId !== track.categoryId) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Goal category must match track category' },
      });
      return;
    }

    // Get existing track goals to determine order and active status
    const trackGoals = await getGoalsByTrack(trackId, householdId, userId);
    const hasActiveGoal = trackGoals.some(g => g.trackStatus === 'active');

    // Determine trackOrder
    let trackOrder: number;
    if (position !== undefined && typeof position === 'number' && position >= 0) {
      trackOrder = position;
      // Shift existing goals at or after this position
      for (const tg of trackGoals) {
        if ((tg.trackOrder ?? 0) >= position) {
          await updateGoal(tg.id, householdId, userId, {
            trackOrder: (tg.trackOrder ?? 0) + 1,
          } as Partial<Goal>);
        }
      }
    } else {
      // Append to end
      trackOrder = trackGoals.length;
    }

    // Determine status
    let trackStatus: 'locked' | 'active' | 'completed';
    let activeWindowStart: string | undefined;

    if (goal.completedAt) {
      trackStatus = 'completed';
    } else if (!hasActiveGoal && !trackGoals.some(g => g.trackStatus === 'completed' || (g.trackOrder ?? 0) < trackOrder)) {
      // First incomplete goal and no active goal → make active
      trackStatus = 'active';
      activeWindowStart = todayDayKey();
    } else if (!hasActiveGoal) {
      // No active goal but there are earlier goals — find the first incomplete
      const allGoalsAfterInsert = [...trackGoals, { ...goal, trackOrder }].sort(
        (a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0)
      );
      const firstIncomplete = allGoalsAfterInsert.find(g => !g.completedAt);
      if (firstIncomplete && (firstIncomplete.id === goalId || firstIncomplete.trackOrder === trackOrder)) {
        trackStatus = 'active';
        activeWindowStart = todayDayKey();
      } else {
        trackStatus = 'locked';
      }
    } else {
      trackStatus = 'locked';
    }

    const patch: Partial<Goal> = {
      trackId,
      trackOrder,
      trackStatus,
    };
    if (activeWindowStart) {
      patch.activeWindowStart = activeWindowStart;
    }

    const updated = await updateGoal(goalId, householdId, userId, patch);

    invalidateUserCaches(userId);
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error adding goal to track:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add goal to track' } });
  }
}

/**
 * DELETE /api/goal-tracks/:id/goals/:goalId
 * Remove a goal from a track (goal becomes standalone).
 */
export async function removeGoalFromTrack(req: Request, res: Response): Promise<void> {
  try {
    const { id: trackId, goalId } = req.params;
    const { householdId, userId } = getRequestIdentity(req);

    const goal = await getGoalById(goalId, householdId, userId);
    if (!goal || goal.trackId !== trackId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal not found in this track' } });
      return;
    }

    const wasActive = goal.trackStatus === 'active';

    // Clear track fields
    await updateGoal(goalId, householdId, userId, {
      trackId: undefined,
      trackOrder: undefined,
      trackStatus: undefined,
      activeWindowStart: undefined,
      activeWindowEnd: undefined,
    } as any);

    // If the removed goal was active, advance the track
    if (wasActive) {
      await advanceTrack(trackId, householdId, userId);
    }

    invalidateUserCaches(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing goal from track:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to remove goal from track' } });
  }
}

/**
 * PATCH /api/goal-tracks/:id/goals/reorder
 * Reorder goals within a track.
 * Body: { goalIds: string[] }
 *
 * After reordering, recomputes which goal is active so that the invariant
 * "active goal == first non-completed goal by trackOrder" holds. Completed
 * goals retain their status. A previously-active goal that gets demoted to
 * 'locked' keeps its activeWindowStart untouched (history is preserved);
 * activeWindowEnd is never set here — that field is reserved for completion.
 */
export async function reorderTrackGoals(req: Request, res: Response): Promise<void> {
  try {
    const { id: trackId } = req.params;
    const { goalIds } = req.body;
    const { householdId, userId } = getRequestIdentity(req);

    if (!Array.isArray(goalIds) || goalIds.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'goalIds must be a non-empty array' } });
      return;
    }

    // Verify track exists
    const track = await getGoalTrackById(trackId, householdId, userId);
    if (!track) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Goal track not found' } });
      return;
    }

    // Update trackOrder for each goal
    for (let i = 0; i < goalIds.length; i++) {
      await updateGoal(goalIds[i], householdId, userId, {
        trackOrder: i,
      } as Partial<Goal>);
    }

    // Recompute active goal based on the new order. The active goal must be
    // the first non-completed goal by trackOrder. Reordering can shift that
    // position, so promote/demote to keep the invariant.
    const trackGoalsSorted = await getGoalsByTrack(trackId, householdId, userId);
    const firstIncomplete = trackGoalsSorted.find(g => g.trackStatus !== 'completed');

    if (firstIncomplete && firstIncomplete.trackStatus !== 'active') {
      // Promote this goal. Preserve activeWindowStart if it already has one
      // (e.g. from a prior activation that was demoted); otherwise start a
      // fresh window today.
      const promotion: Partial<Goal> = { trackStatus: 'active' };
      if (!firstIncomplete.activeWindowStart) {
        promotion.activeWindowStart = todayDayKey();
      }
      await updateGoal(firstIncomplete.id, householdId, userId, promotion as Partial<Goal>);

      // Demote any other goal that was previously active (there should be at
      // most one). Leave activeWindowStart/activeWindowEnd untouched — we
      // never set activeWindowEnd on demotion because that field's semantics
      // mean "completed".
      for (const g of trackGoalsSorted) {
        if (g.id !== firstIncomplete.id && g.trackStatus === 'active') {
          await updateGoal(g.id, householdId, userId, {
            trackStatus: 'locked',
          } as Partial<Goal>);
        }
      }
    }

    invalidateUserCaches(userId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error reordering track goals:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to reorder track goals' } });
  }
}
