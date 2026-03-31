/**
 * HabitEntry Repository
 *
 * MongoDB data access layer for HabitEntry entities.
 * All queries are scoped by householdId + userId (user-owned in household).
 */

import { getDb } from '../lib/mongoClient';
import type { HabitEntry } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { scopeFilter, requireScope } from '../lib/scoping';

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

function mapDocToEntry(doc: any): HabitEntry {
  const { _id, userId: _, householdId: __, ...entry } = doc;
  const entryWithDate = entry.dayKey ? { ...entry, date: entry.dayKey } : entry;
  return entryWithDate as HabitEntry;
}

/**
 * Create a new habit entry (atomic upsert by userId, habitId, dayKey).
 * Delegates to upsertHabitEntry so all write paths are race-safe.
 */
export async function createHabitEntry(
    entry: Omit<HabitEntry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
    householdId: string,
    userId: string
): Promise<HabitEntry> {
    const dayKey = entry.dayKey || entry.date;
    if (!dayKey) {
        throw new Error('HabitEntry must have dayKey or date (legacy input)');
    }
    const { date: _d, habitId, dayKey: _k, ...rest } = entry;
    return upsertHabitEntry(habitId, dayKey, householdId, userId, {
        ...rest,
        timestamp: entry.timestamp,
        source: entry.source || 'manual',
    });
}

/**
 * Get habit entries by habit ID (scoped to household + user).
 */
export async function getHabitEntries(
    habitId: string,
    householdId: string,
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find(scopeFilter(householdId, userId, { habitId, deletedAt: { $exists: false } }))
        .sort({ timestamp: -1 })
        .toArray();

    return documents.map(doc => mapDocToEntry(doc));
}

/**
 * Get habit entries by habit ID (scoped to household + user).
 */
export async function getHabitEntriesByHabit(
    habitId: string,
    householdId: string,
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find(scopeFilter(householdId, userId, { habitId, deletedAt: { $exists: false } }))
        .sort({ timestamp: -1 })
        .toArray();

    return documents.map(doc => mapDocToEntry(doc));
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
    householdId: string,
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const filter = scopeFilter(householdId, userId, {
        habitId,
        $or: [{ dayKey }, { date: dayKey }],
        deletedAt: { $exists: false },
    });

    const documents = await collection.find(filter).toArray();
    return documents.map(doc => mapDocToEntry(doc));
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
    householdId: string,
    userId: string,
    patch: Partial<Omit<HabitEntry, 'id' | 'habitId' | 'createdAt' | 'updatedAt'>>
): Promise<HabitEntry | null> {
    assertNoStoredCompletionOrProgress(patch);

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const { date: _, ...patchWithoutDate } = patch;
    const update = { ...patchWithoutDate, updatedAt: new Date().toISOString() };

    const result = await collection.findOneAndUpdate(
        scopeFilter(householdId, userId, { id }),
        { $set: update },
        { returnDocument: 'after' }
    );

    if (!result) return null;
    return mapDocToEntry(result);
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
    householdId: string,
    userId: string
): Promise<boolean> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.findOneAndUpdate(
        scopeFilter(householdId, userId, { id }),
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
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
    householdId: string,
    userId: string
): Promise<number> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const filter = scopeFilter(householdId, userId, {
        habitId,
        $or: [{ dayKey }, { date: dayKey }],
        deletedAt: { $exists: false },
    });

    const result = await collection.updateMany(filter, {
        $set: {
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    });
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
    householdId: string,
    userId: string
): Promise<number> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const result = await collection.updateMany(
        scopeFilter(householdId, userId, { habitId, deletedAt: { $exists: false } }),
        {
            $set: {
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        }
    );
    return result.modifiedCount;
}

/**
 * Upsert a habit entry for a specific dayKey (create or update).
 * Single atomic operation keyed by (userId, habitId, dayKey). Race-safe: no read-then-write.
 *
 * Soft-delete: One document per (userId, habitId, dayKey). Deleted docs have deletedAt set.
 * Upsert updates that doc and $unset deletedAt (revive if soft-deleted); never creates a second doc for the same key.
 */
export async function upsertHabitEntry(
    habitId: string,
    dayKey: string,
    householdId: string,
    userId: string,
    updates: Partial<Omit<HabitEntry, 'id' | 'habitId' | 'dayKey' | 'date' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<HabitEntry> {
    const scope = requireScope(householdId, userId);
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    assertNoStoredCompletionOrProgress(updates);

    const now = new Date().toISOString();
    const updatesCopy = { ...updates } as Record<string, unknown>;
    delete updatesCopy.date;

    const setFields: Record<string, unknown> = {
        dayKey,
        updatedAt: now,
        value: updates.value ?? undefined,
        timestamp: updates.timestamp || now,
        source: updates.source || 'manual',
        ...updatesCopy,
    };

    const result = await collection.findOneAndUpdate(
        scopeFilter(householdId, userId, { habitId, dayKey }),
        {
            $set: setFields,
            $unset: { deletedAt: '' },
            $setOnInsert: {
                id: randomUUID(),
                createdAt: now,
                householdId: scope.householdId,
                userId: scope.userId,
            },
        },
        { upsert: true, returnDocument: 'after' }
    );

    const doc = result as { _id?: unknown; id?: string; createdAt?: string; [k: string]: unknown } | null;
    if (!doc) {
        throw new Error('upsertHabitEntry: findOneAndUpdate returned null');
    }

    return mapDocToEntry(doc);
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
    householdId: string,
    userId: string
): Promise<boolean> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const filter = scopeFilter(householdId, userId, {
        habitId,
        $or: [{ dayKey }, { date: dayKey }],
        deletedAt: { $exists: false },
    });

    const result = await collection.updateOne(filter, {
        $set: {
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        },
    });
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
    householdId: string,
    userId: string
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find(scopeFilter(householdId, userId, { deletedAt: { $exists: false } }))
        .toArray();

    return documents.map(doc => mapDocToEntry(doc));
}

/**
 * Get habit entries for a specific set of habit IDs (scoped to household + user).
 * Uses MongoDB $in to filter at the DB level, avoiding loading all user entries.
 *
 * @param habitIds - Array of habit IDs to fetch entries for
 * @param householdId - Household ID
 * @param userId - User ID
 * @returns Array of HabitEntry for the specified habits
 */
export async function getHabitEntriesByHabitIds(
    habitIds: string[],
    householdId: string,
    userId: string
): Promise<HabitEntry[]> {
    if (habitIds.length === 0) return [];

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find(scopeFilter(householdId, userId, {
            habitId: { $in: habitIds },
            deletedAt: { $exists: false },
        }))
        .toArray();

    return documents.map(doc => mapDocToEntry(doc));
}

/**
 * Get habit entries for specific habits since a given dayKey.
 * Only returns entries with dayKey >= sinceDayKey (lexicographic comparison).
 * Used for recent-window queries (e.g. last 30 days for goal heatmaps).
 */
export async function getHabitEntriesByHabitIdsSince(
    habitIds: string[],
    householdId: string,
    userId: string,
    sinceDayKey: string
): Promise<HabitEntry[]> {
    if (habitIds.length === 0) return [];

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const documents = await collection
        .find(scopeFilter(householdId, userId, {
            habitId: { $in: habitIds },
            deletedAt: { $exists: false },
            dayKey: { $gte: sinceDayKey },
        }))
        .toArray();

    return documents.map(doc => mapDocToEntry(doc));
}

/**
 * Reassign all non-deleted entries from one habit to another.
 * Used during habit-to-bundle conversion to move historical entries
 * to a legacy child habit, preserving streak continuity.
 *
 * @returns Object with count of modified entries and the earliest dayKey found
 */
export async function reassignEntries(
    fromHabitId: string,
    toHabitId: string,
    householdId: string,
    userId: string
): Promise<{ modifiedCount: number; earliestDayKey: string | null }> {
    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const filter = scopeFilter(householdId, userId, {
        habitId: fromHabitId,
        deletedAt: { $exists: false },
    });

    // Find the earliest dayKey before reassigning
    const earliest = await collection
        .find(filter)
        .sort({ dayKey: 1 })
        .limit(1)
        .toArray();
    const earliestDayKey = earliest.length > 0 ? (earliest[0].dayKey as string || earliest[0].date as string || null) : null;

    const result = await collection.updateMany(filter, {
        $set: {
            habitId: toHabitId,
            updatedAt: new Date().toISOString(),
        },
    });

    return { modifiedCount: result.modifiedCount, earliestDayKey };
}

/**
 * Aggregate entry totals per habit using MongoDB aggregation pipeline.
 * Returns sum of values and entry count per habitId without transferring documents.
 * Used for efficient cumulative goal progress computation.
 */
export async function aggregateHabitEntryTotals(
    habitIds: string[],
    householdId: string,
    userId: string
): Promise<Array<{ habitId: string; totalValue: number; entryCount: number; distinctDays: number }>> {
    if (habitIds.length === 0) return [];

    const db = await getDb();
    const collection = db.collection(COLLECTION_NAME);

    const pipeline = [
        {
            $match: scopeFilter(householdId, userId, {
                habitId: { $in: habitIds },
                deletedAt: { $exists: false },
            }),
        },
        {
            $group: {
                _id: '$habitId',
                totalValue: { $sum: { $ifNull: ['$value', 0] } },
                entryCount: { $sum: 1 },
                distinctDays: { $addToSet: '$dayKey' },
            },
        },
        {
            $project: {
                _id: 0,
                habitId: '$_id',
                totalValue: 1,
                entryCount: 1,
                distinctDays: { $size: '$distinctDays' },
            },
        },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    return results as Array<{ habitId: string; totalValue: number; entryCount: number; distinctDays: number }>;
}
