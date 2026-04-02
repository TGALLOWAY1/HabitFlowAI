# Audit Follow-Up Action Plan

**Date:** 2026-04-02
**Source:** AUDIT_REPORT.md (deep risk audit)
**Status:** Phase 1 immediate fixes completed; remaining items triaged below.

---

## Completed (this pass)

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

---

## Fix Soon (next batch)

### S1 — Shared expected-opportunity engine for analytics + streaks
- **Audit Finding:** #1 (Critical) — analytics denominator wrong for weekly habits
- **Severity:** Critical
- **Why deferred:** Requires new shared module + refactor of both `analyticsService` and `streakService`; medium difficulty, high risk if done hastily
- **Recommended approach:** Extract schedule/expected-opportunity logic into `src/server/services/scheduleEngine.ts`, used by streak, progress, and analytics
- **Prerequisites:** Clear specification of weekly/X-per-week expected opportunity semantics
- **Temporary mitigation:** None — analytics rates for weekly habits are plausibly wrong

### S2 — Transactional/resumable bundle conversion
- **Audit Finding:** #5 (High) — partial failure can strand data
- **Severity:** High
- **Why deferred:** Requires Mongo session transaction or state machine; medium-high difficulty
- **Recommended approach:** Wrap `habitConversionService` writes in Mongo session transaction
- **Prerequisites:** Verify replica set support in all deployment environments
- **Temporary mitigation:** None — partial conversion failures are unlikely but unrecoverable

### S3 — Consolidate bundle parent derivation across views
- **Audit Finding:** #6 (High) — analytics excludes bundle parents, progress includes them
- **Severity:** High
- **Why deferred:** Requires architectural decision on canonical inclusion strategy
- **Recommended approach:** Document and enforce one strategy; likely "exclude parents from individual metrics, show derived parent state separately"
- **Prerequisites:** Decision on bundle parent analytics semantics

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

## Needs Investigation

### I1 — Weekly/scheduled-daily streak boundary correctness
- **What's unclear:** Whether `calculateWeeklyMetrics` and `calculateScheduledDailyMetrics` handle week boundaries correctly when `referenceDate` is derived from `parseISO(referenceDayKey)` (which creates midnight UTC)
- **Risk:** Subtle off-by-one-week errors for non-UTC users
- **Next step:** Create timezone-boundary test fixtures for weekly habits

### I2 — Bundle membership timeline during habit edits
- **What's unclear:** Whether editing a bundle parent's membership rules properly updates or terminates existing child memberships
- **Next step:** Code trace of `PATCH /api/habits/:id` for bundle parents

### I3 — Apple Health disconnect/reconnect behavior
- **What's unclear:** Full behavior when health permissions are revoked and later restored
- **Risk:** Stale pending suggestions, lost sync state
- **Next step:** Manual test plan for disconnect/reconnect flows

### I4 — Goal progress with linked bundles
- **What's unclear:** Whether bundle resolution in goal progress correctly handles all membership states (active, ended, pending)
- **Next step:** Code trace of `computeGoalsWithProgressFromData` bundle fallback path

---

## Remaining Top Risks (post this pass)

1. **Analytics denominator wrong for weekly habits** — plausible but incorrect completion rates (S1)
2. **Habit type changes silently reinterpret history** — no versioning or migration (B1)
3. **Bundle conversion non-transactional** — partial failure can strand data (S2)
4. **Cross-view bundle parent inconsistency** — analytics vs progress disagree (S3)
5. **No cross-surface parity tests** — silent logical wrongness undetected (B5)
