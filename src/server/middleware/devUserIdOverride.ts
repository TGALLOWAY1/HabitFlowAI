/**
 * Dev-only Demo User ID Override
 *
 * Guardrails:
 * - Never runs in production
 * - Only active when DEMO_MODE_ENABLED === "true"
 * - Only overrides when header x-user-id === DEMO_USER_ID
 * - Never allows arbitrary spoofing
 */

import type { Request, Response, NextFunction } from 'express';
import { DEMO_USER_ID, isDemoModeEnabled } from '../config/demo';

export function devUserIdOverride(req: Request, _res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === 'production') {
    next();
    return;
  }

  if (!isDemoModeEnabled()) {
    next();
    return;
  }

  const header = req.headers['x-user-id'];
  if (header && typeof header === 'string' && header.trim() === DEMO_USER_ID) {
    (req as any).userId = DEMO_USER_ID;
  }

  next();
}


