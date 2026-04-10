/**
 * Goal Track Repository
 *
 * MongoDB data access layer for GoalTrack entities.
 * All queries are scoped by householdId + userId.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type GoalTrack } from '../../models/persistenceTypes';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION_NAME = MONGO_COLLECTIONS.GOAL_TRACKS;

function stripScope(doc: any): GoalTrack {
  const { _id, userId: _, householdId: __, ...track } = doc;
  return track as GoalTrack;
}

export async function createGoalTrack(
  data: Omit<GoalTrack, 'id' | 'createdAt' | 'updatedAt'>,
  householdId: string,
  userId: string
): Promise<GoalTrack> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // If sortOrder was not provided, append the new track to the end of its
  // category by using (max existing sortOrder in that category) + 1.
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const existing = await collection
      .find(scopeFilter(householdId, userId, { categoryId: data.categoryId }))
      .toArray();
    const maxOrder = existing.reduce((max, doc: any) => {
      const o = typeof doc.sortOrder === 'number' ? doc.sortOrder : -1;
      return o > max ? o : max;
    }, -1);
    sortOrder = maxOrder + 1;
  }

  const now = new Date().toISOString();
  const document = {
    id: randomUUID(),
    ...data,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    householdId: scope.householdId,
    userId: scope.userId,
  } as any;

  await collection.insertOne(document);
  return stripScope(document);
}

export async function getGoalTracksByUser(
  householdId: string,
  userId: string
): Promise<GoalTrack[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId))
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getGoalTrackById(
  id: string,
  householdId: string,
  userId: string
): Promise<GoalTrack | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne(scopeFilter(householdId, userId, { id }));
  if (!document) return null;

  return stripScope(document);
}

export async function updateGoalTrack(
  id: string,
  householdId: string,
  userId: string,
  patch: Partial<Omit<GoalTrack, 'id' | 'createdAt'>>
): Promise<GoalTrack | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripScope(result);
}

export async function deleteGoalTrack(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne(scopeFilter(householdId, userId, { id }));
  return result.deletedCount > 0;
}

export async function getGoalTracksByCategory(
  categoryId: string,
  householdId: string,
  userId: string
): Promise<GoalTrack[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId, { categoryId }))
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

/**
 * Reorder goal tracks by assigning each provided track a new sortOrder equal
 * to its position in the list. Tracks can span multiple categories — the
 * caller is responsible for passing a complete ordering.
 */
export async function reorderGoalTracks(
  householdId: string,
  userId: string,
  trackIds: string[]
): Promise<boolean> {
  if (trackIds.length === 0) return true;

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);
  const now = new Date().toISOString();

  const operations = trackIds.map((id, index) => ({
    updateOne: {
      filter: scopeFilter(householdId, userId, { id }),
      update: { $set: { sortOrder: index, updatedAt: now } },
    },
  }));

  try {
    await collection.bulkWrite(operations);
    return true;
  } catch (error) {
    console.error('Failed to reorder goal tracks:', error);
    return false;
  }
}
