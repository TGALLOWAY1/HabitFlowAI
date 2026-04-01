/**
 * Habit Health Rule Routes
 *
 * CRUD endpoints for managing health rules on habits.
 * All routes are gated by requireHealthFeature middleware.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { getHabitById } from '../repositories/habitRepository';
import {
  createHealthRule,
  getHealthRuleByHabitId,
  updateHealthRule,
  deactivateHealthRule,
} from '../repositories/habitHealthRuleRepository';
import { runBackfill } from '../services/healthBackfillService';
import { getNowDayKey } from '../utils/dayKey';
import type { HealthMetricType, HealthRuleOperator, HealthRuleBehavior } from '../../models/persistenceTypes';

const router = Router({ mergeParams: true });

const VALID_METRIC_TYPES: HealthMetricType[] = ['steps', 'sleep_hours', 'workout_minutes', 'active_calories', 'weight'];
const VALID_OPERATORS: HealthRuleOperator[] = ['>=', '<=', '>', '<', 'exists'];
const VALID_BEHAVIORS: HealthRuleBehavior[] = ['auto_log', 'suggest'];

/**
 * POST /api/habits/:habitId/health-rule
 * Create a health rule for a habit.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { habitId } = req.params;
    const { metricType, operator, thresholdValue, behavior } = req.body;

    // Validate habit exists
    const habit = await getHabitById(habitId, householdId, userId);
    if (!habit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found.' } });
      return;
    }

    // Validate metricType
    if (!metricType || !VALID_METRIC_TYPES.includes(metricType)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `metricType must be one of: ${VALID_METRIC_TYPES.join(', ')}` } });
      return;
    }

    // Validate operator
    if (!operator || !VALID_OPERATORS.includes(operator)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `operator must be one of: ${VALID_OPERATORS.join(', ')}` } });
      return;
    }

    // Validate thresholdValue (required for comparison operators)
    if (operator !== 'exists' && (thresholdValue == null || typeof thresholdValue !== 'number')) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'thresholdValue is required for comparison operators.' } });
      return;
    }

    // Validate behavior
    if (!behavior || !VALID_BEHAVIORS.includes(behavior)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `behavior must be one of: ${VALID_BEHAVIORS.join(', ')}` } });
      return;
    }

    const rule = await createHealthRule(
      {
        userId,
        habitId,
        sourceType: 'apple_health',
        metricType,
        operator,
        thresholdValue: operator === 'exists' ? null : thresholdValue,
        behavior,
        active: true,
      },
      householdId,
      userId
    );

    if (!rule) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'A health rule already exists for this habit.' } });
      return;
    }

    res.status(201).json({ rule });
  } catch (error) {
    console.error('[Health Rule Create] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * GET /api/habits/:habitId/health-rule
 * Get the health rule for a habit.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { habitId } = req.params;

    const rule = await getHealthRuleByHabitId(habitId, householdId, userId);
    res.status(200).json({ rule: rule || null });
  } catch (error) {
    console.error('[Health Rule Get] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * PATCH /api/habits/:habitId/health-rule
 * Update the health rule for a habit.
 */
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { habitId } = req.params;

    // Get existing rule
    const existing = await getHealthRuleByHabitId(habitId, householdId, userId);
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No health rule found for this habit.' } });
      return;
    }

    const { metricType, operator, thresholdValue, behavior } = req.body;
    const patch: Record<string, unknown> = {};

    if (metricType !== undefined) {
      if (!VALID_METRIC_TYPES.includes(metricType)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `metricType must be one of: ${VALID_METRIC_TYPES.join(', ')}` } });
        return;
      }
      patch.metricType = metricType;
    }

    if (operator !== undefined) {
      if (!VALID_OPERATORS.includes(operator)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `operator must be one of: ${VALID_OPERATORS.join(', ')}` } });
        return;
      }
      patch.operator = operator;
    }

    if (thresholdValue !== undefined) {
      patch.thresholdValue = thresholdValue;
    }

    if (behavior !== undefined) {
      if (!VALID_BEHAVIORS.includes(behavior)) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `behavior must be one of: ${VALID_BEHAVIORS.join(', ')}` } });
        return;
      }
      patch.behavior = behavior;
    }

    const updated = await updateHealthRule(existing.id, patch, householdId, userId);
    res.status(200).json({ rule: updated });
  } catch (error) {
    console.error('[Health Rule Update] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * DELETE /api/habits/:habitId/health-rule
 * Deactivate the health rule for a habit.
 * Past HabitEntries are NOT deleted.
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { habitId } = req.params;

    const existing = await getHealthRuleByHabitId(habitId, householdId, userId);
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No health rule found for this habit.' } });
      return;
    }

    await deactivateHealthRule(existing.id, householdId, userId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Health Rule Delete] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

/**
 * POST /api/habits/:habitId/health-rule/backfill
 * Trigger backfill for a habit based on its health rule.
 */
router.post('/backfill', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { habitId } = req.params;
    const { startDayKey: customStartDayKey } = req.body;

    // Get habit
    const habit = await getHabitById(habitId, householdId, userId);
    if (!habit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Habit not found.' } });
      return;
    }

    // Get rule
    const rule = await getHealthRuleByHabitId(habitId, householdId, userId);
    if (!rule) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No health rule found for this habit.' } });
      return;
    }

    // Determine start date: custom, or habit creation date
    const startDayKey = customStartDayKey || habit.createdAt.slice(0, 10);
    const endDayKey = getNowDayKey();

    const result = await runBackfill(habit, rule, startDayKey, endDayKey, householdId, userId);

    res.status(200).json(result);
  } catch (error) {
    console.error('[Health Backfill] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

export default router;
