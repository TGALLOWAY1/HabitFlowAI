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

---

# Deep Audit: Redundant DB Calls Across All Pages

**Date:** 2026-03-16
**Scope:** Every page, context provider, backend route, and cross-cutting concern

## Executive Summary

Comprehensive audit identified **34 distinct issues** across the entire application. The most impactful patterns are:

1. **N+1 query patterns** in routine image loading and goal habit validation
2. **Overlapping endpoints** fetching identical goal/habit data
3. **Eager context loading** — all data fetched on mount regardless of route
4. **Dual-write wellbeing collections** — every update writes to 2 collections
5. **Session middleware** — 2 DB calls per request with no caching
6. **No request deduplication** — same data fetched by multiple hooks/components

---

## CRITICAL Issues (Fix First)

### C1. Routine Images: N+1 Query Pattern
- **File:** `src/server/routes/routines.ts:192-225`
- **Problem:** `getRoutinesRoute` fetches all routines (1 query), then loops through each calling `getRoutineImageUrl()` individually (N queries). A user with 10 routines = 11 DB queries instead of 1-2.
- **Fix:** Add `getRoutineImagesByRoutineIds(ids[])` batch function to `routineImageRepository.ts`, call once for all routines.

### C2. Goal Habit Validation: N+1 Query Pattern
- **File:** `src/server/routes/goals.ts:50-65`
- **Problem:** `validateHabitIdsExist()` loops through `habitIds` calling `getHabitById()` one at a time. Creating a goal with 5 linked habits = 5 sequential DB queries.
- **Fix:** Replace loop with single `getHabitsByUser()` call and filter in-memory.

### C3. Dual Wellbeing Collection Writes
- **File:** `src/server/routes/wellbeingLogs.ts:139-150`
- **Problem:** Every wellbeing update writes to BOTH `wellbeingLogs` and `wellbeingEntries` collections via `upsertWellbeingLog()` + `createWellbeingEntries()`. 2+ writes per checkin instead of 1.
- **Fix:** Complete migration to single canonical `wellbeingEntries` collection.

### C4. Session Middleware: 2 DB Calls Per Request
- **File:** `src/server/middleware/session.ts:25-51`
- **Problem:** Every authenticated request calls `findSessionByTokenHash()` then `findUserById()` sequentially. For 10 API calls on app load, that's 20 extra DB queries.
- **Fix:** In-memory session cache with TTL (e.g., 60s), or combine session+user into single lookup.

### C5. Overlapping Goal Endpoints
- **Files:** `src/server/routes/progress.ts:35-39`, `src/server/routes/goals.ts:304-308`
- **Problem:** `/progress/overview` and `/goals-with-progress` both call `getGoalsByUser()` + `getHabitsByUser()` + `getHabitEntriesByUser()` + `computeGoalsWithProgressFromData()`. When both are used in a session, 3 DB queries are fully duplicated.
- **Fix:** Unify cache so `useGoalsWithProgress()` extracts from `useProgressOverview()` data when available, or consolidate into single endpoint.

---

## HIGH Issues

### H1. GoalDetailPage: N Individual Habit Entry Fetches
- **File:** `src/pages/goals/GoalDetailPage.tsx:69-111`
- **Problem:** For each linked habit, calls `fetchHabitEntries(habitId)` individually with no date range. 3 linked habits = 3 API calls returning full history each. HabitContext already has this data loaded.
- **Fix:** Reuse HabitContext logs or use batch `getEntryViewsForHabits()` on backend.

### H2. AddHabitModal Uses Wrong Hook
- **File:** `src/components/AddHabitModal.tsx:77`
- **Problem:** Uses `useProgressOverview()` (fetches habits + goals + momentum) just to get the goal list. 80% of fetched data unused.
- **Fix:** Use `useGoalsWithProgress()` instead.

### H3. Routine Detail: Separate Image Query
- **File:** `src/server/routes/routines.ts:250-273`
- **Problem:** Single routine fetch + separate image fetch = 2 queries per detail view.
- **Fix:** Include image data in routine query or join.

### H4. Routine Image Upload/Delete: 3 Cascading Queries Each
- **Files:** `src/server/routes/routines.ts:710-780` (upload), `658-695` (delete)
- **Problem:** Each image operation does: validate routine (1 query) + image operation (1 query) + update routine record (1 query) = 3 queries.
- **Fix:** Combine auth check with operation, consider removing the routine record update if image relationship tracked from image side.

### H5. Journal: No Date Range Filtering
- **File:** `src/server/repositories/journal.ts:111-122`
- **Problem:** `getEntriesByUser()` returns ALL journal entries with no date filtering. User with 200 entries transfers ~400KB when only last 30 days (~120KB) are displayed.
- **Fix:** Add `startDate`/`endDate` parameters to repository query.

### H6. Journal: Dual Fetch on Save
- **File:** `src/pages/JournalPage.tsx`
- **Problem:** After saving, changes `refreshKey` which remounts `JournalDisplay`, causing a full refetch. Every save = 1 write + 2 reads.
- **Fix:** Optimistic update — add/update entry in local state instead of remounting.

### H7. TrackerGrid: 9x refreshProgress() + Background Sync
- **File:** `src/components/TrackerGrid.tsx:919,1012,1032,1071,1096,1124,1337,1350`
- **Problem:** Every mutation (toggle, updateLog, clearEntry) calls `refreshProgress()` immediately AND `scheduleBackgroundSync()` fires 30s later. Double-refresh on every habit toggle.
- **Fix:** Remove explicit `refreshProgress()` calls; rely on background sync, or consolidate into single post-mutation refresh.

---

## MEDIUM Issues

### M1. All Contexts Eager-Load on Mount
- **File:** `src/App.tsx:537-560`
- **Problem:** `HabitProvider`, `RoutineProvider`, `TaskProvider` all fetch data on mount regardless of which page the user navigates to. Visiting Tasks page loads all habits, wellbeing, routines, etc.
- **Fix:** Lazy-load context data when first accessed, or create `/api/bootstrap` endpoint.

### M2. HabitContext: Fixed 400-Day Window
- **File:** `src/store/HabitContext.tsx:94-102`
- **Problem:** `fetchDaySummary()` always requests 400 days of history regardless of actual data or view needs.
- **Fix:** Start with 60-90 days, load more on demand.

### M3. Wellbeing Logs: Full Fetch on Mount
- **File:** `src/store/HabitContext.tsx:118-151`
- **Problem:** ALL wellbeing logs loaded on app mount even if user never visits wellbeing page.
- **Fix:** Lazy-load when WellbeingHistoryPage or relevant component mounts.

### M4. RoutineContext: Logs Fetched Unconditionally
- **File:** `src/store/RoutineContext.tsx:73-103`
- **Problem:** `fetchRoutineLogs()` called on mount, but logs only used by `PinnedRoutinesCard` on dashboard.
- **Fix:** Defer log fetching until PinnedRoutinesCard mounts.

### M5. Routine Editor: Full Refresh After Image Change
- **File:** `src/components/RoutineEditorModal.tsx:100-102, 377`
- **Problem:** After uploading/deleting a single image, calls `refreshRoutines()` which re-fetches ALL routines + ALL logs + triggers N+1 image queries again.
- **Fix:** Update single routine in local state instead of full refresh.

### M6. Wellbeing History: No Window Caching
- **File:** `src/hooks/useWellbeingEntriesRange.ts:32-54`
- **Problem:** Switching between 7d/30d/90d buttons triggers full refetch each time. Clicking 90d → 7d → 90d = 3 API calls when the 90d data already contains 7d data.
- **Fix:** Cache fetched ranges, serve subsets from already-loaded data.

### M7. DayView: Bundle Parent Overfetching
- **File:** `src/server/services/dayViewService.ts:246-273`
- **Problem:** Fetches entry views for bundle parent habits that never have entries. ~50% unnecessary data in bundles.
- **Fix:** Only fetch entries for leaf habits (non-bundles).

### M8. truthQuery: Fetches All Entries Then Filters
- **File:** `src/server/services/truthQuery.ts:40-101`
- **Problem:** `getEntryViewsForHabits()` loads entire user entry history, then filters in-memory by habitId and date range.
- **Fix:** Push date range filtering to the MongoDB query level.

### M9. Goal Cache Not Invalidated by Habit Mutations
- **File:** `src/lib/goalDataCache.ts:136-144`
- **Problem:** When habits linked to goals are created/updated/deleted, goal progress cache isn't invalidated. Stale progress data possible.
- **Fix:** Call `invalidateGoalCaches()` from habit mutation functions.

### M10. Separate Cache Keys Prevent Deduplication
- **File:** `src/lib/goalDataCache.ts:149-159`
- **Problem:** `useProgressOverview()` and `useGoalsWithProgress()` use different cache keys. Same goal data cached twice with no sharing.
- **Fix:** Unify goal data under single cache key, or have one hook derive from the other.

### M11. Task Error: Full Refetch Instead of Rollback
- **File:** `src/context/TaskContext.tsx:62-74`
- **Problem:** On task update failure, fetches entire task list instead of reverting just the failed task.
- **Fix:** Capture pre-update state, revert single task on error.

### M12. Per-Step API Calls During Routine Execution
- **File:** `src/store/RoutineContext.tsx:231-247`
- **Problem:** `recordRoutineStepReached()` fires a POST request for every step with a linked habit during execution. 5 linked steps = 5 API calls.
- **Fix:** Batch evidence records and submit once at routine completion.

### M13. DashboardPrefs: Inconsistent Scoping
- **File:** `src/server/routes/dashboardPrefs.ts:12-27`
- **Problem:** GET uses only `userId`, PUT uses both `householdId` and `userId`. Potential data isolation issue in multi-user households.
- **Fix:** Align GET to use `householdId` like PUT does.

### M14. Stale-While-Revalidate Always Refetches (No TTL Check)
- **File:** `src/lib/useGoalsWithProgress.ts:36-42`, `src/lib/useGoalDetail.ts:50-75`
- **Problem:** Background refetch fires even when cache is fresh (within 30s TTL). No freshness check before initiating background fetch, so navigating between goal views always triggers network calls.
- **Fix:** Add `getCacheFreshness()` check — skip background fetch if TTL < 10s remaining.

### M15. useCompletedGoals Missing Cache Invalidation Listener
- **File:** `src/lib/useCompletedGoals.ts:39-65`
- **Problem:** Unlike `useGoalsWithProgress` (which subscribes to cache invalidation events), `useCompletedGoals` has no subscription. When a goal is marked complete, Win Archive won't update until manual refresh.
- **Fix:** Add `subscribeToCacheInvalidation()` listener like other goal hooks.

### M16. WinArchivePage: Unconditional Force-Refetch on Mount
- **File:** `src/pages/goals/WinArchivePage.tsx:15-25`
- **Problem:** Uses `setTimeout(refetch, 100)` on every mount, ignoring cache freshness entirely.
- **Fix:** Check cache TTL before forcing refetch.

### M17. GoalCompletedPage: Oversized Data Fetch
- **File:** `src/pages/goals/GoalCompletedPage.tsx:32`
- **Problem:** Uses `useGoalDetail(goalId)` which fetches full 30-day history + computed progress, but only displays basic metadata (title, type, targetValue, dates).
- **Fix:** Use lightweight `/goals/{id}` endpoint or extract from already-cached goal list.

### M18. invalidateAllGoalCaches Too Aggressive
- **File:** `src/lib/goalDataCache.ts:105-110`, `src/lib/persistenceClient.ts:888,911,958,1000`
- **Problem:** Every goal mutation (create, update, delete, badge upload) calls `invalidateAllGoalCaches()` which clears the entire cache. Editing Goal #1 forces refetch of Goals #2, #3, etc.
- **Fix:** Use targeted `invalidateGoalCaches(goalId)` (already exists at line 136) instead of the nuclear option.

---

## Impact Summary

| Category | Issues | Est. Redundant DB Calls per App Load |
|----------|--------|--------------------------------------|
| Session middleware | C4 | 20+ (2 per request × 10+ requests) |
| N+1 patterns | C1, C2, H1 | 10-30 (depends on routine/habit count) |
| Overlapping endpoints | C5, H2, M10 | 6-9 (duplicate goal/habit/entry fetches) |
| Eager context loading | M1-M4 | 4-8 (unnecessary API calls per mount) |
| Dual writes | C3 | 2+ per wellbeing update |
| Post-mutation over-refresh | H6, H7, M5 | 2-10 per user interaction |

**Conservative estimate:** A typical app load triggers **40-60 DB queries** when **15-20 would suffice** — a potential **60-70% reduction**.

---

## Recommended Fix Priority

### Phase 1: Highest ROI (1-2 days) ✅ COMPLETED
- [x] C1: Add batch image query, fix N+1 in routine list (already fixed)
- [x] C2: Fix N+1 in goal habit validation (already fixed)
- [x] C4: Add session caching middleware (fixed in Phase 3 caching PR)
- [x] H7: Consolidate TrackerGrid refresh pattern (debounced refreshProgress, 9 calls → 1 coalesced)
- [x] M18: Use targeted goal cache invalidation instead of clearing all (removed 6 redundant invalidateAllGoalCaches calls)

### Phase 2: High Impact (2-3 days) ✅ COMPLETED
- [x] C5/M10: Unify goal data caching — cross-populate goals-with-progress cache from progress overview
- [x] H1: GoalDetailPage derives entries from HabitContext logs (eliminated N API calls per linked habit)
- [x] H5/H6: Journal date filtering (90-day default window) + optimistic updates (no remount refetch)
- [x] M14: TTL freshness check — skip background refetch when cache is still within 30s TTL
- [x] M15: Cache invalidation listener on useCompletedGoals (already implemented)

### Phase 3: Medium Impact (3-5 days) ✅ COMPLETED
- [x] C3: Migrate to single wellbeing collection — frontend reads/writes wellbeingEntries only, dual-write adapter removed
- [ ] M1: Lazy-load context providers by route (deferred — high risk, standalone effort)
- [x] M2: Reduce HabitContext window from 400 to 90 days (completed in Phase 2 commit 96f7c0a)
- [x] M5: Targeted routine state updates — removed redundant refreshRoutines() after image upload/delete
- [x] M8: Push date range filtering to MongoDB query level — startDayKey/endDayKey passed through to repository
- [x] M12: Batch routine step evidence submissions — accumulated during execution, single batch POST on exit
- [x] M16: Check cache TTL before WinArchivePage force-refetch (already implemented via useCompletedGoals TTL logic)
- [x] M17: GoalCompletedPage uses cached goal data from goals-with-progress/completed-goals cache, falls back to detail fetch
