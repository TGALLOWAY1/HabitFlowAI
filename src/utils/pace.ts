import { addDays, differenceInDays, format } from 'date-fns';
import type { HabitStats } from './analytics';
import type { Habit } from '../types';

export const calculatePaceEstimation = (habit: Habit, stats: HabitStats): string | null => {
    if (habit.goal.frequency !== 'total' || !habit.goal.target) return null;

    const remaining = habit.goal.target - stats.cumulativeValue;
    if (remaining <= 0) return 'Goal Reached!';

    // Calculate daily average based on last 30 days (or total history if shorter)
    // We can use totalCompletions / days since creation, but let's use a simple average for now
    // Assuming consistencyScore is a proxy for "days active in last 30 days"
    // But we need the VALUE average, not just boolean completion.

    // Let's use a simpler metric: Average value per day over the last 14 days
    // This requires access to logs, which we don't have here directly, but we have stats.
    // Ideally, stats should include "averageDailyValue".

    // For now, let's estimate based on current pace if we assume the user continues at their current consistency.
    // This is a bit rough. Let's return a placeholder if we can't calculate it accurately yet.

    return null;
};

// Improved version requiring logs
import type { DayLog } from '../types';

export const getEstimatedCompletionDate = (habit: Habit, logs: Record<string, DayLog>): string | null => {
    if (habit.goal.frequency !== 'total' || !habit.goal.target) return null;

    const habitLogs = Object.values(logs)
        .filter(log => log.habitId === habit.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (habitLogs.length < 3) return 'Not enough data';

    const totalValue = habitLogs.reduce((sum, log) => sum + (log.value || 0), 0);
    const remaining = habit.goal.target - totalValue;

    if (remaining <= 0) return 'Goal Reached!';

    const firstLogDate = new Date(habitLogs[0].date);
    const today = new Date();
    const daysActive = differenceInDays(today, firstLogDate) + 1;

    if (daysActive <= 0) return 'Calculating...';

    const avgPerDay = totalValue / daysActive;

    if (avgPerDay <= 0) return 'No progress yet';

    const daysToFinish = Math.ceil(remaining / avgPerDay);
    const estimatedDate = addDays(today, daysToFinish);

    return `Est. ${format(estimatedDate, 'MMM d, yyyy')}`;
};
