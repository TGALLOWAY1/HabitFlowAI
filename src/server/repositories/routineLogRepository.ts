/**
 * RoutineLog Repository
 * 
 * MongoDB data access layer for RoutineLog entities.
 * Tracks when routines are completed.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type RoutineLog } from '../../models/persistenceTypes';

const COLLECTION_NAME = MONGO_COLLECTIONS.ROUTINE_LOGS;

/**
 * Create or update a routine log.
 * 
 * @param log - RoutineLog data
 * @param userId - User ID to associate with the log
 * @returns Created/updated routine log
 */
export async function saveRoutineLog(
    log: RoutineLog,
    userId: string
): Promise<RoutineLog> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Create composite key for query
    const compositeKey = `${log.routineId}-${log.date}`;

    // Create document to store in MongoDB
    const document = {
        routineId: log.routineId,
        date: log.date,
        completedAt: log.completedAt,
        compositeKey, // Store composite key for efficient querying
        userId,
    };

    // Upsert (insert or update)
    const result = await collection.findOneAndUpdate(
        { compositeKey, userId },
        {
            $set: {
                ...document,
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
        throw new Error('Failed to save routine log');
    }

    // Return RoutineLog (without userId, compositeKey, and _id)
    const { _id, userId: _, compositeKey: __, ...routineLog } = result;
    return routineLog as RoutineLog;
}

/**
 * Get all routine logs for a user.
 * 
 * @param userId - User ID to filter logs
 * @returns Record of routine logs keyed by `${routineId}-${date}`
 */
export async function getRoutineLogsByUser(userId: string): Promise<Record<string, RoutineLog>> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({ userId })
        .toArray();

    // Convert array to Record with composite key
    const logs: Record<string, RoutineLog> = {};
    for (const doc of documents) {
        const { _id, userId: _, compositeKey, ...log } = doc;
        logs[compositeKey] = log as RoutineLog;
    }

    return logs;
}

