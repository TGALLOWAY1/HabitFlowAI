import { differenceInDays, isSameDay, subDays, parseISO, startOfDay } from 'date-fns';
import type { Habit, DayLog } from '../types';

export interface HabitStats {
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    consistencyScore: number; // 0-100
    cumulativeValue: number;
}

export const calculateHabitStats = (habit: Habit, logs: Record<string, DayLog>): HabitStats => {
    const habitLogs = Object.values(logs)
        .filter(log => log.habitId === habit.id && log.completed)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Descending order

    const totalCompletions = habitLogs.length;
    const cumulativeValue = Object.values(logs)
        .filter(log => log.habitId === habit.id)
        .reduce((sum, log) => sum + (log.value || 0), 0);

    // Calculate Streaks
    let currentStreak = 0;
    let longestStreak = 0;

    const today = startOfDay(new Date());

    // Check if completed today or yesterday to start current streak
    const hasCompletedToday = habitLogs.some(log => isSameDay(parseISO(log.date), today));
    const hasCompletedYesterday = habitLogs.some(log => isSameDay(parseISO(log.date), subDays(today, 1)));

    if (hasCompletedToday || hasCompletedYesterday) {
        // Iterate to find current streak
        let checkDate = hasCompletedToday ? today : subDays(today, 1);

        while (true) {
            const hasLog = habitLogs.some(log => isSameDay(parseISO(log.date), checkDate));
            if (hasLog) {
                currentStreak++;
                checkDate = subDays(checkDate, 1);
            } else {
                break;
            }
        }
    }

    // Calculate Longest Streak (Simplified for now, just iterating sorted logs)
    // Note: This is a basic implementation. For perfect accuracy with gaps, we'd need more robust logic.
    // But for now, let's just count consecutive days in the logs.
    if (habitLogs.length > 0) {
        let currentSequence = 1;
        longestStreak = 1;

        for (let i = 0; i < habitLogs.length - 1; i++) {
            const date1 = parseISO(habitLogs[i].date);
            const date2 = parseISO(habitLogs[i + 1].date);
            const diff = differenceInDays(date1, date2);

            if (diff === 1) {
                currentSequence++;
            } else {
                longestStreak = Math.max(longestStreak, currentSequence);
                currentSequence = 1;
            }
        }
        longestStreak = Math.max(longestStreak, currentSequence);
    }

    // Consistency Score (Last 30 Days)
    const last30Days = 30;
    let completedInLast30 = 0;
    for (let i = 0; i < last30Days; i++) {
        const dateToCheck = subDays(today, i);
        const hasLog = habitLogs.some(log => isSameDay(parseISO(log.date), dateToCheck));
        if (hasLog) completedInLast30++;
    }
    const consistencyScore = Math.round((completedInLast30 / last30Days) * 100);

    return {
        currentStreak,
        longestStreak,
        totalCompletions,
        consistencyScore,
        cumulativeValue,
    };
};

export const getHeatmapColor = (intensity: number) => {
    if (intensity === 0) return 'bg-neutral-800/50';
    if (intensity === 1) return 'bg-emerald-900/80';
    if (intensity === 2) return 'bg-emerald-700';
    if (intensity === 3) return 'bg-emerald-500';
    return 'bg-emerald-400';
};
