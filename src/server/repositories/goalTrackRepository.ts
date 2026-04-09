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

  const now = new Date().toISOString();
  const document = {
    id: randomUUID(),
    ...data,
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
    .sort({ createdAt: 1 })
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
    .sort({ createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}
