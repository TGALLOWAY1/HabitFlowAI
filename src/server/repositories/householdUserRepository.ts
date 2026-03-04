/**
 * Household user registry repository.
 * Lightweight list of users per household for Switch User UI; no auth/passwords.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type HouseholdUser } from '../../models/persistenceTypes';

const COLLECTION = MONGO_COLLECTIONS.HOUSEHOLD_USERS;

export async function getUsersByHousehold(householdId: string): Promise<HouseholdUser[]> {
  if (!householdId || householdId.trim() === '') {
    return [];
  }
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const docs = await col
    .find({ householdId: householdId.trim() })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map((d: any) => {
    const { _id, ...rest } = d;
    return rest as HouseholdUser;
  });
}

export async function createHouseholdUser(
  householdId: string,
  options: { userId?: string; displayName?: string } = {}
): Promise<HouseholdUser> {
  const hId = householdId.trim();
  if (!hId) {
    throw new Error('householdId is required');
  }
  const userId = options.userId?.trim() || randomUUID();
  const displayName = options.displayName?.trim() || undefined;
  const createdAt = new Date().toISOString();

  const db = await getDb();
  const col = db.collection(COLLECTION);

  const doc: HouseholdUser & { _id?: unknown } = {
    householdId: hId,
    userId,
    createdAt,
  };
  if (displayName) doc.displayName = displayName;

  await col.insertOne(doc as any);
  const { _id, ...rest } = doc;
  return rest as HouseholdUser;
}
