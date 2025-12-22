/**
 * Authentication Middleware
 * 
 * Extracts user identity from request headers.
 * Currently implements "Sticky Anonymous User" pattern via X-User-Id header.
 */

import type { Request, Response, NextFunction } from 'express';
import { DEMO_USER_ID, isDemoModeEnabled } from '../config/demo';

/**
 * Middleware to extract userId from headers.
 * 
 * 1. Checks for X-User-Id header (sent by frontend).
 * 2. Fallbacks to 'anonymous-user' only if header is missing.
 * 3. Attaches userId to request object for route handlers.
 */
export function userIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const userIdHeader = req.headers['x-user-id'];

    // Validate and sanitize the user ID
    if (userIdHeader && typeof userIdHeader === 'string' && userIdHeader.trim().length > 0) {
        const trimmed = userIdHeader.trim();
        // Safety: demo userId is only honored in dev AND only when DEMO_MODE_ENABLED=true.
        // In all other cases, demo identity must not be set via headers.
        if (trimmed === DEMO_USER_ID) {
            if (process.env.NODE_ENV !== 'production' && isDemoModeEnabled()) {
                (req as any).userId = trimmed;
            } else {
                (req as any).userId = 'anonymous-user';
            }
        } else {
            (req as any).userId = trimmed;
        }
        // Optional: Log new sessions (verbose, maybe only for debug)
        // console.log(`[Auth] Request from user: ${(req as any).userId}`);
    } else {
        // Fallback for legacy/direct API calls without header
        // Warning: This causes the "volatile identity" issue if frontend forgets header
        (req as any).userId = 'anonymous-user';
        // console.warn('[Auth] Request missing X-User-Id header, defaulting to anonymous-user');
    }

    next();
}
