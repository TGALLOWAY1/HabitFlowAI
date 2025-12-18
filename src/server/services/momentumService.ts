import type { DayLog, GlobalMomentumState, CategoryMomentumState } from '../../types';
import { subDays, parseISO, isSameDay } from 'date-fns';

/**
 * Momentum Service
 * 
 * Handles logic for:
 * 1. Global Momentum (Life-level)
 * 2. Category Momentum (Domain-level)
 * 
 * Philosophy: "Momentum > Purity. Engagement > Streak Anxiety."
 */

/**
 * Calculates the number of "Active Days" in the last 7 days.
 * An active day is any day where at least one habit was completed.
 */
function calculateActiveDays(logs: DayLog[], windowSize: number = 7, referenceDate: Date = new Date(), filterFn?: (log: DayLog) => boolean): number {
    let activeDaysCount = 0;

    for (let i = 0; i < windowSize; i++) {
        const dateToCheck = subDays(referenceDate, i);

        // Find if any log exists for this day that is completed
        // And matches the filter (e.g. specific category) if provided
        const hasLogs = logs.some(log => {
            if (log.completed !== true) return false;
            if (!isSameDay(parseISO(log.date), dateToCheck)) return false;

            if (filterFn) {
                return filterFn(log);
            }
            return true;
        });

        if (hasLogs) {
            activeDaysCount++;
        }
    }

    return activeDaysCount;
}

export const calculateGlobalMomentum = (logs: DayLog[]): { state: GlobalMomentumState; activeDays: number } => {
    const activeDays = calculateActiveDays(logs);

    let state: GlobalMomentumState = 'Ready';

    if (activeDays >= 6) state = 'Strong';
    else if (activeDays >= 4) state = 'Steady';
    else if (activeDays >= 2) state = 'Building';
    else if (activeDays === 1) state = 'Gentle Restart';
    else state = 'Ready';

    return { state, activeDays };
};

export const calculateCategoryMomentum = (
    logs: DayLog[],
    categoryHabitIds: string[]
): { state: CategoryMomentumState; activeDays: number } => {

    const activeDays = calculateActiveDays(logs, 7, new Date(), (log) => categoryHabitIds.includes(log.habitId));

    let state: CategoryMomentumState = 'Paused';

    if (activeDays >= 5) state = 'Strong';
    else if (activeDays >= 3) state = 'Steady';
    else if (activeDays >= 1) state = 'Building';
    else state = 'Paused';

    return { state, activeDays };
};

export const getMomentumCopy = (state: GlobalMomentumState | CategoryMomentumState): string => {
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
        'Gentle Restart': [
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
    // Return a random phrase for now, or we could rotate based on day of year to consistenty
    // For now, let's just pick the first one to be deterministic/simple, or random?
    // PRD says "rotated, non-repeating". For strict MVP, let's pick random.
    return phrases[Math.floor(Math.random() * phrases.length)];
};
