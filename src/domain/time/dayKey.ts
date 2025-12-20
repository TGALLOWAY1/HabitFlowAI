/**
 * DayKey Utility
 * 
 * Canonical utility for timezone-aware calendar date formatting.
 * DayKey is the aggregation boundary for all habit tracking.
 * 
 * DayKey format: YYYY-MM-DD (e.g., "2025-12-20")
 * 
 * All date aggregation in HabitFlow must use DayKey, not timestamps.
 * DayKey is derived at write time using the user's timezone and stored immutably.
 */

/**
 * DayKey type: A string in YYYY-MM-DD format representing a calendar day
 * in a specific timezone.
 */
export type DayKey = string;

/**
 * Regular expression to validate DayKey format (YYYY-MM-DD)
 */
const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a string is a valid DayKey format (YYYY-MM-DD).
 * 
 * @param dayKey - String to validate
 * @returns True if the string matches YYYY-MM-DD format
 */
export function isValidDayKey(dayKey: string): boolean {
  if (!DAY_KEY_REGEX.test(dayKey)) {
    return false;
  }

  // Parse the date parts to ensure it's a valid calendar date
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  // Check if the date is valid and matches the input
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Asserts that a string is a valid DayKey, throwing a helpful error if not.
 * 
 * @param dayKey - String to validate
 * @throws Error if dayKey is not valid
 */
export function assertDayKey(dayKey: string): void {
  if (!isValidDayKey(dayKey)) {
    throw new Error(
      `Invalid DayKey format: "${dayKey}". Expected YYYY-MM-DD format (e.g., "2025-12-20")`
    );
  }
}

/**
 * Formats a Date object as a DayKey (YYYY-MM-DD) in the specified timezone.
 * 
 * This function ensures that the calendar day is determined by the user's timezone,
 * not UTC. For example, a timestamp at 2025-01-01T01:00:00.000Z is:
 * - "2024-12-31" in America/Los_Angeles (PST, UTC-8)
 * - "2025-01-01" in UTC
 * 
 * @param date - Date object (typically in UTC)
 * @param timeZone - IANA timezone identifier (e.g., "America/Los_Angeles", "UTC", "Europe/London")
 * @returns DayKey string in YYYY-MM-DD format
 */
export function formatDayKeyFromDate(date: Date, timeZone: string): DayKey {
  try {
    // Use Intl.DateTimeFormat with 'en-CA' locale which yields YYYY-MM-DD format
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const formatted = formatter.format(date);
    
    // en-CA should yield YYYY-MM-DD, but verify and construct manually if needed
    if (DAY_KEY_REGEX.test(formatted)) {
      return formatted;
    }

    // Fallback: Use formatToParts if en-CA doesn't work as expected
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error(`Failed to format DayKey from date in timezone ${timeZone}`);
    }

    // Ensure month and day are zero-padded
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');

    return `${year}-${paddedMonth}-${paddedDay}`;
  } catch (error) {
    throw new Error(
      `Failed to format DayKey from date in timezone ${timeZone}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Gets the current DayKey in the specified timezone.
 * 
 * @param timeZone - IANA timezone identifier (e.g., "America/Los_Angeles", "UTC")
 * @returns DayKey string in YYYY-MM-DD format for "today" in the specified timezone
 */
export function getNowDayKey(timeZone: string): DayKey {
  return formatDayKeyFromDate(new Date(), timeZone);
}

