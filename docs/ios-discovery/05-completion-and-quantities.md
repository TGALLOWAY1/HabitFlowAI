# Task 5 — Completion and Numeric-Habit Behavior

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Direct read of the shared domain layer (`completion.ts`, `trackingHistory.ts`,
`weeklyProgress.ts`), server routes/validation (`habitEntries.ts`, `habitValidation.ts`,
`dayKeyNormalization.ts`), plus a read-only UI trace of every logging surface, spot-checked
before acceptance (dead `HabitLogModal`, dead `updateLog` prop, zero-semantics gating,
swallowed errors — all re-verified at the cited lines).

---

## 1. The canonical completion rule (`src/domain/habits/completion.ts`)

One function decides completion everywhere: `deriveDailyHabitCompletion(habit, entries,
dayKey)` (`completion.ts:53-87`).

- **Boolean:** complete iff ≥1 active, non-freeze entry exists for the day.
- **Numeric:** `currentValue` = sum of finite positive `value`s; complete iff a **valid
  positive target** exists and `currentValue >= target`. Below target = `isPartial`
  (progress, never completion). Invalid/missing target ⇒ can never complete
  (`hasValidNumericTarget`, `:21-27`).
- `getCompletionEntryValue` (`:30-34`) defines what a "complete this" gesture writes:
  `1` for boolean, the **target** for numeric.
- **Per-day historical resolution:** the target/type used is the one in force *on that
  day* via `trackingRevisions` — `resolveHabitTrackingForDay` walks sorted revisions and
  picks the last with `effectiveFromDayKey <= dayKey` (`trackingHistory.ts:67-84`).
  Editing a habit's target does not rewrite past completion.

**Weekly-quota habits** (`weeklyProgress.ts:26-62`): weekly `currentValue` = number of
**distinct scheduled days whose day-level completion is true** within the ISO week
(Mon-start); raw quantities and duplicate entries never inflate the count; freeze entries
are excluded via `note?.startsWith('freeze:')`; target = day-resolved `timesPerWeek ?? 1`.

## 2. Server-side entry semantics (`src/server/routes/habitEntries.ts`)

- **Endpoints:** `POST /api/entries` (create), `PUT /api/entries` (upsert by
  `habitId`+`dateKey`), `PATCH /api/entries/:id`, `DELETE /api/entries/:id`,
  `DELETE /api/entries/key?habitId&dateKey` (single-key), `DELETE
  /api/entries?habitId&date` (all entries for the day), `POST /api/entries/batch`
  (multi-habit, one dayKey — used by checklist-parent toggle; **server** computes each
  value via `getCompletionEntryValue`, `:628-632`). All rate-limited (100/15 min/IP).
- **Validation stack:** structure check → `assertNoStoredCompletion` (rejects
  `completed|isComplete|progress|currentValue|percent`) → mutation-field allowlist +
  immutable-field rejection (`:27-44`) → per-habit `validateHabitEntryPayload`
  (`habitValidation.ts`): value must be finite ≥0; **numeric habits require a value**;
  choice-bundle invariants for both generations of the model (legacy `bundleOptionId`
  with `metricConfig.mode` required/none, unified `choiceChildHabitId` validated against
  `subHabitIds`).
- **DayKey normalization** (`dayKeyNormalization.ts:94-115`): input priority `dayKey` >
  legacy `date` > `timestamp`+timezone; invalid/missing timezone falls back to
  **America/New_York**; `date` is never persisted.
- **Every mutation** ends with linked-goal reconciliation (`checkAndCompleteLinkedGoals`
  — completion can be granted *and revoked*) and per-user cache invalidation. The old
  DayLog recompute call is a no-op stub.
- Uniqueness: one entry per `(habitId, dayKey)` via the conditional unique index (Task 4
  §6 caveat); upsert revives soft-deleted rows (`$unset deletedAt`).

## 3. UI logging surfaces — payload matrix

Client state: `logs: Record<'habitId-date', DayLog>` where `DayLog` is a *derived*
per-day summary hydrated from `GET /api/daySummary` (~90-day window), not an entry.

| Surface | Gesture | Call | Payload |
|---|---|---|---|
| TrackerGrid boolean cell | click | `toggleHabit` ON | `POST /entries {habitId, date, value: 1, source:'manual'}` (legacy `date` field → server deprecation warning) |
| — | click (had entry) | `toggleHabit` OFF | `DELETE /entries?habitId&date` — **deletes ALL entries for the day** |
| TrackerGrid numeric cell | click → popover submit | `upsertHabitEntry` | `PUT /entries {habitId, dateKey, value}` — **no `source`** |
| Day/Schedule numeric | popover submit | same | `PUT /entries {…, value, source:'manual'}` — source present |
| Numeric clear | popover trash / long-press ≥400 ms / value 0 (when clear offered) | `deleteHabitEntryByKey` | `DELETE /entries/key?habitId&dateKey` (404 swallowed as success) |
| Checklist parent | click | batch branch of `toggleHabit` | `POST /entries/batch {timezone, dayKey, entries:[{habitId, source:'manual'}]}` (server assigns values = target/1); OFF = N× delete-all-for-day |
| Checklist child | checkbox | `toggleHabit` on child | same as boolean row — **numeric child gets `value: 1`, not target** |
| Choice option (both surfaces, unified model) | chip click | entry **on the child habit** | boolean child: create/delete; numeric child: popover. **`choiceChildHabitId` is never sent** — selection is just a child entry |
| History modal (past days) | add | `createHabitEntry` | `POST /entries {habitId, dayKey, value, source:'manual', timestamp: now}` — correct dayKey, but a "now" clock time on a past day |
| — | edit / zero / delete | `PATCH /entries/:id {value}` / `DELETE /entries/:id` | value 0 ⇒ delete |

Client payload guard `buildHabitEntryUpsertPayload` (`habitEntryPayload.ts`, allowlist +
completion-field denylist) protects **only the PUT path**; POST/PATCH/batch send raw
objects (server still validates). `timeZone` is not in the allowlist — no UI upsert ever
carries one; the server's America/New_York fallback silently applies (`dateKey` is passed
explicitly, so in practice this only affects timestamp-derived paths).

## 4. Refresh and optimistic-update model

- Every mutation optimistically updates `logs` (snapshot → rollback on error) and then
  reconciles from the response's `dayLog`.
- **TrackerGrid** debounces only a progress-overview refresh (300 ms) and otherwise relies
  on a **30 s trailing background re-fetch** of the 90-day daySummary
  (`scheduleBackgroundSync`, `HabitContext.tsx:834-843`) plus an immediate refetch on tab
  visibility. **Day View / ScheduleView** instead `await refreshDayView()` after every
  write. Two convergence speeds for the same data.
- Rollback restores the **whole** snapshotted `logs` map from the render closure — a
  failure can silently revert an unrelated concurrent write (agent-verified; carried to
  Task 11/12).

## 5. Inconsistencies and suspected bugs (recorded, not fixed → Task 12)

1. **Three different values for "complete a numeric habit":** ordinary toggle writes `1`
   (`HabitContext.tsx:526`), checklist-parent batch writes the **target** (server
   `getCompletionEntryValue`), Day View pinned-strip/child checkbox writes `1`. A pinned
   "8 glasses" habit logs 1, shows checked in the strip, and is simultaneously incomplete
   in its category section (`PinnedHabitsStrip.tsx:28-38` passes no `habitStatus`).
2. **Zero semantics differ by surface:** Day View always offers clear (0 ⇒ delete);
   TrackerGrid gates `onClear` on `initialValue > 0` (`TrackerGrid.tsx:1233`), so typing
   `0` into an *empty* numeric cell stores `value: 0` — exactly the state
   `NumericInputPopover.test.tsx:98` says should never exist.
3. **Two clear semantics for one gesture:** boolean un-check nukes *all* entries for the
   day; numeric clear deletes the single key.
4. **Swallowed errors make downstream catches unreachable:** `upsertHabitEntryContext` /
   `deleteHabitEntryByKeyContext` don't rethrow (`HabitContext.tsx:891-896,938-944`), so
   the popover/toast error paths in TrackerGrid can never fire; History-modal paths *do*
   rethrow and alert.
5. **Future-date asymmetry:** History modal blocks future dates in four places;
   ScheduleView navigates to next week and logs freely with no guard
   (`ScheduleView.tsx:219-225`).
6. **Provenance depends on screen:** TrackerGrid's PUT omits `source`; Day View's
   includes `'manual'`.
7. **Dead code:** `HabitLogModal` (its open-setter is never called —
   `TrackerGrid.tsx:785,1356`), `HabitContext.updateLog` + `onUpdateValue`/`onToggle`
   props (declared, never destructured — `TrackerGrid.tsx:649-660`), legacy virtual
   choice-option branch (self-documented dead post-migration, `:1015-1017`),
   `choiceChildHabitId` allowlisted+tested but never sent by any UI.
8. Stale doc-comment: `DayLog.completed` says "calculated when the log is created" citing
   line numbers that no longer exist (`persistenceTypes.ts:339-340`).

## 6. iOS-relevant conclusions

- Implement exactly one completion function equivalent to `deriveDailyHabitCompletion` +
  `resolveHabitTrackingForDay` + `deriveWeeklyHabitProgress` — port the tracking-revision
  day-resolution or historical accuracy breaks.
- Prefer the **PUT upsert + DELETE-by-key** pair with canonical `dayKey` as the single
  write idiom; the web app's payload divergence (date/dateKey/dayKey, source-or-not,
  value 1-vs-target) is accidental complexity, not contract. The server accepts all of
  it, so iOS can standardize without server changes.
- Always send the device IANA timezone where a timestamp is involved; never rely on the
  New York fallback.
- Choice selection = an entry on the child habit; checklist parent = batch endpoint.
  No parent-entry writes in the unified model.
