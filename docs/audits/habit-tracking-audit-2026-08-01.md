# Habit Tracking Audit — 2026-08-01

## Scope and execution plan

1. Establish a clean, synced baseline and run the existing habit/date/streak tests.
2. Map habit configuration, entry persistence, daily read models, completion derivation, scheduling, bundles, statistics, and cache invalidation.
3. Reproduce numeric completion disagreement and streak failures with deterministic unit/component/integration tests.
4. Centralize habit-type completion and progress rules, then make every daily UI/read model consume those rules.
5. Correct streak opportunity/date handling, including schedules, future entries, historical edits, freezes, and timezone-derived DayKeys.
6. Audit adjacent creation/edit validation, bundle derivation, optimistic rollback, accessibility, and statistics paths for the same defects.
7. Run focused tests after each change, then lint, typecheck, build, and the complete test suite; review the final diff and commit history.

## Current domain and data-flow map

### Habit types and configuration

- Persisted `Habit.goal.type` supports `boolean` and `number`.
- `Habit.type` additionally identifies `time` and `bundle`; `time` currently has no distinct persisted goal/value semantics and needs verification.
- Bundles are `checklist` or `choice`. Canonical bundle activity belongs to child habits; temporal `bundleMemberships` determine which children contribute historically, with `subHabitIds` as a compatibility fallback.
- Recurrence is represented by daily/cumulative `goal.frequency`, optional `timesPerWeek`, and optional `assignedDays` plus `requiredDaysPerWeek`.
- Freeze entries (`manual`, `auto`, `soft`) protect streak continuity. No separate skipped/excused state has yet been found.
- Habits support archive/restore and soft deletion. There is no explicit pause interval in the mapped model so far.

### Canonical persistence flow

`HabitEntry` is the behavioral source of truth. Writes flow from `HabitContext`/`persistenceClient` to `/api/entries`, through canonical validators and DayKey normalization, into `habitEntryRepository`. The database key is scoped by household/user/habit/dayKey and writes use upsert/soft-delete behavior. `DayLog` remains a client compatibility read model and must not become an independent truth source.

### Derived read flows

- Day view: `dayViewService` reads `EntryView`s and derives daily/weekly/bundle status.
- Tracker/client cache: `HabitContext` reconstructs `DayLog` objects returned by APIs and also performs optimistic completion calculations.
- Dashboard/progress: `/api/progress/overview` rebuilds day states, derives bundle-parent states, and calls `streakService`.
- Streaks: `streakService` calculates daily or weekly-window metrics from derived `HabitDayState`s.
- Other consumers still under audit: day summary, dashboard streak endpoint, analytics, history, completion rings, routines, and Apple Health auto-log.

### Confirmed sources of disagreement before fixes

- Numeric completion is independently interpreted as entry existence, `value > 0`, or `value >= target` depending on the path.
- `HabitGridCell` intentionally displays a numeric checkmark for any positive value while its title uses the day-view `isComplete` value.
- Assigned-day habits without `requiredDaysPerWeek` fall through to consecutive calendar-day streak logic, allowing unscheduled days to break a streak.
- Streak inputs are not bounded to the reference DayKey before longest/last-completed calculation, so future entries can affect historical metrics.
- Existing canonical documentation says every daily entry implies completion, which is incompatible with target-based numeric progress and will be corrected.

## Behavioral rules for this audit

- Boolean: a valid active entry completes that day.
- Numeric: daily progress is the sum for the DayKey; completion requires a finite value at least equal to a valid positive target. A smaller positive value is partial progress. Zero is no progress and incomplete. Negative and non-finite values are invalid writes.
- A numeric habit without a valid positive target is invalid configuration; legacy invalid records remain incomplete instead of treating any value as completion.
- Weekly quantity habits sum numeric progress within the ISO Monday–Sunday window. Frequency quotas count distinct completed days.
- Bundle completion is derived from active, scheduled child habits and the configured checklist/choice rule; parent entries are not truth.
- Current streak is consecutive satisfied scheduled opportunities through the reference period. The current open opportunity does not break an otherwise active streak before it is completed.
- Longest streak is the largest historical sequence of satisfied scheduled opportunities. Future DayKeys never contribute.
- Unscheduled days do not break a streak. For the accepted existing scheduled-habit design, `requiredDaysPerWeek` habits use satisfied ISO weeks; off-schedule completions continue to count toward the flexible weekly quota.
- Freeze entries protect continuity but do not report the habit as completed.
- Entry edits/deletes are reflected by recomputation; no streak value is persisted.
- DayKeys are immutable, user-relative historical calendar dates. The supplied IANA timezone determines the current/reference DayKey; timestamps are not re-bucketed later.

## Deterministic test matrix

### Completion

| Habit/configuration | Values or entries | Expected |
|---|---:|---|
| Boolean daily | none / one active / deleted | incomplete / complete / incomplete |
| Numeric target 10 | empty, 0, 5, 10, 12.5 | incomplete, incomplete, partial, complete, complete |
| Numeric target 10 | 10 then 5; 5 then clear | incomplete after edit; no progress after clear |
| Numeric target 10 | negative, NaN, infinity | rejected |
| Numeric missing/zero target | any value | invalid configuration; never implicitly complete |
| Numeric historical day | edit below/above target | all daily visuals and streak inputs recompute together |
| Checklist bundle | none/partial/rule met/full | incomplete/partial/complete/complete per rule |
| Choice bundle | none/one or more children | incomplete/complete according to active child entries |

### Streaks

| Scenario | Expected |
|---|---|
| First completion today | current 1, longest 1 |
| Completed yesterday, today open | current retained, at risk |
| Missed scheduled opportunity | current 0; longest retained |
| Unscheduled gaps between assigned weekdays | continuity retained |
| Weekly quota met in consecutive weeks | consecutive-week streak |
| Current week not yet met | prior satisfied-week streak retained until the week closes |
| Backfill closes a real opportunity gap | current/longest recomputed upward |
| Edit/delete breaks a sequence | current/longest recomputed downward |
| Freeze on missed opportunity | continuity retained; completion false |
| Future completion | excluded from current, longest, and last-completed |
| Leap day/month/year boundary | calendar-day continuity correct |
| DST transition | DayKey sequence unaffected |
| Different current timezone | reference DayKey supplied explicitly and deterministic |

## Verification log

Commands and results will be appended as the audit proceeds.
