/**
 * Auth routes: identity and session info.
 */

import type { Request, Response } from 'express';
import type { RequestWithIdentity } from '../middleware/identity';

/**
 * GET /api/auth/me
 * Returns current request identity { householdId, userId }.
 * Requires identity middleware to have run (401 if not authenticated).
 */
export function getAuthMe(req: Request, res: Response): void {
  const r = req as RequestWithIdentity;
  const householdId = r.householdId;
  const userId = r.userId;

  if (householdId == null || userId == null) {
    res.status(401).json({
      error: 'Identity not set. Ensure X-Household-Id and X-User-Id headers are sent (or use dev bootstrap).',
    });
    return;
  }

  res.json({ householdId, userId });
}
