/**
 * Authentication Middleware (DEPRECATED)
 *
 * Do not use in production. The app uses identityMiddleware (identity.ts) which
 * requires X-Household-Id and X-User-Id and returns 401 when missing.
 *
 * This file previously defaulted to 'anonymous-user'; that pattern is removed.
 * If this middleware is ever mounted, production must not default to anonymous.
 */

import type { Request, Response, NextFunction } from 'express';
import { DEMO_USER_ID, isDemoModeEnabled } from '../config/demo';

/**
 * @deprecated Use identityMiddleware from identity.ts instead.
 * Middleware to extract userId from headers. In production, never defaults to anonymous.
 */
export function userIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const userIdHeader = req.headers['x-user-id'];

  if (userIdHeader && typeof userIdHeader === 'string' && userIdHeader.trim().length > 0) {
    const trimmed = userIdHeader.trim();
    if (trimmed === DEMO_USER_ID) {
      if (process.env.NODE_ENV !== 'production' && isDemoModeEnabled()) {
        (req as any).userId = trimmed;
      } else {
        (req as any).userId = trimmed;
      }
    } else {
      (req as any).userId = trimmed;
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      (req as any).userId = undefined;
    } else {
      (req as any).userId = 'anonymous-user';
    }
  }

  next();
}
