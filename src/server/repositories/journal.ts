/**
 * Journal Repository
 * 
 * MongoDB data access layer for JournalEntry entities.
 * Provides CRUD operations for journal entries with user-scoped queries.
 */

import { getDb } from '../lib/mongoClient';
import type { JournalEntry } from '../../models/persistenceTypes';

const COLLECTION_NAME = 'journalEntries';

/**
 * Create a new journal entry.
 * 
 * @param data - Journal entry data (without id, createdAt, updatedAt)
 * @param userId - User ID to associate with the entry
 * @returns Created entry with generated ID
 */
export async function createEntry(
    data: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
    userId: string
): Promise<JournalEntry> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    // Generate ID
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const document = {
        id,
        ...data,
        userId,
        createdAt: now,
        updatedAt: now,
    };

    await collection.insertOne(document);

    console.log(`[Persistence] Created journal entry (ID: ${id}) for User: ${userId}`);

    // Remove MongoDB _id and userId before returning
    const { _id, userId: _, ...entry } = document as any;
    return entry as JournalEntry;
}

/**
 * Get all journal entries for a user.
 * 
 * @param userId - User ID to filter entries
 * @returns Array of entries, sorted by date (desc) then created at (desc)
 */
export async function getEntriesByUser(userId: string): Promise<JournalEntry[]> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find({ userId })
        .sort({ date: -1, createdAt: -1 })
        .toArray();

    return documents.map(({ _id, userId: _, ...entry }) => entry as JournalEntry);
}

/**
 * Get a single journal entry by ID.
 * 
 * @param id - Entry ID
 * @param userId - User ID to verify ownership
 * @returns Entry if found, null otherwise
 */
export async function getEntryById(
    id: string,
    userId: string
): Promise<JournalEntry | null> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const document = await collection.findOne({ id, userId });

    if (!document) {
        return null;
    }

    const { _id, userId: _, ...entry } = document;
    return entry as JournalEntry;
}

/**
 * Update a journal entry.
 * 
 * @param id - Entry ID
 * @param userId - User ID to verify ownership
 * @param patch - Partial entry data to update
 * @returns Updated entry if found, null otherwise
 */
export async function updateEntry(
    id: string,
    userId: string,
    patch: Partial<Omit<JournalEntry, 'id' | 'createdAt' | 'userId'>>
): Promise<JournalEntry | null> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const updateData = {
        ...patch,
        updatedAt: new Date().toISOString()
    };

    const result = await collection.findOneAndUpdate(
        { id, userId },
        { $set: updateData },
        { returnDocument: 'after' }
    );

    if (!result) {
        return null;
    }

    const { _id, userId: _, ...entry } = result;
    return entry as JournalEntry;
}

/**
 * Delete a journal entry.
 * 
 * @param id - Entry ID
 * @param userId - User ID to verify ownership
 * @returns True if entry was deleted, false if not found
 */
export async function deleteEntry(
    id: string,
    userId: string
): Promise<boolean> {

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.deleteOne({ id, userId });

    return result.deletedCount > 0;
}
