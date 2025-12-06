/**
 * DayLog Repository
 * 
 * MongoDB data access layer for DayLog entities (habit tracking results).
 * Provides CRUD operations for day logs with user-scoped queries.
 */

import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongoClient';
import { getUseMongoPersistence } from '../config';
import type { DayLog } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'dayLogs';

/**
 * Create or update a day log.
 * 
 * @param log - DayLog data
 * @param userId - User ID to associate with the log
 * @returns Created/updated day log
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function upsertDayLog(
  log: DayLog,
  userId: string
): Promise<DayLog> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Create composite key for query
  const compositeKey = `${log.habitId}-${log.date}`;

  // Create document to store in MongoDB (includes userId and compositeKey)
  const document = {
    ...log,
    compositeKey, // Store composite key for efficient querying
    userId,
  };

  // Upsert (insert or update)
  await collection.updateOne(
    { compositeKey, userId },
    { $set: document },
    { upsert: true }
  );

  // Return DayLog (without userId, compositeKey, and _id)
  const { _id, userId: _, compositeKey: __, ...dayLog } = document;
  return dayLog as DayLog;
}

/**
 * Get all day logs for a user.
 * 
 * @param userId - User ID to filter logs
 * @returns Record of day logs keyed by `${habitId}-${date}`
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getDayLogsByUser(userId: string): Promise<Record<string, DayLog>> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Convert array to Record with composite key
  const logs: Record<string, DayLog> = {};
  for (const doc of documents) {
    const { _id, userId: _, compositeKey, ...log } = doc;
    logs[compositeKey] = log as DayLog;
  }

  return logs;
}

/**
 * Get day logs for a specific habit.
 * 
 * @param habitId - Habit ID to filter logs
 * @param userId - User ID to verify ownership
 * @returns Record of day logs keyed by `${habitId}-${date}`
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getDayLogsByHabit(
  habitId: string,
  userId: string
): Promise<Record<string, DayLog>> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ habitId, userId })
    .toArray();

  // Convert array to Record with composite key
  const logs: Record<string, DayLog> = {};
  for (const doc of documents) {
    const { _id, userId: _, compositeKey, ...log } = doc;
    logs[compositeKey] = log as DayLog;
  }

  return logs;
}

/**
 * Get a single day log.
 * 
 * @param habitId - Habit ID
 * @param date - Date in YYYY-MM-DD format
 * @param userId - User ID to verify ownership
 * @returns DayLog if found, null otherwise
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getDayLog(
  habitId: string,
  date: string,
  userId: string
): Promise<DayLog | null> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const compositeKey = `${habitId}-${date}`;
  const document = await collection.findOne({ compositeKey, userId });

  if (!document) {
    return null;
  }

  // Remove MongoDB _id, userId, and compositeKey before returning
  const { _id, userId: _, compositeKey: __, ...log } = document;
  return log as DayLog;
}

/**
 * Delete a day log.
 * 
 * @param habitId - Habit ID
 * @param date - Date in YYYY-MM-DD format
 * @param userId - User ID to verify ownership
 * @returns True if log was deleted, false if not found
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function deleteDayLog(
  habitId: string,
  date: string,
  userId: string
): Promise<boolean> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const compositeKey = `${habitId}-${date}`;
  const result = await collection.deleteOne({ compositeKey, userId });

  return result.deletedCount > 0;
}

/**
 * Delete all day logs for a habit (when habit is deleted).
 * 
 * @param habitId - Habit ID
 * @param userId - User ID to verify ownership
 * @returns Number of logs deleted
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function deleteDayLogsByHabit(
  habitId: string,
  userId: string
): Promise<number> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is required. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteMany({ habitId, userId });

  return result.deletedCount;
}

