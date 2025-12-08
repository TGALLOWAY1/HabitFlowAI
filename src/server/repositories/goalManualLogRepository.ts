/**
 * Goal Manual Log Repository
 * 
 * MongoDB data access layer for GoalManualLog entities.
 * Provides CRUD operations for goal manual logs with user-scoped queries.
 * 
 * Expected Behavior:
 * - Manual logs are only supported for cumulative goals (not frequency goals)
 * - Each log represents a discrete amount of progress (value > 0) added at a specific time (loggedAt)
 * - Manual logs are included in goal progress computation:
 *   - currentValue = sum of habit logs + sum of manual logs
 *   - lastSevenDays includes manual log values for relevant dates
 *   - Manual logs are sorted by loggedAt ascending when retrieved
 * - Manual logs are user-scoped (filtered by userId)
 */

import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type GoalManualLog } from '../../models/persistenceTypes';

const COLLECTION_NAME = MONGO_COLLECTIONS.GOAL_MANUAL_LOGS;

/**
 * Create a new goal manual log.
 * 
 * @param data - Goal manual log data (without id, createdAt)
 * @param userId - User ID to associate with the log (for future user scoping)
 * @returns Created log with generated ID
 */
export async function createGoalManualLog(
  data: Omit<GoalManualLog, 'id' | 'createdAt'>,
  userId: string
): Promise<GoalManualLog> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Generate ID (using UUID format to match frontend)
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  // Default loggedAt to now if not provided
  const loggedAt = data.loggedAt || createdAt;

  // Create document to store in MongoDB (includes userId for future scoping)
  const document = {
    id,
    ...data,
    loggedAt,
    createdAt,
    userId,
  };

  await collection.insertOne(document);

  // Return GoalManualLog (without userId and _id)
  const { _id, userId: _, ...log } = document;
  return log as GoalManualLog;
}

/**
 * Get all manual logs for a specific goal.
 * 
 * @param goalId - Goal ID to filter logs
 * @param userId - User ID to verify ownership (for future user scoping)
 * @returns Array of manual logs for the goal, sorted by loggedAt ascending
 */
export async function getGoalManualLogsByGoal(
  goalId: string,
  userId: string
): Promise<GoalManualLog[]> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const logs = await collection
    .find({ goalId, userId })
    .sort({ loggedAt: 1 }) // Sort by loggedAt ascending
    .toArray();

  // Return logs without MongoDB _id and userId
  return logs.map(({ _id, userId: _, ...log }) => log as GoalManualLog);
}

/**
 * Get all manual logs for multiple goals (batch query).
 * 
 * @param goalIds - Array of goal IDs to filter logs
 * @param userId - User ID to verify ownership
 * @returns Array of manual logs for the goals, sorted by loggedAt ascending
 */
export async function getGoalManualLogsByGoals(
  goalIds: string[],
  userId: string
): Promise<GoalManualLog[]> {

  if (goalIds.length === 0) {
    return [];
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const logs = await collection
    .find({ goalId: { $in: goalIds }, userId })
    .sort({ loggedAt: 1 }) // Sort by loggedAt ascending
    .toArray();

  // Return logs without MongoDB _id and userId
  return logs.map(({ _id, userId: _, ...log }) => log as GoalManualLog);
}

/**
 * Delete a goal manual log by ID.
 * 
 * @param id - Log ID
 * @param userId - User ID to verify ownership
 * @returns True if log was deleted, false if not found
 */
export async function deleteGoalManualLog(
  id: string,
  userId: string
): Promise<boolean> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ id, userId });

  return result.deletedCount > 0;
}
