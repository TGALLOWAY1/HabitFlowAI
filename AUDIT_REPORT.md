# HabitFlow Deep Audit Report

Date: 2026-04-02
Auditor stance: skeptical, production-incident prevention first.

## 1. Executive summary

**Overall health: risky for scale.** The app has good intent (entries as canonical truth, explicit dayKey normalization), but execution is inconsistent across endpoints and analytics layers.

**Most likely to break next:**
1. Habit type / schedule changes causing silent reinterpretation of historical entries.
2. Analytics showing plausible but wrong rates due to denominator and scheduling model mismatch.
3. Routine submission writing completions for arbitrary habits not linked to the routine.
4. Bundle conversion flows leaving partially migrated state if any middle step fails.
5. Apple Health backfills and “today” calculations drifting by timezone.

**Most dangerous silent failure mode:** analytics and progress cards disagreeing while both “look right.” Users lose trust when streaks/completion rates differ across Today, Progress, and Analysis views.

---

## 2. System mental model

### Inferred architecture
- **Storage**: MongoDB with repositories as access layer.
- **Operational truth**: `habitEntries` (per habit/dayKey) with soft delete.
- **Derived/legacy cache**: `dayLogs` are recomputed from entries but still present in read/write-adjacent paths.
- **Backend**: Express routes split by domain (`habits`, `entries`, `progress`, `analytics`, `routines`, `health`).
- **Frontend**: React context (`HabitContext`) consuming API responses and mixing canonical + derived responses for UX.

### Canonical entities and derived entities
- Canonical-ish: `Habit`, `HabitEntry`, `Goal`, `Routine`, `BundleMembership`, `HabitHealthRule`, `HealthMetricDaily`.
- Derived: streak metrics, completion booleans, momentum states, analytics cards/heatmaps, day summaries.

### Core data flow (as implemented)
1. **Mutation:** UI -> route (`/api/entries`, `/api/routines/:id/submit`, health sync routes) -> repository `upsertHabitEntry`.
2. **Aggregation:** services (`streakService`, `analyticsService`, `goalProgressUtilsV2`) derive completion/streak/trends from entries.
3. **Presentation:** `progress` and `analytics` routes expose independently computed aggregates.

### Recent feature plug-ins
- **Habit type evolution**: exposed via generic `PATCH /api/habits/:id` patching `goal`, `type`, scheduling fields without migration semantics.
- **Bundle conversion**: `habitConversionService` reassigns old entries to archived “history” child and updates memberships.
- **Apple Health**: `healthMetricsDaily` ingestion + rule evaluation -> auto-log `habitEntries` or suggestions + optional backfill.

---

## 3. Highest-severity findings

### Finding 1 — Analytics denominator ignores weekly/required-days semantics
- **Severity:** Critical
- **Confidence:** High
- **Why this matters:** Completion rate can be materially wrong for weekly habits and scheduled-daily-with-weekly-target habits.
- **Evidence:** `getScheduledHabitsForDay` only checks `assignedDays`; it does not model `goal.frequency === 'weekly'` or `requiredDaysPerWeek` semantics used by streak logic.
- **Affected scenarios:** weekly habits, X-days-per-week habits, trend cards, consistency comparisons.
- **Likely root cause:** analytics reused daily scheduling helper while streak service uses separate weekly logic.
- **Recommended fix:** introduce shared “expectation engine” used by streak/progress/analytics; encode daily vs weekly expected opportunities explicitly.
- **Type:** Design flaw + implementation bug.
- **Silent corruption risk:** Yes (plausible but wrong rates).

### Finding 2 — Progress “today” can diverge from timezone-specific dayKey
- **Severity:** High
- **Confidence:** High
- **Why this matters:** same user can see completed today in one view and not completed in another near timezone boundaries.
- **Evidence:** `progress.ts` computes `todayDate` using requested timezone but calls streak metrics with `referenceDate = new Date()` (server timezone), mixing anchors.
- **Affected scenarios:** midnight boundary, travel, DST transitions.
- **Likely root cause:** dual date anchors in progress route.
- **Recommended fix:** derive `referenceDate` from `todayDate` in requested timezone and pass consistently.
- **Type:** Implementation bug.
- **Silent corruption risk:** Yes (streak/complete-today disagreement).

### Finding 3 — Routine submit allows arbitrary habit completion injection
- **Severity:** Critical
- **Confidence:** High
- **Why this matters:** caller can complete any habit by passing IDs in `habitIdsToComplete`, regardless of routine linkage.
- **Evidence:** explicit code comment acknowledges missing authorization/association check; code upserts directly for provided IDs.
- **Affected scenarios:** malicious/buggy client, accidental cross-routine writes, analytics inflation.
- **Likely root cause:** trusted client assumption, missing server invariant.
- **Recommended fix:** enforce `habitIdsToComplete ⊆ routine.linkedHabitIds` (or explicit override flag with audit log).
- **Type:** Implementation bug / guardrail missing.
- **Silent corruption risk:** Yes.

### Finding 4 — Habit type change has no migration contract
- **Severity:** Critical
- **Confidence:** High
- **Why this matters:** changing `goal.type`, `goal.frequency`, `requiredDaysPerWeek`, `assignedDays`, or `type` can reinterpret existing entries without versioning.
- **Evidence:** `updateHabitRoute` blindly patches these fields; no backfill/migration/version stamping.
- **Affected scenarios:** binary->number, number->binary, daily->weekly, changing targets after long history, linked goals/analytics.
- **Likely root cause:** CRUD patch model without temporal semantics.
- **Recommended fix:** implement explicit “habit evolution” workflow: new effective config version with `effectiveFromDayKey`, plus read-time split by version.
- **Type:** Design flaw.
- **Silent corruption risk:** Extreme.

### Finding 5 — Bundle conversion is non-transactional and can strand data
- **Severity:** High
- **Confidence:** Medium-high
- **Why this matters:** partial failure can leave entries reassigned to placeholder `__pending__` or half-converted parent/children.
- **Evidence:** conversion flow performs multiple writes (`reassignEntries`, create child, create memberships, update parent) with no transaction/compensation.
- **Affected scenarios:** DB transient errors during conversion, process restarts mid-flow.
- **Likely root cause:** multi-step orchestration without transaction boundary.
- **Recommended fix:** use Mongo session transaction or idempotent state machine with resumable steps.
- **Type:** Implementation/migration risk.
- **Silent corruption risk:** Yes.

### Finding 6 — Analytics excludes bundle parents while progress includes derived bundle state
- **Severity:** High
- **Confidence:** High
- **Why this matters:** users compare pages and see different completion outcomes for same day/habit family.
- **Evidence:** analytics `getTrackableHabits` excludes `type === 'bundle'`; progress derives bundle parent day states from memberships.
- **Affected scenarios:** bundle-heavy users, checklist success rules, parent-child comparisons.
- **Likely root cause:** divergent aggregation contracts.
- **Recommended fix:** document and enforce one canonical inclusion strategy across analytics/progress/day view.
- **Type:** Design flaw.
- **Silent corruption risk:** Yes (cross-screen contradiction).

### Finding 7 — Health backfill end date uses default timezone instead of user/rule timezone
- **Severity:** Medium
- **Confidence:** High
- **Why this matters:** off-by-one-day inclusion/exclusion for users outside default timezone.
- **Evidence:** backfill route uses `getNowDayKey()` without user timezone while sync normalizes with client-provided timezone.
- **Affected scenarios:** international users, late-night backfill runs.
- **Likely root cause:** timezone not threaded through backfill endpoint.
- **Recommended fix:** require timezone parameter (or persist user timezone) and use consistently for start/end dayKey.
- **Type:** Implementation bug.
- **Silent corruption risk:** Moderate.

### Finding 8 — Health auto-log/backfill idempotent per dayKey, but source-of-truth conflict remains unresolved
- **Severity:** Medium
- **Confidence:** Medium
- **Why this matters:** manual and auto data compete for same day slot; whichever writes last can replace intent/value.
- **Evidence:** both flows use same `upsertHabitEntry(habitId, dayKey)` key; creation skipped when any entry exists, with no source-priority policy.
- **Affected scenarios:** user manually logs then health sync arrives; reconnect/backfill after manual edits.
- **Likely root cause:** single-row-per-day model without merge policy.
- **Recommended fix:** define precedence/merge rules (manual override lock, dual-source ledger, or reconciliation UI).
- **Type:** Design weakness.
- **Silent corruption risk:** Yes.

### Finding 9 — “No category” self-healing in read path mutates persisted habits during GET
- **Severity:** Medium
- **Confidence:** High
- **Why this matters:** reads have side effects; repeated calls can unexpectedly unarchive or reassign categories.
- **Evidence:** `getHabits` performs recovery updates and unarchives habits if missing/invalid category conditions are met.
- **Affected scenarios:** migrations, stale clients, category deletion edge cases.
- **Likely root cause:** migration logic embedded in hot read endpoint.
- **Recommended fix:** isolate recovery to one-shot migration/admin job with telemetry.
- **Type:** Migration/design flaw.
- **Silent corruption risk:** Moderate.

### Finding 10 — Legacy/modern mixed fields (`dayKey` vs `date`) still leak through critical paths
- **Severity:** Medium
- **Confidence:** Medium-high
- **Why this matters:** mixed-world assumptions can hide data quality issues and complicate backfills.
- **Evidence:** repositories and delete/query operations still match `$or: [{dayKey}, {date}]`; canonical fallback optionally derives from timestamps.
- **Affected scenarios:** old records, partial migrations, analytics windows.
- **Likely root cause:** incomplete migration closure.
- **Recommended fix:** complete migration to `dayKey`, add strict mode in production, emit metrics on fallback usage.
- **Type:** Migration issue.
- **Silent corruption risk:** Moderate.

---

## 4. Data flow audit

### Flow A — Habit completion
- UI triggers entry upsert (manual/routine/health).
- Repository writes one row per `(household,user,habit,dayKey)`.
- DayLog recompute is invoked but DayLogs remain derivative cache.
- **Risk points:** write-source collisions, read-path fallbacks, derived cache mismatch.

### Flow B — Progress overview
- Pull all habits + all entries + goals.
- Build day states from entries.
- Derive bundle parent state in-route.
- Compute streaks and momentum.
- **Risk points:** this logic is not shared with analytics route; duplicated business rules diverge.

### Flow C — Analytics pages
- Pull all habits/entries/categories/memberships.
- Build independent day-state maps and rates.
- Excludes bundle parents entirely.
- **Risk points:** denominator mismatch, weekly logic mismatch, cross-card inconsistency.

### Flow D — Apple Health
- Sync endpoint upserts `healthMetricsDaily` by day/source.
- Evaluate active rules; auto-log or suggest.
- Optional backfill iterates day range and writes missing entries.
- **Risk points:** timezone threading inconsistency, manual-vs-import conflict policy undefined, repeated backfill semantics implicit not explicit.

### Duplicated/ambiguous ownership
- Streak semantics live in `streakService`, but analytics uses separate schedule helper.
- Bundle parent derivation appears in progress/day summary paths differently.
- Recovery/migration behavior appears in operational routes.

---

## 5. Scenario matrix

| Scenario | Status | Notes |
|---|---|---|
| Create habit + complete same day | Safe-ish | Upsert path is atomic by dayKey.
| Complete/uncomplete/recomplete same day | Risky | Soft delete + upsert revival works, but source/value precedence unclear.
| Edit habit after history exists | Likely broken logically | No versioning; history reinterpretation likely.
| Binary -> measurable type change | Likely broken | Historical values assumed under new semantics.
| Measurable -> binary type change | Likely broken | Non-1 numeric history effectively coerced.
| Daily -> weekly frequency change | Likely broken | Analytics denominator not aligned to weekly model.
| Routine completion linked habits | Risky | Server accepts unlinked habit IDs.
| Bundle parent/child analytics parity | Risky | Progress includes derived parent; analytics excludes parent.
| Goal progress with linked bundles | Risky | Bundle resolution exists but depends on mixed membership/subHabit fallback.
| Apple Health auto-log only | Risky | Works for happy path, but conflict policy with manual entries missing.
| Apple Health backfill rerun | Mostly safe | Idempotent skip-if-existing, but timezone/end-day drift risk.
| Permission revoked/disconnect/reconnect | Untested/unclear | Rule deactivation exists; operational sync failure handling not deeply exercised.
| Feature flag off->on health rollout | Untested/unclear | Migration/backfill monitoring not obvious.
| Archived/deleted habit with history | Risky | Multiple pathways (soft delete entries, membership ending) can diverge in views.

---

## 6. Analytics correctness audit

**Trust level: medium-low today.**

Major trust gaps:
1. **Denominator model mismatch** for weekly/X-per-week habits.
2. **Population mismatch** (bundle parents excluded in analytics but present in progress derivations).
3. **Historical reinterpretation risk** when habit configs change without versioning.
4. **Cross-card mismatch potential** due to multiple ad-hoc computations.

Result: charts can be visually stable yet semantically wrong.

---

## 7. Apple Health audit

### Integration risks
- Source normalization is good at ingestion (`dayKey` normalization + upsert metric).
- Rule evaluation pipeline is straightforward and idempotent at day level.

### Major risks
- No explicit conflict-resolution policy between manual and auto sources.
- Backfill timezone inconsistency (`getNowDayKey()` default) can shift window edges.
- Disconnect only deactivates rule; no UX/system policy for stale pending suggestions or changed historical metrics.
- Frontend “one metric card = one connected habit” is UI policy; backend allows multiple habits per metric type via per-habit rules.

### Hardening recommendations
1. Persist source ledger (manual + imported), derive effective completion by policy.
2. Require timezone in backfill endpoint.
3. Add sync cursor / last-sync watermark and observability counters.
4. Add reconciliation endpoint for changed Apple Health historical values.

---

## 8. Habit type change audit

**Current model is not coherent enough for safe longitudinal analytics.**

What exists:
- Generic habit patch endpoint allows type/frequency/goal changes.
- Bundle conversion has special migration flow for parent->bundle transformations.

What is missing:
- No temporal config versioning (`effectiveFromDayKey`).
- No migration/backfill policy for entry reinterpretation.
- No invariant checks preventing incompatible transitions with linked goals/routines/health rules.
- No analytics partitioning by habit-config era.

**Bottom line:** type change support is operationally permissive but semantically undefined.

---

## 9. Test coverage gaps (risk-prioritized)

1. **Type-change regression suite** (critical): binary<->number, daily<->weekly, with long history and linked goals.
2. **Cross-surface parity tests** (critical): today/progress/analytics must agree on core metrics for same fixture.
3. **Routine submit authz tests** (critical): reject unlinked habit IDs.
4. **Bundle conversion failure injection** (high): mid-step failure leaves recoverable/consistent state.
5. **Timezone boundary tests** (high): sync/backfill/progress near midnight in multiple zones.
6. **Health conflict tests** (high): manual then auto-log then manual override.
7. **Migration strictness tests** (medium): dayKey-only mode with legacy fallback metrics.

---

## 10. Prioritized action plan

### Fix immediately
1. **Enforce routine-habit linkage server-side**
   - Step: validate `habitIdsToComplete` against `routine.linkedHabitIds`.
   - Impact: blocks unauthorized/invalid completion writes.
   - Difficulty: Low.
2. **Unify timezone anchor in progress route**
   - Step: use one canonical reference day/date derived from requested timezone.
   - Impact: removes “completed today” inconsistencies.
   - Difficulty: Low.
3. **Define and enforce health/manual precedence policy**
   - Step: add explicit merge strategy for same day/habit.
   - Impact: prevents silent overwrites.
   - Difficulty: Medium.

### Fix before wider release
1. **Shared expectation engine for analytics+streaks**
   - Step: extract schedule/expected-opportunity logic into one module.
   - Impact: stops denominator drift.
   - Difficulty: Medium.
2. **Habit configuration versioning**
   - Step: add `habitConfigVersions` or embedded version windows.
   - Impact: preserves historical semantics.
   - Difficulty: High.
3. **Transaction or resumable saga for bundle conversion**
   - Step: wrap conversion writes in Mongo transaction or state machine.
   - Impact: avoids partial migrations.
   - Difficulty: Medium-high.

### Refactor soon
1. Remove read-path self-healing side effects from `getHabits`.
2. Consolidate bundle parent derivation used by progress/daySummary/analytics.
3. Close legacy `date` fallback path with migration telemetry.

### Can wait
1. Performance cleanup (N+1 connected-health rule load in UI).
2. Additional UI guardrails and explanatory copy for complex transitions.

---

## 11. Suggested follow-up engineering work

1. **Refactors**
   - Introduce `DomainMetricsEngine` shared by progress/day view/analytics.
   - Introduce `HabitEvolutionService` for type/schedule transitions.
2. **Invariants to enforce**
   - Single canonical day boundary per request.
   - Routine completion must only affect linked habits.
   - Any config transition that changes semantics must be versioned.
3. **Migrations/backfills**
   - Full dayKey migration with strict production mode.
   - Backfill audit trail table (who/when/range/result).
4. **Instrumentation**
   - Parity checks: compare analytics completion rate vs recomputed baseline nightly.
   - Fallback counters for legacy date usage.
   - Health sync/backfill event metrics and duplicate-skipped counters.
5. **Tests**
   - Golden-fixture integration suite spanning habits/routines/goals/bundles/health.
   - Property-based tests for schedule expectations and streak boundaries.
6. **UI safeguards**
   - Warnings before type/frequency changes with “historical interpretation may change.”
   - Reconciliation UI for imported vs manual day conflicts.

---

# Appendix — Top 10 Most Important Fixes

1. **Restrict routine completion to linked habits**
   - Severity: Critical
   - Why: prevents arbitrary data writes.
   - Area: `src/server/routes/routines.ts` submit flow.
   - First step: reject any habit ID not in `routine.linkedHabitIds`.

2. **Unify timezone anchor in progress computations**
   - Severity: High
   - Why: avoids today/streak drift.
   - Area: `src/server/routes/progress.ts`.
   - First step: create `referenceDate` from `todayDate` in requested TZ.

3. **Shared expected-opportunity engine**
   - Severity: Critical
   - Why: analytics denominator currently wrong in weekly cases.
   - Area: `analyticsService` + `streakService`.
   - First step: centralize schedule semantics API.

4. **Habit config versioning for type/schedule changes**
   - Severity: Critical
   - Why: prevents historical reinterpretation.
   - Area: `habits` update path + analytics/streak readers.
   - First step: add `effectiveFromDayKey` version model.

5. **Transactional/resumable bundle conversion**
   - Severity: High
   - Why: prevent partial conversion corruption.
   - Area: `habitConversionService`.
   - First step: wrap writes in DB transaction.

6. **Health/manual conflict policy**
   - Severity: High
   - Why: source-of-truth ambiguity degrades trust.
   - Area: `healthAutoLogService`, entry upsert policy.
   - First step: define precedence and lock behavior.

7. **Timezone-aware backfill windows**
   - Severity: Medium
   - Why: off-by-one day in global usage.
   - Area: `habitHealthRules` backfill route.
   - First step: accept/require timezone parameter.

8. **Remove read-side recovery mutations**
   - Severity: Medium
   - Why: GET should not mutate domain state.
   - Area: `habits` get route.
   - First step: move to migration/admin command.

9. **Finalize dayKey migration and strict mode**
   - Severity: Medium
   - Why: mixed fields keep hidden data debt.
   - Area: entry repositories + dayKey utils.
   - First step: ship fallback-usage metrics, then disable in prod.

10. **Cross-surface parity test harness**
   - Severity: High
   - Why: catches silent logical wrongness before release.
   - Area: integration tests across `/progress`, `/analytics`, `/daySummary`.
   - First step: add shared fixture generator and expected invariants.
