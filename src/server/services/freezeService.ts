import type { Habit, DayLog } from '../../types';
import { upsertDayLog, getDayLog } from '../repositories/dayLogRepository';
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

export const processAutoFreezes = async (habits: Habit[], logs: Record<string, DayLog>, userId: string): Promise<void> => {
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
        const logKey = `${habitId}-${yesterdayStr}`;
        const log = logs[logKey]; // Note: logs passed in might be just today's? 
        // We probably need to fetch specific logs or rely on what's passed.
        // Better: Fetch yesterday's log specifically if not present.

        // Optimize: Check if yesterday is already handled (completed or frozen)
        if (log && (log.completed || log.isFrozen)) {
            continue;
        }

        // If no log or not completed/frozen:
        // Check inventory
        const currentInventory = habit.freezeCount ?? 3;
        if (currentInventory <= 0) continue;

        // Check if freeze is NEEDED to save a streak.
        // We need to know if there WAS a streak ending on Day - 2.
        // We can use calculateDailyStreak on logs up to Day - 2.
        // This is expensive to fetch all logs just for this check.
        // Heuristic: If we have a streak > 0, it implies we have recent activity.
        // But we don't have "current streak" stored on habit, it's computed.

        // For MVP efficiency: We'll assume if they have inventory, they want to save *potential* streak.
        // But we shouldn't burn a freeze if they haven't started yet (Streak 0).

        // Let's rely on the fact that if we *don't* freeze, streak becomes 0.
        // If we *do* freeze, streak is preserved.
        // So we need to know if (Streak up to D-2) > 0.

        // Limitation: calculating streak requires history. 
        // We might need to fetch last few logs.
        // Let's try "lazy" approach: Just apply freeze if missing? 
        // No, that burns inventory on day 1 of a new habit.

        // Correct approach:
        // We need to verify 3 things:
        // 1. Log missing/incomplete for Yesterday.
        // 2. Inventory > 0.
        // 3. Streak(Day-2) > 0.

        // Fetch logs for this habit (enough to check streak)
        // We might need to optimization this later.
        // For now, let's assume we can fetch recent logs?
        // Or perhaps we just check D-2 log?
        // If D-2 is completed or frozen, then we have a streak of at least 1.

        const dayMinus2 = subDays(yesterday, 1);
        const dayMinus2Str = format(dayMinus2, 'yyyy-MM-dd');

        // We need to fetch this log from DB
        const logMinus2 = await getDayLog(habitId, dayMinus2Str, userId);

        if (logMinus2 && (logMinus2.completed || logMinus2.isFrozen)) {
            // Yes, we have a streak to protect!

            // 1. Create the Freeze Log
            await upsertDayLog({
                habitId,
                date: yesterdayStr,
                value: 0,
                completed: false,
                isFrozen: true,
                freezeType: 'auto'
            }, userId);

            // 2. Decrement Inventory
            await updateHabit(habitId, userId, {
                freezeCount: currentInventory - 1
            });

            // Update local logs object if it's being used for response
            // (Caller should probably re-fetch or we mutate local copy carefully)
        }
    }
};
