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
    // For numeric habits: sum of values
    // For boolean habits: existence of entries implies '1' (or sum of 1s)
    let totalValue = 0;

    // We can assume if entry exists, it contributes.
    // If it's a numeric habit, we sum data.value.
    // If it's boolean, usually entries have value=1, but we can just count presence if we wanted.
    // However, PRD says consistency: "Value (number | null) // null or 1 for binary habits"
    // Let's sum valid numbers.
    for (const entry of entries) {
        if (typeof entry.value === 'number') {
            totalValue += entry.value;
        }
    }

    // 5. Determine completion status
    const target = habit.goal.target || 0;
    const isNumeric = habit.goal.type === 'number';

    let completed = false;

    if (isNumeric) {
        completed = totalValue >= target;
    } else {
        // Boolean: if we have any entries (and value > 0), it's done.
        // Usually boolean habits have 1 entry of value 1.
        // If we have distinct entries that sum to > 0, it's done.
        completed = totalValue > 0;
    }

    // 6. Create DayLog derived object
    // We pick the Source from the most recent entry if mixed?
    // Or just 'manual' as default fallback.
    // Use the latest entry's source
    const lastEntry = entries[0]; // Sorted by timestamp desc in repo
    const source = lastEntry?.source === 'routine' ? 'routine' : 'manual';
    const routineId = lastEntry?.routineId;

    const dayLog: DayLog = {
        habitId,
        date,
        value: totalValue,
        completed,
        source, // derived
        routineId, // derived from latest
    };

    // 7. Upsert
    const savedLog = await upsertDayLog(dayLog, userId);
    return savedLog;
}
