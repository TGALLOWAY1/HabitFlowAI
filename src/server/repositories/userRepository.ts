/**
 * Auth users repository. Invite-only signup; users have householdId, email, passwordHash, role.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import type { AuthUser } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';

const COL = MONGO_COLLECTIONS.USERS;

export async function findUserByEmailAndHousehold(email: string, householdId: string): Promise<AuthUser | null> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const doc = await db.collection(COL).findOne(
    { email: normalized, householdId },
    { projection: { _id: 1, householdId: 1, email: 1, displayName: 1, passwordHash: 1, role: 1, createdAt: 1, lastLoginAt: 1 } }
  );
  if (!doc) return null;
  return doc as unknown as AuthUser;
}

/** Find user by email in any household (for login when household is unknown). */
export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const doc = await db.collection(COL).findOne(
    { email: normalized },
    { projection: { _id: 1, householdId: 1, email: 1, displayName: 1, passwordHash: 1, role: 1, createdAt: 1, lastLoginAt: 1 } }
  );
  if (!doc) return null;
  return doc as unknown as AuthUser;
}

export async function createUser(params: {
  householdId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'admin' | 'member';
}): Promise<AuthUser> {
  const db = await getDb();
  const userId = randomUUID();
  const now = new Date().toISOString();
  const doc = {
    _id: userId,
    householdId: params.householdId,
    email: params.email.trim().toLowerCase(),
    displayName: params.displayName.trim() || params.email.trim(),
    passwordHash: params.passwordHash,
    role: params.role,
    createdAt: now,
    lastLoginAt: now,
  };
  await db.collection(COL).insertOne(doc);
  return doc as unknown as AuthUser;
}

export async function updateLastLogin(userId: string): Promise<void> {
  const db = await getDb();
  await db.collection(COL).updateOne(
    { _id: userId },
    { $set: { lastLoginAt: new Date().toISOString() } }
  );
}

export async function findUserById(userId: string): Promise<AuthUser | null> {
  const db = await getDb();
  const doc = await db.collection(COL).findOne(
    { _id: userId },
    { projection: { _id: 1, householdId: 1, email: 1, displayName: 1, passwordHash: 1, role: 1, createdAt: 1, lastLoginAt: 1 } }
  );
  if (!doc) return null;
  return doc as unknown as AuthUser;
}

/** Count users (for bootstrap-admin: allow only when zero). */
export async function countUsers(): Promise<number> {
  const db = await getDb();
  return db.collection(COL).countDocuments();
}
