/**
 * Household + user scoping for repository queries.
 * Ensures every query includes householdId (and userId where user-owned).
 * In dev, throws if scope is missing to prevent cross-tenant leaks.
 */

export type Scope = { householdId: string; userId: string };

/**
 * Build base filter for user-owned documents in a household.
 * In development, throws if householdId or userId is missing/empty.
 *
 * @param householdId - Household ID (required)
 * @param userId - User ID (required)
 * @param extra - Additional filter keys to merge
 * @returns Filter object for find/findOne/delete/update
 */
export function scopeFilter(
  householdId: string | undefined | null,
  userId: string | undefined | null,
  extra: Record<string, unknown> = {}
): { householdId: string; userId: string } & Record<string, unknown> {
  if (process.env.NODE_ENV !== 'production') {
    if (householdId == null || String(householdId).trim() === '') {
      throw new Error('[scoping] householdId is required for repository queries');
    }
    if (userId == null || String(userId).trim() === '') {
      throw new Error('[scoping] userId is required for repository queries');
    }
  }
  return {
    householdId: String(householdId),
    userId: String(userId),
    ...extra,
  };
}

/**
 * Require scope for writes. Returns the same object for convenience.
 * In dev, throws if either is missing.
 */
export function requireScope(householdId: string | undefined | null, userId: string | undefined | null): Scope {
  if (process.env.NODE_ENV !== 'production') {
    if (householdId == null || String(householdId).trim() === '') {
      throw new Error('[scoping] householdId is required for writes');
    }
    if (userId == null || String(userId).trim() === '') {
      throw new Error('[scoping] userId is required for writes');
    }
  }
  return { householdId: String(householdId), userId: String(userId) };
}
