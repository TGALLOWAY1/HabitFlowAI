/**
 * Session middleware: loads identity from hf_session cookie when present.
 * Must run before identityMiddleware. Sets req.householdId, req.userId, req.authUser when session is valid.
 *
 * Uses an in-memory TTL cache (60s) to avoid 2 DB queries per request.
 */

import type { Request, Response, NextFunction } from 'express';
import type { RequestWithIdentity } from './identity';
import { hashSessionToken } from '../lib/authCrypto';
import { SESSION_COOKIE_NAME } from '../lib/sessionCookie';
import { findSessionByTokenHash } from '../repositories/sessionRepository';
import { findUserById } from '../repositories/userRepository';
import { TTLCache } from '../lib/cache';

export interface AuthUserInfo {
  email: string;
  displayName: string;
  role: 'admin' | 'member';
}

interface CachedSession {
  userId: string;
  householdId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
}

declare module './identity' {
  interface RequestWithIdentity {
    authUser?: AuthUserInfo;
  }
}

/** Session cache: 60s TTL, keyed by tokenHash. Exported for logout invalidation. */
export const sessionCache = new TTLCache<CachedSession>(60_000);

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const r = req as RequestWithIdentity;
  const raw = req.cookies?.[SESSION_COOKIE_NAME];
  if (!raw || typeof raw !== 'string') {
    next();
    return;
  }
  const tokenHash = hashSessionToken(raw);

  // Check cache first
  const cached = sessionCache.get(tokenHash);
  if (cached) {
    r.householdId = cached.householdId;
    r.userId = cached.userId;
    r.authUser = {
      email: cached.email,
      displayName: cached.displayName,
      role: cached.role,
    };
    next();
    return;
  }

  // Cache miss — query DB
  const session = await findSessionByTokenHash(tokenHash);
  if (!session) {
    next();
    return;
  }
  const user = await findUserById(session.userId);
  if (!user) {
    next();
    return;
  }

  // Populate cache
  sessionCache.set(tokenHash, {
    userId: session.userId,
    householdId: session.householdId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });

  r.householdId = session.householdId;
  r.userId = session.userId;
  r.authUser = {
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  next();
}
