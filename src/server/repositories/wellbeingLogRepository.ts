/**
 * WellbeingLog Repository
 * 
 * MongoDB data access layer for DailyWellbeing entities.
 * Provides CRUD operations for wellbeing logs with user-scoped queries.
 */

import { ObjectId } from 'mongodb';
import { getDb } from '../lib/mongoClient';
import { getUseMongoPersistence } from '../config';
import type { DailyWellbeing } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'wellbeingLogs';

/**
 * Create or update a wellbeing log.
 * 
 * @param log - DailyWellbeing data
 * @param userId - User ID to associate with the log
 * @returns Created/updated wellbeing log
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function upsertWellbeingLog(
  log: DailyWellbeing,
  userId: string
): Promise<DailyWellbeing> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Create document to store in MongoDB (includes userId)
  const document = {
    ...log,
    userId,
  };

  // Upsert (insert or update) using date as unique key
  await collection.updateOne(
    { date: log.date, userId },
    { $set: document },
    { upsert: true }
  );

  // Return DailyWellbeing (without userId and _id)
  const { _id, userId: _, ...wellbeingLog } = document;
  return wellbeingLog as DailyWellbeing;
}

/**
 * Get all wellbeing logs for a user.
 * 
 * @param userId - User ID to filter logs
 * @returns Record of wellbeing logs keyed by date (YYYY-MM-DD)
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getWellbeingLogsByUser(userId: string): Promise<Record<string, DailyWellbeing>> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Convert array to Record keyed by date
  const logs: Record<string, DailyWellbeing> = {};
  for (const doc of documents) {
    const { _id, userId: _, ...log } = doc;
    logs[log.date] = log as DailyWellbeing;
  }

  return logs;
}

/**
 * Get a single wellbeing log by date.
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param userId - User ID to verify ownership
 * @returns DailyWellbeing if found, null otherwise
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function getWellbeingLog(
  date: string,
  userId: string
): Promise<DailyWellbeing | null> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const document = await collection.findOne({ date, userId });

  if (!document) {
    return null;
  }

  // Remove MongoDB _id and userId before returning
  const { _id, userId: _, ...log } = document;
  return log as DailyWellbeing;
}

/**
 * Delete a wellbeing log.
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param userId - User ID to verify ownership
 * @returns True if log was deleted, false if not found
 * @throws Error if USE_MONGO_PERSISTENCE is false
 */
export async function deleteWellbeingLog(
  date: string,
  userId: string
): Promise<boolean> {
  if (!getUseMongoPersistence()) {
    throw new Error('MongoDB persistence is not enabled. Set USE_MONGO_PERSISTENCE=true in .env');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ date, userId });

  return result.deletedCount > 0;
}

