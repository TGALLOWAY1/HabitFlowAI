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
            if (!habit.subHabitIds || habit.subHabitIds.length === 0) {
                // Legacy choice bundles use bundleOptionId, not choiceChildHabitId
                return { valid: false, error: 'choiceChildHabitId is not valid for legacy choice bundles. Use bundleOptionId.' };
            }
            if (!habit.subHabitIds.includes(entryPayload.choiceChildHabitId)) {
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

    // 3. Checklist bundles: parent entries are never valid.
    // Parent completion is derived from children's entries at read time.
    if (habit.type === 'bundle' && habit.bundleType === 'checklist') {
        return { valid: false, error: 'Checklist bundle completion is derived from children. Write entries on child habits instead.' };
    }

    return { valid: true };
}
