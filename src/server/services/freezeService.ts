import type { Habit, DayLog } from '../../types';
import { createHabitEntry, getHabitEntriesForDay } from '../repositories/habitEntryRepository';
import { updateHabit } from '../repositories/habitRepository';

import { subDays, format } from 'date-fns';

/**
 * Freeze Service
 * 
 * Handles automatic freeze application rules.
 * 
 * Rules:
 * - Max freezes: 3
 * - Auto Freeze: Consumes 1 inventory if habit missed AND streak would break.
 */

export const processAutoFreezes = async (habits: Habit[], _logs: Record<string, DayLog>, userId: string): Promise<void> => {
    // We only check "Yesterday". 
    // If today is missed, it's not a freeze YET (user might still do it).
    // If we missed yesterday and didn't freeze, streak is already broken? 
    // Actually, if we load the dashboard today, yesterday's miss is final.
    // So we check Yesterday.

    const yesterday = subDays(new Date(), 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

    for (const habit of habits) {
        // Skip if habit is archived or doesn't track streaks (e.g. non-daily?)
        // Assuming all daily habits. Weekly habits handled separately or by week logic?
        // PRD: "If weekly habits exist, ensure the frozen state applies at the appropriate unit (week)."
        // MVP: Focus on Daily auto-freeze.
        if (habit.goal.frequency !== 'daily') continue;

        const habitId = habit.id;

        // Canonical check: if yesterday already has any entry (completed or freeze marker), skip.
        const yesterdayEntries = await getHabitEntriesForDay(habitId, yesterdayStr, userId);
        if (yesterdayEntries.length > 0) {
            continue;
        }

        // If no log or not completed/frozen:
        // Check inventory
        const currentInventory = habit.freezeCount ?? 3;
        if (currentInventory <= 0) continue;

        const dayMinus2 = subDays(yesterday, 1);
        const dayMinus2Str = format(dayMinus2, 'yyyy-MM-dd');

        // Canonical check: Day-2 must have an entry to indicate an active streak to protect.
        const dayMinus2Entries = await getHabitEntriesForDay(habitId, dayMinus2Str, userId);

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
            }, userId);

            // 2. Decrement Inventory
            await updateHabit(habitId, userId, {
                freezeCount: currentInventory - 1
            });
        }
    }
};
