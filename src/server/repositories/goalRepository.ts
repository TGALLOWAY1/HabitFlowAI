/**
 * Goal Repository
 * 
 * MongoDB data access layer for Goal entities.
 * Provides CRUD operations for goals with user-scoped queries.
 */

// import { ObjectId } from 'mongodb';
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
  } as any;

  await collection.insertOne(document);

  // Return Goal (without userId and _id)
  const { _id, userId: _, ...goal } = document;
  return goal as Goal;
}

/**
 * Get all goals for a user.
 * 
 * @param userId - User ID to filter goals
 * @returns Array of goals for the user, sorted by sortOrder (asc) then createdAt (asc)
 */
export async function getGoalsByUser(userId: string): Promise<Goal[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    // Sort by 'sortOrder' ascending (null/undefined values come LAST by default in Mongo)
    // then by createdAt ascending for stable ordering
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map((doc: any) => {
    const { _id, userId: _, ...goal } = doc;
    return goal as Goal;
  });
}

/**
 * Get all completed goals for a user, sorted by completedAt descending.
 * 
 * @param userId - User ID to filter goals
 * @returns Array of completed goals, sorted by completedAt descending (most recent first)
 */
export async function getCompletedGoalsByUser(userId: string): Promise<Goal[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({
      userId,
      completedAt: { $exists: true, $ne: null } // Only goals with completedAt set
    })
    .sort({ completedAt: -1 }) // Sort by completedAt descending (most recent first)
    .toArray();

  // Remove MongoDB _id and userId before returning
  return documents.map((doc: any) => {
    const { _id, userId: _, ...goal } = doc;
    return goal as Goal;
  });
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
  const { _id, userId: _, ...goal } = document as any;
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
  const { _id, userId: _, ...goal } = result as any;
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
 * Reorder goals.
 * Updates the 'sortOrder' field for a list of goals.
 * 
 * @param userId - User ID to verify ownership
 * @param goalIds - Array of goal IDs in the desired order
 * @returns True if successful
 */
export async function reorderGoals(
  userId: string,
  goalIds: string[]
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Use bulkWrite for efficiency
  // Map over the explicit order of IDs provided
  const operations = goalIds.map((id, index) => ({
    updateOne: {
      filter: { id, userId },
      update: { $set: { sortOrder: index } }
    }
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
