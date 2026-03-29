/**
 * RoutineLog Repository
 *
 * MongoDB data access layer for RoutineLog entities.
 * Tracks when routines are completed, with optional variant context.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type RoutineLog } from '../../models/persistenceTypes';

const COLLECTION_NAME = MONGO_COLLECTIONS.ROUTINE_LOGS;

/**
 * Generate composite key for a routine log.
 * Variant-aware format: routineId-variantId-date
 * Legacy format: routineId-date
 */
function getCompositeKey(routineId: string, date: string, variantId?: string): string {
    if (variantId) {
        return `${routineId}-${variantId}-${date}`;
    }
    return `${routineId}-${date}`;
}

/**
 * Create or update a routine log.
 *
 * @param log - RoutineLog data (now supports variantId, startedAt, stepResults, actualDurationSeconds)
 * @param userId - User ID to associate with the log
 * @returns Created/updated routine log
 */
export async function saveRoutineLog(
    log: RoutineLog,
    userId: string
): Promise<RoutineLog> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Create composite key for query (variant-aware)
    const compositeKey = getCompositeKey(log.routineId, log.date, log.variantId);

    // Create document to store in MongoDB
    const document: Record<string, any> = {
        routineId: log.routineId,
        date: log.date,
        completedAt: log.completedAt,
        compositeKey,
        userId,
    };

    // Add optional variant fields
    if (log.variantId) document.variantId = log.variantId;
    if (log.startedAt) document.startedAt = log.startedAt;
    if (log.stepResults) document.stepResults = log.stepResults;
    if (log.actualDurationSeconds !== undefined) document.actualDurationSeconds = log.actualDurationSeconds;
    if (log.stepTrackingData) document.stepTrackingData = log.stepTrackingData;
    if (log.stepTimingData) document.stepTimingData = log.stepTimingData;

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
            returnDocument: 'after'
        }
    );

    if (!result) {
        throw new Error('Failed to save routine log');
    }

    // Return RoutineLog (without internal fields)
    const { _id, userId: _, compositeKey: __, createdAt: ___, updatedAt: ____, ...routineLog } = result;
    return routineLog as RoutineLog;
}

/**
 * Get all routine logs for a user.
 *
 * @param userId - User ID to filter logs
 * @param filters - Optional filters for routineId and variantId
 * @returns Record of routine logs keyed by composite key
 */
export async function getRoutineLogsByUser(
    userId: string,
    filters?: { routineId?: string; variantId?: string }
): Promise<Record<string, RoutineLog>> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const query: Record<string, any> = { userId };
    if (filters?.routineId) query.routineId = filters.routineId;
    if (filters?.variantId) query.variantId = filters.variantId;

    const documents = await collection
        .find(query)
        .toArray();

    // Convert array to Record with composite key
    const logs: Record<string, RoutineLog> = {};
    for (const doc of documents) {
        const { _id, userId: _, compositeKey, createdAt: __, updatedAt: ___, ...log } = doc;
        logs[compositeKey] = log as RoutineLog;
    }

    return logs;
}
