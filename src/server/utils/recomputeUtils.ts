/**
 * Recompute Utils
 *
 * DayLogs have been removed. This module provides a no-op stub so existing
 * call sites (habitEntries, routines) do not need to change. No derived cache
 * is written.
 */

/**
 * No-op: DayLogs are no longer maintained. Kept for API compatibility.
 */
export async function recomputeDayLogForHabit(
  _habitId: string,
  _date: string,
  _householdId: string,
  _userId: string
): Promise<null> {
  return null;
}
