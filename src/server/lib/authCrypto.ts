/**
 * Auth crypto: invite code hashing and constant-time comparison.
 * Session tokens are hashed with SHA-256 before storage; comparison is constant-time.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const INVITE_HASH_ALG = 'sha256';
const SESSION_TOKEN_BYTES = 32;

/**
 * Hash an invite code for storage. Never store raw codes.
 */
export function hashInviteCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  return createHash(INVITE_HASH_ALG).update(normalized, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of invite code with stored hash.
 */
export function verifyInviteCode(code: string, storedHash: string): boolean {
  const computed = hashInviteCode(code);
  if (computed.length !== storedHash.length) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Hash a session token for storage in DB. Cookie holds raw token.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Generate a new cryptographically secure session token (raw, for cookie).
 */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

/** Alphanumeric chars for invite codes (no ambiguous 0/O, 1/l). */
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 12;

/**
 * Generate a random invite code (for admin create). Returned only once to caller.
 */
export function generateInviteCode(): string {
  let s = '';
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    s += INVITE_CODE_CHARS[bytes[i]! % INVITE_CODE_CHARS.length];
  }
  return s;
}
