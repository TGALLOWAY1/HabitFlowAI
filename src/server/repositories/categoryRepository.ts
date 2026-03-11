/**
 * Category Repository
 *
 * Data access layer for Category entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import type { Category } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'categories';

/**
 * Create a new category.
 */
export async function createCategory(
  data: Omit<Category, 'id'>,
  householdId: string,
  userId: string
): Promise<Category> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const id = randomUUID();

  // Atomic upsert: prevents TOCTOU race where concurrent requests both
  // pass a findOne check and then both insert, creating duplicates.
  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { name: data.name }),
    {
      $setOnInsert: {
        id,
        ...data,
        householdId: scope.householdId,
        userId: scope.userId,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) {
    throw new Error(`Failed to create or find category '${data.name}'`);
  }

  const { _id, userId: _, householdId: __, ...category } = result as any;
  return category as Category;
}

/**
 * Get all categories for a user in a household.
 */
export async function getCategoriesByUser(householdId: string, userId: string): Promise<Category[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId))
    .toArray();

  return documents.map((doc: any) => {
    const { _id, userId: _, householdId: __, ...category } = doc;
    return category as Category;
  });
}

/**
 * Get a category by ID (scoped to household + user).
 */
export async function getCategoryById(
  id: string,
  householdId: string,
  userId: string
): Promise<Category | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne(scopeFilter(householdId, userId, { id }));

  if (!document) return null;

  const { _id, userId: _, householdId: __, ...category } = document as any;
  return category as Category;
}

/**
 * Update a category (scoped to household + user).
 */
export async function updateCategory(
  id: string,
  householdId: string,
  userId: string,
  patch: Partial<Omit<Category, 'id'>>
): Promise<Category | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: patch },
    { returnDocument: 'after' }
  );

  if (!result) return null;

  const { _id, userId: _, householdId: __, ...category } = result as any;
  return category as Category;
}

/**
 * Delete a category (scoped to household + user).
 */
export async function deleteCategory(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne(scopeFilter(householdId, userId, { id }));
  return result.deletedCount > 0;
}

/**
 * Reorder categories (scoped to household + user).
 */
export async function reorderCategories(
  householdId: string,
  userId: string,
  categories: Category[]
): Promise<Category[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  await collection.deleteMany(scopeFilter(householdId, userId));

  const documents = categories.map(category => ({
    ...category,
    householdId,
    userId,
  }));

  if (documents.length > 0) {
    await collection.insertMany(documents);
  }

  return categories;
}
