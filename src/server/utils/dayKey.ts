/**
 * Canonical DayKey computation for the server.
 *
 * Single source of truth for YYYY-MM-DD dayKey in a given timezone.
 * Used by all HabitEntry write endpoints and by date-range read endpoints.
 *
 * Rule: If the client provides a valid timezone, use it. If missing or invalid,
 * default to America/New_York (do not mix UTC day boundaries with user-relative ones).
 */

import { formatDayKeyFromDate, type DayKey } from '../../domain/time/dayKey';
import { assertTimeZone } from '../domain/canonicalValidators';

/** Default timezone when client does not provide one or provides an invalid value. */
export const DEFAULT_DAYKEY_TIMEZONE = 'America/New_York';

/**
 * Resolves the timezone to use for dayKey computation.
 * Returns the input if it is a valid IANA timezone; otherwise returns DEFAULT_DAYKEY_TIMEZONE.
 */
export function resolveTimeZone(input?: string | null): string {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return DEFAULT_DAYKEY_TIMEZONE;
  }
  const result = assertTimeZone(input);
  return result.valid ? input : DEFAULT_DAYKEY_TIMEZONE;
}

/**
 * Computes dayKey (YYYY-MM-DD) for a given date in the specified timezone.
 * If timezone is missing or invalid, uses America/New_York.
 */
export function getDayKeyForDate(date: Date, timeZone?: string | null): DayKey {
  return formatDayKeyFromDate(date, resolveTimeZone(timeZone));
}

/**
 * Returns "today's" dayKey in the specified timezone.
 * If timezone is missing or invalid, uses America/New_York.
 */
export function getNowDayKey(timeZone?: string | null): DayKey {
  return getDayKeyForDate(new Date(), timeZone);
}

/**
 * Computes dayKey for an ISO timestamp string in the specified timezone.
 * If timezone is missing or invalid, uses America/New_York.
 */
export function getDayKeyForTimestamp(isoTimestamp: string, timeZone?: string | null): DayKey {
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: "${isoTimestamp}"`);
  }
  return getDayKeyForDate(date, timeZone);
}
