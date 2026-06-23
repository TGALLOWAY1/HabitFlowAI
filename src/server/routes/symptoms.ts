/**
 * Symptom Routes
 *
 * REST API for Symptom definitions and daily SymptomLog severity records.
 * Part of the Health Hub (Phase 4).
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { validateDayKey } from '../domain/canonicalValidators';
import {
  listSymptoms,
  createSymptom,
  updateSymptom,
  softDeleteSymptom,
  getSymptomLogsForDay,
  setSymptomLog,
  type SymptomCreateInput,
  type SymptomUpdateInput,
} from '../repositories/symptomRepository';

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

/** GET /api/symptoms */
export async function getSymptomsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const symptoms = await listSymptoms(householdId, userId);
    res.status(200).json({ symptoms });
  } catch (error) {
    serverError(res, error, 'Failed to fetch symptoms');
  }
}

/** POST /api/symptoms */
export async function createSymptomRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { name } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Symptom name is required' },
      });
      return;
    }

    const input: SymptomCreateInput = {
      name,
      active: typeof req.body?.active === 'boolean' ? req.body.active : true,
      notes: req.body?.notes ?? null,
    };

    const symptom = await createSymptom(input, householdId, userId);
    res.status(201).json({ symptom });
  } catch (error) {
    serverError(res, error, 'Failed to create symptom');
  }
}

/** PUT /api/symptoms/:id */
export async function updateSymptomRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }

    const patch = req.body as SymptomUpdateInput;
    const symptom = await updateSymptom(id, patch, householdId, userId);
    if (!symptom) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Symptom not found' } });
      return;
    }
    res.status(200).json({ symptom });
  } catch (error) {
    serverError(res, error, 'Failed to update symptom');
  }
}

/** DELETE /api/symptoms/:id (soft delete) */
export async function deleteSymptomRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }
    const deleted = await softDeleteSymptom(id, householdId, userId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Symptom not found' } });
      return;
    }
    res.status(200).json({ message: 'Symptom deleted successfully' });
  } catch (error) {
    serverError(res, error, 'Failed to delete symptom');
  }
}

/** GET /api/symptomLogs?dayKey=YYYY-MM-DD */
export async function getSymptomLogsRoute(req: Request, res: Response): Promise<void> {
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

    const symptomLogs = await getSymptomLogsForDay(householdId, userId, dayKey);
    res.status(200).json({ symptomLogs });
  } catch (error) {
    serverError(res, error, 'Failed to fetch symptom logs');
  }
}

/** POST /api/symptomLogs  Body: { symptomId, dayKey, severity, notes? } */
export async function setSymptomLogRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { symptomId, dayKey, severity, notes } = req.body || {};

    if (!symptomId || typeof symptomId !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'symptomId is required' } });
      return;
    }
    if (!dayKey || typeof dayKey !== 'string' || !validateDayKey(dayKey).valid) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid dayKey is required (YYYY-MM-DD)' } });
      return;
    }
    if (typeof severity !== 'number' || !Number.isFinite(severity) || severity < 1 || severity > 5) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'severity (number 1-5) is required' } });
      return;
    }

    const symptomLog = await setSymptomLog(
      { symptomId, dayKey, severity, notes: typeof notes === 'string' ? notes : null },
      householdId,
      userId
    );
    res.status(200).json({ symptomLog });
  } catch (error) {
    serverError(res, error, 'Failed to save symptom log');
  }
}
