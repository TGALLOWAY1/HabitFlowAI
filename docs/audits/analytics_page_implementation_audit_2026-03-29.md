# Analytics Page Implementation Audit (2026-03-29)

## 1) Executive summary

**Feasibility:** Yes — an Analytics page is feasible now, but only if V1 is explicitly scoped around canonical HabitEntry-derived read models.

**V1-ready now (high confidence):**
- Bottom-nav replacement (`Tasks` -> `Analytics`) with `Tasks` preserved via Dashboard entry points.
- Habit analytics derived from HabitEntries by DayKey (completion rate, streaks, totals, category rollups, top habits, trend deltas).
- Goal analytics using existing goal-progress truth path (`goalProgressUtilsV2` + `truthQuery`) for progress, active/completed splits, linked-habit contribution.
- Limited routine analytics from RoutineLogs (starts/usage frequency, variant usage, routine->confirmed HabitEntry conversion ratio) with strict labeling.

**Biggest blockers / trust risks:**
1. `computeGoalListProgress()` currently contains an explicit approximation path for multi-habit `distinctDays` goals (“acceptable approximation”). This violates “truthful analytics only” for Analytics V1 and must be removed from Analytics read paths.
2. `getGoalDetailRoute()` builds 30-day history with `new Date()` math and no timezone-aware DayKey utility; this can drift from canonical DayKey boundaries.
3. Routine logs are queried by `userId` only in `getRoutineLogsByUser`, while most other canonical stores are household+user scoped. This is an analytics integrity risk for routine tab accuracy in multi-household scenarios.
4. Frontend has legacy utilities (`src/utils/analytics.ts`, `src/utils/habitAggregation.ts`) that operate on DayLogs/date/dateKey semantics and include “simplified” logic. These should not be reused in new analytics.

**Recommended implementation sequence:**
1. Add backend analytics read endpoints (habit + goal + routine) with strict DayKey windowing and no approximations.
2. Build Analytics page shell + tabs, wire nav replacement.
3. Implement Habits tab fully; Goals tab with meaningful subset; Routines tab with “foundational metrics only”.
4. Add invariant tests and cross-view consistency checks.

---

## 2) Current navigation audit

### How Tasks is currently wired
- Router is local state in `App.tsx` (`AppRoute` union includes `'tasks'`, no `'analytics'`).
- URL sync uses `?view=...` parsing in `parseRouteFromLocation()` and `buildUrlForRoute()`.
- Bottom nav is static tabs array in `BottomTabBar.tsx` and currently includes `tasks` as primary destination.
- `ProgressDashboard` receives `onNavigateToTasks` and renders `TasksCard`, so Dashboard already has an entrypoint.

### Safe replacement strategy
1. Add `'analytics'` to `AppRoute` and URL parser.
2. Replace BottomTabBar tab `{ route: 'tasks', label: 'Tasks' }` with analytics.
3. Keep route `'tasks'` and page render branch intact in `App.tsx`.
4. Keep Dashboard `TasksCard` and `onNavigateToTasks` to preserve discoverability.
5. Do **not** break deep links: continue honoring `?view=tasks`; add `?view=analytics`.

### Assumptions to update
- Title mapping in `App.tsx` currently falls back to `'Goals'` for non-explicit views; add explicit `'analytics'` title.
- `BottomTabBar` `TabRoute` union must include `'analytics'`.

---

## 3) Current data inventory

## Habit
- **Where:** `persistenceTypes.ts`, `habitRepository`, `GET /api/habits`.
- **Fields relevant:** type/frequency/weeklyTarget, bundle structure (`bundleType`, `subHabitIds`), category linkage, archived.
- **Canonical?** Configuration model, not behavioral truth.
- **Analytics trust:** High for denominator/target context; must be combined with HabitEntries.
- **Limits:** Bundle semantics complicate counting unless entry attribution is explicit.

## HabitEntry (canonical truth)
- **Where:** `persistenceTypes.ts`, `habitEntryRepository`, `/api/entries`, truthQuery.
- **Fields:** `habitId`, `dayKey`, `timestamp`, `value`, `source`, `routineId`, `variantId`, soft delete.
- **Canonical?** **Yes** (explicitly documented as source of truth).
- **Analytics trust:** Highest.
- **Limits:** Some fallback paths still accept legacy date/dateKey/timestamp derivation; Analytics should require valid dayKey and alert on fallback.

## DaySummary / DayLog derived view
- **Where:** `/api/daySummary` route.
- **Canonical?** Derived cache/read model from HabitEntries.
- **Analytics trust:** Good for UI snapshots; Analytics should prefer direct HabitEntry aggregations/read models to avoid hidden shape conversions.
- **Limits:** Derived `source` collapsed to manual/routine; may lose nuance for advanced analytics.

## Goal
- **Where:** `persistenceTypes.ts`, `goalRepository`, `/api/goals*`.
- **Fields:** `type`, `targetValue`, `linkedHabitIds`, `aggregationMode`, `countMode`, `deadline`, completion metadata.
- **Canonical?** Goal config is canonical; progress is derived.
- **Analytics trust:** High when recomputed from HabitEntries.

## GoalLink semantics (equivalent)
- **Where:** implemented as `Goal.linkedHabitIds` + aggregation semantics in `goalLinkSemantics.ts` and `goalProgressUtilsV2.ts`.
- **Canonical?** Yes for linking semantics.
- **Limits:** No separate GoalLink entity; historical link change events are not first-class.

## Category
- **Where:** `Category` model + category repository.
- **Canonical?** Config taxonomy.
- **Analytics trust:** Good for grouping existing habits.
- **Limits:** Category edits/renames can affect longitudinal interpretation unless snapshots are introduced.

## Routine
- **Where:** `Routine` model + routine routes/repo.
- **Canonical?** Workflow config, not completion truth.
- **Analytics trust:** Good for usage metadata only.

## RoutineExecution / RoutineLog
- **Where:** `RoutineLog` model + `routineLogRepository` + `/api/routineLogs`.
- **Canonical?** Non-authoritative behavioral support signal.
- **Analytics trust:** Moderate for usage metrics; **must not** imply habit completion.
- **Limits:** Current retrieval scope is user-only (household missing) and can introduce data integrity risk.

## HabitPotentialEvidence
- **Where:** evidence routes + repository.
- **Canonical?** Explicitly non-authoritative “potential” signal.
- **Analytics trust:** Useful for “supportive step reached” style leading indicators only.
- **Limits:** date field (not dayKey type), and evidence does not confirm completion.

## Progress/summary endpoints
- `/api/progress/overview`: habit streak/momentum + goalsWithProgress (dashboard-oriented, not flexible analytics endpoint).
- `/api/goals-with-progress`: good base for goal tab summary cards.
- `/api/goals/:id/detail`: includes 30-day history but timezone handling caveat.

## Wellbeing/Sleep/Journal
- Wellbeing entries exist (`/api/wellbeingEntries`, `WellbeingEntry` schema includes keys like sleepScore/sleepQuality).
- Journal exists but is largely textual.
- Cross-domain correlation is possible **only** as descriptive co-movement (no causal claims).

---

## 4) Analytics-by-tab feasibility matrix

## Habits tab
- Completion % (window): **Ready now**
- Current streak / best streak: **Ready now** (reuse streak service logic server-side)
- Total completions: **Ready now**
- Success/consistency rate by window: **Ready now**
- Category momentum/performance: **Possible with moderate changes** (needs dedicated endpoint with clear denominator definitions)
- Top-performing habits: **Ready now**
- Category commitment differences: **Possible with moderate changes** (define denominator carefully by active scheduled opportunities)
- Weekly habits correctness: **Possible with moderate changes** (must compute by week-boundary satisfaction, not daily tick counts)
- Correlations (sleep vs fitness): **Blocked/partial** unless limited to simple co-trend and sufficient data density
- Causal/behavioral inferences: **Should not implement** (misleading)

## Goals tab
- Progress toward target: **Ready now**
- Active/completed goals: **Ready now**
- Recent milestone/completion history: **Possible with moderate changes** (needs derived milestone event synthesis)
- Goal trend chart: **Ready now** (but fix timezone in detail history)
- Pace estimate (“at current pace…”): **Possible with moderate changes** with confidence labeling
- Calendar target dates: **Ready now** for goal.deadline
- Linked habit contribution split: **Ready now** from EntryViews grouped by habit
- Exact distinctDays multi-habit totals in list mode (current optimized path): **Should not implement with current approximation path**

## Routines tab
- Routine starts/usage frequency: **Ready now** from RoutineLogs
- Variant usage: **Ready now** if variantId present
- Routine->confirmed HabitEntry conversion: **Possible with moderate changes** (join RoutineLogs to HabitEntries by routineId/dayKey)
- Routine adherence/completion-style score: **Possible with moderate changes** (must be labeled as routine completion, not habit completion)
- Cumulative time spent: **Possible with moderate changes** (only from actualDurationSeconds / stepTimingData where present)
- “Most impactful steps”: **Blocked today** (potential evidence exists, but no robust attribution from step->confirmed entry chain)
- Any routine metric that implies habits completed by running routine: **Should not implement**

---

## 5) Canonical integrity audit

### Risks found
1. **Approximate goal distinct-day aggregation** in `computeGoalListProgress()` (multi-habit count goals). Not truthful enough for analytics.
2. **Goal detail history timezone drift risk**: `getGoalDetailRoute()` helper uses raw `new Date()` day strings instead of explicit DayKey-by-timezone utility.
3. **Routine log scoping inconsistency**: `getRoutineLogsByUser` filters only by `userId`; other stores use household+user.
4. **Legacy fallback paths** in truthQuery/dayKey utilities can derive dayKey from timestamp/date/dateKey; acceptable for migration but should be surfaced in analytics diagnostics.
5. **Legacy frontend helpers** (`utils/analytics.ts`, `utils/habitAggregation.ts`) are explicitly simplified or date/dateKey-based and may conflict with canonical analytics if reused.
6. **Routine evidence date field** uses `date` (string) rather than typed DayKey pipeline; easy to drift if timezone assumptions vary.

### Integrity guardrails for Analytics page
- Never compute from DayLogs alone when HabitEntries are available.
- No cached counters persisted in Goal/Routine documents.
- All windows resolved by DayKey in request timezone, server-side.
- Explicitly exclude soft-deleted entries.
- Any fallback/approximation should return warning metadata and be hidden in user-facing analytics.

---

## 6) Ideal Analytics page architecture

### Routes/UI shell
- Route: `?view=analytics` as primary nav destination.
- Internal tabs: Habits (default), Goals, Routines.
- Keep one page shell for shared controls (time-range, date window label, loading/error state).

### Route strategy
- Use one route + internal tab state for V1 (fewer URL surfaces, shared filters).
- Optional future: child URLs via `?view=analytics&tab=goals&range=month` for deep links.

### Fetching boundaries
- Shared window control: week/month/year.
- Per-tab endpoint calls to avoid overfetch:
  - `/api/analytics/habits?...`
  - `/api/analytics/goals?...`
  - `/api/analytics/routines?...`

### Cache strategy
- In-memory SWR-style cache keyed by tab+range+timezone.
- Invalidate on HabitEntry/Goal/Routine mutations that affect tab.

### Component strategy
- Shared primitives: `AnalyticsCard`, `SectionHeader`, `TrendChip`, `Sparkline/BarChart` wrappers.
- Tab-specific composables for metric definitions.

### Mobile layout
- Dense card stack (single column), 2-up only for tiny summary chips.
- Highest hierarchy first: headline KPIs -> trend -> breakdown lists -> explanatory caveats.

---

## 7) Backend / API audit

### Reusable existing endpoints
- `/api/progress/overview` for some habit summary baselines.
- `/api/goals-with-progress` for list-level goal cards.
- `/api/goals/:id/detail` as partial trend source (after timezone fix).
- `/api/routineLogs` for routine usage base.

### Needs cleanup before reuse
1. Goal list progress approximation path (distinctDays multi-habit).
2. RoutineLogs scoping by household.
3. Goal detail day-key windowing utility alignment.

### Recommended new analytics endpoints
- `GET /api/analytics/habits?range=week|month|year&timeZone=...`
  - Returns KPI block + daily series + category breakdown + top habits.
- `GET /api/analytics/goals?range=...&timeZone=...`
  - Returns active/completed counts, progress deltas, projected completion (labeled estimate), contribution split.
- `GET /api/analytics/routines?range=...&timeZone=...`
  - Returns routine starts, variant usage, logged duration totals, routine->entry conversion.

### Aggregation placement
- All aggregation server-side in dedicated service layer (`src/server/services/analytics/*`).
- Use HabitEntries + truthQuery for habit/goal metrics.
- Use RoutineLogs + optional joins to HabitEntries for routine metrics; never infer completion from logs alone.

### Index/query needs
- Verify/ensure indexes on `habitEntries` (`householdId`, `userId`, `dayKey`, `habitId`, `deletedAt`).
- Add routineLogs composite index including householdId once repository is fixed.

### Recomputability
- Endpoints must compute from source-of-truth tables at read-time or from transparent derived read models that can be rebuilt.
- No write-time counters.

---

## 8) Frontend implementation audit

### Where nav lives
- `src/components/BottomTabBar.tsx` (tab definitions)
- `src/App.tsx` route union/parser/title/render branches

### Add analytics route/page
- Create `src/pages/analytics/AnalyticsPage.tsx`
- Add render branch in `App.tsx` and title mapping
- Add tab in `BottomTabBar.tsx`

### Reusable existing components
- Goal trend/chart components can be reused with generic wrappers.
- Dashboard cards can inspire visual density but analytics needs dedicated shell.

### Keep Tasks discoverable
- Preserve Dashboard `TasksCard` CTA (`onNavigateToTasks`).
- Optionally add small “Open Tasks” quick action inside Dashboard and/or Analytics overflow menu.

---

## 9) Data gaps and schema gaps

1. **Routine execution identity/scoping**
   - Why: routine analytics trust.
   - V1 block? partial blocker.
   - Change: add household scoping in routineLogs repository + indexes.

2. **Routine step impact attribution**
   - Why: “supportive step” analytics.
   - V1 block? yes for impact claims.
   - Change: explicit step->entry confirmation linkage (executionId on HabitEntry).

3. **Goal milestone event model**
   - Why: robust milestone timeline.
   - V1 block? no.
   - Change: derived milestone synthesis service (no stored counters).

4. **Timezone-correct long-window goal history endpoint**
   - Why: month/year charts.
   - V1 block? moderate.
   - Change: parameterized history range endpoint using DayKey utilities.

5. **Cross-domain correlation data density checks**
   - Why: avoid fake inference.
   - V1 block? no, if deferred.
   - Change: minimum-day-threshold + confidence metadata.

6. **Duration completeness in routines**
   - Why: “hours spent” trust.
   - V1 block? partial.
   - Change: clearly separate “tracked duration” vs “estimated/unknown”.

---

## 10) Recommended V1 scope

## Ship now
- Nav replacement: Tasks -> Analytics in bottom nav.
- Analytics shell with tabs and Week/Month/Year selector.
- Habits tab:
  - completion %, total completions, current/best streak, top habits, category performance delta.
- Goals tab:
  - active/completed counts, per-goal progress, contribution by linked habits, simple pace estimate.
- Routines tab (limited):
  - routine starts, variant usage, tracked duration totals, routine->entry conversion.

## Ship if small cleanup is done first
- Fix goal distinctDays approximation for multi-habit goals.
- Fix timezone-safe goal history generation.
- Fix routine logs household scoping.

## Defer
- Causal correlation copy.
- Step-level impact ranking.
- Advanced forecast confidence intervals.

## Explicit TODOs for routine maturity
- Introduce routineExecutionId join key.
- Normalize routine evidence from `date` to DayKey-first contract.
- Add attribution model for “step reached -> confirmed habit entry”.

---

## 11) Exact metric definitions (V1)

## Habits
1. **Completion % (window)**
   - Source: HabitEntries + active habits.
   - Formula: `completed_opportunities / total_opportunities * 100`.
   - Daily habits: one opportunity per day in window.
   - Weekly habits: one opportunity per week bucket; success if distinct dayKeys with entries in that week >= weeklyTarget.
   - Bundles: parent bundle completion derived per canonical bundle rule; avoid double-count with children by reporting either parent-only or child-only mode.

2. **Current streak**
   - Source: habit day states from HabitEntries.
   - Formula: consecutive satisfied periods backward from current period (day for daily, week for weekly).

3. **Best streak**
   - Source: historical satisfied-period sequence.
   - Formula: max consecutive satisfied periods.

4. **Total completions**
   - Count mode default: distinct DayKeys with completion for boolean daily; for numeric, count days meeting target + optional total value separately.

5. **Category performance delta**
   - Window comparison: current window completion% vs previous equivalent window.
   - Caveat: only categories with >= N opportunities.

## Goals
1. **Goal progress**
   - Source: `Goal + linkedHabitIds + HabitEntries` through goal semantics.
   - Formula: existing canonical `aggregationMode/countMode` logic.

2. **Goal pace estimate**
   - Source: progress slope over recent 28 days.
   - Formula: `remaining / max(epsilon, avg_daily_progress_recent)`.
   - Label: “estimate”, hide when insufficient data.

3. **Linked habit contribution**
   - Source: goal-scoped EntryViews grouped by habitId.
   - Output: % share and absolute contribution.

## Routines
1. **Routine starts**
   - Source: RoutineLogs count in window.
2. **Variant usage share**
   - Source: RoutineLogs grouped by variantId.
3. **Tracked duration total**
   - Source: sum(actualDurationSeconds) where present.
   - Caveat: show “tracked time”, not total time.
4. **Routine->entry conversion**
   - Source: join RoutineLogs (routineId, dayKey) with HabitEntries(source='routine', routineId).
   - Formula: `% of routine runs with >=1 confirmed habit entry`.

---

## 12) Insight-copy guardrails

### Allowed (grounded)
- “You completed 23 of 29 habit opportunities this month.”
- “Health category completion is down 18% vs last month.”
- “At your recent pace, this goal is estimated in ~4 weeks.”
- “You started routines 12 times this month; 8 runs produced confirmed habit entries.”

### Disallowed / risky
- “Routines caused your habit success to increase.” (causal claim)
- “You spent 8 hours this month” when duration coverage is partial.
- “You do worse fitness when sleep is low” unless statistically validated and clearly labeled as correlation.

---

## 13) Testing and release gates

1. **Nav safety**
   - `?view=tasks` still opens Tasks.
   - Bottom nav shows Analytics instead of Tasks.

2. **Canonical drift gates**
   - Analytics habit metrics must equal recomputation from HabitEntries fixtures.
   - No metric sourced from stored completion fields.

3. **DayKey correctness**
   - Timezone boundary tests near midnight for all ranges.

4. **Edit/delete/backfill recomputation**
   - Update/delete/backfill HabitEntries and assert analytics recompute exactly.

5. **Goal recomputation integrity**
   - Multi-habit distinctDays tests must be exact (no approximation).

6. **Routine non-authoritativeness**
   - Routine logs without HabitEntries must not raise habit completion metrics.

7. **Bundle/weekly correctness**
   - Checklist/choice/weekly fixtures with expected outcomes.

8. **Partial data/empty states**
   - Graceful no-data cards; no invented numbers.

9. **Cross-view parity**
   - Dashboard streak/progress cards align with Analytics equivalents for same window.

10. **Performance gate**
   - Month/year tab load under target latency with indexed queries.

---

## 14) Implementation plan by milestone

## Milestone 1: Foundations + nav migration
- Scope:
  - Add Analytics route + bottom nav replacement.
  - Scaffold Analytics page shell + tabs + range control.
- Likely files:
  - `src/App.tsx`
  - `src/components/BottomTabBar.tsx`
  - `src/pages/analytics/*`
- Dependencies: none.
- Risks: deep-link regression.
- Acceptance: Tasks still reachable via Dashboard.

## Milestone 2: Canonical backend analytics services
- Scope:
  - Implement `/api/analytics/habits|goals|routines`.
  - Fix goal distinctDays approximation, goal history timezone consistency, routine log scoping.
- Likely files:
  - `src/server/routes/*analytics*.ts` (new)
  - `src/server/services/analytics/*` (new)
  - `src/server/utils/goalProgressUtilsV2.ts`
  - `src/server/repositories/routineLogRepository.ts`
  - `src/server/routes/goals.ts`
  - `src/server/app.ts`
- Dependencies: existing truthQuery/habitEntry repository.
- Risks: query performance.
- Acceptance: invariant tests green and parity checks pass.

## Milestone 3: Habits analytics UX (full V1 depth)
- Scope:
  - KPI cards, trends, category table, top habits.
- Likely files:
  - `src/pages/analytics/HabitsAnalyticsTab.tsx`
  - shared analytics components.
- Acceptance: Week/Month/Year all truthful and consistent.

## Milestone 4: Goals + limited routines tabs
- Scope:
  - Goals summary and contribution views.
  - Routines foundational usage/conversion metrics.
- Risks: overclaiming in copy.
- Acceptance: copy guardrails enforced; no pseudo-completions.

## Milestone 5: hardening + release
- Scope:
  - e2e checks, migration/deploy checklist, observability.
- Acceptance:
  - Release gates in section 13 passed.

---


## TODO
- [ ] Execute Milestone 1: add `analytics` route, replace bottom-nav `Tasks` with `Analytics`, and keep `Tasks` reachable from Dashboard entry points without breaking `?view=tasks` deep links.

## Recommended V1 (concise)
- Strong Habits tab (default) with canonical, DayKey-based metrics.
- Meaningful Goals tab with truthful progress + contribution + cautious pace estimate.
- Honest Routines tab limited to usage/conversion/tracked-duration, no completion claims.

## Recommended ideal end-state
- Unified analytics service layer with reusable derivation contracts.
- Exact goal aggregation for all modes at all scales.
- Routine execution attribution model (`routineExecutionId`) linking step actions to confirmed entries.
- Confidence-scored cross-domain insights (habit + wellbeing) with strict thresholds and disclaimers.

## Top 10 risks
1. Goal distinctDays approximation shipped to user.
2. Timezone/day boundary drift in history windows.
3. Routine log scoping inconsistency.
4. Reuse of legacy non-canonical frontend analytics helpers.
5. Bundle double-counting in category totals.
6. Weekly habit misrepresentation as daily completion.
7. Copy over-claiming causality.
8. Partial duration data presented as full time spent.
9. Cache invalidation drift between dashboard/goals/analytics.
10. Soft-deleted entries accidentally included.

## Top 10 implementation tasks
1. Add `analytics` route and bottom nav replacement.
2. Create Analytics page shell + tabs + shared range control.
3. Implement `GET /api/analytics/habits`.
4. Implement `GET /api/analytics/goals`.
5. Implement `GET /api/analytics/routines`.
6. Remove/replace approximate distinctDays path for analytics-critical reads.
7. Make goal history dayKey generation timezone-safe.
8. Add household scoping to routine logs repository + route usage.
9. Add invariant/unit tests for DayKey, weekly habits, bundles, delete/backfill recomputation.
10. Add cross-view parity tests against dashboard/progress outputs.
