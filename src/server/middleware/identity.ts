/**
 * V1 Identity Middleware
 *
 * Single source of truth for request identity: { householdId, userId }.
 * - Prefer explicit headers: X-Household-Id, X-User-Id.
 * - Production: missing headers → 401.
 * - Dev only: missing headers → bootstrap identity (default-household, default-user).
 */

import type { Request, Response, NextFunction } from 'express';

export const DEV_BOOTSTRAP_HOUSEHOLD_ID = 'default-household';
export const DEV_BOOTSTRAP_USER_ID = 'default-user';

export type RequestIdentity = {
  householdId: string;
  userId: string;
};

export interface RequestWithIdentity extends Request {
  householdId?: string;
  userId?: string;
}

/**
 * Get identity from request (set by identityMiddleware).
 * Use in route handlers to pass to repositories.
 */
export function getRequestIdentity(req: Request): { householdId: string; userId: string } {
  const r = req as RequestWithIdentity;
  const householdId = r.householdId;
  const userId = r.userId;
  if (householdId == null || userId == null) {
    throw new Error('Identity not set on request. Ensure identityMiddleware ran and headers are present.');
  }
  return { householdId, userId };
}

function trimHeader(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * Middleware that sets req.householdId and req.userId.
 * Production: returns 401 if X-Household-Id or X-User-Id is missing.
 * Dev (NODE_ENV !== 'production'): uses bootstrap identity when headers missing.
 */
export function identityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const householdIdRaw = req.headers['x-household-id'];
  const userIdRaw = req.headers['x-user-id'];

  const householdId = trimHeader(householdIdRaw);
  const userId = trimHeader(userIdRaw);

  const isProduction = process.env.NODE_ENV === 'production';

  if (householdId !== null && userId !== null) {
    (req as RequestWithIdentity).householdId = householdId;
    (req as RequestWithIdentity).userId = userId;
    next();
    return;
  }

  if (isProduction) {
    res.status(401).json({
      error: 'Missing identity. Send X-Household-Id and X-User-Id headers.',
    });
    return;
  }

  // DEV/TEST ONLY: bootstrap identity when headers are missing.
  // This branch cannot run in production (we 401 above when isProduction).
  // Do not use anonymous-user; use explicit bootstrap IDs for traceability.
  (req as RequestWithIdentity).householdId = DEV_BOOTSTRAP_HOUSEHOLD_ID;
  (req as RequestWithIdentity).userId = DEV_BOOTSTRAP_USER_ID;
  next();
}
