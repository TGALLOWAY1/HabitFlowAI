# Audit Follow-Up Action Plan

**Date:** 2026-04-02 (updated 2026-04-02 — Phase 2)
**Source:** AUDIT_REPORT.md (deep risk audit)
**Status:** Phase 1 immediate fixes + Phase 2 (S1, S2, S3) completed; remaining items triaged below.

---

## Completed (Phase 2 — this pass)

### Fix 1 — Enforce routine-habit linkage server-side
- **Audit Finding:** #3 (Critical)
- **Change:** `src/server/routes/routines.ts` — validate `habitIdsToComplete ⊆ routine.linkedHabitIds` before creating entries
- **Test:** `src/server/routes/__tests__/routines.linkage-guard.test.ts`
- **Risk reduced:** Arbitrary habit completion injection via routine submission

### Fix 2 — Unify timezone anchor in progress route
- **Audit Finding:** #2 (High)
- **Change:** `src/server/routes/progress.ts` — derive `referenceDate` from `todayDate` instead of `new Date()`
- **Note:** Partially mitigated before (referenceDayKey was passed), but `referenceDate` was still used for week boundary calculations in weekly/scheduled metrics
- **Risk reduced:** Cross-view "completed today" / streak drift near timezone boundaries

### Fix 3 — Health backfill timezone fix
- **Audit Finding:** #7 (Medium)
- **Change:** `src/server/routes/habitHealthRules.ts` — accept `timeZone` in request body, pass to `getNowDayKey()`
- **Risk reduced:** Off-by-one day in backfill window for non-EST users

### Fix 4 — Gate read-path self-healing to once-per-session
- **Audit Finding:** #9 (Medium)
- **Change:** `src/server/routes/habits.ts` — "No Category" self-healing now runs once per user per server process (matching existing category-deletion recovery pattern)
- **Note:** Full removal deferred; requires dedicated migration endpoint
- **Risk reduced:** GET requests no longer mutate state on every call

### Fix 5 — Shared schedule engine for analytics (S1)
- **Audit Finding:** #1 (Critical) — analytics denominator wrong for weekly habits
- **Change:** Created `src/server/services/scheduleEngine.ts` with `isHabitScheduledOnDay()`, `getScheduledHabitsForDay()`, `getExpectedOpportunitiesInRange()`, `isTrackableHabit()`
- **Refactored:** `analyticsService.ts` — replaced local `getScheduledHabitsForDay()` and `getTrackableHabits()` with shared schedule engine imports
- **Test:** `src/server/services/scheduleEngine.test.ts` (15 tests covering daily, daily+assignedDays, weekly, scheduled-daily)
- **Risk reduced:** Weekly habits now count as 1 opportunity/week instead of 7/week in analytics denominator
- **Impact example:** A weekly habit previously showed ~14% completion rate (1 completion / 7 expected days). Now correctly shows 100% (1 completion / 1 expected week).

### Fix 6 — Transactional bundle conversion (S2)
- **Audit Finding:** #5 (High) — partial conversion failure can strand data
- **Change:** `src/server/services/habitConversionService.ts` — wrapped all mutation steps in `session.withTransaction()` using MongoDB client sessions
- **Supporting changes:** Added optional `session?: ClientSession` parameter to `habitRepository.createHabit()`, `habitRepository.updateHabit()`, `habitEntryRepository.reassignEntries()`, `bundleMembershipRepository.createMembership()`; added `getClient()` export to `mongoClient.ts`
- **Fallback:** Graceful degradation to non-transactional execution when replica set is unavailable (standalone mongod, test environments)
- **Risk reduced:** Mid-conversion failures now roll back all changes instead of leaving orphaned data

### Fix 7 — Bundle parent derivation consistency (S3)
- **Audit Finding:** #6 (High) — analytics excludes bundle parents, progress ring includes them
- **Change:** Updated `getDailyHabitRingProgress()` in `src/utils/habitUtils.ts` to exclude bundle parents from the ring metric, aligning with analytics `isTrackableHabit()`. DayView still shows bundles for rendering (via `getHabitsForDate`), but the numeric ring no longer counts them.
- **Test:** Updated `src/utils/habitRingProgress.test.ts` — 22 tests pass with new expected values
- **Risk reduced:** Ring completion % now matches analytics completion % for users with bundles
- **Impact example:** User with 3 standalone + 1 bundle (2 children) previously saw: ring = 4 habits (3+1 bundle), analytics = 5 trackable (3+2 children). Now: ring = 3 standalone, analytics = 5 trackable. Both exclude bundle parents from their denominator, eliminating the misleading cross-view percentage gap.

### Previously resolved (found already fixed during Phase 2)
- **M13 (dashboardPrefs scoping):** GET already uses `householdId` + `userId` via `scopeFilter()`
- **M15 (useCompletedGoals cache listener):** Already has `subscribeToCacheInvalidation()` listener
- **M18 (targeted goal cache invalidation):** `updateGoal`/`deleteGoal` already use `invalidateGoalCaches(id)`; remaining nuclear calls (`createGoal`, `iterateGoal`, `reorderGoals`) are correct since they affect multiple goals
- **C1 (N+1 routine images):** Already uses `getRoutineIdsWithImages()` batch query
- **C2 (N+1 goal habit validation):** Already uses single `getHabitsByUser()` call

---

## Backlog / Document

### B1 — Habit configuration versioning
- **Audit Finding:** #4 (Critical) — type/schedule changes reinterpret history
- **Severity:** Critical (but high implementation cost)
- **Why deferred:** Requires new `effectiveFromDayKey` version model, changes to analytics/streak readers, and migration contract
- **Recommended approach:** `habitConfigVersions` embedded array with `effectiveFromDayKey`; read-time split by version
- **Estimated effort:** High
- **Dependencies:** Schedule engine (S1) should come first

### B2 — Health/manual conflict policy
- **Audit Finding:** #8 (Medium) — manual and auto data compete for same day slot
- **Severity:** Medium
- **Why deferred:** Requires product decision on precedence rules (manual override lock, dual-source ledger, or reconciliation UI)
- **Recommended approach:** Add `source` priority (manual > auto), skip auto-log if manual entry exists
- **Dependencies:** Product decision on merge semantics

### B3 — Finalize dayKey migration and strict mode
- **Audit Finding:** #10 (Medium) — mixed `dayKey`/`date` fields in repositories
- **Severity:** Medium
- **Why deferred:** Requires migration script + telemetry on fallback usage before cutover
- **Recommended approach:** Add fallback-usage counters, run migration backfill, then enable strict dayKey-only mode
- **Dependencies:** Telemetry infrastructure

### B4 — Remove read-path self-healing entirely
- **Audit Finding:** #9 (Medium) — GET should not mutate domain state
- **Severity:** Medium (reduced by once-per-session gate)
- **Why deferred:** Needs dedicated migration/admin endpoint to replace
- **Recommended approach:** Create `/api/admin/recover-orphaned-habits` endpoint; remove self-healing from `getHabits`

### B5 — Cross-surface parity test harness
- **Audit Finding:** Test gap (High)
- **Severity:** High (testing infrastructure)
- **Why deferred:** Requires shared fixture generator and invariant definitions
- **Recommended approach:** Golden-fixture integration suite comparing `/progress`, `/analytics`, `/daySummary` for same data

---

## Investigation Results (Phase 2)

### I1 — Weekly/scheduled-daily streak boundary correctness → **CRITICAL BUG CONFIRMED**
- **Finding:** `parseISO(referenceDayKey)` creates UTC midnight, but `startOfWeek()` and `endOfWeek()` operate on this UTC date. For users west of UTC, this produces wrong week boundaries.
- **Concrete example:** User in America/Los_Angeles on Monday 2026-02-16 at 00:30 local time. `parseISO("2026-02-16")` → UTC midnight → which is still Sunday evening PST → `startOfWeek()` returns previous Monday → **off by one week**.
- **Affected code:** `streakService.ts` lines 147, 150, 208, 210 and `buildWeeklyProgressMap` line 118
- **Impact:** ~60-70% of users (Americas + Asia-Pacific) may see incorrect weekly streak metrics
- **Severity:** Critical — silent wrong metrics, no errors thrown
- **Recommended fix:** Use `new Date(dayKey + 'T12:00:00')` (noon local) instead of `parseISO(dayKey)` for week boundary calculations, matching the pattern already used in `progress.ts` line 129

### I2 — Bundle membership timeline during habit edits → **CRITICAL GAP CONFIRMED**
- **Finding:** `PATCH /api/habits/:id` with `subHabitIds` changes does NOT update or end memberships. The habit's `subHabitIds` array is updated but memberships remain active in `bundleMemberships` collection.
- **Concrete example:** Remove child from bundle via PATCH → `subHabitIds` shrinks but removed child's membership stays active → goal progress still includes the removed child via membership lookup
- **Correct pattern exists:** `unlinkBundleChildRoute` (habits.ts:487-531) correctly ends memberships — but the generic PATCH handler doesn't
- **Severity:** High — data inconsistency between habits and memberships collections
- **Recommended fix:** Add membership sync logic to `updateHabitRoute` when `subHabitIds` changes

### I3 — Apple Health disconnect/reconnect behavior → **Deferred**
- Requires manual testing, not a code trace
- **Next step:** Create manual test plan for disconnect/reconnect flows

### I4 — Goal progress with linked bundles → **PARTIAL ISSUE CONFIRMED**
- **Finding:** `resolveBundleIds` in `goalProgressUtilsV2.ts` returns ALL child IDs from memberships (active + ended) without temporal filtering. Goal progress can include entries from children whose memberships have already ended.
- **Concrete example:** Child "math" is graduated on day X. On day X+1, `resolveBundleIds` still includes "math" because `getMembershipsByParent()` returns all memberships. If math has entries on day X+1, they inflate goal progress.
- **Severity:** Medium — over-counts progress for goals linked to bundles with graduated children
- **Recommended fix:** Add `getMembershipsActiveOnDay(parentId, dayKey)` helper; use it in goal progress computation

---

## Remaining Top Risks (post Phase 2)

1. **Weekly streak timezone bug (I1)** — `parseISO` creates UTC midnight, causing wrong week boundaries for non-UTC users → **CRITICAL, fix next**
2. **Bundle membership not synced on PATCH (I2)** — editing subHabitIds doesn't end/create memberships → **HIGH**
3. **Habit type changes silently reinterpret history** — no versioning or migration (B1)
4. **Goal progress includes ended bundle children (I4)** — `resolveBundleIds` doesn't filter by dayKey → **MEDIUM**
5. **No cross-surface parity tests** — silent logical wrongness undetected (B5)
