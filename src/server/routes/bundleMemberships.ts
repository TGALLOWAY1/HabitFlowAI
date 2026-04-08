/**
 * Bundle Membership Routes
 *
 * REST API for managing temporal bundle memberships (choice bundles).
 * Memberships define time ranges during which a child habit belongs to a parent bundle.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { invalidateUserCaches } from '../lib/cacheInstances';
import { validateDayKey } from '../domain/canonicalValidators';
import { getHabitById } from '../repositories/habitRepository';
import { getHabitEntriesByHabit } from '../repositories/habitEntryRepository';
import {
  createMembership,
  endMembership,
  archiveMembership,
  graduateMembership,
  getMembershipById,
  getMembershipsByParent,
  getMembershipsForDay,
  deleteMembership,
  hasActiveMembership,
} from '../repositories/bundleMembershipRepository';

/**
 * GET /api/bundle-memberships?parentHabitId=X[&dayKey=Y]
 *
 * List memberships for a bundle. If dayKey is provided, returns only
 * memberships active on that day.
 */
export async function getBundleMembershipsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { parentHabitId, dayKey } = req.query;

    if (!parentHabitId || typeof parentHabitId !== 'string') {
      res.status(400).json({ error: 'parentHabitId query parameter is required' });
      return;
    }

    if (dayKey && typeof dayKey === 'string') {
      const validation = validateDayKey(dayKey);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      const memberships = await getMembershipsForDay(parentHabitId, dayKey, householdId, userId);
      res.json(memberships);
      return;
    }

    const memberships = await getMembershipsByParent(parentHabitId, householdId, userId);
    res.json(memberships);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}

/**
 * POST /api/bundle-memberships
 *
 * Add a child to a bundle (create membership).
 * Body: { parentHabitId, childHabitId, activeFromDayKey, activeToDayKey? }
 */
export async function createBundleMembershipRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { parentHabitId, childHabitId, activeFromDayKey, activeToDayKey, daysOfWeek } = req.body;

    if (!parentHabitId || typeof parentHabitId !== 'string') {
      res.status(400).json({ error: 'parentHabitId is required' });
      return;
    }
    if (!childHabitId || typeof childHabitId !== 'string') {
      res.status(400).json({ error: 'childHabitId is required' });
      return;
    }
    if (!activeFromDayKey || typeof activeFromDayKey !== 'string') {
      res.status(400).json({ error: 'activeFromDayKey is required' });
      return;
    }

    const fromValidation = validateDayKey(activeFromDayKey);
    if (!fromValidation.valid) {
      res.status(400).json({ error: `activeFromDayKey: ${fromValidation.error}` });
      return;
    }

    if (activeToDayKey != null) {
      if (typeof activeToDayKey !== 'string') {
        res.status(400).json({ error: 'activeToDayKey must be a string' });
        return;
      }
      const toValidation = validateDayKey(activeToDayKey);
      if (!toValidation.valid) {
        res.status(400).json({ error: `activeToDayKey: ${toValidation.error}` });
        return;
      }
      if (activeToDayKey < activeFromDayKey) {
        res.status(400).json({ error: 'activeToDayKey must be >= activeFromDayKey' });
        return;
      }
    }

    // Validate daysOfWeek if provided
    if (daysOfWeek != null) {
      if (!Array.isArray(daysOfWeek) || !daysOfWeek.every((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6)) {
        res.status(400).json({ error: 'daysOfWeek must be an array of numbers 0-6 (Sun-Sat)' });
        return;
      }
    }

    // Validate parent is a bundle (choice or checklist)
    const parentHabit = await getHabitById(parentHabitId, householdId, userId);
    if (!parentHabit) {
      res.status(404).json({ error: 'Parent habit not found' });
      return;
    }
    if (parentHabit.type !== 'bundle' || !parentHabit.bundleType) {
      res.status(400).json({ error: 'Parent habit must be a bundle (choice or checklist)' });
      return;
    }

    // Validate child exists
    const childHabit = await getHabitById(childHabitId, householdId, userId);
    if (!childHabit) {
      res.status(404).json({ error: 'Child habit not found' });
      return;
    }

    // Prevent duplicate active membership
    if (!activeToDayKey) {
      const duplicate = await hasActiveMembership(parentHabitId, childHabitId, householdId, userId);
      if (duplicate) {
        res.status(409).json({ error: 'An active membership already exists for this parent-child pair' });
        return;
      }
    }

    const membership = await createMembership(
      parentHabitId,
      childHabitId,
      activeFromDayKey,
      householdId,
      userId,
      activeToDayKey,
      daysOfWeek
    );

    invalidateUserCaches(userId);
    res.status(201).json(membership);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}

/**
 * PATCH /api/bundle-memberships/:id/end
 *
 * End a membership (set activeToDayKey).
 * Body: { endDayKey }
 */
export async function endBundleMembershipRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    const { endDayKey } = req.body;

    if (!endDayKey || typeof endDayKey !== 'string') {
      res.status(400).json({ error: 'endDayKey is required' });
      return;
    }

    const validation = validateDayKey(endDayKey);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const membership = await getMembershipById(id, householdId, userId);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (membership.activeToDayKey) {
      res.status(400).json({ error: 'Membership is already ended' });
      return;
    }

    if (endDayKey < membership.activeFromDayKey) {
      res.status(400).json({ error: 'endDayKey must be >= activeFromDayKey' });
      return;
    }

    const updated = await endMembership(
      membership.parentHabitId,
      membership.childHabitId,
      endDayKey,
      householdId,
      userId
    );

    if (!updated) {
      res.status(500).json({ error: 'Failed to end membership' });
      return;
    }

    const result = await getMembershipById(id, householdId, userId);
    invalidateUserCaches(userId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}

/**
 * PATCH /api/bundle-memberships/:id/archive
 *
 * Archive a membership (UX hint to hide from active lists).
 */
export async function archiveBundleMembershipRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;

    const membership = await getMembershipById(id, householdId, userId);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    const updated = await archiveMembership(id, householdId, userId);
    if (!updated) {
      res.status(500).json({ error: 'Failed to archive membership' });
      return;
    }

    const result = await getMembershipById(id, householdId, userId);
    invalidateUserCaches(userId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}

/**
 * PATCH /api/bundle-memberships/:id/graduate
 *
 * Graduate a membership: the habit behavior has become automatic.
 * Sets graduatedAt and activeToDayKey atomically.
 * Body: { endDayKey }
 */
export async function graduateBundleMembershipRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    const { endDayKey } = req.body;

    if (!endDayKey || typeof endDayKey !== 'string') {
      res.status(400).json({ error: 'endDayKey is required' });
      return;
    }

    const validation = validateDayKey(endDayKey);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const membership = await getMembershipById(id, householdId, userId);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    if (membership.activeToDayKey) {
      res.status(400).json({ error: 'Membership is already ended' });
      return;
    }

    if (membership.graduatedAt) {
      res.status(400).json({ error: 'Membership is already graduated' });
      return;
    }

    if (endDayKey < membership.activeFromDayKey) {
      res.status(400).json({ error: 'endDayKey must be >= activeFromDayKey' });
      return;
    }

    const updated = await graduateMembership(id, endDayKey, householdId, userId);
    if (!updated) {
      res.status(500).json({ error: 'Failed to graduate membership' });
      return;
    }

    const result = await getMembershipById(id, householdId, userId);
    invalidateUserCaches(userId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}

/**
 * DELETE /api/bundle-memberships/:id
 *
 * Delete a membership. Only allowed if the child habit has zero entries (409 otherwise).
 */
export async function deleteBundleMembershipRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;

    const membership = await getMembershipById(id, householdId, userId);
    if (!membership) {
      res.status(404).json({ error: 'Membership not found' });
      return;
    }

    // Check if child has any entries
    const entries = await getHabitEntriesByHabit(membership.childHabitId, householdId, userId);
    const activeEntries = entries.filter(e => !e.deletedAt);
    if (activeEntries.length > 0) {
      res.status(409).json({
        error: 'Cannot delete membership: child habit has entries. Use end or archive instead.',
        entryCount: activeEntries.length,
      });
      return;
    }

    const deleted = await deleteMembership(id, householdId, userId);
    if (!deleted) {
      res.status(500).json({ error: 'Failed to delete membership' });
      return;
    }

    invalidateUserCaches(userId);
    res.status(204).send();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
}
