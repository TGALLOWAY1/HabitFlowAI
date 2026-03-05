/**
 * Identity Middleware
 *
 * Single source of truth for request identity: { householdId, userId }.
 * - Production: identity is derived ONLY from session (valid session cookie). Headers are ignored.
 * - Development: header identity (X-Household-Id, X-User-Id) allowed only when DEMO_MODE_ENABLED=true for local debugging; otherwise session required.
 */

import type { Request, Response, NextFunction } from 'express';

export const DEV_BOOTSTRAP_HOUSEHOLD_ID = 'default-household';
export const DEV_BOOTSTRAP_USER_ID = 'default-user';

export type RequestIdentity = {
  householdId: string;
  userId: string;
};

/** How identity was set: session (from cookie), demo_headers, or bootstrap (dev only). */
export type IdentitySource = 'session' | 'demo_headers' | 'bootstrap';

export interface RequestWithIdentity extends Request {
  householdId?: string;
  userId?: string;
  /** Set by identityMiddleware when using demo headers or bootstrap; omitted when identity came from session. */
  identitySource?: IdentitySource;
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
    throw new Error('Identity not set on request. Session required (or DEMO_MODE_ENABLED with headers in dev).');
  }
  return { householdId, userId };
}

function trimHeader(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE_ENABLED === 'true' || process.env.DEMO_MODE_ENABLED === '1';
}

/**
 * Middleware that sets req.householdId and req.userId.
 * - If session middleware already set them (from cookie), keep and next().
 * - Production: never use headers; 401 if no session-derived identity.
 * - Development with DEMO_MODE_ENABLED=true: use X-Household-Id / X-User-Id when both present; else bootstrap when both missing.
 * - Development without demo mode: 401 if no session-derived identity (same as production).
 */
export function identityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const r = req as RequestWithIdentity;
  if (r.householdId != null && r.userId != null) {
    next();
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    res.status(401).json({
      error: 'Session required. Log in to continue.',
    });
    return;
  }

  if (isDemoModeEnabled()) {
    const householdId = trimHeader(req.headers['x-household-id']);
    const userId = trimHeader(req.headers['x-user-id']);
    if (householdId !== null && userId !== null) {
      r.householdId = householdId;
      r.userId = userId;
      r.identitySource = 'demo_headers';
      next();
      return;
    }
    r.householdId = DEV_BOOTSTRAP_HOUSEHOLD_ID;
    r.userId = DEV_BOOTSTRAP_USER_ID;
    r.identitySource = 'bootstrap';
    next();
    return;
  }

  res.status(401).json({
    error: 'Session required. Log in to continue.',
  });
}
