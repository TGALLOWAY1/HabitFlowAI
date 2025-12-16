/**
 * Recompute Utils
 * 
 * Utilities to keep Derived Data (DayLogs) in sync with Source of Truth (HabitEntries).
 */

import { getHabitEntriesForDay } from '../repositories/habitEntryRepository';
import { upsertDayLog, deleteDayLog } from '../repositories/dayLogRepository';
import { getHabitById } from '../repositories/habitRepository';
import type { DayLog } from '../../models/persistenceTypes';

/**
 * Recomputes the DayLog for a specific habit and date based on its entries.
 * 
 * @param habitId 
 * @param date YYYY-MM-DD
 * @param userId 
 * @returns The updated DayLog or null if deleted/empty
 */
export async function recomputeDayLogForHabit(
    habitId: string,
    date: string,
    userId: string
): Promise<DayLog | null> {

    // 1. Fetch all active entries for this day
    const entries = await getHabitEntriesForDay(habitId, date, userId);

    // 2. If no entries, delete the DayLog and return null (clean up)
    if (entries.length === 0) {
        await deleteDayLog(habitId, date, userId);
        return null;
    }

    // 3. Fetch Habit to check goals
    const habit = await getHabitById(habitId, userId);
    if (!habit) {
        throw new Error(`Habit not found during recompute: ${habitId}`);
    }

    // 4. Aggregate values
    // Choice Habits: Parent completion is binary (if any entries exist). Value is NOT summed.
    // Numeric/Boolean: Sum values.

    let totalValue = 0;
    let completed = false;

    if (habit.bundleType === 'choice') {
        // Choice V2 Logic
        // Completion: true if any entry exists
        completed = entries.length > 0;

        // Value: Should be null/undefined for parent, but DayLog usually expects a number for charts?
        // User requested null. 
        // We will assign undefined (which matches optional value?: number).
        // However, if we want "Streaks" or "Consistency" based on DayLog.value, we might need 0/1.
        // But `completed` boolean is the primary driver for streaks.

        // Collect option completions for List View (UX)
        const completedOptions: Record<string, number> = {};
        for (const entry of entries) {
            if (entry.bundleOptionId) {
                // Legacy Embedded Option
                completedOptions[entry.bundleOptionId] = entry.value || 1;
            } else if (entry.choiceChildHabitId) {
                // New Child Habit Option
                // We key by ID.
                completedOptions[entry.choiceChildHabitId] = entry.value || 1;
            }
        }
    } else {
        // Standard Logic (Numeric / Boolean / Checklist)
        for (const entry of entries) {
            if (typeof entry.value === 'number') {
                totalValue += entry.value;
            }
        }

        const target = habit.goal.target || 0;
        const isNumeric = habit.goal.type === 'number';

        if (isNumeric) {
            completed = totalValue >= target;
        } else {
            // Boolean or Checklist
            completed = totalValue > 0;
        }
    }

    // 6. Create DayLog derived object
    const lastEntry = entries[0]; // Sorted by timestamp desc in repo
    const source = lastEntry?.source === 'routine' ? 'routine' : 'manual';
    const routineId = lastEntry?.routineId;

    // For choice habits, we reconstruct the completedOptions map
    let completedOptionsMap: Record<string, number> | undefined = undefined;
    if (habit.bundleType === 'choice') {
        completedOptionsMap = {};
        for (const entry of entries) {
            if (entry.bundleOptionId) {
                completedOptionsMap[entry.bundleOptionId] = entry.value || 1;
            } else if (entry.choiceChildHabitId) {
                completedOptionsMap[entry.choiceChildHabitId] = entry.value || 1;
            }
        }
    }

    const dayLog: DayLog = {
        habitId,
        date,
        // For choice habits, we purposely set value to undefined (or could be 1 for consistency plotting?)
        // The user said: "value must be null/undefined ... to avoid sum of reps showing as parent value"
        value: habit.bundleType === 'choice' ? undefined : totalValue,
        completed,
        source, // derived
        routineId, // derived from latest
        bundleOptionId: lastEntry?.bundleOptionId, // derived from latest (might be ambiguous for multi-select, but keeps "last action" context)
        completedOptions: completedOptionsMap
    };

    // 7. Upsert
    const savedLog = await upsertDayLog(dayLog, userId);
    return savedLog;
}
