import { getDayLogsByHabit } from '../repositories/dayLogRepository';
import { createHabitEntry, getHabitEntriesByHabit } from '../repositories/habitEntryRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
// import type { DayLog, HabitEntry } from '../../models/persistenceTypes';

/**
 * Backfill DayLogs into HabitEntries
 * 
 * Idempotent: Checks if entry exists for (habitId + date) before creating.
 */
export async function backfillDayLogsToEntries(userId: string): Promise<{ created: number; skipped: number; errors: number }> {
    let created = 0;
    let skipped = 0;
    let errors = 0;

    try {
        // 1. Get all habits for user
        const habits = await getHabitsByUser(userId);

        // 2. For each habit, get all day logs and existing entries
        for (const habit of habits) {
            const dayLogsMap = await getDayLogsByHabit(habit.id, userId);
            const dayLogs = Object.values(dayLogsMap);

            const existingEntries = await getHabitEntriesByHabit(habit.id, userId);
            const entryDateMap = new Set(existingEntries.map(e => e.date));

            for (const log of dayLogs) {
                // Skip if already exists or no meaningful value (unless completed boolean)
                if (entryDateMap.has(log.date)) {
                    skipped++;
                    continue;
                }

                // Logic to determine value
                let value: number | undefined = log.value;
                if (value === undefined && log.completed) {
                    // For boolean habits that are completed but have no value, default to 1 for migration if we want to count them.
                    // However, strict aggregation will handle "value needed for numeric goals" separately.
                    // For now, let's preserve the exact state: only set value if it exists or if we infer it for boolean.
                    // BUT, the goal issue is about numeric goals. 
                    // If we backfill undefined -> 1 for binary habits, we replicate the "1 mile" bug if unit mismatch isn't fixed.
                    // WE WILL FIX UNIT MISMATCH in the next step.
                    // So it IS safe to backfill 1 for binary completion, so that they have a value for "Count" based goals.
                    // But wait, the user said "Goal cumulative chart... is incorrect when... A weekly binary habit... is linked... to A daily numeric habit".
                    // If we backfill 1, and don't fix aggregation, issue persists.
                    // If we fix aggregation, backfilling 1 is fine for binary goals.

                    // Actually, keep it faithful: if log.value is undefined, entry.value is undefined?
                    // HabitEntry schema says value?: number.
                    // Let's copy strictly. If log.completed is true, we create an entry.
                }

                if (!log.completed && (log.value === undefined || log.value === 0)) {
                    // No need to backfill empty/incomplete logs that have no value
                    continue;
                }

                try {
                    await createHabitEntry({
                        habitId: log.habitId,
                        date: log.date,
                        value: log.value,
                        source: 'import', // Mark as imported
                        // timestamp? DayLog doesn't have time. Use date + noon? Or just date string in timestamp field if permitted?
                        // Schema: timestamp is string (ISO). 
                        timestamp: `${log.date}T12:00:00.000Z`,
                    }, userId);
                    created++;
                } catch (e) {
                    console.error(`Failed to backfill log ${log.habitId}-${log.date}`, e);
                    errors++;
                }
            }
        }
    } catch (err) {
        console.error("Migration fatal error", err);
        throw err;
    }

    return { created, skipped, errors };
}
