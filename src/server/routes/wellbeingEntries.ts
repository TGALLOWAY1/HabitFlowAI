/**
 * WellbeingEntry Routes
 *
 * New canonical API endpoints for subjective wellbeing check-ins.
 * Old wellbeingLogs endpoints remain backward-compatible and unchanged.
 */

import type { Request, Response } from 'express';
import { validateDayKey } from '../domain/canonicalValidators';
import { createWellbeingEntries, getWellbeingEntries, softDeleteWellbeingEntry, type WellbeingEntryUpsertInput } from '../repositories/wellbeingEntryRepository';

/**
 * Get wellbeing entries for a user in a dayKey range.
 *
 * GET /api/wellbeingEntries?startDayKey=YYYY-MM-DD&endDayKey=YYYY-MM-DD
 */
export async function getWellbeingEntriesRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).userId || 'anonymous-user';
    const { startDayKey, endDayKey } = req.query as any;

    if (!startDayKey || typeof startDayKey !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'startDayKey is required (YYYY-MM-DD)' } });
      return;
    }
    if (!endDayKey || typeof endDayKey !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'endDayKey is required (YYYY-MM-DD)' } });
      return;
    }

    const v1 = validateDayKey(startDayKey);
    if (!v1.valid) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: v1.error } });
      return;
    }
    const v2 = validateDayKey(endDayKey);
    if (!v2.valid) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: v2.error } });
      return;
    }

    const entries = await getWellbeingEntries({ userId, startDayKey, endDayKey });
    res.status(200).json({ wellbeingEntries: entries });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch wellbeing entries',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Batch upsert wellbeing entries.
 *
 * POST /api/wellbeingEntries
 * Body: { entries: WellbeingEntryUpsertInput[], defaultTimeZone?: string }
 */
export async function upsertWellbeingEntriesRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).userId || 'anonymous-user';
    const { entries, defaultTimeZone } = req.body || {};

    if (!Array.isArray(entries)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'entries is required and must be an array' } });
      return;
    }

    const saved = await createWellbeingEntries(entries as WellbeingEntryUpsertInput[], userId, {
      defaultTimeZone: typeof defaultTimeZone === 'string' ? defaultTimeZone : 'UTC',
    });

    res.status(200).json({ wellbeingEntries: saved });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save wellbeing entries',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Soft delete a wellbeing entry by ID.
 *
 * DELETE /api/wellbeingEntries/:id
 */
export async function deleteWellbeingEntryRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).userId || 'anonymous-user';
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'id is required' } });
      return;
    }

    const deleted = await softDeleteWellbeingEntry(id, userId);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Wellbeing entry not found' } });
      return;
    }

    res.status(200).json({ message: 'Wellbeing entry deleted successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete wellbeing entry',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}


