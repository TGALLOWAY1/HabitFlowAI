/**
 * Password reset token repository.
 *
 * Tokens are emailed to users in raw form; we store only the SHA-256 hash.
 * Tokens are single-use (`usedAt` set on consumption) and time-boxed via
 * `expiresAt`. A TTL index on `expiresAt` cleans up expired rows.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import type { PasswordResetToken } from '../../models/persistenceTypes';

const COL = MONGO_COLLECTIONS.PASSWORD_RESET_TOKENS;

export async function createPasswordResetToken(params: {
  userId: string;
  householdId: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<PasswordResetToken> {
  const db = await getDb();
  const doc: PasswordResetToken = {
    _id: randomUUID(),
    userId: params.userId,
    householdId: params.householdId,
    tokenHash: params.tokenHash,
    createdAt: new Date().toISOString(),
    expiresAt: params.expiresAt,
  };
  await db.collection(COL).insertOne(doc as any);
  return doc;
}

/**
 * Atomically claim a reset token: sets `usedAt` on the matching active row in
 * a single round-trip and returns the pre-update document, or `null` if no
 * active token matches (expired, already used, or unknown). Use this in the
 * reset-password handler so concurrent requests with the same raw token can't
 * both succeed.
 */
export async function claimPasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection(COL).findOneAndUpdate(
    {
      tokenHash,
      expiresAt: { $gt: now },
      usedAt: { $exists: false },
    },
    { $set: { usedAt: now } },
    { returnDocument: 'before' },
  );
  if (!result) return null;
  return result as unknown as PasswordResetToken;
}

/**
 * Invalidate any pending (unused, unexpired) tokens for a user. Called when a
 * fresh reset is requested so only the latest link works.
 */
export async function deleteActiveTokensForUser(userId: string): Promise<number> {
  const db = await getDb();
  const result = await db.collection(COL).deleteMany({
    userId,
    usedAt: { $exists: false },
  });
  return result.deletedCount;
}
