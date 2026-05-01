# Data Model

This file summarizes the implemented data model (post–M6). Canonical references remain under `docs/reference/`.

## Canonical References

- `docs/reference/V1/00_NORTHSTAR.md`
- `docs/reference/V1/02_HABIT_ENTRY.md`
- `docs/reference/V1/11_TIME_DAYKEY.md`

## Collection Overview

Defined in `src/models/persistenceTypes.ts` (`MONGO_COLLECTIONS`). **Current** collections in use:

- `categories`
- `habits`
- `wellbeingLogs` (legacy wellbeing format)
- `wellbeingEntries` (canonical wellbeing truth)
- `routines`
- `goals`
- `routineLogs`
- `routineImages`
- `journalEntries`
- `dashboardPrefs`
- `tasks`
- **`habitEntries`** (canonical behavioral truth)
- `habitPotentialEvidence`
- **`bundleMemberships`** (temporal bundle child-parent relationships)
- `healthMetricsDaily` (imported Apple Health data — NOT behavioral truth)
- `habitHealthRules` (habit ↔ health data rule mappings)
- `healthSuggestions` (pending suggestions from health rule evaluation)

**Removed / no longer used:** `dayLogs`, `goalManualLogs`. Do not reference these in new code or docs.

## Apple Health Integration Collections

### healthMetricsDaily
Imported daily health metrics. Upsert key: `(userId, dayKey, source)`. Fields: steps, activeCalories, sleepHours, workoutMinutes, weight. This data does NOT equal completion — it must be evaluated against rules.

### habitHealthRules
Maps a habit to a health data condition. One rule per habit (unique index on userId + habitId). Defines metric type, operator, threshold, and behavior (auto_log or suggest).

### healthSuggestions
Pending suggestions created when a `suggest` rule is satisfied. User must accept to create a HabitEntry. Statuses: pending, accepted, dismissed.

## Truth Ownership

- **Behavioral truth:** `habitEntries` only. Completion and progress are derived at read time, not stored.
- **Reflective truth:** `journalEntries`
- **Subjective-state truth:** `wellbeingEntries`
- **Derived read-model surfaces** (computed from entries, not stored): day view, day summary, progress/overview, streaks, goal progress.

## Soft Delete

- **Habits** are soft-deleted: `DELETE /api/habits/:id` sets `Habit.deletedAt` rather than removing the row. The document is retained so that orphan entries (which still contribute to goal progress) can display the habit's original name and unit in historical views. Default readers (`getHabitsByUser`, etc.) filter out soft-deleted; goal-progress code opts in via `{ includeDeleted: true }`.
- **Entries** are soft-deleted via `HabitEntry.deletedAt`.
- **Truth records** are never hard-deleted.

## HabitEntry Semantics

`HabitEntry` fields are defined in `src/models/persistenceTypes.ts`.

Enforced guardrails:

- No stored completion/progress fields in writes (`src/server/repositories/habitEntryRepository.ts`)
- DayKey validation/normalization at API boundary (`src/server/utils/dayKeyNormalization.ts`)
- Route-level canonical validators (`src/server/domain/canonicalValidators.ts`)

## Bundle Membership

The `bundleMemberships` collection stores temporal parent-child relationships for choice bundles.

Each record represents a time range during which a child habit belongs to a parent bundle:
- `activeFromDayKey`: When the membership starts (YYYY-MM-DD)
- `activeToDayKey`: When the membership ends (null = currently active)
- `archivedAt`: UX hint to hide from active lists (does not affect temporal logic)

Bundle parent completion is derived from children whose membership is active on the queried day. For pre-migration bundles without membership records, the system falls back to `subHabitIds`.

See: `src/server/repositories/bundleMembershipRepository.ts`

## Goal Milestones

Cumulative goals may declare intermediate stages via `Goal.milestones`. Each entry has:
- `id` — server-assigned UUID
- `value` — threshold > 0 and strictly less than `Goal.targetValue`
- `acknowledgedAt?` — ISO timestamp set after the user dismisses the per-milestone celebration

Milestone *completion* is derived at read time from HabitEntries (see `src/server/utils/goalProgressUtilsV2.ts` → `computeMilestoneStates`); only the configuration above and `acknowledgedAt` are stored. The server normalizes the array to ascending order by `value` on write.

`acknowledgedAt` is the only progress-adjacent field stored on the goal. It mirrors `Goal.completedAt`: derived completion remains canonical, while the acknowledgment marker keeps the celebration screen idempotent across reloads.

## DayKey Boundary

DayKey utilities and validation:

- `src/domain/time/dayKey.ts`
- `src/server/utils/dayKey.ts` (server default timezone: America/New_York when client omits or sends invalid timezone)
- `src/server/domain/canonicalValidators.ts`

Aggregation logic uses DayKey windows, not timestamp-only grouping. See `docs/semantics/daykey.md`.
