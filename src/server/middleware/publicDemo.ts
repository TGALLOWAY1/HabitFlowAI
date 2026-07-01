/**
 * Public Demo Mode middleware (production-safe, read-only).
 *
 * Lets unauthenticated visitors browse the seeded demo dataset through the
 * real API without a session. Guardrails:
 * - Only active when PUBLIC_DEMO_ENABLED === "true" (off by default).
 * - Only opts in when the client sends `X-Demo-Mode: true`; the header is a
 *   boolean opt-in — it can never select an arbitrary user or household.
 * - Never overrides a session-derived identity.
 * - Requests with the public demo identity are read-only: every method except
 *   GET/HEAD/OPTIONS is rejected with 403 { demoReadOnly: true }. The dev-only
 *   demo paths (DEMO_MODE_ENABLED header identity) are unaffected.
 */

import type { Request, Response, NextFunction } from 'express';
import type { RequestWithIdentity } from './identity';
import { DEMO_USER_ID, isPublicDemoEnabled } from '../config/demo';
import { PUBLIC_DEMO_HOUSEHOLD_ID, PUBLIC_DEMO_HEADER } from '../../shared/demo';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hasPublicDemoHeader(req: Request): boolean {
  const raw = req.headers[PUBLIC_DEMO_HEADER.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

/**
 * Maps opted-in, sessionless requests to the fixed public demo identity.
 * Must run after sessionMiddleware and before identityMiddleware.
 */
export function publicDemoIdentity(req: Request, _res: Response, next: NextFunction): void {
  const r = req as RequestWithIdentity;

  if (!isPublicDemoEnabled() || !hasPublicDemoHeader(req)) {
    next();
    return;
  }

  // A real session always wins — demo header is ignored for logged-in users.
  if (r.householdId != null && r.userId != null) {
    next();
    return;
  }

  r.householdId = PUBLIC_DEMO_HOUSEHOLD_ID;
  r.userId = DEMO_USER_ID;
  r.identitySource = 'public_demo';
  next();
}

/**
 * Rejects mutating methods for the public demo identity.
 * Must run after identityMiddleware.
 */
export function publicDemoReadOnlyGuard(req: Request, res: Response, next: NextFunction): void {
  const r = req as RequestWithIdentity;

  if (r.identitySource !== 'public_demo' || READ_METHODS.has(req.method)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'Demo mode is read-only. Create an account to make changes.',
    demoReadOnly: true,
  });
}
