/**
 * Authentication Middleware
 * 
 * Extracts user identity from request headers.
 * Currently implements "Sticky Anonymous User" pattern via X-User-Id header.
 */

import type { Request, Response, NextFunction } from 'express';

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
        (req as any).userId = userIdHeader.trim();
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
