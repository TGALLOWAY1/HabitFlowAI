/**
 * Pure formatting/encoding helpers for Sleep Analytics.
 *
 * Clock times are stored as "minutes-after-noon" (see
 * docs/reference/V1/00_DATA_CONTRACT_WELLBEING_KEYS.md): minutes elapsed since
 * 12:00 noon, wrapped into 0..1439, so a normal sleep window stays numerically
 * contiguous across midnight (10 PM → 600, 12:05 AM → 725, 6 AM → 1083).
 *
 * Keeping these out of components makes them trivially unit-testable.
 */

const MINUTES_PER_DAY = 1440;
const NOON_OFFSET = 720;

/** Encode a wall-clock time (0-23h, 0-59m) to minutes-after-noon (0..1439). */
export function clockToMinutesAfterNoon(hour: number, minute: number): number {
  return ((hour * 60 + minute) - NOON_OFFSET + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Decode minutes-after-noon back to minutes-after-midnight (0..1439). */
export function minutesAfterNoonToClockMinutes(minutesAfterNoon: number): number {
  return (Math.round(minutesAfterNoon) + NOON_OFFSET) % MINUTES_PER_DAY;
}

/**
 * Parse an <input type="time"> value ("HH:MM", 24h) to minutes-after-noon.
 * Returns null for empty/invalid input.
 */
export function timeStringToMinutesAfterNoon(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return clockToMinutesAfterNoon(hour, minute);
}

/** Format minutes-after-noon as a 24h "HH:MM" string for <input type="time">. */
export function minutesAfterNoonToTimeString(minutesAfterNoon: number | null | undefined): string {
  if (minutesAfterNoon == null || !Number.isFinite(minutesAfterNoon)) return '';
  const clock = minutesAfterNoonToClockMinutes(minutesAfterNoon);
  const hh = String(Math.floor(clock / 60)).padStart(2, '0');
  const mm = String(clock % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Format minutes-after-noon as a human clock label, e.g. "10:02 PM" / "6:08 AM". */
export function minutesAfterNoonToClock(minutesAfterNoon: number | null | undefined): string {
  if (minutesAfterNoon == null || !Number.isFinite(minutesAfterNoon)) return '—';
  const clock = minutesAfterNoonToClockMinutes(minutesAfterNoon);
  let hour = Math.floor(clock / 60);
  const minute = clock % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Format a duration in minutes as "6h 48m". */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Rescale a 0-4 subjective sleep-quality score to a 0-10 display value. */
export function quality4to10(quality0to4: number | null | undefined): number | null {
  if (quality0to4 == null || !Number.isFinite(quality0to4)) return null;
  return Math.round(quality0to4 * 2.5 * 10) / 10;
}
