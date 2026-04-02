# GitHub Issues for Audit Follow-Up

Copy each issue below into GitHub. Labels and priority are suggested.

---

## Issue 1

**Title:** Shared expected-opportunity engine for analytics + streak denominator
**Labels:** `bug`, `critical`, `analytics`

**Body:**
## Problem

Analytics completion rates are wrong for weekly and X-days-per-week habits. `getScheduledHabitsForDay` only checks `assignedDays` and doesn't model `goal.frequency === 'weekly'` or `requiredDaysPerWeek` semantics used by streak logic.

This means charts can be visually stable yet semantically wrong — users see plausible but incorrect rates.

**Audit reference:** AUDIT_REPORT.md Finding #1, Follow-up item S1

## Affected areas
- `src/server/services/analyticsService.ts` — denominator calculation
- `src/server/services/streakService.ts` — separate weekly logic
- Progress route, analytics route, trend cards

## Recommended approach
1. Extract schedule/expected-opportunity logic into a shared `scheduleEngine` module
2. Encode daily vs weekly expected opportunities explicitly
3. Use this engine in streak, progress, and analytics paths

## Acceptance criteria
- [ ] Weekly habits show correct completion rates in analytics
- [ ] X-days-per-week habits show correct completion rates
- [ ] Streak service and analytics service use the same schedule semantics
- [ ] Cross-surface parity: progress and analytics agree on completion rates for same fixture

---

## Issue 2

**Title:** Habit configuration versioning for type/schedule changes
**Labels:** `enhancement`, `critical`, `data-integrity`

**Body:**
## Problem

Changing `goal.type`, `goal.frequency`, `requiredDaysPerWeek`, `assignedDays`, or `type` via `PATCH /api/habits/:id` silently reinterprets all historical entries without versioning. This is the most dangerous silent corruption risk in the codebase.

Examples:
- Binary -> measurable: historical `value: 1` entries now treated as numeric
- Daily -> weekly: analytics denominator changes retroactively
- Changing targets after long history: streak/goal calculations rewrite the past

**Audit reference:** AUDIT_REPORT.md Finding #4, Follow-up item B1

## Recommended approach
1. Add `habitConfigVersions` embedded array with `effectiveFromDayKey`
2. Read-time split by version era for analytics/streaks
3. Type transition validation (prevent incompatible transitions with linked goals/routines/health rules)

## Dependencies
- Shared schedule engine (#issue-1) should come first

## Acceptance criteria
- [ ] Type/schedule changes create a new config version with `effectiveFromDayKey`
- [ ] Analytics partition calculations by config era
- [ ] Streak calculations respect version boundaries
- [ ] Incompatible transitions are rejected or warned

---

## Issue 3

**Title:** Transactional or resumable bundle conversion
**Labels:** `bug`, `high`, `data-integrity`

**Body:**
## Problem

Bundle conversion (`habitConversionService`) performs multiple writes (reassignEntries, create child, create memberships, update parent) with no transaction or compensation. A partial failure (DB transient error, process restart) can leave entries reassigned to `__pending__` or half-converted parent/children.

**Audit reference:** AUDIT_REPORT.md Finding #5, Follow-up item S2

## Recommended approach
1. Wrap conversion writes in Mongo session transaction
2. Alternative: idempotent state machine with resumable steps
3. Verify replica set support in all deployment environments

## Acceptance criteria
- [ ] Bundle conversion is atomic — all-or-nothing
- [ ] Mid-step failure leaves data in a consistent, recoverable state
- [ ] Test: inject failure mid-conversion and verify rollback/recovery

---

## Issue 4

**Title:** Consolidate bundle parent treatment across analytics, progress, and day view
**Labels:** `bug`, `high`, `analytics`

**Body:**
## Problem

Analytics `getTrackableHabits` excludes `type === 'bundle'` parents entirely. Progress route derives bundle parent day states from memberships and includes them. This means users see different completion outcomes for the same day/habit family across pages.

**Audit reference:** AUDIT_REPORT.md Finding #6, Follow-up item S3

## Recommended approach
1. Make an architectural decision: one canonical inclusion strategy
2. Likely: exclude parents from individual metrics everywhere, show derived parent state separately
3. Document the rule and enforce across all aggregation paths

## Acceptance criteria
- [ ] Bundle parents treated consistently across Today, Progress, Analytics
- [ ] Documented decision on bundle parent analytics semantics
- [ ] Cross-surface parity test covering bundle scenarios

---

## Issue 5

**Title:** Define health/manual entry conflict resolution policy
**Labels:** `enhancement`, `medium`, `data-integrity`

**Body:**
## Problem

Manual and Apple Health auto-log entries compete for the same `(habitId, dayKey)` slot. Both flows use `upsertHabitEntry` — whichever writes last wins. There is no source-priority policy, no merge strategy, and no reconciliation UI.

Scenarios: user manually logs, then health sync arrives and overwrites. Or: reconnect/backfill after manual edits replaces user intent.

**Audit reference:** AUDIT_REPORT.md Finding #8, Follow-up item B2

## Recommended approach
1. Add `source` priority: manual > auto (skip auto-log if manual entry exists)
2. Consider dual-source ledger for full audit trail
3. Optional: reconciliation UI for conflicts

## Acceptance criteria
- [ ] Manual entries are never overwritten by auto-log
- [ ] Auto-log skips days where manual entry exists
- [ ] Backfill respects manual entries
- [ ] Policy is documented

---

## Issue 6

**Title:** Finalize dayKey migration and enable strict mode
**Labels:** `tech-debt`, `medium`

**Body:**
## Problem

Repositories and query operations still match `$or: [{dayKey}, {date}]` for backward compatibility. This mixed-field world hides data quality issues and complicates backfills.

**Audit reference:** AUDIT_REPORT.md Finding #10, Follow-up item B3

## Recommended approach
1. Add fallback-usage telemetry/counters to measure how often `date` fallback fires
2. Run migration backfill to ensure all entries have canonical `dayKey`
3. Enable strict dayKey-only mode in production
4. Remove legacy `date` fallback code

## Acceptance criteria
- [ ] Telemetry shows zero fallback usage in production
- [ ] All entries have canonical `dayKey` field
- [ ] Legacy `date` fallback removed from repositories
- [ ] No regressions in old data queries

---

## Issue 7

**Title:** Move getHabits self-healing to dedicated migration endpoint
**Labels:** `tech-debt`, `medium`

**Body:**
## Problem

`GET /api/habits` contains two recovery layers that mutate state during reads:
1. Category-deletion unarchive recovery
2. "No Category" orphan reassignment

These have been gated to once-per-user-per-server-process (PR: audit fixes), but GET endpoints should not mutate domain state at all.

**Audit reference:** AUDIT_REPORT.md Finding #9, Follow-up item B4

## Recommended approach
1. Create `/api/admin/recover-orphaned-habits` endpoint
2. Run as one-shot migration or periodic admin job
3. Remove self-healing from `getHabits` entirely

## Acceptance criteria
- [ ] `GET /api/habits` has no side effects
- [ ] Admin migration endpoint handles orphan recovery
- [ ] No habits become invisible after removing self-healing

---

## Issue 8

**Title:** Cross-surface parity test harness
**Labels:** `testing`, `high`

**Body:**
## Problem

No tests verify that Today view, Progress, Analytics, and Day Summary agree on core metrics for the same data fixture. Silent logical wrongness across views is the most dangerous failure mode — both views "look right" but disagree.

**Audit reference:** AUDIT_REPORT.md Section 9, Follow-up item B5

## Recommended approach
1. Create shared fixture generator (habits + entries + goals + bundles + health)
2. Define expected invariants (completion rate, streak, completed-today must agree)
3. Integration tests that query `/progress`, `/analytics`, `/daySummary` with same fixture and assert parity

## Acceptance criteria
- [ ] Golden fixture covering: daily habits, weekly habits, bundles, goals, health-linked habits
- [ ] Tests assert cross-endpoint agreement on completion metrics
- [ ] Tests run in CI

---

## Issue 9

**Title:** Investigate weekly streak boundary correctness with timezone-derived dates
**Labels:** `investigation`, `medium`

**Body:**
## Problem

In `streakService.ts`, `calculateWeeklyMetrics` and `calculateScheduledDailyMetrics` use `parseISO(referenceDayKey)` to create a Date for week boundary calculations. `parseISO('2026-03-31')` creates midnight UTC, which may cause off-by-one-week errors for non-UTC users when determining which ISO week a day belongs to.

**Audit reference:** Follow-up item I1

## Next steps
- [ ] Create timezone-boundary test fixtures for weekly habits (e.g., Sunday 11pm in various timezones)
- [ ] Verify week-start calculations use consistent timezone
- [ ] Fix if week boundary drift is confirmed

---

## Issue 10

**Title:** Investigate Apple Health disconnect/reconnect behavior
**Labels:** `investigation`, `medium`

**Body:**
## Problem

When health permissions are revoked and later restored, behavior is unclear:
- What happens to pending suggestions?
- Is sync state preserved or reset?
- Are stale metrics cleaned up?

Rule deactivation exists but full disconnect/reconnect flow is not deeply tested.

**Audit reference:** AUDIT_REPORT.md Section 7, Follow-up item I3

## Next steps
- [ ] Manual test plan for disconnect/reconnect flows
- [ ] Verify rule deactivation cleans up pending suggestions
- [ ] Document expected behavior
