/**
 * HabitEntry Repository
 * 
 * MongoDB data access layer for HabitEntry entities.
 * Provides CRUD operations for habit entries with user-scoped queries.
 */

import { getDb } from '../lib/mongoClient';
import type { HabitEntry } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';

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

    const newEntry: HabitEntry = {
        ...entry,
        id,
        createdAt: now,
        updatedAt: now,
    };

    // Create document to store in MongoDB (includes userId)
    const document = {
        ...newEntry,
        userId,
        // Add date index for faster querying by day
        date: entry.date,
    };

    const result = await collection.insertOne(document);

    if (!result.acknowledged) {
        throw new Error('Failed to create habit entry');
    }

    return newEntry;
}

/**
 * Get habit entries by habit ID.
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
        return entry as HabitEntry;
    });
}

/**
 * Get habit entries for a specific day.
 * Useful for recomputing daily logs.
 * 
 * @param habitId - Habit ID
 * @param date - Date string (YYYY-MM-DD)
 * @param userId - User ID
 * @returns Array of HabitEntry
 */
export async function getHabitEntriesForDay(
    habitId: string,
    date: string,
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({
            habitId,
            userId,
            date,
            deletedAt: { $exists: false }
        })
        .toArray();

    return documents.map(doc => {
        const { _id, userId: _, ...entry } = doc;
        return entry as HabitEntry;
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

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const update = {
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    const result = await collection.findOneAndUpdate(
        { id, userId },
        { $set: update },
        { returnDocument: 'after' }
    );

    if (!result) return null;

    const { _id, userId: _, ...updatedEntry } = result;
    return updatedEntry as HabitEntry;
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
    date: string,
    userId: string
): Promise<number> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.updateMany(
        { habitId, date, userId, deletedAt: { $exists: false } }, // Only active ones
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    );

    return result.modifiedCount;
}

