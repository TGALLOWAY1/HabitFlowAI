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
 * Returns the token row only when it is still active: not used, not expired.
 */
export async function findActivePasswordResetToken(tokenHash: string): Promise<PasswordResetToken | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const doc = await db.collection(COL).findOne({
    tokenHash,
    expiresAt: { $gt: now },
    usedAt: { $exists: false },
  });
  if (!doc) return null;
  return doc as unknown as PasswordResetToken;
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  const db = await getDb();
  await db.collection(COL).updateOne(
    { _id: id } as any,
    { $set: { usedAt: new Date().toISOString() } },
  );
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
