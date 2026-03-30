# HabitFlow Historical Linkage & Archive Correctness Audit (2026-03-30)

## 1) Executive summary

### Overall verdict
HabitFlow currently mixes two different models:
1. **Strong event truth for activity** (`habitEntries`, soft-deleted via `deletedAt`).
2. **Weak live-reference linkage model** for relationships (`goal.linkedHabitIds`, `routine.linkedHabitIds`, `habit.subHabitIds`, `habit.bundleParentId`).

That split creates a critical historical correctness problem: **progress can survive while attribution/context disappears** when linked entities are deleted, renamed, or unlinked.

### Most critical findings
1. **Deleting a habit soft-deletes all of its entries before hard-deleting the habit record.** That removes contribution history from goal/routine analytics because all goal calculations filter out deleted entries. This retroactively changes historical outcomes.  
2. **Goal archive/detail rendering depends on live habit records for names/metadata and linked list rendering.** If a linked habit is deleted, archived goals lose contributor visibility (or show empty linked habits), even when the goal itself remains completed.  
3. **Goals and routines have no true archive state model.** Goals are “archived” implicitly via `completedAt`; routines have no archive/retire field at all (only hard delete).  
4. **Bundle membership has temporal history (`bundleMemberships`), but parent/child deletions still rely on live habit presence and entry survival.** Temporal link model exists, but destructive deletion undermines it.  
5. **Goal progress derivation for list view contains an approximation for multi-habit `distinctDays` goals, so historical numbers can already drift even without deletions.**

### Product-semantics gap
Against intended semantics (preserve historical meaning in archives and analytics), the current system is **partially compliant for structure in some areas (bundle memberships)** but **non-compliant for historical interpretability and stable attribution** across delete/unlink flows.

---

## 2) Current model inventory

## 2.1 Core entities and source-of-truth model

### Habits
- Stored in `habits` collection with `archived: boolean` and no `deletedAt` (hard delete at record level).  
- Relationship fields are live references:
  - `linkedGoalId?: string`
  - `linkedRoutineIds?: string[]`
  - bundle relationship fields (`type: 'bundle'`, `subHabitIds`, `bundleParentId`, `bundleType`, etc.).

### Habit history / progress truth
- `habitEntries` is canonical historical activity store; `DayLog` is explicitly a derived cache.
- Entries use `deletedAt` for soft-delete semantics.
- Goal and analytics reads are based on entry views from `truthQuery`, filtering out `deletedAt` entries.

### Goals
- Stored in `goals` collection.
- `completedAt` is used as active vs completed/archive-like state.
- Linked relationships are **live IDs only** (`linkedHabitIds`, optional `linkedTargets`) with no snapshot metadata.
- No immutable contribution records or archived snapshots.

### Routines
- Stored in `routines` collection.
- No archive/retire flag. Lifecycle is active or deleted.
- Linked habits are live ID arrays (`linkedHabitIds`) and per-step `linkedHabitId` inside variants/steps.

### Routine history
- `routineLogs` store completion records (`routineId`, `variantId`, timestamps, step results).
- These logs are not deleted when routine is deleted (no cascade in delete path), creating potential orphan logs.

### Bundles
- Represented as habits (`type: 'bundle'`, `bundleType: checklist|choice`) plus live parent-child pointers (`subHabitIds`, `bundleParentId`).
- There is a separate **temporal relationship table**: `bundleMemberships` with `activeFromDayKey`, `activeToDayKey`, optional `graduatedAt`, `archivedAt`.

### Archive/completion states
- Habits: `archived: boolean` exists, but UI/action semantics are inconsistent and destructive delete is common.
- Goals: “archive” is effectively `completedAt != null`; no separate archived snapshot state.
- Routines: no archive state.
- Bundles: membership-level archive hints exist (`archivedAt`), but bundle habit itself has only habit-level archived boolean.

### Deletion semantics
- Habit record: hard delete.
- Habit entries: soft delete by setting `deletedAt`.
- Goal record: hard delete.
- Routine record: hard delete.
- Bundle membership: supports end/archive/delete; delete is blocked if child has entries.

---

## 3) Current lifecycle semantics by entity type

## 3.1 Habits

### Delete habit code path
1. `DELETE /api/habits/:id` in `deleteHabitRoute`:
   - Verify habit exists.
   - `deleteHabitEntriesByHabit` (soft-delete all entries).
   - `deleteHabit` (hard delete habit doc).
2. No automatic cleanup of:
   - goals’ `linkedHabitIds`
   - routines’ `linkedHabitIds`
   - other live references (except local UI best-effort parent bundle update in `HabitContext`).

### Archive habit code path
- No dedicated archive endpoint; archive is a generic `PATCH /habits/:id` setting `archived`.
- UI contains delete confirmations warning “all history will be lost,” indicating deletion is treated as normal destructive action.

### Historical effect
- Because goal progress ignores `deletedAt` entries, deleting habit entries removes past contribution from analytics/history.
- Because habit doc is deleted, historical display metadata (name/unit/details) is lost unless redundantly embedded elsewhere.

## 3.2 Goals

### Complete/archive-like path
- Goal completion sets `completedAt` via update route/client helper (`markGoalAsCompleted` => PATCH goal).
- Completed goals retrieved via `getCompletedGoalsByUser` filter `completedAt != null`.

### Delete goal path
- `DELETE /api/goals/:id` hard-deletes goal.
- Then `unlinkHabitsFromGoal` clears habit-side `linkedGoalId` only.
- No goal snapshot persists after deletion.

### Unlink habit from goal
- Implemented as `updateGoal` patch replacing `linkedHabitIds`.
- No time-bounded relationship table; unlink rewrites live set only.

### Historical effect
- Goal progress is recomputed from current linked IDs + surviving entries.
- If a habit is removed/deleted from linkage, historic contributions can disappear from current and archive views.

## 3.3 Routines

### Delete routine path
- `DELETE /api/routines/:id` hard-deletes routine only.
- No archive path.
- No explicit unlink cleanup on habits (`linkedRoutineIds`) server-side.

### Routine completion history
- Logs persist in `routineLogs` separately.
- No guaranteed UI archive for deleted routine logs with structure snapshots.

### Unlink habits from routine
- Usually via routine edit flow replacing `linkedHabitIds` and variant step links.
- UI (`RoutineEditorModal`) performs bidirectional updates on habits best-effort, but this is frontend orchestration, not invariant-enforced server transaction.

## 3.4 Bundles

### Delete/unlink bundle-child
- `unlinkBundleChildRoute` updates live parent `subHabitIds`, child `bundleParentId`, and ends membership in temporal table.
- Membership delete endpoint blocks deletion if child has entries (good safety), but parent/child habit deletion can still erase context.

### Bundle deletion behavior in practice
- Bundles are habits, so deletion follows habit delete path (soft-delete entries + hard-delete habit doc).
- No enforced “promote children and preserve structure snapshot” flow.

---

## 4) Scenario matrix

| Scenario | What system does today | History preserved? | Archive meaningful? | Analytics correct over time? | Reopen/extend usable? | Severity | Root cause |
|---|---|---:|---:|---:|---:|---|---|
| Delete habit with zero entries | Soft-delete entries (none), hard-delete habit | N/A | Usually yes | Yes | N/A | Low | Destructive delete allowed for all habits equally |
| Delete habit with history but no links | Soft-delete all entries, hard-delete habit | **No** (entries excluded) | Habit history disappears | **No** past totals drop | N/A | High | Deletion mutates historical truth via `deletedAt` |
| Delete habit with history linked to active goal | Habit gone; entries soft-deleted; goal still links stale id | **No** | Goal linked-habit list drops missing habit | **No** goal currentValue drops | Weak | Critical | Goal uses live IDs + active entries only |
| Delete habit with history linked to archived goal | Same as above | **No** | Archived goal loses contributor context | **No** past appears rewritten | Weak | Critical | Archive rendered from live refs/no snapshots |
| Delete habit after helping complete a goal | Goal remains completed; progress recompute may drop historic cumulative value | **No** | “Win” exists but explanation weak/empty | **No** | Weak | Critical | No immutable goal contribution snapshot |
| Delete habit linked to routine | Habit removed; routine may still reference id until edited; no server cleanup | Partial | Routine UI may show missing links | Routine metrics partly survive via logs but attribution weak | Weak | High | Live link arrays, no FK constraints or cleanup |
| Archive habit linked to goal | Habit stays in DB with `archived=true`; links/entries intact | Yes | Better than delete | Mostly yes | Good | Medium-positive | Archive is non-destructive but underused |
| Unlink habit from goal while keeping history | Goal `linkedHabitIds` rewritten; old contributions excluded from future recompute | Partial | Historical attribution to old habit lost | Past totals can change | Weak | High | No temporal goal link records |
| Delete routine with zero completions | Hard delete routine | N/A | N/A | N/A | N/A | Low | Acceptable for no-history case |
| Archive routine with completion history | **No archive flow exists** | No dedicated preservation path | No archive view | Potential orphan logs only | Poor | High | Missing routine lifecycle state |
| Delete routine linked to habits | Hard delete routine only | Routine logs may remain | No structured archived routine object | Habit analytics unaffected directly | Weak | Medium | No routine soft-delete/archive model |
| Delete/complete/archive goal with linked habits | Complete = set `completedAt`; delete = hard delete | Complete: partial, Delete: none | Complete view depends on live habits | Recomputed from current links/entries | Extend flow copies live links only | High | No snapshot + live refs |
| Reopen/extend archived goal after linked habit deleted | Extend copies `goal.linkedHabitIds` including stale/deleted ids; UI filters missing habits | Weak | Context missing | New goal may start with invalid links | Poor | High | No link validation/snapshot at extend time |
| Delete checklist bundle with child habits | Bundle delete path can remove parent history + entries; child impact depends on manual steps | Partial | Bundle meaning likely lost | Bundle-derived analytics unstable | Weak | High | Bundle-as-habit destructive deletion |
| Delete choice bundle with child habits | Same as checklist; plus option attribution can vanish | Partial | Historical choice context degraded | Potentially unstable | Weak | High | No immutable bundle snapshot/events |
| Delete bundle linked to goal | Goal may still include deleted bundle id; bundle resolution may fail to resolve child history | Partial | Goal context degraded | Goal totals may drop/shift | Poor | High | Goal bundle resolution depends on live habit + memberships |
| Delete bundle linked to routine | Routine links stale id | Partial | Routine previews lose context | Routine analytics attribution weak | Poor | Medium | Live refs only |
| Promote child habits after bundle deletion | No default enforced promotion flow | Variable | Often not explicit | Variable | Weak | Medium | Missing deletion orchestration |
| Rename a habit after contributing to goal | Name updates globally; no name-at-time snapshot | Numeric history yes | Historical label changed retroactively | Totals stable | Moderate | Medium | No display metadata snapshots |
| Rename/delete/unlink then view archives later | Archive pulls current entities | Frequently degraded | Often not interpretable | Can drift/rewrite | Poor | Critical | Archive = live graph projection, not frozen history |

---

## 5) Archive correctness findings

## 5.1 Goals archive (Win Archive + Goal Detail)
- Win Archive lists completed goal records only; no preserved contributor snapshots or frozen totals.
- Goal Detail linked habit section builds from current `habitMap` and filters missing habits; deleted habits vanish from rendering.
- Goal detail entry loading queries by current `goal.linkedHabitIds`, so removed/unlinked/deleted habits stop contributing to reconstructed entry timeline.

**Consequence:** archived goals are not historically self-describing.

## 5.2 Habits archive
- Habits support `archived: boolean`, but archive UX is limited and deletion is easy.
- No dedicated habit archive retrieval/history preservation model beyond retaining habit row.

## 5.3 Routine archive
- No routine archive state/page despite persistent routine logs.
- Deleting routine removes main object needed to interpret logs in context.

## 5.4 Bundle archive
- Temporal memberships are a strong component, but archive rendering still depends on surviving live habit objects and links.

---

## 6) Analytics correctness findings

## 6.1 Goal progress stability
- Goal progress is recomputed from entry views for resolved linked habits.
- Deleting a habit soft-deletes entries => removed from calculations => past totals change.
- Unlinking habits rewrites linked set => prior contributions disappear from goal calculations.

## 6.2 Attribution correctness
- No immutable `goalContribution` events or snapshots tied to completion state.
- Display labels are live habit names/units, so rename/delete affects historical interpretation.

## 6.3 Bundle analytics
- Uses temporal memberships (good), but if child/parent habits are deleted or entries deleted, derived parent-level history can still collapse.

## 6.4 Known approximation bug (independent but relevant)
- In `computeGoalListProgress`, multi-habit `distinctDays` count uses an approximation (upper-bound/per-habit sum logic), so list-level numbers may be historically imprecise even without deletion.

---

## 7) Root-cause analysis

1. **Historical activity and historical relationships are modeled asymmetrically.**
   - Activity has event rows (`habitEntries`) but can be hidden retroactively by soft delete.
   - Relationships are mostly mutable live arrays; no effective-dated goal/routine link ledger.

2. **Archive surfaces are read-time projections over current graph, not frozen snapshots.**
   - Completed goal pages reconstruct from current habit IDs and entries, not completion-time snapshots.

3. **Deletion semantics are too destructive for entities with historical meaning.**
   - Habit delete mutates both identity and evidence in one action.

4. **Lifecycle semantics are inconsistent by entity.**
   - Habit has archive boolean, goal has completion flag, routine has neither archive nor completion archive model.

5. **Frontend bidirectional relationship updates are best-effort, not transactionally enforced.**
   - Creates potential drift across linked records.

---

## 8) Recommendations: minimal / robust / ideal

## 8.1 Minimal patch (fastest risk reduction)

### Required changes
1. **Guardrail on habit delete:** block hard delete when non-deleted entries exist; return 409 with guidance to archive.
2. **Do not soft-delete habit entries in habit delete path** for historical habits; instead require archive.
3. **Goal detail/archive fallback rendering:** when linked habit missing, render “Deleted habit” placeholder using stored ID; do not silently drop.
4. **On goal completion, persist lightweight snapshot fields** on goal:
   - `completionSnapshot.currentValue`
   - `completionSnapshot.linkedHabits[]` with id + name + unit + type.

### Migration complexity
- Low-to-medium. Mostly service/UI changes and additive goal fields.

### Risk
- Low; mostly prevents destructive actions.

### Impact
- Immediate improvement in archive interpretability and user trust.

## 8.2 Medium-term robust fix

### Required changes
1. Introduce **effective-dated goal-habit link records** (`goalLinks` with `activeFromDayKey`, `activeToDayKey`).
2. Replace destructive habit delete with **retire lifecycle** (`retiredAt`, `archivedAt`) for history-bearing habits.
3. Add **routine archive/retire state** and archive retrieval UI with preserved routine metadata snapshot.
4. Add immutable **goal completion snapshot** and optionally periodic snapshots for archived views.
5. Make bundle deletion flow explicit:
   - default promote children
   - end memberships
   - preserve parent snapshot + status.

### Migration complexity
- Medium. New collections + backfill from current arrays.

### Risk
- Medium (data migration, query rewrites).

### Impact
- Strong historical correctness and stable archive/analytics behavior.

## 8.3 Ideal architecture

### Required changes
1. Event-sourced or append-only **contribution ledger**:
   - `HabitContributionEvent`
   - `GoalContributionEvent`
   - `RoutineExecutionEvent`
   - `LinkChangedEvent`.
2. Immutable snapshot model for **completed/archived entities** (goal/routine/bundle).
3. Distinguish command semantics explicitly:
   - `delete` (only no-history objects)
   - `archive/retire`
   - `unlink` (time-bounded, never history-destructive).
4. Analytics computed from immutable events + temporal joins; past cannot be rewritten by live object mutation.

### Migration complexity
- High.

### Risk
- Higher implementation complexity; best done incrementally.

### Impact
- Maximum historical integrity, auditability, and explainability.

---

## 9) Migration strategy

1. **Schema additions (additive first):**
   - `goals.completionSnapshot`
   - new `goalHabitLinks` collection (effective-dated)
   - optional `habitLifecycle` fields (`retiredAt`, `deletedAt` for soft-delete only)
   - routine lifecycle fields (`archivedAt`, `retiredAt`).

2. **Backfill phase 1:**
   - For completed goals, compute and persist snapshot from currently available entries/habits.
   - Flag degraded snapshots where linked habits already missing.

3. **Backfill phase 2:**
   - Initialize `goalHabitLinks` with a single open-ended interval for each current linked habit.

4. **Read path migration:**
   - Archive pages read snapshot first; fallback to reconstructed live data only if snapshot absent.

5. **Write path migration:**
   - Goal habit edits append/close link intervals instead of overwriting arrays.

6. **Deprecate destructive delete:**
   - Keep hard delete only for zero-history entities.

---

## 10) Test plan

## 10.1 Regression tests (must-add)
1. Habit delete with history returns 409 and does not alter entries.
2. Goal completed snapshot remains stable after habit rename/delete/unlink.
3. Archived goal detail renders deleted contributors using snapshot placeholders.
4. Routine archive preserves completion logs and step/habit structure snapshot.
5. Bundle delete defaults to child promotion + membership closure; no history loss.

## 10.2 Scenario tests
- Implement the scenario matrix rows as integration tests with seeded data and post-action archive assertions.

## 10.3 Analytics stability tests
1. Goal `currentValue` before/after habit rename unchanged.
2. Goal archived cumulative total unchanged after linked habit retire/delete attempt.
3. Multi-habit `distinctDays` exactness test (remove approximation in list path or explicitly mark as estimate).

## 10.4 Archive rendering tests
1. Win Archive card still opens interpretable completed goal after linked habit removal.
2. Goal detail contributor list shows deleted/retired contributors from snapshot.
3. Missing live entities do not produce empty-state misrepresentation (“No habits linked”) when historical links existed.

---

## 11) Prioritized fix list by severity and implementation effort

## P0 (Critical, short effort)
1. Block destructive habit delete when history exists.
2. Stop cascading entry soft-delete during habit delete for historical habits.
3. Add goal completion snapshot + archive rendering fallback for missing linked habits.

## P1 (High, medium effort)
4. Introduce routine archive lifecycle + archive retrieval.
5. Add temporal goal-habit link model; stop overwriting historical relationships.
6. Harden unlink/delete UI copy to clearly distinguish delete vs archive vs unlink.

## P2 (Medium, medium effort)
7. Bundle delete orchestration: promote children by default; preserve parent historical context.
8. Replace frontend best-effort relationship sync with server-side transactional invariants.

## P3 (Medium, larger effort)
9. Introduce immutable contribution/event records for analytics stability.
10. Eliminate approximate multi-habit distinct-day computation in goal list progress.

---

## Key technical evidence references (code paths)

- Habit delete cascades soft-delete of entries then hard-delete habit:
  - `src/server/routes/habits.ts` (`deleteHabitRoute`)
  - `src/server/repositories/habitEntryRepository.ts` (`deleteHabitEntriesByHabit`)
  - `src/server/repositories/habitRepository.ts` (`deleteHabit`)

- Goal progress recomputation from entry views, filtered active entries:
  - `src/server/utils/goalProgressUtilsV2.ts`
  - `src/server/services/truthQuery.ts`

- Goal archive/completed retrieval:
  - `src/server/repositories/goalRepository.ts` (`getCompletedGoalsByUser`)
  - `src/pages/goals/WinArchivePage.tsx`

- Goal detail linked habit rendering from live habit map:
  - `src/pages/goals/GoalDetailPage.tsx`
  - `src/components/goals/GoalCard.tsx`

- Goal delete cleanup only clears `habit.linkedGoalId` (not historical snapshots):
  - `src/server/routes/goals.ts` (`deleteGoalRoute`)
  - `src/server/repositories/habitRepository.ts` (`unlinkHabitsFromGoal`)

- Routine deletion and lack of archive lifecycle:
  - `src/server/routes/routines.ts` (`deleteRoutineRoute`)
  - `src/server/repositories/routineRepository.ts` (`deleteRoutine`)

- Temporal bundle relationship model:
  - `src/server/repositories/bundleMembershipRepository.ts`
  - `src/server/routes/bundleMemberships.ts`
  - `src/server/routes/habits.ts` (`unlinkBundleChildRoute`)

