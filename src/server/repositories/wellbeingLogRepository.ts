/**
 * WellbeingLog Repository
 * 
 * MongoDB data access layer for DailyWellbeing entities.
 * Provides CRUD operations for wellbeing logs with user-scoped queries.
 */

import { getDb } from '../lib/mongoClient';
import type { DailyWellbeing } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'wellbeingLogs';

/**
 * Create or update a wellbeing log.
 * 
 * @param log - DailyWellbeing data
 * @param userId - User ID to associate with the log
 * @returns Created/updated wellbeing log
 */
export async function upsertWellbeingLog(
  log: DailyWellbeing,
  userId: string
): Promise<DailyWellbeing> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Ensure date field is present and is a string
  if (!log.date || typeof log.date !== 'string') {
    throw new Error(`Wellbeing log must have a valid date field (string in YYYY-MM-DD format). Received: ${JSON.stringify(log)}`);
  }

  // Create document to store in MongoDB (includes userId)
  const document = {
    ...log,
    userId,
  };

  // Upsert (insert or update) using findOneAndUpdate to get the latest state
  // We use $set to accept partial updates while preserving existing fields
  // This is critical to prevent overwriting existing data if frontend sends partial updates
  const result = await collection.findOneAndUpdate(
    { date: log.date, userId },
    {
      $set: {
        ...document,
        // Ensure date is always set
        date: log.date,
        updatedAt: new Date().toISOString()
      },
      $setOnInsert: {
        createdAt: new Date().toISOString()
      }
    },
    {
      upsert: true,
      returnDocument: 'after' // Return the modified document
    }
  );

  if (!result) {
    throw new Error(`Failed to upsert wellbeing log for date: ${log.date}`);
  }

  // Return DailyWellbeing (without userId and _id)
  const { _id, userId: _, ...wellbeingLog } = result;

  // Ensure date field is present in the returned object
  if (!wellbeingLog.date) {
    console.error(`Warning: Stored document missing date field. Document:`, result);
    wellbeingLog.date = log.date; // Fallback to input date
  }

  return wellbeingLog as DailyWellbeing;
}

/**
 * Get all wellbeing logs for a user.
 * 
 * @param userId - User ID to filter logs
 * @returns Record of wellbeing logs keyed by date (YYYY-MM-DD)
 */
export async function getWellbeingLogsByUser(userId: string): Promise<Record<string, DailyWellbeing>> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({ userId })
    .toArray();

  // Convert array to Record keyed by date
  // Ensure date field is present and in YYYY-MM-DD format
  const logs: Record<string, DailyWellbeing> = {};
  for (const doc of documents) {
    const { _id, userId: _, ...log } = doc;

    // Defensive check: ensure date field exists and is a string
    if (!log.date || typeof log.date !== 'string') {
      console.warn(`Wellbeing log document missing or invalid date field. Document keys: ${Object.keys(doc).join(', ')}. Document:`, JSON.stringify(doc, null, 2));
      continue; // Skip documents without valid date
    }

    // Ensure date is in YYYY-MM-DD format (normalize if needed)
    const dateStr = log.date as string;

    // Ensure the log object has the date field explicitly set
    const wellbeingLog: DailyWellbeing = {
      ...log,
      date: dateStr, // Explicitly set date to ensure it's present
    } as DailyWellbeing;

    logs[dateStr] = wellbeingLog;
  }

  console.log(`Retrieved ${Object.keys(logs).length} wellbeing logs for user ${userId}. Dates: ${Object.keys(logs).join(', ')}`);
  return logs;
}

/**
 * Get a single wellbeing log by date.
 * 
 * @param date - Date in YYYY-MM-DD format
 * @param userId - User ID to verify ownership
 * @returns DailyWellbeing if found, null otherwise
 */
export async function getWellbeingLog(
  date: string,
  userId: string
): Promise<DailyWellbeing | null> {

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
 */
export async function deleteWellbeingLog(
  date: string,
  userId: string
): Promise<boolean> {

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const result = await collection.deleteOne({ date, userId });

  return result.deletedCount > 0;
}

