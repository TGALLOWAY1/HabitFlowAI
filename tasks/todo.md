# Fix Goals at a Glance Loading Performance

## Diagnosis

The `/progress/overview` and `/goals-with-progress` endpoints had major performance issues:

### Issue 1: Duplicate `getHabitEntriesByUser` calls (biggest bottleneck)
- `progress.ts` called `getHabitEntriesByUser()` — full table scan
- `computeGoalsWithProgressV2` → `getEntryViewsForHabits` → `truthQuery.ts` called it AGAIN
- **2 full collection scans** per request, completely redundant

### Issue 2: Duplicate `getHabitsByUser` calls
- `progress.ts` and `goalProgressUtilsV2.ts` both fetched all habits independently

### Issue 3: Sequential DB queries
- Independent queries ran sequentially instead of in parallel

### Issue 4: Unnecessary dynamic import
- `await import(...)` on every request instead of static import

## Fix Applied

- [x] 1. Added `buildEntryViewsFromEntries` to `truthQuery.ts` — accepts pre-fetched entries
- [x] 2. Added `computeGoalsWithProgressFromData` to `goalProgressUtilsV2.ts` — accepts pre-fetched habits + entries
- [x] 3. `progress.ts`: Parallelized 3 DB queries with `Promise.all`, static imports, passes data through
- [x] 4. `goals.ts`: Same optimization for `/goals-with-progress` endpoint
- [x] 5. Updated tests to match new function signatures
- [x] 6. Verified: TypeScript clean, zero new test failures

## Impact
- `/progress/overview`: **4 DB calls → 3** (habits, entries, goals in parallel), no redundant fetches
- `/goals-with-progress`: **3 DB calls → 3** (parallelized), no redundant fetches
- Both endpoints now pass pre-fetched data downstream instead of re-querying
