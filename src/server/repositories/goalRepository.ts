/**
 * Goal Repository
 * 
 * MongoDB data access layer for Goal entities.
 * Provides CRUD operations for goals with user-scoped queries.
 */

import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type Goal } from '../../models/persistenceTypes';

const COLLECTION_NAME = MONGO_COLLECTIONS.GOALS;

/**
 * Create a new goal.
 * 
 * @param data - Goal data (without id, createdAt)
 * @param userId - User ID to associate with the goal
 * @returns Created goal with generated ID
 */
export async function createGoal(
  data: Omit<Goal, 'id' | 'createdAt'>,
  userId: string
): Promise<Goal> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Generate ID (using UUID format to match frontend)
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Create document to store in MongoDB (includes userId)
  const document = {
    id,
    ...data,
    createdAt,
    userId,
  };

  await collection.insertOne(document);

  // Return Goal (without userId and _id)
  const { _id, userId: _, ...goal } = document;
  return goal as Goal;
}

/**
 * Get all goals for a user.
 * 
 * @param userId - User ID to filter goals
 * @returns Array of goals for the user
 */
export async function getGoalsByUser(userId: string): Promise<Goal[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map(({ _id, userId: _, ...goal }) => goal as Goal);
}

/**
 * Get a single goal by ID.
 * 
 * @param id - Goal ID
 * @param userId - User ID to verify ownership
 * @returns Goal if found, null otherwise
 */
export async function getGoalById(
  id: string,
  userId: string
): Promise<Goal | null> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne({ id, userId });

  if (!document) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...goal } = document;
  return goal as Goal;
}

/**
 * Update a goal.
 * 
 * @param id - Goal ID
 * @param userId - User ID to verify ownership
 * @param patch - Partial goal data to update
 * @returns Updated goal if found, null otherwise
 */
export async function updateGoal(
  id: string,
  userId: string,
  patch: Partial<Omit<Goal, 'id' | 'createdAt'>>
): Promise<Goal | null> {

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
  const { _id, userId: _, ...goal } = result;
  return goal as Goal;
}

/**
 * Delete a goal.
 * 
 * @param id - Goal ID
 * @param userId - User ID to verify ownership
 * @returns True if goal was deleted, false if not found
 */
export async function deleteGoal(
  id: string,
  userId: string
): Promise<boolean> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ id, userId });

  return result.deletedCount > 0;
}

/**
 * Validate that habit IDs are valid strings (non-empty).
 * Note: This validates format only. To verify existence, use getHabitById.
 * 
 * @param habitIds - Array of habit IDs to validate
 * @returns True if all IDs are valid strings, false otherwise
 */
export function validateHabitIds(habitIds: any[]): boolean {
  if (!Array.isArray(habitIds)) {
    return false;
  }
  
  return habitIds.every(id => typeof id === 'string' && id.trim().length > 0);
}
