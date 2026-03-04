/**
 * Goal Repository
 *
 * MongoDB data access layer for Goal entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type Goal } from '../../models/persistenceTypes';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION_NAME = MONGO_COLLECTIONS.GOALS;

function stripScope(doc: any): Goal {
  const { _id, userId: _, householdId: __, ...goal } = doc;
  return goal as Goal;
}

export async function createGoal(
  data: Omit<Goal, 'id' | 'createdAt'>,
  householdId: string,
  userId: string
): Promise<Goal> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const document = {
    id,
    ...data,
    createdAt,
    householdId: scope.householdId,
    userId: scope.userId,
  } as any;

  await collection.insertOne(document);
  return stripScope(document);
}

export async function getGoalsByUser(householdId: string, userId: string): Promise<Goal[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId))
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getCompletedGoalsByUser(householdId: string, userId: string): Promise<Goal[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(
      scopeFilter(householdId, userId, {
        completedAt: { $exists: true, $ne: null },
      })
    )
    .sort({ completedAt: -1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getGoalById(
  id: string,
  householdId: string,
  userId: string
): Promise<Goal | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne(scopeFilter(householdId, userId, { id }));
  if (!document) return null;

  return stripScope(document);
}

export async function updateGoal(
  id: string,
  householdId: string,
  userId: string,
  patch: Partial<Omit<Goal, 'id' | 'createdAt'>>
): Promise<Goal | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: patch },
    { returnDocument: 'after' }
  );

  if (!result) return null;
  return stripScope(result);
}

export async function deleteGoal(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne(scopeFilter(householdId, userId, { id }));
  return result.deletedCount > 0;
}

export async function reorderGoals(
  householdId: string,
  userId: string,
  goalIds: string[]
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const operations = goalIds.map((id, index) => ({
    updateOne: {
      filter: scopeFilter(householdId, userId, { id }),
      update: { $set: { sortOrder: index } },
    },
  }));

  if (operations.length === 0) return true;

  try {
    await collection.bulkWrite(operations);
    return true;
  } catch (error) {
    console.error('Failed to reorder goals:', error);
    return false;
  }
}

export function validateHabitIds(habitIds: any[]): boolean {
  if (!Array.isArray(habitIds)) return false;
  return habitIds.every(id => typeof id === 'string' && id.trim().length > 0);
}
