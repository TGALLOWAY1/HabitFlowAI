/**
 * Canonical Validators
 * 
 * Validation functions that enforce canonical vocabulary and invariants at API boundaries.
 * These validators ensure:
 * - DayKey format correctness
 * - TimeZone validity
 * - HabitEntry payload correctness
 * - No stored completion flags
 */

import { assertDayKey, type DayKey } from '../../domain/time/dayKey';
import type { ValidationResult, HabitEntryPayload } from './canonicalTypes';

/**
 * Validates that a timezone string is a valid IANA timezone identifier.
 * 
 * @param timeZone - Timezone string to validate
 * @returns ValidationResult
 */
export function assertTimeZone(timeZone: string): ValidationResult {
    if (!timeZone || typeof timeZone !== 'string') {
        return {
            valid: false,
            error: 'timeZone is required and must be a string (IANA timezone identifier, e.g., "America/Los_Angeles", "UTC")'
        };
    }

    // Basic sanity check: IANA timezones are typically in format "Area/Location" or "UTC"
    // We can't fully validate without a timezone database, but we can check basic format
    const validPatterns = [
        /^UTC([+-]\d{1,2}(:\d{2})?)?$/, // UTC, UTC+5, UTC-8, etc.
        /^[A-Z][a-z]+\/[A-Z][a-z_]+$/, // America/Los_Angeles, Europe/London, etc.
        /^[A-Z]{3,}$/, // EST, PST, etc. (less common but valid)
    ];

    const isValidFormat = validPatterns.some(pattern => pattern.test(timeZone));

    // Always try to create a date formatter with this timezone as a runtime check
    // This catches invalid timezones that pass format checks
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
    } catch (error) {
        return {
            valid: false,
            error: `Invalid timezone: "${timeZone}". Must be a valid IANA timezone identifier (e.g., "America/Los_Angeles", "UTC")`
        };
    }

    return { valid: true };
}

/**
 * Validates a DayKey string format.
 * 
 * @param dayKey - DayKey string to validate
 * @returns ValidationResult
 */
export function validateDayKey(dayKey: string): ValidationResult {
    try {
        assertDayKey(dayKey);
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : `Invalid DayKey format: "${dayKey}"`
        };
    }
}

/**
 * Validates a HabitEntry payload for required fields and basic constraints.
 * 
 * This performs basic structural validation. Habit-specific validation
 * (e.g., Choice Bundle rules) should be done via validateHabitEntryPayload().
 * 
 * @param payload - HabitEntry payload to validate
 * @returns ValidationResult
 */
export function validateHabitEntryPayloadStructure(payload: Partial<HabitEntryPayload>): ValidationResult {
    // Required fields
    if (!payload.habitId || typeof payload.habitId !== 'string') {
        return { valid: false, error: 'habitId is required and must be a string' };
    }

    // dayKey or date (legacy) is required - but we'll normalize later, so just check format if provided
    if (payload.dayKey && typeof payload.dayKey === 'string') {
        const dayKeyValidation = validateDayKey(payload.dayKey);
        if (!dayKeyValidation.valid) {
            return dayKeyValidation;
        }
    }

    if (payload.date && typeof payload.date === 'string') {
        const dayKeyValidation = validateDayKey(payload.date);
        if (!dayKeyValidation.valid) {
            return { valid: false, error: `Invalid date format (legacy): ${dayKeyValidation.error}` };
        }
    }

    // If neither dayKey nor date is provided, we'll check for timestamp + timeZone in normalization
    // Don't fail here - let normalization handle it

    // Validate source if provided
    if (payload.source !== undefined) {
        const validSources: Array<'manual' | 'routine' | 'quick' | 'import' | 'test'> = 
            ['manual', 'routine', 'quick', 'import', 'test'];
        if (!validSources.includes(payload.source)) {
            return {
                valid: false,
                error: `Invalid source: "${payload.source}". Must be one of: ${validSources.join(', ')}`
            };
        }
    }

    // Validate value if provided (must be number or null)
    if (payload.value !== undefined && payload.value !== null && typeof payload.value !== 'number') {
        return { valid: false, error: 'value must be a number or null' };
    }

    // Validate timestamp if provided (must be ISO 8601)
    if (payload.timestamp !== undefined) {
        if (typeof payload.timestamp !== 'string') {
            return { valid: false, error: 'timestamp must be a string (ISO 8601 format)' };
        }
        // Basic ISO 8601 check
        const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
        if (!isoRegex.test(payload.timestamp) && !Date.parse(payload.timestamp)) {
            return { valid: false, error: 'timestamp must be a valid ISO 8601 date string' };
        }
    }

    return { valid: true };
}

/**
 * Validates that a payload does not contain stored completion flags.
 * 
 * Completion must be derived from HabitEntries, never stored.
 * 
 * @param payload - Any payload object to check
 * @returns ValidationResult
 */
export function assertNoStoredCompletion(payload: any): ValidationResult {
    const completionFields = ['completed', 'isComplete', 'isCompleted', 'progress', 'currentValue', 'percent'];
    
    for (const field of completionFields) {
        if (field in payload) {
            return {
                valid: false,
                error: `Field "${field}" is not allowed. Completion/progress must be derived from HabitEntries, not stored.`
            };
        }
    }

    return { valid: true };
}

/**
 * Validates GoalLink aggregation mode and unit expectations.
 * 
 * @param aggregationMode - Aggregation mode ('days' or 'sum')
 * @param hasUnit - Whether the linked habit has a unit
 * @returns ValidationResult
 */
export function validateGoalLinkAggregation(
    aggregationMode: 'days' | 'sum',
    hasUnit: boolean
): ValidationResult {
    if (aggregationMode === 'sum' && !hasUnit) {
        return {
            valid: false,
            error: 'Aggregation mode "sum" requires the linked habit to have a unit. Use "days" for boolean habits.'
        };
    }

    return { valid: true };
}

