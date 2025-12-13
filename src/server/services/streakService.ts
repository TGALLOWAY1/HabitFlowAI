import type { DayLog } from '../../types';
import { subDays, isSameDay, parseISO, getISOWeek, getYear } from 'date-fns';

/**
 * Streak Service
 * 
 * Handles resilient streak logic:
 * 1. Daily Streak (days contiguous, bridged by freezes)
 * 2. Weekly Streak (weeks contiguous, partial credit counts)
 */

export const calculateDailyStreak = (logs: DayLog[], habitId: string, referenceDate: Date = new Date()): number => {
    // 1. Filter logs for this habit
    const habitLogs = logs.filter(l => l.habitId === habitId && (l.completed || l.isFrozen));

    // 2. Sort logs by date descending
    habitLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let streak = 0;
    let checkDate = referenceDate;

    // 3. Handle "Today"
    // If we have a log for today (completed or frozen), streak includes it.
    // If not, we don't break; we just check yesterday.
    const todayLog = habitLogs.find(l => isSameDay(parseISO(l.date), checkDate));
    if (todayLog) {
        streak++;
        checkDate = subDays(checkDate, 1);
    } else {
        // No log for today. Streak assumes we stick active from yesterday?
        // Actually, if I haven't done it today, my streak is whatever it was yesterday.
        // So we just step back one day to start checking "history".
        checkDate = subDays(checkDate, 1);
    }

    // 4. Iterate backwards
    // We allow gaps ONLY if they are covered by a freeze?
    // Wait, the `habitLogs` array only contains "good" days (completed or frozen).
    // So if the next log in the array is NOT `checkDate`, then we have a gap.

    // BUT, we need to handle the fact that we might have skipped "today" but done "yesterday".
    // Or skipped "today" and "yesterday" (Break).

    // Better approach: Iterate days backwards from checkDate.
    // Stop when we find a day with NO log.

    // Max lookback? A reasonable number or until streak breaks.
    // We can iterate until we fail to find a log.

    // Optimization: Use a Set of date strings for O(1) lookup
    const validDates = new Set(habitLogs.map(l => l.date));

    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];

        if (validDates.has(dateStr)) {
            streak++;
            checkDate = subDays(checkDate, 1);
        } else {
            // Found a gap. Streak ends.
            break;
        }

        // Safety break for infinite loops (though subDays should prevent)
        if (streak > 10000) break;
    }

    return streak;
};

export const calculateWeeklyStreak = (logs: DayLog[], habitId: string, referenceDate: Date = new Date()): number => {
    // 1. Group logs by Week (ISO Week)
    // Map: "YYYY-WW" -> count
    const weekCounts = new Map<string, number>();
    const frozenWeeks = new Set<string>(); // Keep track if any day in the week was frozen

    logs.filter(l => l.habitId === habitId).forEach(log => {
        const date = parseISO(log.date);
        const key = `${getYear(date)}-${getISOWeek(date)}`;

        if (log.completed) {
            weekCounts.set(key, (weekCounts.get(key) || 0) + 1);
        }
        if (log.isFrozen) {
            frozenWeeks.add(key);
        }
    });

    let streak = 0;
    let checkDate = referenceDate;

    // Current Week handling
    const currentWeekKey = `${getYear(checkDate)}-${getISOWeek(checkDate)}`;
    const currentWeekCount = weekCounts.get(currentWeekKey) || 0;
    const currentWeekFrozen = frozenWeeks.has(currentWeekKey);

    // If current week has >= 1 completion OR is frozen, it counts.
    // If 0 completions, it doesn't break streak yet (week in progress), so we ignore it and start from previous week.
    // Wait, if it has completions, we increment streak.
    if (currentWeekCount >= 1 || currentWeekFrozen) {
        streak++;
    }

    // Move to previous week
    checkDate = subDays(checkDate, 7); // Rough jump, better to align to end of prev week?
    // Actually just iterating weeks is safer.

    const maxWeeks = 500; // Safety cap
    for (let i = 0; i < maxWeeks; i++) {
        const weekKey = `${getYear(checkDate)}-${getISOWeek(checkDate)}`;
        const count = weekCounts.get(weekKey) || 0;
        const isFrozen = frozenWeeks.has(weekKey);

        if (count >= 1 || isFrozen) {
            streak++;
            checkDate = subDays(checkDate, 7);
        } else {
            break;
        }
    }

    return streak;
};

