/**
 * ActivityLog Repository
 * 
 * MongoDB data access layer for ActivityLog entities.
 * Tracks when activities are completed.
 */

import { getDb } from '../lib/mongoClient';
import type { ActivityLog } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'activityLogs';

/**
 * Create or update an activity log.
 * 
 * @param log - ActivityLog data
 * @param userId - User ID to associate with the log
 * @returns Created/updated activity log
 */
export async function saveActivityLog(
    log: ActivityLog,
    userId: string
): Promise<ActivityLog> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Create composite key for query
    const compositeKey = `${log.activityId}-${log.date}`;

    // Create document to store in MongoDB
    const document = {
        activityId: log.activityId,
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
        throw new Error('Failed to save activity log');
    }

    // Return ActivityLog (without userId, compositeKey, and _id)
    const { _id, userId: _, compositeKey: __, ...activityLog } = result;
    return activityLog as ActivityLog;
}

/**
 * Get all activity logs for a user.
 * 
 * @param userId - User ID to filter logs
 * @returns Record of activity logs keyed by `${activityId}-${date}`
 */
export async function getActivityLogsByUser(userId: string): Promise<Record<string, ActivityLog>> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({ userId })
        .toArray();

    // Convert array to Record with composite key
    const logs: Record<string, ActivityLog> = {};
    for (const doc of documents) {
        const { _id, userId: _, compositeKey, ...log } = doc;
        logs[compositeKey] = log as ActivityLog;
    }

    return logs;
}
