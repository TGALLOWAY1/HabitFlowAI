/**
 * Canonical DayKey computation for the server.
 *
 * Single source of truth for YYYY-MM-DD dayKey in a given timezone.
 * Used by all HabitEntry write endpoints and by date-range read endpoints.
 *
 * Rule: If the client provides a valid timezone, use it. If missing or invalid,
 * default to America/New_York (do not mix UTC day boundaries with user-relative ones).
 */

import { formatDayKeyFromDate, isValidDayKey, type DayKey } from '../../domain/time/dayKey';
import { assertTimeZone } from '../domain/canonicalValidators';

/** Default timezone when client does not provide one or provides an invalid value. */
export const DEFAULT_DAYKEY_TIMEZONE = 'America/New_York';

/** When true, allow using entry.date / entry.dateKey (and timestamp derivation) when entry.dayKey is missing. Log when used. */
export function allowDayKeyLegacyFallback(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_DAYKEY_LEGACY_FALLBACK === '1' ||
    process.env.ALLOW_DAYKEY_LEGACY_FALLBACK === 'true'
  );
}

/**
 * Canonical dayKey from a stored entry (HabitEntry). Prefer dayKey; legacy date/dateKey only in dev (or when ALLOW_DAYKEY_LEGACY_FALLBACK is set) with log.
 * Avoids silently mixing date and dayKey logic in production.
 */
export function getCanonicalDayKeyFromEntry(
  entry: { dayKey?: string; date?: string; dateKey?: string; timestamp?: string; id?: string },
  options: { timeZone?: string | null; allowLegacyFallback?: boolean } = {}
): string | null {
  const allow = options.allowLegacyFallback ?? allowDayKeyLegacyFallback();

  if (entry.dayKey && isValidDayKey(entry.dayKey)) {
    return entry.dayKey;
  }

  if (allow) {
    if (entry.date && isValidDayKey(entry.date)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DayKey] Entry ${entry.id ?? 'unknown'} using legacy "date" field as dayKey. Prefer "dayKey".`);
      }
      return entry.date;
    }
    if (entry.dateKey && isValidDayKey(entry.dateKey)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[DayKey] Entry ${entry.id ?? 'unknown'} using legacy "dateKey" field as dayKey. Prefer "dayKey".`);
      }
      return entry.dateKey;
    }
    if (entry.timestamp && options.timeZone) {
      try {
        const d = new Date(entry.timestamp);
        if (!isNaN(d.getTime())) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[DayKey] Entry ${entry.id ?? 'unknown'} deriving dayKey from timestamp in ${options.timeZone}.`);
          }
          return formatDayKeyFromDate(d, resolveTimeZone(options.timeZone));
        }
      } catch {
        // fall through to null
      }
    }
  }

  return null;
}

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
