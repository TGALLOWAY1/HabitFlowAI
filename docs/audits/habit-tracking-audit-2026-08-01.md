# Habit Tracking Audit — 2026-08-01

## Scope

This audit traced habit creation, daily entry writes, day views, client optimistic state, bundles, schedules, completion, streaks, analytics, reminders, cache invalidation, and the MongoDB uniqueness boundary. It included deterministic unit/component/integration tests and an actual browser reproduction against the local application.

## Domain and data-flow map

### Supported habit shapes

- `Habit.goal.type`: `boolean` or `number`. These are the only distinct completion value modes.
- `Habit.type`: compatibility/display discriminator (`boolean`, `number`, `time`, or `bundle`). `time` does not have separate completion semantics; duration fields are scheduling metadata.
- `goal.frequency`: `daily` or `total`. A `total` numeric habit still records daily contributions; cumulative goal reporting is separate from daily completion.
- Weekly recurrence: `timesPerWeek`, or `assignedDays` with optional `requiredDaysPerWeek`.
- Bundles: `choice` or `checklist`, with historical composition represented by temporal `bundleMemberships`; static `subHabitIds` is a legacy fallback.
- Lifecycle: archive/restore and soft delete are supported. The model has no pause interval, so it cannot exclude an archived period while preserving later activity.
- Excused occurrence: a freeze marker (`manual`, `auto`, or `soft`) protects streak continuity but is not a completion. There is no second habit-level skipped/excused state.

### Canonical write flow

`HabitContext` / `persistenceClient` → `/api/entries` or an approved alternate producer → canonical habit/value/DayKey validation → `habitEntryRepository` → MongoDB `habitEntries`.

The full identity key is `(householdId, userId, habitId, dayKey)`. A single document is reused for edits, deletes, and restoration. `DayLog`, cached progress responses, and UI status objects are compatibility/read models, not historical truth.

Alternate entry producers audited and reconciled: batch entry writes, routines, health sync/backfill, health suggestions, and habit health rules.

### Canonical read flow

- Daily completion: `src/domain/habits/completion.ts`.
- Weekly distinct-day progress: `src/domain/habits/weeklyProgress.ts`.
- Schedule and creation-day eligibility: `src/domain/habits/schedule.ts`.
- Calendar arithmetic and timezone DayKeys: `src/domain/time/dayKey.ts`.
- Streaks: `src/server/services/streakService.ts` over canonical day states.
- Day view: `dayViewService` derives daily, weekly, and bundle state from `EntryView`s.
- Client day views: server status is merged with optimistic local entries by `habitStatusResolution`; UI components do not reinterpret numeric completion.
- Progress and analytics: rebuild canonical day states on read and call the same completion, schedule, and streak functions.
- Bundle parent completion/streak: derived from the children active on the historical DayKey. Parent entries are not authoritative.

No streak value is persisted. Historical entry edits/deletes and habit definition edits are reflected on the next read; the relevant response caches are invalidated on write.

## Finalized behavioral rules

### Completion and progress

- Boolean: at least one valid, active, non-freeze entry completes the DayKey.
- Numeric: sum finite non-negative progress for the DayKey; complete only at `value >= positive target`.
- Below target is partial progress, never completion. Above target remains complete and retains the entered quantity.
- Empty and zero mean no progress. UI entry of zero clears the existing record instead of storing a redundant zero.
- Negative and non-finite values are rejected at API boundaries. Invalid legacy values are ignored by derivation.
- A numeric habit without a finite target greater than zero is invalid configuration. A legacy invalid definition remains incomplete.
- Changing a numeric value from at/above target to below target immediately removes all completion visuals and affects streaks/statistics on recomputation.
- Numeric checkmark, title strike-through, category count, label, progress, history, day summary, reminder suppression, analytics, and streak inputs all derive from the same completion rule.

### Scheduling and streaks

- A scheduled opportunity cannot precede the habit's creation DayKey in the supplied user timezone.
- Assigned weekdays are the only eligible days when present. Unassigned days neither advance nor break a streak; an off-schedule completion does not satisfy a weekly quota.
- A daily current streak is the consecutive sequence of protected scheduled opportunities through the reference day. An unfinished opportunity on the still-open reference day preserves the prior current streak and marks it at risk.
- A strict assigned-day schedule (`requiredDaysPerWeek === assignedDays.length`) uses that daily opportunity streak. A flexible schedule with grace days uses week-level satisfaction, as do explicit `timesPerWeek` habits.
- A weekly current streak is consecutive satisfied ISO Monday–Sunday weeks. An open, unsatisfied current week preserves the preceding streak until the week closes.
- Longest streak is the largest completed historical sequence of scheduled daily opportunities or satisfied weekly periods.
- Future entries, invalid DayKeys, and entries before creation do not affect current streak, longest streak, or last-completed date.
- Weekly quotas count distinct completed scheduled days, not event count or numeric quantity. Duplicate entries cannot inflate progress.
- Freeze markers protect an opportunity/weekly quota but never set `completedToday` or daily completion.
- Checklist `streakType` is independent from daily success: `success`, `full`, and `any` are honored from historical child state.
- Leap days, month/year boundaries, DST transitions, and range iteration use UTC-safe DayKey arithmetic. User-facing creation/reference boundaries use the supplied IANA timezone.

### Bundles and historical edits

- Choice bundle: complete when any active child completes.
- Checklist bundle: complete according to `any`, `threshold`, `percent`, or `full` success rule.
- Partial bundle state means at least one active child progressed/completed without the parent rule being met.
- Temporal membership controls historical composition and optional weekdays. Editing current composition does not rewrite old memberships.
- Editing/deleting an old child entry recalculates the parent and streak from truth on the next read.
- A soft-deleted entry is excluded from completion, streaks, analytics, and goal progress. Deleting a habit does not delete its entries, so its still-active historical entries continue to contribute to linked goal history.

## Bugs confirmed and fixed

| Severity | Defect and impact | Root cause | Resolution |
|---|---|---|---|
| High | Numeric habits struck through below target while checkmark/labels disagreed. | UI paths used entry existence or `value > 0`; server paths used target completion; day-view fallbacks used target `1`. | Added one completion domain function and routed UI, server views, summaries, routines, health, reminders, and optimistic state through it. |
| High | Current/longest streaks broke on unscheduled gaps and could include future data. | Calendar-day adjacency, incomplete lifetime bounds, and schedule branches implemented independently. | Replaced with scheduled-opportunity/weekly-period calculation, bounded by reference and creation DayKeys. |
| High | Weekly quota streaks counted completions on days not in the configured schedule. | Weekly aggregation counted every completed DayKey. | Count only distinct scheduled completed days; freeze markers remain protective. |
| High | Checklist completion and streak qualification disagreed. | Progress derived only the daily success rule and discarded `streakType`. | Preserve separate `completed` and `streakCompleted` states for parent bundles. |
| High | Invalid or type-incompatible entry writes could create false progress. | PATCH/batch/alternate producers did not consistently load the habit or validate the merged value. | Central API validation for boolean/numeric values, date keys, and habit ownership; reconciled alternate producers. |
| High | Numeric clear/update and multi-child bundle updates could leave partial client/server state under rapid or failed interactions. | Delete-then-create and per-item client mutations were non-atomic and optimistic rollback was fragmented. | Atomic per-key upsert/clear semantics, batch preflight, authoritative refetch, and consolidated rollback. |
| High | MongoDB unique index could not be rebuilt even after the old dedupe procedure. | The full unique index includes soft-deleted rows, while detection/verification ignored them and the script only soft-deleted losers. | Detector/verifier now exactly match all index keys; dedupe archives losers and removes them from the indexed collection. |
| High | Category reorder could silently fail to persist order or delete every category from a stale/empty payload, breaking habit grouping. | The repository deleted all scoped categories, reinserted client objects, and relied on MongoDB natural order. | Reorder now validates the exact scoped ID set and updates an internal sort position in place; stale/partial payloads return 400 without data loss. |
| Medium | Analytics and reminders used server/UTC creation dates and some analytics paths reimplemented scheduling. | Timezone was not passed through; `date-fns`/manual weekday logic bypassed the schedule domain. | Shared schedule domain used by client/server, reminders, progress, category analytics, insights, heatmaps, and streaks. |
| Medium | Analytics/progress could return another timezone/day/household's cached result, and category edits stayed stale for the TTL. | Cache keys omitted household, timezone, and reference day; category writes did not invalidate. | Scoped keys include all four dimensions; category mutations invalidate per-user read caches. |
| Medium | Add-habit form lost name/type/target after creating a category in-place. | Category refresh retriggered form initialization. | Initialization is stable for the modal session; component regression added. |
| Medium | Invalid numeric targets, duplicate/out-of-range weekdays, contradictory weekly settings, bad times, and impossible checklist thresholds were accepted. | Form/API definition validation was fragmented. | Added typed whole-definition validation on create/edit and disabled invalid form submission. |
| Medium | Today/Schedule UI could show stale progress after root numeric writes, refresh, or date navigation. | Local merge included bundle children but not root numeric entries and used a hard-coded target. | Shared local status resolver merges all relevant entries, uses habit-type targets, and refetches the authoritative day view. |
| Medium | Boolean habits linked to unitless cumulative goals contributed `1` instead of the habit target. | The contribution multiplier was incorrectly nested under the goal-unit branch. | Boolean contribution now always uses the configured habit target; goal-unit display no longer changes arithmetic. |

Primary affected systems were `src/domain/habits/*`, `src/domain/time/dayKey.ts`, `streakService`, `dayViewService`, habit entry routes/repository, alternate entry producers, progress/analytics/reminder services, `HabitContext`, tracker/day-view components, category routes/repository, MongoDB index assurance, and migration tooling.

## Reproduction and regression matrix

### Numeric UI

| Case | Expected/verified |
|---|---|
| Empty / cleared / zero | `0 / target`, unchecked, no strike-through, zero stored as clear |
| Below target | partial progress, unchecked, no strike-through |
| Exactly target | checked, strike-through, completed category count |
| Above target / decimal | checked, entered value retained |
| Complete → below target | all completion indicators revert |
| Negative / NaN / infinity | rejected |
| Missing/zero target | form/API invalid; legacy definition incomplete |
| Refresh/date navigation/historical edit | server DayView and local resolver agree |

The actual browser reproduction used a numeric target of 10 and verified 1, 4, 10, 12.5, back to 4, clear, and explicit zero. At 4 the accessible checkbox was unchecked and the title had no strike class; at 10/12.5 both were complete; after clear/zero the editor had no persisted-entry clear action.

### Deterministic streak coverage

- first and one-day completion; multi-day streak; open today; missed scheduled day
- assigned weekdays with unscheduled gaps; off-schedule weekly entries ignored
- consecutive, missing, current-open, and at-risk ISO weeks
- historical add/edit/delete recomputation and freeze protection
- future/pre-creation entries excluded
- checklist `success`/`full`/`any` streak qualification
- duplicate daily writes deduplicated for weekly progress
- leap day, month/year boundary, DST spring/fall, timezone creation boundary

## Architecture and persistence changes

- Added canonical completion, weekly-progress, schedule, DayKey, and definition-validation modules.
- Replaced business-rule copies in tracker cells, Today/Schedule, day view, day summary, progress, analytics, reminders, routines, and health writes.
- Added server-side whole-habit validation and merged-state validation for PATCH.
- Made numeric writes single-key operations; batch requests validate completely before mutation.
- Preserved bundle historical membership and separate daily/streak qualification.
- Kept completion/streak/statistics derived; no database migration adds redundant derived fields.
- Updated the duplicate migration to write a recovery archive before physically removing conflicting indexed documents.
- Scoped cache keys and expanded invalidation; no cache is authoritative.
- Replaced destructive category delete/reinsert ordering with exact-set, scoped `sortOrder` updates. The field is internal and populated lazily, so no category migration is required.

## Remaining risks and product decisions

- The configured database still contains 23 legacy duplicate habit-entry index-key groups. The code intentionally does not mutate data at startup. Run backfill/dedupe dry runs, review the archive plan, apply with backup/approval, verify, then restart to create the unique index.
- Target and schedule edits currently reinterpret all historical entries because definitions are not versioned. Preserving old targets/schedules requires effective-dated habit definitions and a product decision.
- Archive has a timestamp but there is no pause/resume interval history. A restored habit cannot distinguish a genuine missed archived period from an active period for historical streaks.
- `goal.frequency: total` mixes daily completion presentation with lifetime goal aggregation. The desired daily checkmark/streak semantics for cumulative targets need an explicit product rule.
- Weekly-quota analytics still expose both daily heatmap activity and week-level streak satisfaction. A future metric contract should distinguish “completed occurrences” from “quota completion rate” in naming and UI.
- Static client bundle data is a compatibility fallback; older historical views can only be exact when temporal membership records exist.
- Batch validation is all-or-nothing before writes, but MongoDB multi-document transactions are not used for routine or bundle child batches. A process failure mid-batch can still require reconciliation.
- Cross-tab refresh is visibility/interval based, not realtime conflict resolution; offline writes are not queued.
- Auto-freeze generation remains a separate service with legacy entry-existence checks and has no active production caller. It should be reconciled before enabling automatic freezes.
- Hardware haptics, true multi-device concurrency, midnight while the tab stays continuously open, and screen-reader announcements were not fully exercised in automation.
- The browser reproduction used an isolated generated account and left an empty `Audit Numeric Habit` (target 10 pages) in an `Audit` category; its entry was cleared. No production-data cleanup was run without explicit approval.

Repository-wide failures outside this audit remain: a nondeterministic goal forecast date, invalid-category goal-stack filtering, a dashboard-preferences immutable `_id` update, goal-track `null`/`undefined` contract drift, missing goal-extension lineage, and three password-reset tests sharing rate-limit state. These should be handled separately rather than folded into habit-domain changes.

## Verification log

Focused verification during implementation:

- TypeScript `npx tsc --noEmit`: passed.
- Canonical completion/schedule/streak/analytics/client status suites: 188/188 passed across 21 files in the final focused run.
- Reminder scheduler Mongo integration: passed (20 tests).
- Habit-entry unique-index Mongo integration: passed (2 tests).
- Scoped route/persistence restorations: bundle conversion + category routes 29/29, category repository/routes 38/38, deleted-habit goal history 7/7, linked-habit goal cleanup 2/2, and integrity report 1/1.
- Browser UI: known numeric mismatch reproduced before the fix and the full target matrix above verified after the fix.
- Full repository Vitest run: 949/957 passed; the eight failures are the unrelated remaining items listed above. All habit-audit regressions passed.
- `npx vite build`: passed (2,821 modules; existing large-chunk warning).
- `npm run typecheck` and `npm run build`: blocked by the pre-existing duplicate `src/components/Wellbeing` versus `src/components/wellbeing` casing conflict; direct non-project-reference TypeScript and Vite build both pass.
- `npm run lint`: existing repository baseline is 429 findings (309 errors, 120 warnings).
- `npm run check:invariants`: three unrelated existing `activity` wording violations in weekly-review/behavior-pattern files.
