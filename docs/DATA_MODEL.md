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

**Removed / no longer used:** `dayLogs`, `goalManualLogs`. Do not reference these in new code or docs.

## Truth Ownership

- **Behavioral truth:** `habitEntries` only. Completion and progress are derived at read time, not stored.
- **Reflective truth:** `journalEntries`
- **Subjective-state truth:** `wellbeingEntries`
- **Derived read-model surfaces** (computed from entries, not stored): day view, day summary, progress/overview, streaks, goal progress.

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

## DayKey Boundary

DayKey utilities and validation:

- `src/domain/time/dayKey.ts`
- `src/server/utils/dayKey.ts` (server default timezone: America/New_York when client omits or sends invalid timezone)
- `src/server/domain/canonicalValidators.ts`

Aggregation logic uses DayKey windows, not timestamp-only grouping. See `docs/semantics/daykey.md`.
