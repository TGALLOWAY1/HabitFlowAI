/**
 * HabitEntry Repository
 * 
 * MongoDB data access layer for HabitEntry entities.
 * Provides CRUD operations for habit entries with user-scoped queries.
 */

import { getDb } from '../lib/mongoClient';
import type { HabitEntry } from '../../models/persistenceTypes';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';

/**
 * Assert that an object does not contain stored completion/progress fields.
 * 
 * Completion and progress must be derived from HabitEntries, never stored.
 * This guardrail prevents accidental persistence of derived data.
 * 
 * @param obj - Object to check
 * @throws Error if forbidden fields are present
 */
function assertNoStoredCompletionOrProgress(obj: any): void {
    const forbiddenFields = [
        'completed',
        'isComplete',
        'isCompleted',
        'completion',
        'progress',
        'currentValue',
        'percent',
        'streak',
        'momentum',
        'totals',
        'weeklyProgress',
        'dailyProgress',
    ];

    const foundFields: string[] = [];
    for (const field of forbiddenFields) {
        if (field in obj && obj[field] !== undefined) {
            foundFields.push(field);
        }
    }

    if (foundFields.length > 0) {
        throw new Error(
            `Cannot persist completion/progress fields. Found: ${foundFields.join(', ')}. ` +
            'Completion and progress must be derived from HabitEntries, never stored.'
        );
    }
}

const COLLECTION_NAME = 'habitEntries';

/**
 * Create a new habit entry.
 * 
 * @param entry - HabitEntry data (excluding id, createdAt, updatedAt)
 * @param userId - User ID to associate with the entry
 * @returns Created habit entry
 */
export async function createHabitEntry(
    entry: Omit<HabitEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
    userId: string
): Promise<HabitEntry> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const now = new Date().toISOString();
    const id = randomUUID();

    // Ensure dayKey is present (required)
    const dayKey = entry.dayKey || entry.date;
    if (!dayKey) {
        throw new Error('HabitEntry must have dayKey or date (legacy input)');
    }

    // Ban stored completion/progress fields
    assertNoStoredCompletionOrProgress(entry);

    // Create entry object (exclude date from persistence)
    const { date: _, ...entryWithoutDate } = entry;
    const newEntry: HabitEntry = {
        ...entryWithoutDate,
        id,
        dayKey, // Store canonical dayKey only
        createdAt: now,
        updatedAt: now,
    };

    // Create document to store in MongoDB (includes userId, excludes date)
    const document = {
        ...newEntry,
        userId,
        dayKey, // Store canonical dayKey only (date is NOT persisted)
    };

    const result = await collection.insertOne(document);

    if (!result.acknowledged) {
        throw new Error('Failed to create habit entry');
    }

    // For reads: derive date from dayKey for backward compatibility in API responses
    const entryWithDate = { ...newEntry, date: newEntry.dayKey };
    return entryWithDate as HabitEntry;
}

/**
 * Get habit entries by habit ID.
 * 
 * @param habitId - Habit ID
 * @param userId - User ID
 * @returns Array of HabitEntry
 */
/**
 * Get habit entries by habit ID.
 * 
 * @param habitId - Habit ID
 * @returns Array of HabitEntry
 */
export async function getHabitEntries(
    habitId: string
): Promise<HabitEntry[]> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Note: This fetches purely by habitId. Without userId scoping it might be unsafe if habit IDs aren't unique global UUIDs.
    // Assuming habit IDs are unique UUIDs.
    const documents = await collection
        .find({ habitId, deletedAt: { $exists: false } })
        .sort({ timestamp: -1 })
        .toArray();

    return documents.map(doc => {
        const { _id, userId: _, ...entry } = doc;
        // For reads: derive date from dayKey for backward compatibility in API responses
        const entryWithDate = entry.dayKey ? { ...entry, date: entry.dayKey } : entry;
        return entryWithDate as HabitEntry;
    });
}

/**
 * Get habit entries by habit ID (Scoped to User).
 * 
 * @param habitId - Habit ID
 * @param userId - User ID
 * @returns Array of HabitEntry
 */
export async function getHabitEntriesByHabit(
    habitId: string,
    userId: string
): Promise<HabitEntry[]> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({ habitId, userId, deletedAt: { $exists: false } }) // Exclude soft-deleted
        .sort({ timestamp: -1 }) // Newest first
        .toArray();

    return documents.map(doc => {
        const { _id, userId: _, ...entry } = doc;
        // For reads: derive date from dayKey for backward compatibility in API responses
        const entryWithDate = entry.dayKey ? { ...entry, date: entry.dayKey } : entry;
        return entryWithDate as HabitEntry;
    });
}

/**
 * Get habit entries for a specific day.
 * Useful for recomputing daily logs.
 * 
 * @param habitId - Habit ID
 * @param dayKey - DayKey string (YYYY-MM-DD) - canonical field
 * @param userId - User ID
 * @returns Array of HabitEntry
 */
export async function getHabitEntriesForDay(
    habitId: string,
    dayKey: string,
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Query by dayKey (preferred) or date (legacy fallback)
    const documents = await collection
        .find({
            habitId,
            userId,
            $or: [
                { dayKey },
                { date: dayKey } // Legacy fallback
            ],
            deletedAt: { $exists: false }
        })
        .toArray();

    return documents.map(doc => {
        const { _id, userId: _, ...entry } = doc;
        // For reads: derive date from dayKey for backward compatibility in API responses
        const entryWithDate = entry.dayKey ? { ...entry, date: entry.dayKey } : entry;
        return entryWithDate as HabitEntry;
    });
}

/**
 * Update a habit entry.
 * 
 * @param id - Entry ID
 * @param userId - User ID
 * @param patch - Fields to update
 * @returns Updated HabitEntry or null
 */
export async function updateHabitEntry(
    id: string,
    userId: string,
    patch: Partial<Omit<HabitEntry, 'id' | 'habitId' | 'createdAt' | 'updatedAt'>>
): Promise<HabitEntry | null> {

    // Ban stored completion/progress fields
    assertNoStoredCompletionOrProgress(patch);

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Remove date from patch if present (date is not persisted)
    const { date: _, ...patchWithoutDate } = patch;

    const update = {
        ...patchWithoutDate,
        updatedAt: new Date().toISOString(),
    };

    const result = await collection.findOneAndUpdate(
        { id, userId },
        { $set: update },
        { returnDocument: 'after' }
    );

    if (!result) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, userId: _userId, ...updatedEntry } = result;
    // For reads: derive date from dayKey for backward compatibility in API responses
    const entryWithDate = updatedEntry.dayKey ? { ...updatedEntry, date: updatedEntry.dayKey } : updatedEntry;
    return entryWithDate as HabitEntry;
}

/**
 * Soft delete a habit entry.
 * 
 * @param id - Entry ID
 * @param userId - User ID
 * @returns True if deleted
 */
export async function deleteHabitEntry(
    id: string,
    userId: string
): Promise<boolean> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.findOneAndUpdate(
        { id, userId },
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    );

    return !!result;
}

/**
 * Soft delete all entries for a habit on a specific day.
 * 
 * @param habitId - Habit ID
 * @param date - Date to clear
 * @param userId - User ID
 * @returns Number of deleted entries
 */
export async function deleteHabitEntriesForDay(
    habitId: string,
    dayKey: string,
    userId: string
): Promise<number> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Query by dayKey (preferred) or date (legacy fallback for existing records)
    const result = await collection.updateMany(
        {
            habitId,
            $or: [
                { dayKey },
                { date: dayKey } // Legacy fallback
            ],
            userId,
            deletedAt: { $exists: false }
        }, // Only active ones
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    );


    return result.modifiedCount;
}

/**
 * Soft delete all entries for a habit.
 *
 * @param habitId - Habit ID
 * @param userId - User ID
 * @returns Number of entries marked deleted
 */
export async function deleteHabitEntriesByHabit(
    habitId: string,
    userId: string
): Promise<number> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.updateMany(
        {
            habitId,
            userId,
            deletedAt: { $exists: false }
        },
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount;
}

/**
 * Upsert a habit entry for a specific dayKey (create or update)
 * @param habitId - Habit ID
 * @param dayKey - DayKey string YYYY-MM-DD (canonical)
 * @param userId - User ID
 * @param updates - Updates to apply (value, source, etc)
 */
export async function upsertHabitEntry(
    habitId: string,
    dayKey: string,
    userId: string,
    updates: Partial<Omit<HabitEntry, 'id' | 'habitId' | 'dayKey' | 'date' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<HabitEntry> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const now = new Date().toISOString();

    // Check if exists (active) - query by dayKey (preferred) or date (legacy)
    const existing = await collection.findOne({
        habitId,
        $or: [
            { dayKey },
            { date: dayKey } // Legacy fallback
        ],
        userId,
        deletedAt: { $exists: false }
    }) as unknown as HabitEntry | null;

    // Ban stored completion/progress fields
    assertNoStoredCompletionOrProgress(updates);

    if (existing) {
        // Update - ensure dayKey is set (exclude date from persistence)
        // Type assertion needed because updates type omits date, but we want to be explicit
        const updatesWithoutDate = updates as any;
        delete updatesWithoutDate.date;
        const patch = {
            ...updatesWithoutDate,
            dayKey, // Ensure canonical dayKey is set
            updatedAt: now
        };

        await collection.updateOne(
            { _id: new ObjectId((existing as any)._id) },
            { $set: patch }
        );
        const updated = { ...existing, ...patch };
        // For reads: derive date from dayKey for backward compatibility in API responses
        const entryWithDate = updated.dayKey ? { ...updated, date: updated.dayKey } : updated;
        return entryWithDate as HabitEntry;
    } else {
        // Create - ensure dayKey is set (exclude date from persistence)
        // Type assertion needed because updates type omits date, but we want to be explicit
        const updatesWithoutDate = updates as any;
        delete updatesWithoutDate.date;
        const newEntry = {
            _id: new ObjectId(),
            id: randomUUID(),
            habitId,
            userId,
            dayKey, // Canonical dayKey only (date is NOT persisted)
            value: updates.value ?? undefined,
            timestamp: updates.timestamp || now,
            source: updates.source || 'manual',
            createdAt: now,
            updatedAt: now,
            ...updatesWithoutDate
        } as HabitEntry;
        await collection.insertOne(newEntry as any);
        // For reads: derive date from dayKey for backward compatibility in API responses
        const entryWithDate = { ...newEntry, date: newEntry.dayKey };
        return entryWithDate as HabitEntry;
    }
}

/**
 * Soft delete a single habit entry by key (habitId + dayKey)
 * 
 * Uses canonical dayKey format (YYYY-MM-DD). Supports legacy date field for backward compatibility.
 * Only deletes entries that are not already soft-deleted (deletedAt does not exist).
 * 
 * @param habitId - Habit ID
 * @param dayKey - DayKey string (YYYY-MM-DD) - canonical field
 * @param userId - User ID
 * @returns True if an entry was deleted, false if no matching active entry found
 */
export async function deleteHabitEntryByKey(
    habitId: string,
    dayKey: string,
    userId: string
): Promise<boolean> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Query by dayKey (preferred) or date (legacy fallback)
    // Only delete entries that are not already soft-deleted
    const result = await collection.updateOne(
        {
            habitId,
            userId,
            $or: [
                { dayKey },
                { date: dayKey } // Legacy fallback
            ],
            deletedAt: { $exists: false } // Only delete active entries
        },
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount > 0;
}

/**
 * Get all habit entries for a user.
 * Essential for progress aggregation.
 * 
 * @param userId - User ID
 * @returns Array of HabitEntry
 */
export async function getHabitEntriesByUser(
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({ userId, deletedAt: { $exists: false } })
        .toArray();

    return documents.map(doc => {
        const { _id, userId: _, ...entry } = doc;
        // For reads: derive date from dayKey for backward compatibility in API responses
        const entryWithDate = entry.dayKey ? { ...entry, date: entry.dayKey } : entry;
        return entryWithDate as HabitEntry;
    });
}
