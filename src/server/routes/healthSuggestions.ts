/**
 * Health Suggestion Routes
 *
 * Endpoints for managing health-based habit suggestions.
 * All routes are gated by requireHealthFeature middleware (via /api/health prefix).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getPendingSuggestionsByUser, getSuggestionById, updateSuggestionStatus } from '../repositories/healthSuggestionRepository';
import { getHabitEntriesForDay, upsertHabitEntry } from '../repositories/habitEntryRepository';
import { getHabitById } from '../repositories/habitRepository';

const router = Router();

/**
 * GET /api/health/suggestions
 * Get all pending suggestions for the current user.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const suggestions = await getPendingSuggestionsByUser(householdId, userId);
    res.status(200).json({ suggestions });
  } catch (error) {
    console.error('[Health Suggestions] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * POST /api/health/suggestions/:id/accept
 * Accept a suggestion — creates a HabitEntry.
 */
router.post('/:id/accept', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;

    const suggestion = await getSuggestionById(id, householdId, userId);
    if (!suggestion) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Suggestion not found.' } });
      return;
    }

    if (suggestion.status !== 'pending') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Suggestion is not pending.' } });
      return;
    }

    // Check if entry already exists (idempotency)
    const existing = await getHabitEntriesForDay(
      suggestion.habitId, suggestion.dayKey, householdId, userId
    );
    if (existing.length > 0) {
      // Entry already exists — just mark suggestion as accepted
      await updateSuggestionStatus(id, 'accepted', householdId, userId);
      res.status(200).json({ suggestion: { ...suggestion, status: 'accepted' }, entry: existing[0] });
      return;
    }

    // Determine value
    const habit = await getHabitById(suggestion.habitId, householdId, userId);
    const value = habit?.goal?.type === 'number' ? suggestion.metricValue : 1;

    // Create entry
    const entry = await upsertHabitEntry(
      suggestion.habitId,
      suggestion.dayKey,
      householdId,
      userId,
      {
        value,
        source: 'apple_health',
        sourceRuleId: suggestion.ruleId,
        importedMetricValue: suggestion.metricValue,
        importedMetricType: suggestion.metricType,
        timestamp: new Date().toISOString(),
      }
    );

    // Mark suggestion as accepted
    const updated = await updateSuggestionStatus(id, 'accepted', householdId, userId);

    res.status(200).json({ suggestion: updated, entry });
  } catch (error) {
    console.error('[Health Suggestion Accept] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * POST /api/health/suggestions/:id/dismiss
 * Dismiss a suggestion — no HabitEntry created.
 */
router.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { id } = req.params;

    const suggestion = await getSuggestionById(id, householdId, userId);
    if (!suggestion) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Suggestion not found.' } });
      return;
    }

    if (suggestion.status !== 'pending') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Suggestion is not pending.' } });
      return;
    }

    const updated = await updateSuggestionStatus(id, 'dismissed', householdId, userId);
    res.status(200).json({ suggestion: updated });
  } catch (error) {
    console.error('[Health Suggestion Dismiss] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

export default router;
