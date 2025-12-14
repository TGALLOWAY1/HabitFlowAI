import type { DayLog, HabitEntry, PersistenceSchema } from '../models/persistenceTypes';
import { randomUUID } from 'crypto';

/**
 * Migrates deprecated DayLogs to universal HabitEntries.
 * Enforces Single-Entry Per Day constraint.
 * 
 * Logic:
 * 1. Iterate all DayLogs where completed == true.
 * 2. Check if a HabitEntry already exists for (habitId, dateKey).
 * 3. If not, create one.
 * 
 * @param data - The full persistence schema
 * @returns The updated persistence schema with migrated entries
 */
export function migrateDayLogsToEntries(data: PersistenceSchema): PersistenceSchema {
    console.log('[Migration] Starting DayLog -> HabitEntry IDEMPOTENT migration...');

    const logs = data.logs || {};
    const existingEntries = data.habitEntries || [];
    const newEntries: HabitEntry[] = [...existingEntries];

    // Build a lookup set for existing (habitId, dateKey) tuples to ensure uniqueness
    // Using a Set string: `${habitId}:${dateKey}`
    const existingKeys = new Set<string>();

    existingEntries.forEach(entry => {
        // Fallback: if dateKey missing, try to derive from date or timestamp
        const keyDate = entry.dateKey || entry.date || entry.timestamp?.split('T')[0];
        if (keyDate) {
            existingKeys.add(`${entry.habitId}:${keyDate}`);
        }
    });

    let migratedCount = 0;

    Object.values(logs).forEach((log: DayLog) => {
        if (!log.completed) return; // Only migrate completed logs

        const uniqueKey = `${log.habitId}:${log.date}`;

        if (existingKeys.has(uniqueKey)) {
            // Entry already exists for this day, skip to enforce single-entry
            return;
        }

        // Create new Entry
        const newEntry: HabitEntry = {
            id: randomUUID(),
            habitId: log.habitId,
            // Use noon to avoid timezone edge cases, but strictly rely on dateKey
            timestamp: `${log.date}T12:00:00.000Z`,
            dateKey: log.date, // THE source of truth
            date: log.date, // Legacy field support
            value: log.value || 1, // Default to 1 (boolean true) if value missing
            source: log.source || 'manual', // Preserve source if possible
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        newEntries.push(newEntry);
        existingKeys.add(uniqueKey); // Prevent duplicates within this run
        migratedCount++;
    });

    console.log(`[Migration] Migrated ${migratedCount} DayLogs to HabitEntries.`);

    return {
        ...data,
        habitEntries: newEntries
    };
}
