/**
 * Health Sync Routes
 *
 * Endpoint for syncing Apple Health data into HabitFlow.
 * All routes are gated by requireHealthFeature middleware.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { upsertHealthMetric } from '../repositories/healthMetricDailyRepository';
import { processHealthSync } from '../services/healthAutoLogService';
import { normalizeDayKey } from '../utils/dayKeyNormalization';
import { checkAndCompleteLinkedGoals } from '../services/goalAutoCompletion';
import { invalidateUserCaches } from '../lib/cacheInstances';

const router = Router();

/**
 * POST /api/health/apple/sync
 *
 * Receives daily health data from an Apple Health client.
 * Upserts into HealthMetricDaily, then evaluates rules for auto-log/suggest.
 * Idempotent — same data sent twice produces one record.
 */
router.post('/apple/sync', async (req: Request, res: Response) => {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { dayKey: rawDayKey, date, timeZone, steps, activeCalories, sleepHours, workoutMinutes, weight } = req.body;

    // Validate dayKey
    let dayKey: string;
    try {
      dayKey = normalizeDayKey({ dayKey: rawDayKey, date, timeZone });
    } catch {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing dayKey/date.' } });
      return;
    }

    // Validate at least one metric present
    if (steps == null && activeCalories == null && sleepHours == null && workoutMinutes == null && weight == null) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one health metric is required.' } });
      return;
    }

    for (const [metricName, metricValue] of Object.entries({
      steps,
      activeCalories,
      sleepHours,
      workoutMinutes,
      weight,
    })) {
      if (metricValue != null && (
        typeof metricValue !== 'number'
        || !Number.isFinite(metricValue)
        || metricValue < 0
      )) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `${metricName} must be a finite non-negative number.` },
        });
        return;
      }
    }

    // Upsert health metric
    const metric = await upsertHealthMetric(
      {
        userId,
        dayKey,
        source: 'apple_health',
        steps: steps ?? null,
        activeCalories: activeCalories ?? null,
        sleepHours: sleepHours ?? null,
        workoutMinutes: workoutMinutes ?? null,
        weight: weight ?? null,
      },
      householdId,
      userId
    );

    // Evaluate rules for auto-log and suggestions
    const syncResult = await processHealthSync(dayKey, metric, householdId, userId);
    const completedGoalIds = syncResult.autoLogged.length > 0
      ? await checkAndCompleteLinkedGoals(syncResult.autoLogged, householdId, userId, timeZone)
      : [];
    if (syncResult.autoLogged.length > 0) invalidateUserCaches(userId);

    res.status(200).json({
      metric,
      autoLogged: syncResult.autoLogged,
      suggested: syncResult.suggested,
      completedGoalIds,
    });
  } catch (error) {
    console.error('[Health Sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message } });
  }
});

export default router;
