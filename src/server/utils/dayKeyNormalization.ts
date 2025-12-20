/**
 * DayKey Normalization Utilities
 * 
 * Normalizes dayKey from various input formats to ensure canonical DayKey (YYYY-MM-DD).
 * Handles:
 * - Direct dayKey input (validated)
 * - Legacy date input (converted to dayKey)
 * - Timestamp + timeZone derivation
 */

import { assertDayKey, formatDayKeyFromDate, type DayKey } from '../../domain/time/dayKey';
import { validateDayKey } from '../domain/canonicalValidators';

/**
 * Normalizes dayKey from various input formats.
 * 
 * Priority:
 * 1. If dayKey is provided: validate and use it
 * 2. Else if date (legacy) is provided: validate and use as dayKey
 * 3. Else if timestamp + timeZone are provided: derive dayKey
 * 4. Else: throw error
 * 
 * @param options - Input options
 * @param options.dayKey - Direct dayKey input (preferred)
 * @param options.date - Legacy date input (YYYY-MM-DD)
 * @param options.timestamp - ISO 8601 timestamp
 * @param options.timeZone - IANA timezone identifier (required if deriving from timestamp)
 * @returns Normalized DayKey
 * @throws Error if no valid dayKey can be determined
 */
export function normalizeDayKey(options: {
    dayKey?: string;
    date?: string;
    timestamp?: string;
    timeZone?: string;
}): DayKey {
    // Priority 1: Direct dayKey input
    if (options.dayKey) {
        const validation = validateDayKey(options.dayKey);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        return options.dayKey;
    }

    // Priority 2: Legacy date input (treat as dayKey)
    if (options.date) {
        const validation = validateDayKey(options.date);
        if (!validation.valid) {
            throw new Error(`Invalid date format (legacy): ${validation.error}`);
        }
        // Warn in dev that date is deprecated
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[DayKey Normalization] Using legacy "date" field. Prefer "dayKey" instead.');
        }
        return options.date;
    }

    // Priority 3: Derive from timestamp + timeZone
    if (options.timestamp && options.timeZone) {
        try {
            const date = new Date(options.timestamp);
            if (isNaN(date.getTime())) {
                throw new Error(`Invalid timestamp: "${options.timestamp}"`);
            }
            return formatDayKeyFromDate(date, options.timeZone);
        } catch (error) {
            throw new Error(
                `Failed to derive dayKey from timestamp + timeZone: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // No valid input
    throw new Error(
        'dayKey is required. Provide either: dayKey, date (legacy), or timestamp + timeZone'
    );
}

/**
 * Normalizes HabitEntry payload to ensure dayKey is present.
 * 
 * @param payload - HabitEntry payload (may have dayKey, date, or timestamp)
 * @param timeZone - User's timezone (required if deriving from timestamp)
 * @returns Normalized payload with dayKey set
 */
export function normalizeHabitEntryPayload(
    payload: any,
    timeZone?: string
): { dayKey: DayKey; timestampUtc: string } {
    // Ensure timestampUtc exists (use timestamp or default to now)
    const timestampUtc = payload.timestamp || payload.timestampUtc || new Date().toISOString();

    // Normalize dayKey
    const dayKey = normalizeDayKey({
        dayKey: payload.dayKey,
        date: payload.date,
        timestamp: timestampUtc,
        timeZone: timeZone || 'UTC', // Default to UTC if not provided
    });

    return {
        dayKey,
        timestampUtc,
    };
}

