import type { Habit, DayLog } from '../../types';
import { createHabitEntry, getHabitEntriesForDay } from '../repositories/habitEntryRepository';
import { updateHabit } from '../repositories/habitRepository';

import { subDays, format, startOfWeek, getDay, addDays } from 'date-fns';

/**
 * Freeze Service
 *
 * Handles automatic freeze application rules.
 *
 * Rules:
 * - Max freezes: 3
 * - Auto Freeze: Consumes 1 inventory if habit missed AND streak would break.
 * - Daily habits: checked every day against "yesterday"
 * - Weekly habits: checked on Mondays against the previous week (Mon-Sun)
 */

/**
 * Count non-freeze completion entries for a habit across a Mon-Sun week window.
 */
async function countWeekCompletions(
    habitId: string,
    weekStart: Date,
    householdId: string,
    userId: string
): Promise<number> {
    let count = 0;
    for (let i = 0; i < 7; i++) {
        const day = addDays(weekStart, i);
        const dayStr = format(day, 'yyyy-MM-dd');
        const entries = await getHabitEntriesForDay(habitId, dayStr, householdId, userId);
        // Count days with at least one non-freeze entry
        const hasCompletion = entries.some(e => !e.note?.startsWith('freeze:'));
        if (hasCompletion) count++;
    }
    return count;
}

export const processAutoFreezes = async (habits: Habit[], _logs: Record<string, DayLog>, householdId: string, userId: string): Promise<void> => {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    for (const habit of habits) {
        const habitId = habit.id;
        const currentInventory = habit.freezeCount ?? 3;
        if (currentInventory <= 0) continue;

        // Weekly habits: check at week boundary (Monday) against the previous week
        if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
            // Only run on Mondays — the first day after a week closes
            if (getDay(now) !== 1) continue;

            const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
            const previousWeekStart = subDays(currentWeekStart, 7);
            const weekBeforeStart = subDays(currentWeekStart, 14);

            // Check if previous week was satisfied (completions >= timesPerWeek)
            const prevWeekCompletions = await countWeekCompletions(habitId, previousWeekStart, householdId, userId);
            if (prevWeekCompletions >= habit.timesPerWeek) continue; // Week was satisfied, no freeze needed

            // Check if there was an active streak to protect (the week before must have been satisfied)
            const weekBeforeCompletions = await countWeekCompletions(habitId, weekBeforeStart, householdId, userId);
            if (weekBeforeCompletions < habit.timesPerWeek) continue; // No streak to protect

            // Check that the previous week's Sunday doesn't already have a freeze marker
            const prevWeekSunday = subDays(currentWeekStart, 1);
            const prevWeekSundayStr = format(prevWeekSunday, 'yyyy-MM-dd');
            const sundayEntries = await getHabitEntriesForDay(habitId, prevWeekSundayStr, householdId, userId);
            const alreadyFrozen = sundayEntries.some(e => e.note?.startsWith('freeze:'));
            if (alreadyFrozen) continue;

            // Create freeze marker on previous week's Sunday
            await createHabitEntry({
                habitId,
                dayKey: prevWeekSundayStr,
                timestamp: `${prevWeekSundayStr}T23:59:59.000Z`,
                value: 0,
                source: 'manual',
                note: 'freeze:auto',
            }, householdId, userId);

            await updateHabit(habitId, householdId, userId, {
                freezeCount: currentInventory - 1
            });

            continue;
        }

        // Daily habits: existing logic
        if (habit.goal.frequency !== 'daily') continue;

        // Canonical check: if yesterday already has any entry (completed or freeze marker), skip.
        const yesterdayEntries = await getHabitEntriesForDay(habitId, yesterdayStr, householdId, userId);
        if (yesterdayEntries.length > 0) {
            continue;
        }

        const dayMinus2 = subDays(yesterday, 1);
        const dayMinus2Str = format(dayMinus2, 'yyyy-MM-dd');

        // Canonical check: Day-2 must have an entry to indicate an active streak to protect.
        const dayMinus2Entries = await getHabitEntriesForDay(habitId, dayMinus2Str, householdId, userId);

        if (dayMinus2Entries.length > 0) {
            // Yes, we have a streak to protect!

            // 1. Create a freeze marker entry (canonical truth).
            await createHabitEntry({
                habitId,
                dayKey: yesterdayStr,
                timestamp: `${yesterdayStr}T23:59:59.000Z`,
                value: 0,
                source: 'manual',
                note: 'freeze:auto',
            }, householdId, userId);

            // 2. Decrement Inventory
            await updateHabit(habitId, householdId, userId, {
                freezeCount: currentInventory - 1
            });
        }
    }
};
