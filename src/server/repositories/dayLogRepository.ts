/**
 * DayLog Repository
 * 
 * MongoDB data access layer for DayLog entities (habit tracking results).
 * Provides CRUD operations for day logs with user-scoped queries.
 */

import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongoClient';
import { getMongoEnabled } from '../config';
import type { DayLog } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'dayLogs';

/**
 * Create or update a day log.
 * 
 * @param log - DayLog data
 * @param userId - User ID to associate with the log
 * @returns Created/updated day log
 */
export async function upsertDayLog(
  log: DayLog,
  userId: string
): Promise<DayLog> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Create composite key for query
  const compositeKey = `${log.habitId}-${log.date}`;

  // Create document to store in MongoDB (includes userId and compositeKey)
  // Build document with all fields from log, explicitly including activity metadata
  const document: any = {
    habitId: log.habitId,
    date: log.date,
    value: log.value,
    completed: log.completed,
    compositeKey, // Store composite key for efficient querying
    userId,
  };

  // Add activity metadata if it exists in the log object
  // Check property existence to ensure we capture it even if it's an optional field
  const logAny = log as any;
  if (logAny.hasOwnProperty('activityId') && logAny.activityId != null) {
    document.activityId = logAny.activityId;
  }
  if (logAny.hasOwnProperty('activityStepId') && logAny.activityStepId != null) {
    document.activityStepId = logAny.activityStepId;
  }

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
 */
export async function getDayLogsByUser(userId: string): Promise<Record<string, DayLog>> {

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
 */
export async function getDayLogsByHabit(
  habitId: string,
  userId: string
): Promise<Record<string, DayLog>> {

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
 */
export async function getDayLog(
  habitId: string,
  date: string,
  userId: string
): Promise<DayLog | null> {

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
 */
export async function deleteDayLog(
  habitId: string,
  date: string,
  userId: string
): Promise<boolean> {

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
 */
export async function deleteDayLogsByHabit(
  habitId: string,
  userId: string
): Promise<number> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteMany({ habitId, userId });

  return result.deletedCount;
}

