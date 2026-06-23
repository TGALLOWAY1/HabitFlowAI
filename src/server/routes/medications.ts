/**
 * Medication Routes
 *
 * REST API for Medication definitions and daily MedicationLog "taken" records.
 * Part of the Wellbeing system (Phase 2: medication tracking within wellbeing).
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { validateDayKey } from '../domain/canonicalValidators';
import {
  listMedications,
  createMedication,
  updateMedication,
  softDeleteMedication,
  getMedicationLogsForDay,
  setMedicationLog,
  type MedicationCreateInput,
  type MedicationUpdateInput,
} from '../repositories/medicationRepository';

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

/** GET /api/medications */
export async function getMedicationsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const medications = await listMedications(householdId, userId);
    res.status(200).json({ medications });
  } catch (error) {
    serverError(res, error, 'Failed to fetch medications');
  }
}

/** POST /api/medications */
export async function createMedicationRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { name } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Medication name is required' },
      });
      return;
    }

    const input: MedicationCreateInput = {
      name,
      dosage: req.body?.dosage ?? null,
      schedule: req.body?.schedule ?? null,
      startDate: req.body?.startDate ?? null,
      endDate: req.body?.endDate ?? null,
      active: typeof req.body?.active === 'boolean' ? req.body.active : true,
      notes: req.body?.notes ?? null,
    };

    const medication = await createMedication(input, householdId, userId);
    res.status(201).json({ medication });
  } catch (error) {
    serverError(res, error, 'Failed to create medication');
  }
}

/** PUT /api/medications/:id */
export async function updateMedicationRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }

    const patch = req.body as MedicationUpdateInput;
    const medication = await updateMedication(id, patch, householdId, userId);
    if (!medication) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Medication not found' } });
      return;
    }
    res.status(200).json({ medication });
  } catch (error) {
    serverError(res, error, 'Failed to update medication');
  }
}

/** DELETE /api/medications/:id (soft delete) */
export async function deleteMedicationRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }
    const deleted = await softDeleteMedication(id, householdId, userId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Medication not found' } });
      return;
    }
    res.status(200).json({ message: 'Medication deleted successfully' });
  } catch (error) {
    serverError(res, error, 'Failed to delete medication');
  }
}

/** GET /api/medicationLogs?dayKey=YYYY-MM-DD */
export async function getMedicationLogsRoute(req: Request, res: Response): Promise<void> {
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

    const medicationLogs = await getMedicationLogsForDay(householdId, userId, dayKey);
    res.status(200).json({ medicationLogs });
  } catch (error) {
    serverError(res, error, 'Failed to fetch medication logs');
  }
}

/** POST /api/medicationLogs  Body: { medicationId, dayKey, taken, timeTaken? } */
export async function setMedicationLogRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { medicationId, dayKey, taken, timeTaken } = req.body || {};

    if (!medicationId || typeof medicationId !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'medicationId is required' } });
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

    const medicationLog = await setMedicationLog(
      { medicationId, dayKey, taken, timeTaken: typeof timeTaken === 'string' ? timeTaken : null },
      householdId,
      userId
    );
    res.status(200).json({ medicationLog });
  } catch (error) {
    serverError(res, error, 'Failed to save medication log');
  }
}
