/**
 * HabitEntry Routes
 * 
 * REST API for managing habit entries.
 * Automatically triggers DayLog recomputation on mutation.
 */

import type { Request, Response } from 'express';
import {
    createHabitEntry,
    updateHabitEntry,
    deleteHabitEntry,
} from '../repositories/habitEntryRepository';
import { getHabitById } from '../repositories/habitRepository';
import { validateHabitEntryPayload } from '../utils/habitValidation';
import { recomputeDayLogForHabit } from '../utils/recomputeUtils';
import { validateDayKey, assertTimeZone, validateHabitEntryPayloadStructure, assertNoStoredCompletion } from '../domain/canonicalValidators';
import { normalizeHabitEntryPayload } from '../utils/dayKeyNormalization';

/**
 * Get entry views for a habit (via truthQuery).
 * GET /api/entries?habitId=...&startDayKey=...&endDayKey=...&timeZone=...
 * 
 * Returns EntryView[] from truthQuery (unified HabitEntries + legacy DayLogs).
 * All history reads should use this endpoint.
 */
export async function getHabitEntriesRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        const { habitId, startDayKey, endDayKey, timeZone } = req.query;

        if (!habitId || typeof habitId !== 'string') {
            res.status(400).json({ error: 'habitId is required' });
            return;
        }

        // timeZone is required for DayKey derivation
        const userTimeZone = (timeZone && typeof timeZone === 'string')
            ? timeZone
            : 'UTC'; // Default to UTC if not provided

        // Validate timeZone
        const timeZoneValidation = assertTimeZone(userTimeZone);
        if (!timeZoneValidation.valid) {
            res.status(400).json({ error: timeZoneValidation.error });
            return;
        }

        // Validate dayKeys if provided
        if (startDayKey && typeof startDayKey === 'string') {
            const dayKeyValidation = validateDayKey(startDayKey);
            if (!dayKeyValidation.valid) {
                res.status(400).json({ error: dayKeyValidation.error });
                return;
            }
        }

        if (endDayKey && typeof endDayKey === 'string') {
            const dayKeyValidation = validateDayKey(endDayKey);
            if (!dayKeyValidation.valid) {
                res.status(400).json({ error: dayKeyValidation.error });
                return;
            }
        }

        // Fetch via truthQuery (unified HabitEntries + legacy DayLogs)
        const { getEntryViewsForHabit } = await import('../services/truthQuery');
        const entryViews = await getEntryViewsForHabit(habitId, userId, {
            startDayKey: startDayKey as string | undefined,
            endDayKey: endDayKey as string | undefined,
            timeZone: userTimeZone,
        });

        res.json({ entries: entryViews });
    } catch (error) {
        console.error('Error fetching entries:', error);
        res.status(500).json({ error: 'Failed to fetch entries' });
    }
}

/**
 * Create a new entry.
 * POST /api/entries
 */
export async function createHabitEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        // habitId, value, date (required), note, source...
        const entryData = req.body;

        if (!entryData.habitId || !entryData.date || entryData.value === undefined) {
            // For choice habits, value CAN be undefined if metric is none.
            // But traditionally, for legacy habits, value was required. 
            // Logic below handles choice specifically.
            // If we strict check value here, we break choice with metric=none.
            // We should relax this check and rely on validation utils.
            // But wait, existing code expects value.
            // Let's rely on validation mostly.
        }

        // Validate payload structure (canonical invariants)
        const structureValidation = validateHabitEntryPayloadStructure(entryData);
        if (!structureValidation.valid) {
            res.status(400).json({ error: structureValidation.error });
            return;
        }

        // Ensure no stored completion flags
        const noCompletionValidation = assertNoStoredCompletion(entryData);
        if (!noCompletionValidation.valid) {
            res.status(400).json({ error: noCompletionValidation.error });
            return;
        }

        // Normalize dayKey from various inputs (dayKey, date, or timestamp + timeZone)
        const userTimeZone = (entryData.timeZone && typeof entryData.timeZone === 'string')
            ? entryData.timeZone
            : 'UTC'; // Default to UTC

        let normalizedPayload;
        try {
            normalizedPayload = normalizeHabitEntryPayload(entryData, userTimeZone);
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Failed to normalize dayKey'
            });
            return;
        }

        if (!entryData.habitId) {
            res.status(400).json({ error: 'Missing required field: habitId' });
            return;
        }

        // 0. Fetch Habit & Validate
        const habit = await getHabitById(entryData.habitId, userId);
        if (!habit) {
            res.status(404).json({ error: 'Habit not found' });
            return;
        }

        // Validate habit-specific rules (Choice Bundle, etc.)
        const validation = validateHabitEntryPayload(habit, entryData);
        if (!validation.valid) {
            res.status(400).json({ error: validation.error });
            return;
        }

        // 1. Create Entry with normalized dayKey (date is NOT persisted, only accepted as input)
        const { date: _, ...entryDataWithoutDate } = entryData;
        const newEntry = await createHabitEntry({
            ...entryDataWithoutDate,
            dayKey: normalizedPayload.dayKey,
            // date is NOT included - it's only accepted as input and normalized to dayKey
            timestamp: normalizedPayload.timestampUtc,
            source: entryData.source || 'manual' // Default source
        }, userId);

        // Add date to response for backward compatibility (derived from dayKey)
        const responseEntry = { ...newEntry, date: newEntry.dayKey };

        // 2. Recompute DayLog (use dayKey)
        if (!newEntry.dayKey) {
            throw new Error('Entry missing dayKey after creation');
        }
        const updatedDayLog = await recomputeDayLogForHabit(
            newEntry.habitId,
            newEntry.dayKey,
            userId
        );

        res.status(201).json({
            entry: responseEntry, // Includes date as derived alias for backward compatibility
            dayLog: updatedDayLog // Return derived state
        });

    } catch (error) {
        console.error('Error creating entry:', error);
        res.status(500).json({ error: 'Failed to create entry' });
    }
}

/**
 * Delete an entry.
 * DELETE /api/entries/:id
 */
export async function deleteHabitEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        const { id } = req.params;

        // We need to know habitId and date to recompute.
        // Since we don't have them in params, we might need to fetch the entry first?
        // OR the client sends them?
        // Fetching is safer.

        // Wait, we can't easily fetch "by id" in our repo without `getHabitEntryById`.
        // `updateHabitEntry` and `delete` use filter `{id, userId}` directly.
        // But to recompute, we NEED habitId and date.

        // Let's add `getHabitEntryById` to repo? 
        // Or simply ask client to provide context? 
        // Safer: add `getHabitEntryById` to repo. 
        // For now, I'll use a direct findOne logic here or assume client passes query params?
        // No, that's brittle.
        // I will add a simple Find to the repo logic inline or update repo. 

        // Let's rely on standard REST. The client just says DELETE /id.
        // So I must lookup the entry to know what to recompute.

        // HACK: I'll use the findOneAndUpdate return value in deleteHabitEntry?
        // My repo `deleteHabitEntry` returns boolean.
        // Let's rely on `delete` returning the doc? 
        // The repo used `findOneAndUpdate` but didn't return the doc.
        // I should update the repo to return the deleted doc so I can read its habitId/date.

        // Actually, let's step back and fix the repo to return the deleted entry.
        // Or just fetch it before deleting.

        // I'll assume for this iteration I'll fetch it from DB using `getDb` here (leaky) or update repo.
        // Updating repo is better.
        // But since I can't update repo in this "tool call" easily without rewriting it...
        // I'll just use a direct DB query here to "peek" before delete. 
        // Actually, importing `getDb` here is fine.

        const { getDb } = await import('../lib/mongoClient');
        const db = await getDb();
        const entry = await db.collection('habitEntries').findOne({ id, userId });

        if (!entry) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }

        const { habitId, dayKey } = entry;
        if (!dayKey) {
            res.status(500).json({ error: 'Entry missing dayKey' });
            return;
        }

        // 1. Delete
        const deleted = await deleteHabitEntry(id, userId);
        if (!deleted) {
            res.status(500).json({ error: 'Failed to delete' });
            return;
        }

        // 2. Recompute
        const updatedDayLog = await recomputeDayLogForHabit(habitId, dayKey, userId);

        res.json({
            success: true,
            dayLog: updatedDayLog // might be null if day is empty now
        });

    } catch (error) {
        console.error('Error deleting entry:', error);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
}

/**
 * Update an entry.
 * PATCH /api/entries/:id
 */
export async function updateHabitEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        const { id } = req.params;
        const patch = req.body;

        // Ensure no stored completion flags
        const noCompletionValidation = assertNoStoredCompletion(patch);
        if (!noCompletionValidation.valid) {
            res.status(400).json({ error: noCompletionValidation.error });
            return;
        }

        // 1. Fetch old entry to capture old dayKey before update
        // This is necessary to recompute both old and new dates if dayKey changes
        const { getDb } = await import('../lib/mongoClient');
        const db = await getDb();
        const oldEntry = await db.collection('habitEntries').findOne({ id, userId });

        if (!oldEntry) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }

        const oldDayKey = oldEntry.dayKey || oldEntry.date;
        const habitId = oldEntry.habitId;

        // Normalize dayKey if date/dayKey/timestamp is being updated
        if (patch.date || patch.dayKey || patch.timestamp) {
            const userTimeZone = (patch.timeZone && typeof patch.timeZone === 'string')
                ? patch.timeZone
                : 'UTC';

            try {
                const normalized = normalizeHabitEntryPayload({
                    ...patch,
                    timestamp: patch.timestamp || oldEntry.timestamp,
                }, userTimeZone);

                // Update patch with normalized dayKey (date is NOT persisted, only accepted as input)
                patch.dayKey = normalized.dayKey;
                // Remove date from patch - it's only accepted as input, not persisted
                delete patch.date;
                patch.timestamp = normalized.timestampUtc;
            } catch (error) {
                res.status(400).json({
                    error: error instanceof Error ? error.message : 'Failed to normalize dayKey'
                });
                return;
            }
        }

        // 2. Update entry
        const updatedEntry = await updateHabitEntry(id, userId, patch);

        if (!updatedEntry) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }

        // 3. Recompute DayLogs for affected dayKeys
        const newDayKey = updatedEntry.dayKey;
        if (!newDayKey) {
            throw new Error('Entry missing dayKey after update');
        }

        // Add date to response for backward compatibility (derived from dayKey)
        const responseEntry = { ...updatedEntry, date: updatedEntry.dayKey };

        if (oldDayKey !== newDayKey) {
            // DayKey changed: recompute both old and new dayKeys
            // This ensures no stale completion/progress remains on the old dayKey
            await Promise.all([
                recomputeDayLogForHabit(habitId, oldDayKey, userId),
                recomputeDayLogForHabit(habitId, newDayKey, userId)
            ]);

            // Recompute new dayKey's DayLog for response
            const newDayLog = await recomputeDayLogForHabit(habitId, newDayKey, userId);

            // Return the new dayLog (old one is cleaned up if no entries remain)
            res.json({
                entry: responseEntry, // Includes date as derived alias
                dayLog: newDayLog
            });
        } else {
            // DayKey unchanged: recompute once (current behavior)
            const updatedDayLog = await recomputeDayLogForHabit(
                habitId,
                newDayKey,
                userId
            );

            res.json({
                entry: responseEntry, // Includes date as derived alias
                dayLog: updatedDayLog
            });
        }

    } catch (error) {
        console.error('Error updating entry:', error);
        res.status(500).json({ error: 'Failed to update entry' });
    }
}

/**
 * Delete all entries for a habit on a specific day.
 * DELETE /api/entries?habitId=...&date=...
 */
export async function deleteHabitEntriesForDayRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        const { habitId, date } = req.query;

        if (!habitId || typeof habitId !== 'string' || !date || typeof date !== 'string') {
            // If ID is provided, it's a single delete (handled by deleteHabitEntryRoute /:id)
            // But valid REST might treat DELETE /api/entries as bulk delete.
            res.status(400).json({ error: 'habitId and date are required for bulk delete' });
            return;
        }

        const { deleteHabitEntriesForDay } = await import('../repositories/habitEntryRepository');

        // 1. Bulk Delete
        // Normalize date to dayKey (both are YYYY-MM-DD format)
        const dayKey = date;
        await deleteHabitEntriesForDay(habitId, dayKey, userId);

        // 2. Recompute (should result in deleted/empty log)
        const updatedDayLog = await recomputeDayLogForHabit(habitId, dayKey, userId);

        res.json({
            success: true,
            dayLog: updatedDayLog
        });

    } catch (error) {
        console.error('Error deleting entries for day:', error);
        res.status(500).json({ error: 'Failed to delete entries' });
    }
}


/**
 * Upsert a habit entry (Idempotent).
 * PUT /api/entries
 */
export async function upsertHabitEntryRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        const { habitId, dateKey, ...data } = req.body;

        if (!habitId || !dateKey) {
            res.status(400).json({ error: 'habitId and dateKey are required' });
            return;
        }

        const { upsertHabitEntry } = await import('../repositories/habitEntryRepository');

        // 0. Fetch Habit & Validate
        const habit = await getHabitById(habitId, userId);
        if (!habit) {
            res.status(404).json({ error: 'Habit not found' });
            return;
        }

        const validation = validateHabitEntryPayload(habit, { ...data, habitId }); // data includes value, bundleOptionId
        if (!validation.valid) {
            res.status(400).json({ error: validation.error });
            return;
        }

        // 1. Upsert
        const entry = await upsertHabitEntry(habitId, dateKey, userId, data);

        // 2. Recompute DayLog (Legacy/Cache)
        const updatedDayLog = await recomputeDayLogForHabit(habitId, dateKey, userId);

        res.json({
            entry,
            dayLog: updatedDayLog
        });

    } catch (error) {
        console.error('Error upserting entry:', error);
        res.status(500).json({ error: 'Failed to upsert entry' });
    }
}

/**
 * Delete a habit entry by key.
 * DELETE /api/entries/key?habitId=...&dateKey=...
 */
export async function deleteHabitEntryByKeyRoute(req: Request, res: Response): Promise<void> {
    try {
        const userId = (req as any).userId || 'anonymous-user';
        const { habitId, dateKey } = req.query;

        if (!habitId || typeof habitId !== 'string' || !dateKey || typeof dateKey !== 'string') {
            res.status(400).json({ error: 'habitId and dateKey are required' });
            return;
        }

        const { deleteHabitEntryByKey } = await import('../repositories/habitEntryRepository');

        // 1. Delete
        await deleteHabitEntryByKey(habitId, dateKey, userId);

        // 2. Recompute
        const updatedDayLog = await recomputeDayLogForHabit(habitId, dateKey, userId);

        res.json({
            success: true,
            dayLog: updatedDayLog
        });

    } catch (error) {
        console.error('Error deleting entry by key:', error);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
}
