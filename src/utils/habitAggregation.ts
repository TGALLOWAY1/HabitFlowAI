import type { Habit, HabitEntry } from '../models/persistenceTypes';
import { evaluateChecklistSuccess } from '../shared/checklistSuccessRule';
import { deriveDailyHabitCompletion } from '../domain/habits/completion';
import { deriveWeeklyHabitProgress, getIsoWeekEndDayKey } from '../domain/habits/weeklyProgress';
import { getIsoWeekStartDayKey } from '../domain/time/dayKey';

export interface HabitStatus {
    isComplete: boolean;
    isPartial: boolean;
    currentValue: number;
    targetValue: number;
    // For Choice Bundles
    selectedOption?: {
        key: string;
        label: string;
    };
    // For Checklist Bundles
    completedChildrenCount?: number;
    totalChildrenCount?: number;
    /** Whether the checklist success rule is met (may differ from isComplete for display) */
    meetsSuccessRule?: boolean;
    /** Whether all scheduled items are complete (N/N) */
    isFullyComplete?: boolean;
}

/**
 * Computes completion status for any habit type for a given date context.
 * 
 * @param habit - The habit configuration
 * @param allEntries - All habit entries (filtered for performance if possible)
 * @param dateKey - The specific date (YYYY-MM-DD) for Daily check
 * @param weekEntries - (Optional) Entries for the entire week if checking Weekly content
 */
export function computeHabitStatus(
    habit: Habit,
    allEntries: HabitEntry[],
    dateKey: string,
    schema?: { habits: Habit[] } // Needed for looking up bundle children
): HabitStatus {

    const activeEntries = allEntries.filter(entry => !entry.deletedAt && !entry.note?.startsWith('freeze:'));

    // 1. Weekly-quota Habit Logic
    if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
        const weekStartDayKey = getIsoWeekStartDayKey(dateKey);
        return deriveWeeklyHabitProgress(
            habit,
            weekStartDayKey,
            getIsoWeekEndDayKey(weekStartDayKey),
            activeEntries,
        );
    }

    // 2. Choice Bundle Logic (Daily Only)
    if (habit.bundleType === 'choice') {
        const entry = allEntries.find(e => e.dateKey === dateKey); // Single Entry Constraint
        if (entry && entry.optionKey && habit.bundleOptions) {
            const option = habit.bundleOptions.find(o => o.key === entry.optionKey);
            return {
                isComplete: true,
                isPartial: false,
                currentValue: 1,
                targetValue: 1,
                selectedOption: option ? { ...option, key: option.key || '' } : undefined
            };
        }
        return {
            isComplete: !!entry, // Fallback if no optionKey (shouldn't happen in strict mode)
            isPartial: false,
            currentValue: entry ? 1 : 0,
            targetValue: 1
        };
    }

    // 3. Checklist Bundle Logic (Daily Only)
    if (habit.bundleType === 'checklist') {
        if (!schema || !habit.subHabitIds || habit.subHabitIds.length === 0) {
            return { isComplete: false, isPartial: false, currentValue: 0, targetValue: 0 };
        }

        let completedCount = 0;
        habit.subHabitIds.forEach(childId => {
            const child = schema.habits.find(candidate => candidate.id === childId);
            if (!child) return;
            const childEntries = activeEntries.filter(entry => entry.habitId === childId && entry.dateKey === dateKey);
            // Legacy in-memory schemas may omit the required goal object.
            // Persisted habits are validated and always use canonical derivation.
            const childComplete = child.goal
                ? deriveDailyHabitCompletion(child, childEntries).isComplete
                : childEntries.length > 0;
            if (childComplete) completedCount++;
        });

        const totalCount = habit.subHabitIds.length;
        const { meetsSuccessRule, isFullyComplete } = evaluateChecklistSuccess(
            completedCount,
            totalCount,
            habit.checklistSuccessRule
        );

        return {
            isComplete: meetsSuccessRule,
            isPartial: completedCount > 0 && !meetsSuccessRule,
            currentValue: completedCount,
            targetValue: totalCount,
            completedChildrenCount: completedCount,
            totalChildrenCount: totalCount,
            meetsSuccessRule,
            isFullyComplete,
        };
    }

    // 4. Standard Daily Habit Logic
    return deriveDailyHabitCompletion(
        habit,
        activeEntries.filter(entry => entry.habitId === habit.id && entry.dateKey === dateKey),
    );
}
