/**
 * Analytics Routes
 *
 * Read-only endpoints for habit analytics (summary, heatmap, trends, category breakdown, insights).
 */

import type { Request, Response } from 'express';
import { getRequestIdentity } from '../middleware/identity';
import { resolveTimeZone, getNowDayKey } from '../utils/dayKey';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';
import { getCategoriesByUser } from '../repositories/categoryRepository';
import { getAllMembershipsByUser } from '../repositories/bundleMembershipRepository';
import { getRoutines } from '../repositories/routineRepository';
import { getRoutineLogsByUser } from '../repositories/routineLogRepository';
import { getGoalsByUser } from '../repositories/goalRepository';
import {
  computeHabitAnalyticsSummary,
  computeHeatmapData,
  computeTrendData,
  computeCategoryBreakdown,
  computeInsights,
  computeRoutineAnalytics,
  computeGoalAnalytics,
} from '../services/analyticsService';

function parseDays(query: unknown, defaultDays = 90): number {
  const raw = typeof query === 'string' ? parseInt(query, 10) : NaN;
  if (isNaN(raw) || raw < 1 || raw > 365) return defaultDays;
  return raw;
}

export async function getHabitAnalyticsSummary(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 90);
    const referenceDayKey = getNowDayKey(timeZone);

    const [habits, entries, memberships] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
      getAllMembershipsByUser(householdId, userId),
    ]);

    const summary = computeHabitAnalyticsSummary(habits, entries, memberships, referenceDayKey, days, timeZone);
    res.json(summary);
  } catch (error) {
    console.error('[analytics] summary error:', error);
    res.status(500).json({ error: 'Failed to compute analytics summary' });
  }
}

export async function getHabitAnalyticsHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 365);
    const referenceDayKey = getNowDayKey(timeZone);

    const [habits, entries] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
    ]);

    const heatmap = computeHeatmapData(habits, entries, referenceDayKey, days, timeZone);
    res.json(heatmap);
  } catch (error) {
    console.error('[analytics] heatmap error:', error);
    res.status(500).json({ error: 'Failed to compute heatmap data' });
  }
}

export async function getHabitAnalyticsTrends(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 90);
    const referenceDayKey = getNowDayKey(timeZone);

    const [habits, entries] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
    ]);

    const trends = computeTrendData(habits, entries, referenceDayKey, days, timeZone);
    res.json(trends);
  } catch (error) {
    console.error('[analytics] trends error:', error);
    res.status(500).json({ error: 'Failed to compute trend data' });
  }
}

export async function getHabitAnalyticsCategoryBreakdown(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 90);
    const referenceDayKey = getNowDayKey(timeZone);

    const [habits, entries, categories] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
      getCategoriesByUser(householdId, userId),
    ]);

    const breakdown = computeCategoryBreakdown(habits, entries, categories, referenceDayKey, days, timeZone);
    res.json(breakdown);
  } catch (error) {
    console.error('[analytics] category breakdown error:', error);
    res.status(500).json({ error: 'Failed to compute category breakdown' });
  }
}

export async function getHabitAnalyticsInsights(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 90);
    const referenceDayKey = getNowDayKey(timeZone);

    const [habits, entries] = await Promise.all([
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
    ]);

    const insights = computeInsights(habits, entries, referenceDayKey, days, timeZone);
    res.json(insights);
  } catch (error) {
    console.error('[analytics] insights error:', error);
    res.status(500).json({ error: 'Failed to compute insights' });
  }
}

export async function getRoutineAnalyticsSummary(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 90);
    const referenceDayKey = getNowDayKey(timeZone);

    const [routines, routineLogs] = await Promise.all([
      getRoutines(householdId, userId),
      getRoutineLogsByUser(userId),
    ]);

    const analytics = computeRoutineAnalytics(routines, routineLogs, referenceDayKey, days);
    res.json(analytics);
  } catch (error) {
    console.error('[analytics] routine summary error:', error);
    res.status(500).json({ error: 'Failed to compute routine analytics' });
  }
}

export async function getGoalAnalyticsSummary(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const timeZone = resolveTimeZone(typeof req.query.timeZone === 'string' ? req.query.timeZone : undefined);
    const days = parseDays(req.query.days, 90);
    const referenceDayKey = getNowDayKey(timeZone);

    const [goals, habits, entries] = await Promise.all([
      getGoalsByUser(householdId, userId),
      getHabitsByUser(householdId, userId),
      getHabitEntriesByUser(householdId, userId),
    ]);

    const analytics = computeGoalAnalytics(goals, habits, entries, referenceDayKey, timeZone);
    res.json(analytics);
  } catch (error) {
    console.error('[analytics] goal summary error:', error);
    res.status(500).json({ error: 'Failed to compute goal analytics' });
  }
}
