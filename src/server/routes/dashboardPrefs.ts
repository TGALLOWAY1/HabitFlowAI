/**
 * DashboardPrefs Routes
 *
 * Stores view-only user dashboard preferences (e.g., pinnedRoutineIds).
 * Guardrail: userId is always derived server-side via middleware.
 */

import type { Request, Response } from 'express';
import { getDashboardPrefs, updateDashboardPrefs } from '../repositories/dashboardPrefsRepository';
import { getRequestIdentity } from '../middleware/identity';

export async function getDashboardPrefsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const prefs = await getDashboardPrefs(householdId, userId);
    res.status(200).json({ dashboardPrefs: prefs });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dashboard prefs',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

export async function updateDashboardPrefsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const { pinnedRoutineIds, pinnedGoalIds, pinnedJournalTemplateIds, checkinExtraMetricKeys, hideStreaks } = req.body || {};

    const prefs = await updateDashboardPrefs(householdId, userId, { pinnedRoutineIds, pinnedGoalIds, pinnedJournalTemplateIds, checkinExtraMetricKeys, hideStreaks });
    res.status(200).json({ dashboardPrefs: prefs });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

