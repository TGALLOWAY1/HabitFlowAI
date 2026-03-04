/**
 * Canonical habit entry upsert payload builder.
 * Ensures frontend only sends fields the server allows; strips forbidden completion/progress fields.
 */

/** Keys allowed in PUT /api/entries body (data spread). Matches server repository allowed updates. */
const ALLOWED_UPSERT_KEYS = [
  'value',
  'timestamp',
  'source',
  'bundleOptionId',
  'bundleOptionLabel',
  'choiceChildHabitId',
  'unitSnapshot',
  'routineId',
  'note',
] as const;

/** Forbidden keys (server rejects). Completion/progress must be derived, never stored. */
const FORBIDDEN_KEYS = [
  'completed',
  'isComplete',
  'isCompleted',
  'completion',
  'progress',
  'currentValue',
  'percent',
  'streak',
  'momentum',
  'totals',
  'weeklyProgress',
  'dailyProgress',
] as const;

const ALLOWED_SET = new Set<string>(ALLOWED_UPSERT_KEYS);
const FORBIDDEN_SET = new Set<string>(FORBIDDEN_KEYS);

/**
 * Builds a payload object for habit entry upsert (PUT /api/entries) that matches server schema.
 * - Includes only allowed fields.
 * - Strips forbidden completion/progress fields and other unknown keys.
 */
export function buildHabitEntryUpsertPayload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (FORBIDDEN_SET.has(key)) continue;
    if (ALLOWED_SET.has(key) && data[key] !== undefined) {
      out[key] = data[key];
    }
  }
  return out;
}
