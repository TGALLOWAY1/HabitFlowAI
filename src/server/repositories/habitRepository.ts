/**
 * Habit Repository
 * 
 * MongoDB data access layer for Habit entities.
 * Provides CRUD operations for habits with user-scoped queries.
 */

import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { getMongoEnabled } from '../config';
import type { Habit } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'habits';

/**
 * Create a new habit.
 * 
 * @param data - Habit data (without id, createdAt, archived)
 * @param userId - User ID to associate with the habit
 * @returns Created habit with generated ID
 */
export async function createHabit(
  data: Omit<Habit, 'id' | 'createdAt' | 'archived'>,
  userId: string
): Promise<Habit> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Generate ID (using UUID format to match frontend)
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Create document to store in MongoDB (includes userId)
  const document = {
    id,
    ...data,
    archived: false,
    createdAt,
    userId,
  };

  await collection.insertOne(document);

  // Return Habit (without userId and _id)
  const { _id, userId: _, ...habit } = document;
  return habit as Habit;
}

/**
 * Get all habits for a user.
 * 
 * @param userId - User ID to filter habits
 * @returns Array of habits for the user
 */
export async function getHabitsByUser(userId: string): Promise<Habit[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map(({ _id, userId: _, ...habit }) => habit as Habit);
}

/**
 * Get habits by category.
 * 
 * @param categoryId - Category ID to filter habits
 * @param userId - User ID to verify ownership
 * @returns Array of habits in the category
 */
export async function getHabitsByCategory(
  categoryId: string,
  userId: string
): Promise<Habit[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ categoryId, userId })
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map(({ _id, userId: _, ...habit }) => habit as Habit);
}

/**
 * Get a single habit by ID.
 * 
 * @param id - Habit ID
 * @param userId - User ID to verify ownership
 * @returns Habit if found, null otherwise
 */
export async function getHabitById(
  id: string,
  userId: string
): Promise<Habit | null> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne({ id, userId });

  if (!document) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...habit } = document;
  return habit as Habit;
}

/**
 * Update a habit.
 * 
 * @param id - Habit ID
 * @param userId - User ID to verify ownership
 * @param patch - Partial habit data to update
 * @returns Updated habit if found, null otherwise
 */
export async function updateHabit(
  id: string,
  userId: string,
  patch: Partial<Omit<Habit, 'id' | 'createdAt'>>
): Promise<Habit | null> {

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
  const { _id, userId: _, ...habit } = result;
  return habit as Habit;
}

/**
 * Delete a habit.
 * 
 * @param id - Habit ID
 * @param userId - User ID to verify ownership
 * @returns True if habit was deleted, false if not found
 */
export async function deleteHabit(
  id: string,
  userId: string
): Promise<boolean> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ id, userId });

  return result.deletedCount > 0;
}

