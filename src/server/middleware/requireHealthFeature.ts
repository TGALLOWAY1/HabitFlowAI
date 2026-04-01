/**
 * Feature gate for Apple Health integration.
 * Restricts access to health-related endpoints to allowed users only.
 */

import type { Request, Response, NextFunction } from 'express';
import type { RequestWithIdentity } from './identity';

const HEALTH_FEATURE_ALLOWED_EMAILS = ['tj.galloway1@gmail.com'];

export function requireHealthFeature(req: Request, res: Response, next: NextFunction): void {
  const r = req as RequestWithIdentity;
  const email = r.authUser?.email?.toLowerCase();
  if (!email || !HEALTH_FEATURE_ALLOWED_EMAILS.includes(email)) {
    res.status(403).json({ error: 'Apple Health integration is not available for your account.' });
    return;
  }
  next();
}
