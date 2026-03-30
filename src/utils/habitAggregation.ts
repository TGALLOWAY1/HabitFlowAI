import type { Habit, HabitEntry } from '../models/persistenceTypes';
import { evaluateChecklistSuccess } from '../shared/checklistSuccessRule';

export interface HabitStatus {
    isComplete: boolean;
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

    // 1. Weekly Habit Logic
    if (habit.frequency === 'weekly') {
        if (!habit.weeklyTarget) {
            // Edge case: Weekly habit missing target. Treat as 1x/week.
            return { isComplete: false, currentValue: 0, targetValue: 1 };
        }

        // We assume 'allEntries' passed here are relevant to the WEEK context 
        // OR we filter them here if they contain more history.
        // Ideally, caller passes entries filtered by week range.
        const weekDistinctDays = new Set(allEntries.map(e => e.dateKey)).size;

        return {
            isComplete: weekDistinctDays >= habit.weeklyTarget,
            currentValue: weekDistinctDays,
            targetValue: habit.weeklyTarget
        };
    }

    // 2. Choice Bundle Logic (Daily Only)
    if (habit.bundleType === 'choice') {
        const entry = allEntries.find(e => e.dateKey === dateKey); // Single Entry Constraint
        if (entry && entry.optionKey && habit.bundleOptions) {
            const option = habit.bundleOptions.find(o => o.key === entry.optionKey);
            return {
                isComplete: true,
                currentValue: 1,
                targetValue: 1,
                selectedOption: option ? { ...option, key: option.key || '' } : undefined
            };
        }
        return {
            isComplete: !!entry, // Fallback if no optionKey (shouldn't happen in strict mode)
            currentValue: entry ? 1 : 0,
            targetValue: 1
        };
    }

    // 3. Checklist Bundle Logic (Daily Only)
    if (habit.bundleType === 'checklist') {
        if (!schema || !habit.subHabitIds || habit.subHabitIds.length === 0) {
            return { isComplete: false, currentValue: 0, targetValue: 0 };
        }

        let completedCount = 0;
        habit.subHabitIds.forEach(childId => {
            const childHasEntry = allEntries.some(e => e.habitId === childId && e.dateKey === dateKey);
            if (childHasEntry) completedCount++;
        });

        const totalCount = habit.subHabitIds.length;
        const { meetsSuccessRule, isFullyComplete } = evaluateChecklistSuccess(
            completedCount,
            totalCount,
            habit.checklistSuccessRule
        );

        return {
            isComplete: meetsSuccessRule,
            currentValue: completedCount,
            targetValue: totalCount,
            completedChildrenCount: completedCount,
            totalChildrenCount: totalCount,
            meetsSuccessRule,
            isFullyComplete,
        };
    }

    // 4. Standard Daily Habit Logic
    // Single Entry Constraint: Any entry for this dateKey means complete.
    const entry = allEntries.find(e => e.dateKey === dateKey);

    return {
        isComplete: !!entry,
        currentValue: entry ? 1 : 0,
        targetValue: 1
    };
}
