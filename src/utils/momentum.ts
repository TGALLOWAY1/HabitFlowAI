
import { subDays, parseISO, isSameDay, startOfDay } from 'date-fns';
import type { DayLog, CategoryMomentumState, GlobalMomentumState } from '../types';

/**
 * Calculates the number of "Active Days" in the last 7 days.
 * An active day is any day where at least one habit was completed.
 * 
 * @param logs The full dictionary of DayLogs or array of DayLogs
 * @param habitIds Filter for specific habit IDs (e.g. for a category)
 * @param referenceDate The "Today" to count back from (defaults to now)
 */
export function calculateActiveDays(
    logs: Record<string, DayLog> | DayLog[],
    habitIds: string[],
    referenceDate: Date = new Date()
): number {
    const windowSize = 7;
    let activeDaysCount = 0;

    // Normalize logs to array if it's a record
    const logsArray = Array.isArray(logs) ? logs : Object.values(logs);

    // Normalize reference date to start of day to avoid time issues
    const end = startOfDay(referenceDate);
    // 7 days inclusive: Today + 6 past days
    // PRD: "Rolling 7-day window"
    // Usually implies Today + Past 6 days.

    for (let i = 0; i < windowSize; i++) {
        const dateToCheck = subDays(end, i);

        const hasActivity = logsArray.some(log => {
            if (!log.completed) return false;
            // Check if log belongs to one of the target habits
            if (!habitIds.includes(log.habitId)) return false;

            // Check date match
            // Handle both string dates and Date objects if necessary, but type says string (ISO)
            // We assume log.date is YYYY-MM-DD.
            return isSameDay(parseISO(log.date), dateToCheck);
        });

        if (hasActivity) {
            activeDaysCount++;
        }
    }

    return activeDaysCount;
}

export function getMomentumState(activeDays: number): CategoryMomentumState {
    if (activeDays >= 5) return 'Strong';
    if (activeDays >= 3) return 'Steady';
    if (activeDays >= 1) return 'Building';
    return 'Paused';
}

export function calculateCategoryMomentum(
    logs: Record<string, DayLog> | DayLog[],
    categoryHabitIds: string[],
    categoryId: string, // Changed signature to include categoryId for deterministic copy
    referenceDate: Date = new Date()
): { state: CategoryMomentumState; activeDays: number; phrase: string } {

    const activeDays = calculateActiveDays(logs, categoryHabitIds, referenceDate);
    const state = getMomentumState(activeDays);
    const phrase = getMomentumCopy(state, categoryId, referenceDate);

    return { state, activeDays, phrase };
}

export const getMomentumCopy = (state: CategoryMomentumState | GlobalMomentumState, seedKey: string = 'default', date: Date = new Date()): string => {
    const copyMap: Record<string, string[]> = {
        'Strong': [
            "You’re in a great rhythm",
            "Momentum is strong right now",
            "You’re on fire!",
            "Great consistency"
        ],
        'Steady': [
            "You’ve got solid momentum",
            "Nice follow-through this week",
            "Keeping it steady",
            "You’re showing up"
        ],
        'Building': [
            "Momentum is building",
            "You’re getting back into motion",
            "Step by step",
            "Solid progress"
        ],
        'Gentle Restart': [ // Primarily for Global, but safe to include
            "Welcome back",
            "One step is enough to restart",
            "Good to see you",
            "Fresh start"
        ],
        'Ready': [
            "Ready when you are",
            "No pressure — start anytime",
            "Fresh slate",
            "Your goals are waiting"
        ],
        'Paused': [
            "This area has been quiet",
            "Ready when you want to restart",
            "Paused for now"
        ]
    };

    const phrases = copyMap[state] || copyMap['Ready'];

    // Deterministic selection based on seed and date (day of year)
    // This ensures consistency across re-renders but rotates content daily
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);

    // Simple hash function for the seed string
    let hash = 0;
    for (let i = 0; i < seedKey.length; i++) {
        hash = ((hash << 5) - hash) + seedKey.charCodeAt(i);
        hash |= 0;
    }

    const index = Math.abs(hash + dayOfYear) % phrases.length;
    return phrases[index];
};
