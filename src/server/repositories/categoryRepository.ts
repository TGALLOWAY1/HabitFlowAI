/**
 * Category Repository
 * 
 * Data access layer for Category entities.
 * Uses feature flag to switch between MongoDB persistence and local storage (not yet implemented).
 */

import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { getUseMongoPersistence } from '../config';
import type { Category } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'categories';

/**
 * Create a new category.
 * 
 * @param data - Category data (without id, which will be generated)
 * @param userId - User ID to associate the category with
 * @returns Created category with generated ID
 * @throws Error if USE_MONGO_PERSISTENCE is false (not yet implemented for local storage)
 */
export async function createCategory(
  data: Omit<Category, 'id'>,
  userId: string
): Promise<Category> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Generate ID (using UUID format to match frontend)
  const id = randomUUID();

  // Create document to store in MongoDB (includes userId)
  const document = {
    id,
    ...data,
    userId,
  };

  await collection.insertOne(document);

  // Return Category (without userId and _id)
  const { _id, userId: _, ...category } = document;
  return category as Category;
}

/**
 * Get all categories for a user.
 * 
 * @param userId - User ID to filter categories
 * @returns Array of categories for the user
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getCategoriesByUser(userId: string): Promise<Category[]> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map(({ _id, userId: _, ...category }) => category as Category);
}

/**
 * Get a category by ID.
 * 
 * @param id - Category ID
 * @param userId - User ID to verify ownership
 * @returns Category if found, null otherwise
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getCategoryById(
  id: string,
  userId: string
): Promise<Category | null> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne({ id, userId });

  if (!document) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...category } = document;
  return category as Category;
}

/**
 * Update a category.
 * 
 * @param id - Category ID
 * @param userId - User ID to verify ownership
 * @param patch - Partial category data to update
 * @returns Updated category if found, null otherwise
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function updateCategory(
  id: string,
  userId: string,
  patch: Partial<Omit<Category, 'id'>>
): Promise<Category | null> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.findOneAndUpdate(
    { id, userId },
    { $set: patch },
    { returnDocument: 'after' }
  );

  if (!result) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...category } = result;
  return category as Category;
}

/**
 * Delete a category.
 * 
 * @param id - Category ID
 * @param userId - User ID to verify ownership
 * @returns True if category was deleted, false if not found
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function deleteCategory(
  id: string,
  userId: string
): Promise<boolean> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ id, userId });

  return result.deletedCount > 0;
}

/**
 * Reorder categories by updating their order field or replacing the entire array.
 * 
 * @param userId - User ID
 * @param categories - Array of categories in new order
 * @returns Updated categories array
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function reorderCategories(
  userId: string,
  categories: Category[]
): Promise<Category[]> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Delete all existing categories for this user
  await collection.deleteMany({ userId });

  // Insert categories in new order
  const documents = categories.map(category => ({
    ...category,
    userId,
  }));

  if (documents.length > 0) {
    await collection.insertMany(documents);
  }

  return categories;
}

