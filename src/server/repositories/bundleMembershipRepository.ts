/**
 * BundleMembership Repository
 *
 * MongoDB data access layer for temporal bundle membership records.
 * All queries are scoped by householdId + userId.
 */

import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import { randomUUID } from 'crypto';
import type { BundleMembershipRecord } from '../domain/canonicalTypes';

const COLLECTION_NAME = 'bundleMemberships';

function mapDoc(doc: any): BundleMembershipRecord {
  const { _id, userId: _, householdId: __, ...record } = doc;
  return record as BundleMembershipRecord;
}

/**
 * Create a new bundle membership.
 */
export async function createMembership(
  parentHabitId: string,
  childHabitId: string,
  activeFromDayKey: string,
  householdId: string,
  userId: string,
  activeToDayKey?: string | null
): Promise<BundleMembershipRecord> {
  requireScope(householdId, userId);
  const db = getDb();
  const now = new Date().toISOString();
  const record: BundleMembershipRecord = {
    id: randomUUID(),
    parentHabitId,
    childHabitId,
    activeFromDayKey,
    activeToDayKey: activeToDayKey ?? null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).insertOne({
    ...record,
    householdId,
    userId,
  });

  return record;
}

/**
 * End a membership by setting activeToDayKey.
 */
export async function endMembership(
  parentHabitId: string,
  childHabitId: string,
  endDayKey: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION_NAME).updateOne(
    scopeFilter(householdId, userId, {
      parentHabitId,
      childHabitId,
      activeToDayKey: null,
    }),
    { $set: { activeToDayKey: endDayKey, updatedAt: new Date().toISOString() } }
  );
  return result.modifiedCount > 0;
}

/**
 * Archive a membership (UX hint to hide from active lists).
 */
export async function archiveMembership(
  membershipId: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION_NAME).updateOne(
    scopeFilter(householdId, userId, { id: membershipId }),
    { $set: { archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }
  );
  return result.modifiedCount > 0;
}

/**
 * Get a single membership by ID.
 */
export async function getMembershipById(
  membershipId: string,
  householdId: string,
  userId: string
): Promise<BundleMembershipRecord | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION_NAME).findOne(
    scopeFilter(householdId, userId, { id: membershipId })
  );
  return doc ? mapDoc(doc) : null;
}

/**
 * Get active memberships for a parent (activeToDayKey is null).
 */
export async function getActiveMemberships(
  parentHabitId: string,
  householdId: string,
  userId: string
): Promise<BundleMembershipRecord[]> {
  const db = getDb();
  const docs = await db.collection(COLLECTION_NAME)
    .find(scopeFilter(householdId, userId, { parentHabitId, activeToDayKey: null }))
    .sort({ activeFromDayKey: 1 })
    .toArray();
  return docs.map(mapDoc);
}

/**
 * Get memberships active on a specific dayKey.
 * A membership is active on dayKey if:
 *   activeFromDayKey <= dayKey AND (activeToDayKey IS NULL OR activeToDayKey >= dayKey)
 */
export async function getMembershipsForDay(
  parentHabitId: string,
  dayKey: string,
  householdId: string,
  userId: string
): Promise<BundleMembershipRecord[]> {
  const db = getDb();
  const docs = await db.collection(COLLECTION_NAME)
    .find(scopeFilter(householdId, userId, {
      parentHabitId,
      activeFromDayKey: { $lte: dayKey },
      $or: [
        { activeToDayKey: null },
        { activeToDayKey: { $gte: dayKey } },
      ],
    }))
    .sort({ activeFromDayKey: 1 })
    .toArray();
  return docs.map(mapDoc);
}

/**
 * Get all memberships for a parent (for analytics/history).
 */
export async function getMembershipsByParent(
  parentHabitId: string,
  householdId: string,
  userId: string
): Promise<BundleMembershipRecord[]> {
  const db = getDb();
  const docs = await db.collection(COLLECTION_NAME)
    .find(scopeFilter(householdId, userId, { parentHabitId }))
    .sort({ activeFromDayKey: 1 })
    .toArray();
  return docs.map(mapDoc);
}

/**
 * Get all memberships for a child habit (find parent(s)).
 */
export async function getMembershipsByChild(
  childHabitId: string,
  householdId: string,
  userId: string
): Promise<BundleMembershipRecord[]> {
  const db = getDb();
  const docs = await db.collection(COLLECTION_NAME)
    .find(scopeFilter(householdId, userId, { childHabitId }))
    .sort({ activeFromDayKey: 1 })
    .toArray();
  return docs.map(mapDoc);
}

/**
 * Hard delete a membership. Only allowed for zero-entry children (enforced at service layer).
 */
export async function deleteMembership(
  membershipId: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION_NAME).deleteOne(
    scopeFilter(householdId, userId, { id: membershipId })
  );
  return result.deletedCount > 0;
}

/**
 * Check if a duplicate active membership exists (same parent + child, no end date).
 */
export async function hasActiveMembership(
  parentHabitId: string,
  childHabitId: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const doc = await db.collection(COLLECTION_NAME).findOne(
    scopeFilter(householdId, userId, {
      parentHabitId,
      childHabitId,
      activeToDayKey: null,
    })
  );
  return doc !== null;
}

/**
 * Ensure indexes for the bundleMemberships collection.
 * Call during app startup.
 */
export async function ensureBundleMembershipIndexes(): Promise<void> {
  const db = getDb();
  const collection = db.collection(COLLECTION_NAME);
  await Promise.all([
    collection.createIndex({ householdId: 1, userId: 1, parentHabitId: 1, activeFromDayKey: 1 }),
    collection.createIndex({ householdId: 1, userId: 1, childHabitId: 1 }),
    collection.createIndex({ householdId: 1, userId: 1, parentHabitId: 1, activeToDayKey: 1 }),
  ]);
}
