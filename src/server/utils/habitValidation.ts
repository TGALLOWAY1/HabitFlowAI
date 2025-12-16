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
        if (!entryPayload.bundleOptionId) {
            // Allow parent-level binary completions? PRD says "Entries are the source of truth".
            // If manual log for parent, maybe? But PRD says "Parent completion is derived".
            // So users should only log options.
            return { valid: false, error: 'Choice habits require a selected option (bundleOptionId).' };
        }

        const option = habit.bundleOptions.find(opt => opt.id === entryPayload.bundleOptionId);
        if (!option) {
            return { valid: false, error: `Invalid option ID: ${entryPayload.bundleOptionId}` };
        }

        // Metric Logic
        const metricMode = option.metricConfig?.mode || 'none';

        if (metricMode === 'required') {
            if (entryPayload.value === undefined || entryPayload.value === null) {
                return { valid: false, error: `Value is required for option "${option.label}"` };
            }
        } else if (metricMode === 'none') {
            if (entryPayload.value !== undefined && entryPayload.value !== null) {
                // We could strictly fail, or just warn. PRD says "No ambiguous history".
                // Let's fail to keep data clean.
                return { valid: false, error: `Value should not be provided for non-metric option "${option.label}"` };
            }
        }
    }

    return { valid: true };
}
