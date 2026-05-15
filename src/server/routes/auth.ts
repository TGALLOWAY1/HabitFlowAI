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
  updatePasswordHash,
  countUsers,
} from '../repositories/userRepository';
import { findInviteByCodeHash, incrementInviteUses } from '../repositories/inviteRepository';
import {
  createSession,
  createSessionToken,
  deleteSessionByTokenHash,
  deleteSessionsByUserId,
} from '../repositories/sessionRepository';
import {
  claimPasswordResetToken,
  createPasswordResetToken,
  deleteActiveTokensForUser,
} from '../repositories/passwordResetTokenRepository';
import { generateSessionToken, hashInviteCode, hashSessionToken } from '../lib/authCrypto';
import { sendPasswordResetEmail } from '../lib/email';
import { sessionCache } from '../middleware/session';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

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

function getAppBaseUrl(req: Request): string {
  const fromEnv = process.env.APP_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.replace(/\/$/, '');
  // Fall back to the request's own origin so local dev still produces a usable link.
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
  const host = req.get('host') ?? 'localhost';
  return `${proto}://${host}`;
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always responds 200 to avoid leaking which emails are registered.
 * If the email matches a user, generates a single-use reset token, stores
 * its hash, and emails the user a link valid for 15 minutes.
 */
export async function postForgotPassword(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const emailCheck = validateEmail(body.email);
  if (!emailCheck.valid) {
    res.status(400).json({ error: emailCheck.error });
    return;
  }

  const normalizedEmail = String(body.email).trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (user) {
    // Invalidate any prior pending tokens — only the freshest link works.
    await deleteActiveTokensForUser(user._id);

    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS).toISOString();
    await createPasswordResetToken({
      userId: user._id,
      householdId: user.householdId,
      tokenHash,
      expiresAt,
    });

    const baseUrl = getAppBaseUrl(req);
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  res.status(200).json({ ok: true });
}

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 *
 * Validates a reset token, updates the user's password, marks the token used
 * (single-use), and invalidates all existing sessions for that user so any
 * already-open sessions are forced to re-authenticate.
 */
export async function postResetPassword(req: Request, res: Response): Promise<void> {
  const body = req.body ?? {};
  const token = body.token;
  const newPassword = body.newPassword;

  if (token == null || typeof token !== 'string' || token.trim().length === 0) {
    res.status(400).json({ error: 'Reset token is required.' });
    return;
  }
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    res.status(400).json({ error: passwordCheck.error });
    return;
  }

  const tokenHash = hashSessionToken(String(token));
  // Atomic claim: prevents concurrent reset-password requests from both
  // succeeding with the same raw token. If the claim fails the token has
  // already been used, has expired, or never existed.
  const record = await claimPasswordResetToken(tokenHash);
  if (!record) {
    res.status(400).json({ error: 'Invalid or expired reset token.' });
    return;
  }

  const passwordHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
  await updatePasswordHash(record.userId, passwordHash);
  await deleteSessionsByUserId(record.userId);

  res.status(200).json({ ok: true });
}
