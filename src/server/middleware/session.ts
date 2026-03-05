/**
 * Session middleware: loads identity from hf_session cookie when present.
 * Must run before identityMiddleware. Sets req.householdId, req.userId, req.authUser when session is valid.
 */

import type { Request, Response, NextFunction } from 'express';
import type { RequestWithIdentity } from './identity';
import { hashSessionToken } from '../lib/authCrypto';
import { SESSION_COOKIE_NAME } from '../lib/sessionCookie';
import { findSessionByTokenHash } from '../repositories/sessionRepository';
import { findUserById } from '../repositories/userRepository';

export interface AuthUserInfo {
  email: string;
  displayName: string;
  role: 'admin' | 'member';
}

declare module './identity' {
  interface RequestWithIdentity {
    authUser?: AuthUserInfo;
  }
}

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const r = req as RequestWithIdentity;
  const raw = req.cookies?.[SESSION_COOKIE_NAME];
  if (!raw || typeof raw !== 'string') {
    next();
    return;
  }
  const tokenHash = hashSessionToken(raw);
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
  r.householdId = session.householdId;
  r.userId = session.userId;
  r.authUser = {
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
  next();
}
