import type { Habit, HabitEntry } from '../../models/persistenceTypes';

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates a habit entry against the habit definition.
 * Enforces Choice Habit V2 invariants:
 * 1. Metric Requirement: If option requires metric, value must be present.
 * 2. Metric Prohibition: If option has no metric, value must be undefined/null.
 * 3. Option Existence: bundleOptionId must exist in habit.bundleOptions.
 */
export function validateHabitEntryPayload(habit: Habit, entryPayload: Partial<HabitEntry>): ValidationResult {
    // 1. Check if it's a Choice Bundle
    if (habit.bundleType === 'choice' && habit.bundleOptions) {

        // If it's a choice bundle, bundleOptionId is required for the entry
        // (Unless it's a legacy entry or some other edge case, but for new entries it's required)
        if (!entryPayload.bundleOptionId && !entryPayload.choiceChildHabitId) {
            // Allow parent-level binary completions? PRD says "Entries are the source of truth".
            // If manual log for parent, maybe? But PRD says "Parent completion is derived".
            // So users should only log options.
            return { valid: false, error: 'Choice habits require a selected option (bundleOptionId or choiceChildHabitId).' };
        }

        // 1a. Validate Legacy Option ID if present
        if (entryPayload.bundleOptionId) {
            const option = habit.bundleOptions.find(opt => opt.id === entryPayload.bundleOptionId);
            if (!option) {
                return { valid: false, error: `Invalid option ID: ${entryPayload.bundleOptionId}` };
            }

            // Metric Logic only applies to internal options
            const metricMode = option.metricConfig?.mode || 'none';
            if (metricMode === 'required') {
                if (entryPayload.value === undefined || entryPayload.value === null) {
                    return { valid: false, error: `Value is required for option "${option.label}"` };
                }
            } else if (metricMode === 'none') {
                if (entryPayload.value !== undefined && entryPayload.value !== null) {
                    return { valid: false, error: `Value should not be provided for non-metric option "${option.label}"` };
                }
            }
        }

        // 1b. Validate Child Habit ID if present (Unification Model)
        if (entryPayload.choiceChildHabitId) {
            // We can't validate existence of child habit easily here without fetching it.
            // But we can check if it's in subHabitIds if the habit has them.
            if (habit.subHabitIds && !habit.subHabitIds.includes(entryPayload.choiceChildHabitId)) {
                // Warn or fail? 
                // It's possible the child was removed from bundle but stats remain.
                // But for *creation* of entry, it should be in the bundle.
                return { valid: false, error: `Habit ${entryPayload.choiceChildHabitId} is not a valid child of this choice bundle.` };
            }
        }

        return { valid: true };
    }

    // 2. Check if it's a Unified Choice Bundle (using subHabitIds)
    if (habit.bundleType === 'choice' && !habit.bundleOptions && habit.subHabitIds) {
        if (!entryPayload.choiceChildHabitId) {
            return { valid: false, error: 'Choice habits require a selected child habit (choiceChildHabitId).' };
        }
        if (!habit.subHabitIds.includes(entryPayload.choiceChildHabitId)) {
            return { valid: false, error: `Habit ${entryPayload.choiceChildHabitId} is not a valid child of this choice bundle.` };
        }

    }

    return { valid: true };
}
