# Task 7 — Habit Bundles

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Read-only investigation of the membership routes/repository, conversion
service, shared success rule, and derivation call sites, reconciled with the two
decision-log docs and the 2026-03-30 bundle audit. Spot-checks before acceptance:
dead convert-path, PATCH validation, legacy-option write conflict, daySummary/progress
divergence. One agent claim was **refuted and dropped** ("PATCH bypasses definition
validation" — in fact `updateHabitRoute` validates the merged doc at `habits.ts:433`).

---

## 1. Data model

A bundle is a `Habit` with `type:'bundle'` + `bundleType:'checklist'|'choice'`
(`persistenceTypes.ts:163,248`). Children are real habits carrying `bundleParentId`;
the parent lists them in `subHabitIds`. Legacy choice bundles used `bundleOptions[]` on
the parent (`:255`, `@deprecated`) with entries **on the parent** carrying
`bundleOptionId`; the unified model writes entries **on the child**. Per-bundle streak
override `streakType:'success'|'full'|'any'` (`:290`). Definition validation
(`definitionValidation.ts:52-138`) runs on create **and** on update against the merged
document (`habits.ts:247,433`). `bundleOptions` itself has no shape validation anywhere.

A child can structurally belong to multiple bundles via memberships (only exact
parent+child active duplicates are blocked, `bundleMemberships.ts:134-140`), but
`bundleParentId` is single-valued — multi-parent children would render inconsistently.

## 2. Membership lifecycle (`/api/bundle-memberships`)

| Route | Effect | Notes |
|---|---|---|
| `POST` | insert `{parentHabitId, childHabitId, activeFromDayKey, activeToDayKey:null, daysOfWeek:null, graduatedAt:null, archivedAt:null}` | parent must be a real bundle; child must exist; duplicate active pair → 409. **Child habit doc untouched** |
| `PATCH /:id/end` | sets `activeToDayKey` | must not already be ended; `end >= from` |
| `PATCH /:id/archive` | sets `archivedAt` | **inert** — no temporal query reads it; pure UX hint; no UI calls it |
| `PATCH /:id/graduate` | sets `graduatedAt` **and** `activeToDayKey` atomically | "ended with success" semantic; only consumer is the analytics `graduatedHabits` counter |
| `DELETE /:id` | hard delete | 409 if the child has **any** non-deleted entries |

Overlapping windows are allowed by design (matches
`docs/decision-log/bundle-temporal-membership.md`). The UI uses only get/create/end —
archive, graduate, and delete are API-only, like `daysOfWeek`.

## 3. Temporal membership — the read rule (consistent in 4 places)

For a given `dayKey`, a child counts iff
`activeFromDayKey <= dayKey && (activeToDayKey == null || activeToDayKey >= dayKey)`
(**inclusive bounds, null = open**), then filtered by `daysOfWeek` (null/empty = every
day; day-of-week via noon-UTC). Implemented identically in
`bundleMembershipRepository.ts:182-211`, `daySummary.ts:229-241`, `progress.ts:255-260`,
and `dayViewService.ts:156-170`. The success-rule denominator is the count of
memberships active **that day**, not `subHabitIds.length`. Decision-log docs match the
code on every substantive point.

## 4. Dual representation — who is authoritative

- **UI rendering:** `subHabitIds` exclusively (all of `habitUtils`, `HabitContext`
  batching). The client never fetches memberships for rendering.
- **Server historical derivation:** memberships, with `subHabitIds` as an
  **all-or-nothing fallback** — if a parent has ≥1 membership row, `subHabitIds` is
  ignored entirely (`progress.ts:136-141`, `daySummary.ts:211-213`,
  `dayViewService.ts:162-169`).
- **Sync is client-driven, non-atomic, and error-swallowed:** `AddHabitModal` /
  `BundlePickerModal` fire separate habit-update and membership-create/end calls with
  `catch {}` (`AddHabitModal.tsx:333,364,381`, `BundlePickerModal.tsx:61`). One silently
  failed membership create ⇒ the child vanishes from all server derivation while the
  client still renders and counts it — **permanent client/server denominator drift**
  (the "partial-membership cliff").

## 5. Success rules and bundle completion

`evaluateChecklistSuccess(completed, total, rule)` (`shared/checklistSuccessRule.ts`) is
the single source of truth (client + server; the server "service" is a re-export shim):
`any` ≥1 · `threshold` ≥N · `percent` ≥P% · `full`/default = all; empty/unscheduled
bundle (`total === 0`) is never complete. Choice bundle completion = any active child
complete. Bundle **streak** qualification (`progress.ts:262-272`): choice → any child;
checklist → `streakType` override ('any'/'full') else the success rule; written as
`streakCompleted` on parent day states — **bundle streaks exist only on
`/api/progress/overview`** (daySummary/dayView don't compute them), and analytics
excludes bundle parents entirely (`isTrackableHabit`).

## 6. Conversion and unlink — built, then bypassed

- `POST /api/habits/:id/convert-to-bundle` → `convertHabitToBundle`
  (`habitConversionService.ts:36-180`) implements careful history preservation: the
  original habit's entries are re-homed onto an auto-created, immediately-archived
  legacy child ("<name> (history)") with a closed membership covering the historical
  window; the original doc becomes the parent.
- **But the UI never calls it.** `convertHabitToBundle` in `persistenceClient.ts:1733`
  has zero callers; `AddHabitModal`'s convert flow ends in a plain
  `updateHabit(...)` (`AddHabitModal.tsx:303`) — so real conversions **skip the
  history-child mechanism**: old parent entries stay attached to a now-bundle parent,
  whose entries checklist validation rejects on write yet reads back in derivation.
- Same story for `POST /:id/unlink-child` (`habits.ts:737-782`, updates all three
  representations): no client caller; the UI performs the non-atomic 3-call sequence
  the endpoint was built to replace (the 2026-03-30 audit's "P7 atomic unlink" is only
  half-done — endpoint exists, isn't atomic internally, and isn't used).
- Unlinking preserves the child's entries and closes (not deletes) its membership, so
  history keeps deriving correctly. **Bundle → regular conversion does not exist.**

## 7. Choice-bundle generations

Legacy (`bundleOptions` on parent, parent entries with `bundleOptionId`, per-option
`metricConfig.mode` required/none) vs unified (real child habits, child entries).
Migration `archive/old-scripts/migrateChoiceBundles.ts` created children from options,
renamed `bundleOptions`→`legacyBundleOptions`, and backfilled `choiceChildHabitId` onto
historical parent entries — archived, unwired, and it did **not** create membership rows
(that was a separate archived script). Read side today: `daySummary.ts:92` accepts
either key for `completedOptions`; the client still renders virtual children from
`bundleOptions` where present.

## 8. Suspected bugs / risks (→ Task 12)

1. **Dead conversion path** (§6) — the only history-preserving converter is
   unreachable; UI conversions structurally strand parent entries.
2. **Partial-membership cliff** (§4) — swallowed membership-create errors cause
   permanent client/server disagreement.
3. **daySummary vs progress divergence for legacy choice parents:** daySummary keeps a
   parent's own entry-derived log (`if (!logs[parentLogKey])`, `daySummary.ts:259-268`);
   progress unconditionally replaces parent day states with child-derived ones
   (`progress.ts:143-145`). Same habit, two endpoints, two answers.
4. **Legacy virtual-option click should 400:** TrackerGrid writes `value: 1` with the
   option label, but validation rejects a value for options whose `metricConfig.mode`
   is 'none' (the default) (`TrackerGrid.tsx:1029-1033` vs `habitValidation.ts:56-59`).
5. **Deleting/archiving a bundle parent orphans children** — nothing prunes
   `subHabitIds`, clears `bundleParentId`, or ends memberships in that direction.
6. **`endMembership` matches by (parent, child, activeTo:null), not by id** — with
   duplicate active pairs the wrong row can be closed.
7. **`graduatedHabits` analytics overcounts** — counts `graduatedAt !== null`, but
   migrated rows lack the field entirely (`undefined !== null` is true).
8. Inert/unused surface: membership `archivedAt`, archive/graduate/delete endpoints,
   `daysOfWeek`, three dead repository functions.
9. Two parallel `Habit` type declarations (`models/persistenceTypes.ts` vs
   `types/index.ts`) both carrying bundle fields — drift risk.

## 9. iOS-relevant conclusions

- Model bundles as **parent habit + child habits + temporal memberships**, and implement
  the one read rule from §3. Use membership rows as derivation truth and `subHabitIds`
  only as a rendering hint — but be aware of the web app's cliff behavior when the two
  disagree.
- An iOS client should make membership sync **transactional from the client's
  perspective** (create child + membership + parent update as one logical operation with
  error surfacing) — the current web behavior is the bug to avoid, not the pattern to
  copy.
- Checklist completion = shared success rule; choice completion = any child; both
  derive from child entries. Never write parent entries (legacy read support only).
- Conversion: prefer calling the existing `convert-to-bundle` endpoint (it does the
  right thing) rather than replicating the web UI's plain-update shortcut.
