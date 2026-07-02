# HabitFlow Bundle Semantics Audit (2026-03-30)

## 1) Executive Summary

The bundle refactor is **partially implemented but currently fragile**. The server has stronger semantics (temporal memberships + checklist success rules) in `dayView` and `progress`, but major client surfaces still derive bundle state from **static `subHabitIds` + local `logs`**, overriding or bypassing server truth. This creates cross-view divergence and introduces race/idempotency issues during toggles.

### Top 5 findings
1. **Critical:** Grid still contains legacy choice-parent entry paths (`upsert` on parent per day), which conflict with multi-child choice semantics and one-entry-per-habit/day persistence constraints.
2. **High:** Today view fetches canonical dayView, then **recomputes parent completion client-side** from static `subHabitIds`, potentially overriding temporal-membership correctness.
3. **High:** Bundle structure edits do not maintain `BundleMembership` history from UI flows, so historical accuracy depends on partial migration state and fallback behavior.
4. **High:** Day summary logs are per-habit-entry aggregates and do not derive bundle parent states; dashboard/rings that consume these logs rely on client fallback semantics.
5. **Medium/High:** Async mutation calls in day-view (choice deselect, clear) are fire-and-forget without awaited reconciliation, increasing stale UI/race risk.

---

## 2) Bundle Model Understanding

### Reconstructed model currently in code
- **Canonical server read path (strongest):**
  - `dayViewService` resolves active children by day using `BundleMembership`, with fallback to `subHabitIds`.
  - Choice completion = ANY active child complete.
  - Checklist completion = `evaluateChecklistSuccess(...)` rule.
- **Progress/streak path (partially strong):**
  - `progress` route derives parent dayStates from memberships (fallback static).
- **Client/UI fallback model (weaker/legacy):**
  - `habitUtils.computeBundleStatus/getBundleStats` derives from static `subHabitIds` and local `logs`.
  - Checklist defaults to ALL complete; does not use checklist success rule.
  - No temporal membership awareness.

### Alignment vs intended behavior
- **Choice bundle (intended ANY, allow many children):**
  - Partially aligned in server derivation and Today child toggles.
  - Misaligned in Grid where legacy parent-entry choice flows still exist.
- **Checklist as one parent habit:**
  - Partially aligned in ring/root filtering and some parent derivation.
  - Misaligned where views recompute with static-only children and ALL-only rule.
- **Historical integrity:**
  - Intended temporal correctness exists in server services.
  - But client edit flows do not keep membership timeline in sync, so historical correctness is not guaranteed end-to-end.

---

## 3) Dataflow Analysis (interaction → persistence → derivation)

### A. Today view checklist child toggle ON/OFF
1. UI triggers `onSubHabitToggle` → `onToggle(subHabitId)` in `DayCategorySection`.
2. `DayView` calls `toggleHabit(subHabitId, dateStr)` via HabitContext.
3. HabitContext optimistic writes `logs[subHabitId-day]`; create uses `POST /entries`, delete uses `DELETE /entries?habitId&date` (clear day).
4. Server persists via `upsertHabitEntry` / soft delete.
5. Today view does **client recompute** of parent from `subHabitIds` + merged logs.

Risk: server dayView may be correct with memberships, but client recompute can override with static membership assumptions.

### B. Today view choice child toggle ON/OFF
- ON: `onChoiceSelect` calls `onToggle(optionKey)` (child habit id) => child entry mutation.
- OFF: `onChoiceSelect` calls `deleteHabitEntryByKey(optionKey, dateStr)` (child deletion).

Risk: deselect path is not awaited in `DayCategorySection`, so UI may transiently desync and race with subsequent actions.

### C. Grid choice interactions (legacy + unified mixed)
- Grid has branch for real child habits that inspects **parent log `completedOptions`** and may upsert **parent** entry with `choiceChildHabitId`.
- Grid also has virtual option path writing parent entries via `bundleOptionId`.
- Parent bundle click for choice only expands/collapses.

Risk: mixed model (child-entry and parent-entry) creates inconsistent source-of-truth and conflicts with multi-child semantics.

### D. Bundle structure edits
- `AddHabitModal` updates `subHabitIds` and child `bundleParentId` links only.
- No corresponding create/end/graduate/archive membership calls.

Risk: historical day-specific active-child set is not explicitly maintained by edit flows.

### E. Reload/switch view behavior
- `dayView` endpoint derives from truthQuery + memberships.
- Grid/ring/dashboard often consume `logs` from `/daySummary`, then client-derived bundle logic.

Risk: same day can render differently across Today vs Grid vs Dashboard after refresh/navigation.

---

## 4) Findings by Criticality

### [Critical] Legacy choice-parent write path still active in Grid
- **Why it matters:** violates “choice bundle allows one/several/all children” if persisted at parent/day key with overwrite semantics.
- **Trigger:** interact with choice items in Grid paths that call parent `upsertHabitEntry(parent.id, day, { choiceChildHabitId/... })`.
- **Affected:** Grid cards, delete/reconcile behavior, parent log `completedOptions` rendering.
- **Root cause:** partial migration; both old option model and new child-habit model coexist.
- **Fix direction:** remove parent-choice entry writes from Grid; always write child habit entries and derive parent.

### [High] Today view post-fetch client recompute can override canonical dayView semantics
- **Why it matters:** temporal memberships/checklist rules from server can be replaced by static `subHabitIds` + ALL logic.
- **Trigger:** any logs merge in `resolvedHabitStatusMap` recompute.
- **Affected:** Today completion badges, counts, parent-child consistency.
- **Root cause:** optimistic merge layer includes bundle recomputation instead of patching only touched habits.
- **Fix direction:** keep server-derived parent completion authoritative; only patch direct mutated child status and request lightweight refetch.

### [High] Membership timeline not maintained in bundle edit flows
- **Why it matters:** historical rendering can drift when children are added/removed later.
- **Trigger:** editing bundle children in Add Habit modal.
- **Affected:** DayView/progress historical days, analytics relying on active-child sets.
- **Root cause:** edit flow only updates habit docs (`subHabitIds`, `bundleParentId`).
- **Fix direction:** when linking/unlinking children, create/end `BundleMembership` records with explicit day keys.

### [High] Day summary lacks derived bundle parent states
- **Why it matters:** ring/dashboard consuming logs rely on client derivation (static), not server canonical membership logic.
- **Trigger:** dashboard/ring reads after entry changes.
- **Affected:** daily rings, quick summaries, potentially card states.
- **Root cause:** `daySummary` aggregates only by entry habitId.
- **Fix direction:** either enrich daySummary with derived parent states from memberships or stop using daySummary for bundle parent completion.

### [High] Idempotency model restricts one entry per habit/day across mixed choice models
- **Why it matters:** parent-entry choice path cannot represent multi-choice in a single day.
- **Trigger:** repeated parent upserts for different options same day.
- **Affected:** choice bundle analytics and undo semantics.
- **Root cause:** repository upsert key `(habitId, dayKey)`.
- **Fix direction:** commit to child-habit entries only for choices; deprecate parent-choice entries.

### [Medium] Fire-and-forget mutation calls in Today choice deselect/clear
- **Why it matters:** stale UI, out-of-order operations under rapid taps.
- **Trigger:** rapid toggles on choice pills and numeric clear.
- **Affected:** DayCategorySection and popover clear interactions.
- **Root cause:** missing `await` and explicit pending-state lockout.
- **Fix direction:** await mutations, disable controls while pending, reconcile from mutation response/refetch.

### [Medium] Bundle parent deletion cleanup is best-effort and non-transactional
- **Why it matters:** can leave orphaned linkage if second update fails.
- **Trigger:** deleting child habit where parent patch fails.
- **Affected:** subHabitIds integrity.
- **Root cause:** sequential API calls without compensating rollback.
- **Fix direction:** server-side transactional endpoint for child deletion + parent linkage cleanup + membership end.

### [Low] Multiple bundle-semantic implementations increase drift risk
- **Why it matters:** maintainability and regression probability.
- **Trigger:** future PR patches only one layer.
- **Affected:** all surfaces.
- **Root cause:** duplicated logic in `habitUtils`, day-view merge, Grid, server services.
- **Fix direction:** centralize derivation contract in one shared selector/service API.

---

## 5) Cross-View Consistency Matrix

| Surface | Bundle completion computation | Match intended semantics? | Shared logic vs duplicate |
|---|---|---|---|
| Today view (`DayView`) | Server `dayView` then client recompute from `subHabitIds` + local logs | Partial (can diverge on memberships/checklist rule) | Duplicate/overriding logic |
| Grid (`TrackerGrid`) | `computeBundleStatus/getBundleStats` from `subHabitIds`; mixed choice parent/child write paths | Partial to poor for choice migration | Mostly duplicate legacy logic |
| Dashboard rings | `getDailyHabitRingProgress` -> `isHabitComplete` -> `computeBundleStatus` | Partial; static-only, no memberships/checklistSuccessRule | Duplicate client util |
| Progress API (`/progress`) | Server-derived parent dayStates via memberships fallback static | Better alignment | Separate server implementation |
| DaySummary API (`/daySummary`) | Aggregates entry habit only; no parent derivation | Incomplete for parent semantics | Separate implementation |
| Goal progress | Resolves bundle to all child IDs via memberships (not day-scoped) | Mixed (can include entries outside membership active windows) | Separate implementation |

---

## 6) Historical Integrity Risks

1. **Bundle edits without membership writes**: adding/removing child in modal updates static links only; no explicit temporal boundary.
2. **Fallback to static `subHabitIds`** in many client views can back-project current structure into history.
3. **Goal progress bundle resolution** unions child IDs across memberships without day-scoped filtering against membership windows; historical contributions can over-include if child had pre-membership entries.
4. **Mixed legacy choice data** (parent entries with `bundleOptionId`/`choiceChildHabitId` + child entries) can distort historical render depending on view pathway.

---

## 7) Code Quality / Architecture Concerns

- Semantic duplication across:
  - `src/server/services/dayViewService.ts`
  - `src/server/routes/progress.ts`
  - `src/server/routes/daySummary.ts`
  - `src/utils/habitUtils.ts`
  - `src/components/day-view/DayView.tsx`
  - `src/components/TrackerGrid.tsx`
- Multiple sources of truth:
  - canonical entries + memberships on server
  - local `logs` cache with client recomputation
- Legacy APIs retained in active UI paths (`bundleOptions`, parent choice entries), increasing coupling and migration ambiguity.
- Async mutation sequencing lacks consistent in-flight guards and dedupe across surfaces.
- Tests are present but still allow fragmented semantics (server strong tests, client utility tests for static model).

---

## 8) Recommended Fix Plan

### Phase 1 — Critical guardrails
1. Remove parent-choice write paths from Grid; write only child habit entries.
2. Add server guard: reject new parent choice entries for migrated bundles.
3. Make Today choice deselect/clear fully awaited + pending lock.
4. Add temporary telemetry/assertions for mixed-mode writes (parent choice entry + child entry same day).

### Phase 2 — Semantic unification
1. Introduce one canonical bundle completion contract endpoint (or shared selector package).
2. Refactor Today/Grid/Rings to consume canonical derived parent state instead of local recompute.
3. Encode checklist success rule consistently in all surfaces.
4. On bundle child link/unlink, write `BundleMembership` create/end with explicit effective day.

### Phase 3 — UX and regression hardening
1. Harmonize parent/child visual states across Today/Grid.
2. Add optimistic update strategy with mutation queue/idempotency keys for rapid toggles.
3. Remove deprecated `bundleOptions` UI path after data migration completes.
4. Add admin diagnostics page for membership timeline vs static links drift.

---

## 9) Regression Test Plan

### Unit
- Choice bundle parent completion: 0/1/N children complete => false/true/true.
- Checklist success-rule matrix (full/any/threshold/percent) across active child counts.
- Membership day-window evaluation and day-of-week filtering.
- Upsert/delete idempotency under repeated same mutation.

### Integration (API)
- `/dayView` vs `/progress` agreement for bundle completion on same day.
- `/daySummary` enriched/compat behavior for bundle parents (if kept).
- Bundle edit endpoint writes membership start/end boundaries correctly.
- Goal progress excludes child entries outside active membership windows.

### E2E
- Today: toggle checklist child on/off updates parent and counts immediately + after reload.
- Today: toggle multiple choice children (1..N) persists and reloads correctly.
- Grid: same scenarios match Today states exactly.
- Cross-navigation: Today ↔ Grid ↔ Dashboard no semantic drift.
- Rapid toggle spam (double-click/tap) produces stable final state and no 4xx/5xx.

---

## PR-aware notes for 2026-03-30

- Bundle-related change today: `eee26a6` fixed child unlink serialization (`null` vs `undefined`) and parent `subHabitIds` cleanup on deletion.
- This improves one failure mode but does not resolve broader semantic duplication or mixed legacy choice-write paths.

---

## End-of-report highlights

### Top immediate fixes
1. Eliminate Grid parent-choice writes (child-only entry writes).
2. Stop Today client from recomputing parent status over server dayView.
3. Wire bundle edit operations to `BundleMembership` timeline writes.

### Most dangerous unresolved ambiguity
- Whether choice completion should be represented exclusively via child entries (recommended) or allow parent entries in parallel. Current code supports both, causing non-deterministic behavior across views.

### Most likely source of future regressions
- Continued duplication of bundle semantics in client utilities and view-specific components rather than one canonical derivation contract.
