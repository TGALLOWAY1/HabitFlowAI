/**
 * Insights Routes
 *
 * Read-only, cross-domain analytics that power the Insights page tabs. All
 * derived from canonical truth at read time via insightsService (nothing
 * stored). Responses are cached briefly (analyticsCache) like the other
 * analytics endpoints.
 *
 *   GET /api/insights/overview      — averages, top correlations, discoveries
 *   GET /api/insights/correlations  — all factor↔outcome correlations
 *   GET /api/insights/habits        — habit↔wellbeing correlations
 *   GET /api/insights/medications   — adherence + medication↔wellbeing correlations
 *   GET /api/insights/predictions   — linear-trend projections per metric
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { resolveTimeZone, getNowDayKey } from '../utils/dayKey';
import { getWellbeingEntries } from '../repositories/wellbeingEntryRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUserInRange } from '../repositories/habitEntryRepository';
import { listMedications, getMedicationLogsInRange } from '../repositories/medicationRepository';
import { listSupplements, getSupplementLogsInRange } from '../repositories/supplementRepository';
import { listSymptoms, getSymptomLogsInRange } from '../repositories/symptomRepository';
import {
  computeInsightsOverview,
  computeCorrelationsForSources,
  computePredictionsForSources,
  computeMedicationInsights,
  startDayKeyForRange,
  type InsightsSources,
} from '../services/insightsService';
import { analyticsCache } from '../lib/cacheInstances';

function parseDays(query: unknown, defaultDays = 90): number {
  const raw = typeof query === 'string' ? parseInt(query, 10) : NaN;
  if (isNaN(raw) || raw < 1 || raw > 365) return defaultDays;
  return raw;
}

interface ResolvedRequest {
  householdId: string;
  userId: string;
  timeZone: string;
  referenceDayKey: string;
  days: number;
}

function resolve(req: Request, defaultDays = 90): ResolvedRequest {
  const { householdId, userId } = getRequestIdentity(req);
  const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
  const days = parseDays(req.query.days, defaultDays);
  const referenceDayKey = getNowDayKey(timeZone);
  return { householdId, userId, timeZone, referenceDayKey, days };
}

/**
 * Load every source the insights engine needs over the requested window.
 * Habit entries use a 2× window so a future feature could compute
 * period-over-period deltas; correlations/predictions use the requested window.
 */
async function loadSources(r: ResolvedRequest): Promise<InsightsSources> {
  const rangeStart = startDayKeyForRange(r.referenceDayKey, r.days);
  const [
    wellbeingEntries,
    habits,
    habitEntries,
    medications,
    medicationLogs,
    supplements,
    supplementLogs,
    symptoms,
    symptomLogs,
  ] = await Promise.all([
    getWellbeingEntries({ userId: r.userId, startDayKey: rangeStart, endDayKey: r.referenceDayKey }),
    getHabitsByUser(r.householdId, r.userId),
    getHabitEntriesByUserInRange(r.householdId, r.userId, rangeStart, r.referenceDayKey),
    listMedications(r.householdId, r.userId),
    getMedicationLogsInRange(r.householdId, r.userId, rangeStart, r.referenceDayKey),
    listSupplements(r.householdId, r.userId),
    getSupplementLogsInRange(r.householdId, r.userId, rangeStart, r.referenceDayKey),
    listSymptoms(r.householdId, r.userId),
    getSymptomLogsInRange(r.householdId, r.userId, rangeStart, r.referenceDayKey),
  ]);
  return {
    wellbeingEntries,
    habits,
    habitEntries,
    medications,
    medicationLogs,
    supplements,
    supplementLogs,
    symptoms,
    symptomLogs,
  };
}

async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = analyticsCache.get(key) as T | undefined;
  if (hit !== undefined) return hit;
  const result = await compute();
  analyticsCache.set(key, result);
  return result;
}

export async function getInsightsOverview(req: Request, res: Response): Promise<void> {
  try {
    const r = resolve(req, 90);
    const result = await cached(`${r.userId}:insights:overview:${r.days}`, async () => {
      const sources = await loadSources(r);
      return computeInsightsOverview(sources, r.referenceDayKey, r.days, r.timeZone);
    });
    res.json(result);
  } catch (error) {
    console.error('[insights] overview error:', error);
    res.status(500).json({ error: 'Failed to compute insights overview' });
  }
}

export async function getInsightsCorrelations(req: Request, res: Response): Promise<void> {
  try {
    const r = resolve(req, 90);
    const result = await cached(`${r.userId}:insights:correlations:${r.days}`, async () => {
      const sources = await loadSources(r);
      return { correlations: computeCorrelationsForSources(sources, r.referenceDayKey, r.days, r.timeZone), rangeDays: r.days };
    });
    res.json(result);
  } catch (error) {
    console.error('[insights] correlations error:', error);
    res.status(500).json({ error: 'Failed to compute correlations' });
  }
}

export async function getInsightsHabits(req: Request, res: Response): Promise<void> {
  try {
    const r = resolve(req, 90);
    const result = await cached(`${r.userId}:insights:habits:${r.days}`, async () => {
      const sources = await loadSources(r);
      return {
        correlations: computeCorrelationsForSources(sources, r.referenceDayKey, r.days, r.timeZone, ['habit']),
        rangeDays: r.days,
      };
    });
    res.json(result);
  } catch (error) {
    console.error('[insights] habits error:', error);
    res.status(500).json({ error: 'Failed to compute habit insights' });
  }
}

export async function getInsightsMedications(req: Request, res: Response): Promise<void> {
  try {
    const r = resolve(req, 90);
    const result = await cached(`${r.userId}:insights:medications:${r.days}`, async () => {
      const sources = await loadSources(r);
      return computeMedicationInsights(sources, r.referenceDayKey, r.days, r.timeZone);
    });
    res.json(result);
  } catch (error) {
    console.error('[insights] medications error:', error);
    res.status(500).json({ error: 'Failed to compute medication insights' });
  }
}

export async function getInsightsPredictions(req: Request, res: Response): Promise<void> {
  try {
    const r = resolve(req, 90);
    const result = await cached(`${r.userId}:insights:predictions:${r.days}`, async () => {
      const sources = await loadSources(r);
      return { predictions: computePredictionsForSources(sources, r.referenceDayKey, r.days), rangeDays: r.days };
    });
    res.json(result);
  } catch (error) {
    console.error('[insights] predictions error:', error);
    res.status(500).json({ error: 'Failed to compute predictions' });
  }
}
