/**
 * Sessions repository. Token is stored hashed; cookie holds raw token.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import type { Session } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { hashSessionToken, generateSessionToken } from '../lib/authCrypto';

const COL = MONGO_COLLECTIONS.SESSIONS;

export function createSessionToken(): { raw: string; hash: string } {
  const raw = generateSessionToken();
  return { raw, hash: hashSessionToken(raw) };
}

export async function createSession(params: {
  householdId: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}): Promise<Session> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const doc = {
    _id: id,
    householdId: params.householdId,
    userId: params.userId,
    tokenHash: params.tokenHash,
    createdAt: now,
    expiresAt: params.expiresAt,
    ip: params.ip,
    userAgent: params.userAgent,
  };
  await db.collection(COL).insertOne(doc as any);
  return doc as unknown as Session;
}

export async function findSessionByTokenHash(tokenHash: string): Promise<Session | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const doc = await db.collection(COL).findOne({
    tokenHash,
    expiresAt: { $gt: now },
  });
  if (!doc) return null;
  return doc as unknown as Session;
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.collection(COL).deleteOne({ tokenHash });
  return result.deletedCount > 0;
}

export async function deleteSessionsByUserId(userId: string): Promise<number> {
  const db = await getDb();
  const result = await db.collection(COL).deleteMany({ userId });
  return result.deletedCount;
}
