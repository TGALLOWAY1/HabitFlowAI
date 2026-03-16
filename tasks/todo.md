# Fix Goals at a Glance Loading Performance

## Diagnosis

The `/progress/overview` endpoint has three major performance issues:

### Issue 1: Triple-fetch of `getHabitEntriesByUser` (biggest bottleneck)
- `progress.ts:37` calls `getHabitEntriesByUser()` — fetches ALL entries from DB
- `computeGoalsWithProgressV2` → `getEntryViewsForHabits` → `truthQuery.ts:72` calls `getHabitEntriesByUser()` AGAIN
- That's **2 full table scans** of the same collection per request, completely redundant

### Issue 2: Double-fetch of `getHabitsByUser`
- `progress.ts:33` fetches all habits
- `goalProgressUtilsV2.ts:242` fetches all habits AGAIN inside `computeGoalsWithProgressV2`

### Issue 3: Sequential DB queries that could be parallel
- `getHabitsByUser` and `getHabitEntriesByUser` are awaited sequentially but are independent

### Issue 4: Unnecessary dynamic import
- `progress.ts:131` uses `await import(...)` instead of a static import

## Fix Plan

- [ ] 1. Parallelize the two independent DB queries with `Promise.all`
- [ ] 2. Add a variant of `computeGoalsWithProgressV2` that accepts pre-fetched habits and entries to eliminate redundant DB calls
- [ ] 3. Replace the dynamic import with a static import
- [ ] 4. Verify the fix compiles and tests pass
