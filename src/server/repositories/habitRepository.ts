/**
 * Habit Repository
 *
 * MongoDB data access layer for Habit entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import type { Habit } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'habits';

function stripScope(doc: any): Habit {
  const { _id, userId: _, householdId: __, ...habit } = doc;
  return habit as Habit;
}

export async function createHabit(
  data: Omit<Habit, 'id' | 'createdAt' | 'archived'>,
  householdId: string,
  userId: string
): Promise<Habit> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Atomic upsert: prevents TOCTOU race where concurrent requests both
  // pass a findOne check and then both insert, creating duplicates.
  // $setOnInsert only applies fields when a new document is created.
  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { name: data.name, categoryId: data.categoryId }),
    {
      $setOnInsert: {
        id,
        ...data,
        archived: false,
        createdAt,
        householdId: scope.householdId,
        userId: scope.userId,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) {
    throw new Error(`Failed to create or find habit '${data.name}'`);
  }

  // Log only if we actually created a new document (id matches what we generated)
  if ((result as any).id === id) {
    console.log(`[Persistence] Created habit '${data.name}' (ID: ${id}) for User: ${userId}`);
  }

  return stripScope(result);
}

export async function getHabitsByUser(householdId: string, userId: string): Promise<Habit[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId))
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getHabitsByCategory(
  categoryId: string,
  householdId: string,
  userId: string
): Promise<Habit[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId, { categoryId }))
    .sort({ order: 1, createdAt: 1 })
    .toArray();

  return documents.map(stripScope);
}

export async function getHabitById(
  id: string,
  householdId: string,
  userId: string
): Promise<Habit | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne(scopeFilter(householdId, userId, { id }));
  if (!document) return null;

  return stripScope(document);
}

export async function updateHabit(
  id: string,
  householdId: string,
  userId: string,
  patch: Partial<Omit<Habit, 'id' | 'createdAt'>>
): Promise<Habit | null> {
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

export async function deleteHabit(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne(scopeFilter(householdId, userId, { id }));
  return result.deletedCount > 0;
}

export async function reorderHabits(
  householdId: string,
  userId: string,
  habitIds: string[]
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const operations = habitIds.map((id, index) => ({
    updateOne: {
      filter: scopeFilter(householdId, userId, { id }),
      update: { $set: { order: index } },
    },
  }));

  if (operations.length === 0) return true;

  try {
    await collection.bulkWrite(operations);
    return true;
  } catch (error) {
    console.error('Failed to reorder habits:', error);
    return false;
  }
}

/**
 * Archive all habits belonging to a category.
 * Called when a category is deleted to prevent orphaned habit references.
 * Archived habits are preserved in the database but hidden from active tracking.
 * Returns the number of habits archived.
 */
export async function archiveHabitsByCategory(
  categoryId: string,
  householdId: string,
  userId: string
): Promise<number> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.updateMany(
    scopeFilter(householdId, userId, { categoryId, archived: { $ne: true } }),
    { $set: { archived: true, archivedAt: new Date().toISOString(), archivedReason: 'category_deleted' } }
  );

  return result.modifiedCount;
}
