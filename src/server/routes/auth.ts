/**
 * Auth routes: invite redeem, login, logout, session me.
 */

import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import type { RequestWithIdentity } from '../middleware/identity';
import bcrypt from 'bcrypt';
import { validateEmail, validatePassword, validateDisplayName, validateInviteCode } from '../lib/authValidation';
import { setSessionCookie, clearSessionCookie, SESSION_MAX_AGE_MS } from '../lib/sessionCookie';
import {
  createUser,
  findUserByEmailAndHousehold,
  findUserByEmail,
  updateLastLogin,
  countUsers,
} from '../repositories/userRepository';
import { findInviteByCodeHash, incrementInviteUses } from '../repositories/inviteRepository';
import {
  createSession,
  createSessionToken,
  deleteSessionByTokenHash,
} from '../repositories/sessionRepository';
import { hashInviteCode, hashSessionToken } from '../lib/authCrypto';
import { sessionCache } from '../middleware/session';

const SALT_ROUNDS = 12;

/**
 * GET /api/auth/me
 * Returns authenticated user identity { householdId, userId, email?, displayName?, role? }.
 * When authenticated via session, includes email/displayName/role.
 */
export function getAuthMe(req: Request, res: Response): void {
  const r = req as RequestWithIdentity;
  const householdId = r.householdId;
  const userId = r.userId;

  if (householdId == null || userId == null) {
    res.status(401).json({
      error: 'Session required. Log in to continue.',
    });
    return;
  }

  if (r.authUser) {
    res.json({
      householdId,
      userId,
      email: r.authUser.email,
      displayName: r.authUser.displayName,
      role: r.authUser.role,
    });
    return;
  }

  res.json({ householdId, userId });
}

/**
 * POST /api/auth/invite/redeem
 * Body: { inviteCode, email, password, displayName }
 * Creates user and session if invite valid; sets session cookie.
 */
export async function postInviteRedeem(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const inviteCode = body.inviteCode;
  const email = body.email;
  const password = body.password;
  const displayName = body.displayName;

  const codeCheck = validateInviteCode(inviteCode);
  if (!codeCheck.valid) {
    res.status(400).json({ error: codeCheck.error });
    return;
  }
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    res.status(400).json({ error: emailCheck.error });
    return;
  }
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    res.status(400).json({ error: passwordCheck.error });
    return;
  }
  const nameCheck = validateDisplayName(displayName);
  if (!nameCheck.valid) {
    res.status(400).json({ error: nameCheck.error });
    return;
  }

  const codeHash = hashInviteCode(String(inviteCode).trim());
  const invite = await findInviteByCodeHash(codeHash);
  if (!invite) {
    res.status(400).json({ error: 'Invalid or expired invite code.' });
    return;
  }
  if (invite.revokedAt) {
    res.status(400).json({ error: 'This invite has been revoked.' });
    return;
  }
  const now = new Date().toISOString();
  if (invite.expiresAt < now) {
    res.status(400).json({ error: 'This invite has expired.' });
    return;
  }
  if (invite.uses >= invite.maxUses) {
    res.status(400).json({ error: 'This invite has reached its maximum uses.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await findUserByEmailAndHousehold(normalizedEmail, invite.householdId);
  if (existing) {
    res.status(400).json({ error: 'A user with this email already exists in this household.' });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
  const user = await createUser({
    householdId: invite.householdId,
    email: normalizedEmail,
    displayName: displayName != null ? String(displayName).trim() || normalizedEmail : normalizedEmail,
    passwordHash,
    role: invite.role,
  });

  await incrementInviteUses(invite._id);

  const { raw: token, hash: tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  await createSession({
    householdId: invite.householdId,
    userId: user._id,
    tokenHash,
    expiresAt,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  setSessionCookie(res, token);
  res.status(201).json({
    user: {
      householdId: user.householdId,
      userId: user._id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Creates session and sets cookie.
 */
export async function postLogin(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const email = body.email;
  const password = body.password;

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    res.status(400).json({ error: emailCheck.error });
    return;
  }
  if (password == null || typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required.' });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  await updateLastLogin(user._id);

  const { raw: token, hash: tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString();
  await createSession({
    householdId: user.householdId,
    userId: user._id,
    tokenHash,
    expiresAt,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  setSessionCookie(res, token);
  res.status(200).json({
    user: {
      householdId: user.householdId,
      userId: user._id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
}

/**
 * POST /api/auth/logout
 * Clears session cookie and invalidates server-side session when cookie present.
 */
export async function postLogout(req: Request, res: Response): Promise<void> {
  const raw = req.cookies?.['hf_session'];
  if (raw && typeof raw === 'string') {
    const tokenHash = hashSessionToken(raw);
    sessionCache.invalidate(tokenHash);
    await deleteSessionByTokenHash(tokenHash);
  }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

/**
 * POST /api/auth/bootstrap-admin
 * One-time admin creation for private beta. Requires BOOTSTRAP_ADMIN_KEY.
 * Allowed when: (no users exist and key matches) OR (non-production and key matches).
 * Body: { bootstrapKey, householdId?, email, password, displayName? }
 */
export async function postBootstrapAdmin(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const key = body.bootstrapKey ?? req.headers['x-bootstrap-key'];
  const envKey = process.env.BOOTSTRAP_ADMIN_KEY;
  if (!envKey || key !== envKey) {
    res.status(403).json({ error: 'Invalid or missing bootstrap key.' });
    return;
  }

  const userCount = await countUsers();
  const isFirstRun = userCount === 0;
  const isNonProd = process.env.NODE_ENV !== 'production';
  if (!isFirstRun && !isNonProd) {
    res.status(403).json({ error: 'Bootstrap only allowed when no users exist or in non-production.' });
    return;
  }

  const emailCheck = validateEmail(body.email);
  if (!emailCheck.valid) {
    res.status(400).json({ error: emailCheck.error });
    return;
  }
  const passwordCheck = validatePassword(body.password);
  if (!passwordCheck.valid) {
    res.status(400).json({ error: passwordCheck.error });
    return;
  }

  const householdId = body.householdId != null ? String(body.householdId).trim() : randomUUID();
  const normalizedEmail = String(body.email).trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    res.status(400).json({ error: 'A user with this email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(String(body.password), SALT_ROUNDS);
  const user = await createUser({
    householdId,
    email: normalizedEmail,
    displayName: body.displayName != null ? String(body.displayName).trim() || normalizedEmail : normalizedEmail,
    passwordHash,
    role: 'admin',
    ...(body.userId ? { userId: String(body.userId).trim() } : {}),
  });

  res.status(201).json({
    user: {
      householdId: user.householdId,
      userId: user._id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
