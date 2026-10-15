/**
 * Daily Check-in — shared constants (frontend + backend).
 *
 * The Daily Check-in is a reflective record layered on top of habitEntries:
 * it never stores completion ("done" is always derived from entries). These
 * constants are the stable data contract for what a check-in may contain.
 */

/** Number of top-level pages in the guided flow (intro → completion → mood → effort → wrap-up). */
export const DAILY_CHECK_IN_STEP_COUNT = 5;

/** Inclusive bounds for mood and effort scores. */
export const DAILY_CHECK_IN_SCORE_MIN = 1;
export const DAILY_CHECK_IN_SCORE_MAX = 5;

/** Max characters for a per-habit journal note. */
export const DAILY_CHECK_IN_JOURNAL_MAX_LENGTH = 500;

/** Max habits recorded in one day's check-in (defense against oversized payloads). */
export const DAILY_CHECK_IN_MAX_HABITS = 200;

/**
 * Optional descriptive mood tags (LOCKED ids — labels live in the UI).
 * Do not rename or repurpose ids; stored check-ins reference them.
 */
export const DAILY_CHECK_IN_MOOD_TAGS = [
  'calm',
  'energized',
  'focused',
  'distracted',
  'proud',
  'tired',
] as const;

export type DailyCheckInMoodTag = typeof DAILY_CHECK_IN_MOOD_TAGS[number];

export function isDailyCheckInMoodTag(value: unknown): value is DailyCheckInMoodTag {
  return typeof value === 'string' && (DAILY_CHECK_IN_MOOD_TAGS as readonly string[]).includes(value);
}
