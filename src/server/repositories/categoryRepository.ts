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
const SORT_ORDER_FIELD = 'sortOrder';

export class CategoryReorderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryReorderValidationError';
  }
}

function toCategory(document: Record<string, unknown>): Category {
  const {
    _id,
    userId: _userId,
    householdId: _householdId,
    [SORT_ORDER_FIELD]: _sortOrder,
    ...category
  } = document;
  return category as unknown as Category;
}

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
        // Legacy categories retain insertion order until the first reorder;
        // categories created later sort after normalized integer positions.
        [SORT_ORDER_FIELD]: Date.now(),
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) {
    throw new Error(`Failed to create or find category '${data.name}'`);
  }

  return toCategory(result as Record<string, unknown>);
}

/**
 * Get all categories for a user in a household.
 */
export async function getCategoriesByUser(householdId: string, userId: string): Promise<Category[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find(scopeFilter(householdId, userId))
    .sort({ [SORT_ORDER_FIELD]: 1, _id: 1 })
    .toArray();

  return documents.map((document) => toCategory(document));
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

  return toCategory(document);
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

  return toCategory(result as Record<string, unknown>);
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
  const existingDocuments = await collection
    .find(scopeFilter(householdId, userId), { projection: { id: 1 } })
    .toArray();
  const existingIds = new Set(existingDocuments.map((document) => document.id as string));
  const requestedIds = categories.map((category) => category.id);
  const requestedIdSet = new Set(requestedIds);

  if (
    requestedIds.length !== requestedIdSet.size
    || requestedIdSet.size !== existingIds.size
    || requestedIds.some((id) => !existingIds.has(id))
  ) {
    throw new CategoryReorderValidationError(
      'Category reorder must contain every existing category exactly once',
    );
  }

  if (requestedIds.length > 0) {
    await collection.bulkWrite(
      requestedIds.map((id, sortOrder) => ({
        updateOne: {
          filter: scopeFilter(householdId, userId, { id }),
          update: { $set: { [SORT_ORDER_FIELD]: sortOrder } },
        },
      })),
    );
  }

  return getCategoriesByUser(householdId, userId);
}
