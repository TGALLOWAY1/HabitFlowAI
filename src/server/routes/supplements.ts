/**
 * Supplement Routes
 *
 * REST API for Supplement definitions and daily SupplementLog "taken" records.
 * Part of the Health Hub (Phase 4). Mirrors the medication routes.
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { validateDayKey } from '../domain/canonicalValidators';
import {
  listSupplements,
  createSupplement,
  updateSupplement,
  softDeleteSupplement,
  getSupplementLogsForDay,
  setSupplementLog,
  type SupplementCreateInput,
  type SupplementUpdateInput,
} from '../repositories/supplementRepository';

function serverError(res: Response, error: unknown, message: string): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    },
  });
}

/** GET /api/supplements */
export async function getSupplementsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const supplements = await listSupplements(householdId, userId);
    res.status(200).json({ supplements });
  } catch (error) {
    serverError(res, error, 'Failed to fetch supplements');
  }
}

/** POST /api/supplements */
export async function createSupplementRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { name } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Supplement name is required' },
      });
      return;
    }

    const input: SupplementCreateInput = {
      name,
      dosage: req.body?.dosage ?? null,
      schedule: req.body?.schedule ?? null,
      active: typeof req.body?.active === 'boolean' ? req.body.active : true,
      notes: req.body?.notes ?? null,
    };

    const supplement = await createSupplement(input, householdId, userId);
    res.status(201).json({ supplement });
  } catch (error) {
    serverError(res, error, 'Failed to create supplement');
  }
}

/** PUT /api/supplements/:id */
export async function updateSupplementRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }

    const patch = req.body as SupplementUpdateInput;
    const supplement = await updateSupplement(id, patch, householdId, userId);
    if (!supplement) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Supplement not found' } });
      return;
    }
    res.status(200).json({ supplement });
  } catch (error) {
    serverError(res, error, 'Failed to update supplement');
  }
}

/** DELETE /api/supplements/:id (soft delete) */
export async function deleteSupplementRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }
    const deleted = await softDeleteSupplement(id, householdId, userId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Supplement not found' } });
      return;
    }
    res.status(200).json({ message: 'Supplement deleted successfully' });
  } catch (error) {
    serverError(res, error, 'Failed to delete supplement');
  }
}

/** GET /api/supplementLogs?dayKey=YYYY-MM-DD */
export async function getSupplementLogsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { dayKey } = req.query as { dayKey?: string };

    if (!dayKey || typeof dayKey !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'dayKey is required (YYYY-MM-DD)' },
      });
      return;
    }
    const v = validateDayKey(dayKey);
    if (!v.valid) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: v.error } });
      return;
    }

    const supplementLogs = await getSupplementLogsForDay(householdId, userId, dayKey);
    res.status(200).json({ supplementLogs });
  } catch (error) {
    serverError(res, error, 'Failed to fetch supplement logs');
  }
}

/** POST /api/supplementLogs  Body: { supplementId, dayKey, taken, timeTaken? } */
export async function setSupplementLogRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { supplementId, dayKey, taken, timeTaken } = req.body || {};

    if (!supplementId || typeof supplementId !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'supplementId is required' } });
      return;
    }
    if (!dayKey || typeof dayKey !== 'string' || !validateDayKey(dayKey).valid) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid dayKey is required (YYYY-MM-DD)' } });
      return;
    }
    if (typeof taken !== 'boolean') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'taken (boolean) is required' } });
      return;
    }

    const supplementLog = await setSupplementLog(
      { supplementId, dayKey, taken, timeTaken: typeof timeTaken === 'string' ? timeTaken : null },
      householdId,
      userId
    );
    res.status(200).json({ supplementLog });
  } catch (error) {
    serverError(res, error, 'Failed to save supplement log');
  }
}
