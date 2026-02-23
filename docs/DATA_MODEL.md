# Data Model

This file summarizes the implemented data model. Canonical references remain under `docs/reference/`.

## Canonical References

- `docs/reference/V1/00_NORTHSTAR.md`
- `docs/reference/V1/02_HABIT_ENTRY.md`
- `docs/reference/V1/11_TIME_DAYKEY.md`

## Collection Overview

Defined in `src/models/persistenceTypes.ts` (`MONGO_COLLECTIONS`):

- `categories`
- `habits`
- `dayLogs` (legacy/derived compatibility)
- `wellbeingLogs` (legacy wellbeing format)
- `wellbeingEntries` (canonical wellbeing truth)
- `routines`
- `goals`
- `goalManualLogs`
- `routineLogs`
- `routineImages`
- `journalEntries`
- `dashboardPrefs`
- `tasks`
- `habitEntries` (canonical behavioral truth)
- `habitPotentialEvidence`

## Truth Ownership

Behavioral truth:
- `habitEntries`

Reflective truth:
- `journalEntries`

Subjective-state truth:
- `wellbeingEntries`

Derived/read-model surfaces (non-canonical truth):
- `dayLogs`
- trend/progress/momentum/summary responses

## HabitEntry Semantics

`HabitEntry` fields are defined in `src/models/persistenceTypes.ts`.

Enforced guardrails:
- no stored completion/progress fields in writes (`src/server/repositories/habitEntryRepository.ts`)
- DayKey validation/normalization at API boundary (`src/server/utils/dayKeyNormalization.ts`)
- route-level canonical validators (`src/server/domain/canonicalValidators.ts`)

## DayKey Boundary

DayKey utilities and validation:
- `src/domain/time/dayKey.ts`
- `src/server/domain/canonicalValidators.ts`

Aggregation logic should use DayKey windows, not timestamp-only grouping.
