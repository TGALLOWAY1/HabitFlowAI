# HabitFlow AI Audit V1 — Executive Summary

## Scope Snapshot
- Audit scope: current web app + Express/Mongo backend as implemented in `src/`.
- V1 target respected: pragmatic "get life together" habit + goals + logging + dashboards product.
- Canonical baseline used: `docs/DOMAIN_CANON.md`, `docs/reference/V1/00_NORTHSTAR.md`, `docs/reference/V1/02_HABIT_ENTRY.md`, `docs/reference/V1/11_TIME_DAYKEY.md`, plus iOS orchestration constraints from `docs/reference/V2 (Current - iOS focus)/03_Routine.md` and `docs/reference/V2 (Current - iOS focus)/07_Metrics.md`.

## Current Status (Short)
- Core functionality exists across habits, entries, goals, routines, journal, tasks, wellbeing, dashboards.
- The codebase is mid-migration: canonical HabitEntry/DayKey paths exist, but legacy DayLog/manual-log/evidence paths are still live and still influence read models.
- Product works for single-user dev use, but data integrity and canonical consistency risks remain high.

## Top 10 Issues (Ranked)
1. **Canonical truth split still active in read path**
- `src/server/services/truthQuery.ts:85`, `:144` defaults `includeLegacyFallback` to `true`, merging DayLogs into EntryViews (`:334`).
- Impact: behavioral truth can still come from legacy cache.

2. **Goal progress still accepts non-HabitEntry truth inputs**
- Manual logs are first-class (`src/server/routes/goals.ts:750`, `:863`, `src/server/repositories/goalManualLogRepository.ts:1`).
- `GET /api/goals/:id/detail` still uses `computeGoalProgress` (DayLogs + manual logs) and aggregates DayLogs directly (`src/server/routes/goals.ts:955`, `:973-1016`).
- Impact: direct canonical violation for goal semantics.

3. **Uniqueness invariant `(habitId, dayKey)` is not enforced**
- Canon expects one entry per habit/day default (`docs/reference/V1/02_HABIT_ENTRY.md:33-39`).
- No unique index on active entries in `src/server/lib/mongoClient.ts:37-39`; upsert is race-prone in `src/server/repositories/habitEntryRepository.ts:370-425`.

4. **Routine flow can auto-log habits as completion shortcut**
- `submitRoutineRoute` writes HabitEntries directly for passed IDs (`src/server/routes/routines.ts:817-838`).
- iOS routine canon explicitly forbids routine-as-tracker patterns (`docs/reference/V2 (Current - iOS focus)/03_Routine.md:218-229`).

5. **DayKey/timezone semantics are inconsistent in key aggregators**
- `daySummary` default range uses server-local day key (`src/server/routes/daySummary.ts:21-35`) while accepting `timeZone` but not using it for range derivation.
- Fallback logic still reads `entry.dayKey || entry.date || entry.dateKey` (`src/server/routes/daySummary.ts:68`, `src/server/routes/progress.ts:76`, `src/server/routes/dashboard.ts:60`).

6. **Evidence subsystem violates canonical shape and user scoping**
- Hardcoded user ID: `src/server/routes/habitPotentialEvidence.ts:19`.
- Persistent evidence collection + non-canonical fields (`date`, `stepId`, `source: 'routine-step'`) in `src/server/repositories/habitPotentialEvidenceRepository.ts:26-56` and model `src/models/persistenceTypes.ts:1200-1224`.

7. **Frontend sends forbidden completion payload in entry upsert path**
- `TrackerGrid` sends `{ completed: false }` in upsert (`src/components/TrackerGrid.tsx:1047-1052`).
- Backend rejects stored completion fields (`src/server/domain/canonicalValidators.ts:144-152`).

8. **Client state architecture remains DayLog-cache-centric**
- Primary store truth in UI is `logs: Record<string, DayLog>` (`src/store/HabitContext.tsx:30`, `:77`), with frequent recompute-refresh loops (`:429`, `:471`, `:667`, `:714`).
- Slows migration to pure entries-first derivation.

9. **Identity/auth model is unsafe and inconsistent**
- Header-based user identity with anonymous fallback everywhere (`src/server/middleware/auth.ts:14-42`).
- `TaskContext` and routine evidence calls bypass shared API client and omit `X-User-Id` (`src/context/TaskContext.tsx:32-53`, `src/store/RoutineContext.tsx:219-227`).

10. **UX/mobile friction is still high in critical logging flows**
- Grid logging uses delayed single click + double-click deletion (`src/components/TrackerGrid.tsx:1083-1186`), poor touch affordance.
- Day view choice selection is partially implemented (`src/components/day-view/DayCategorySection.tsx:141-143`).

## If We Fix Only 3 Things This Month
1. **Make HabitEntry truly sole truth end-to-end**
- Disable legacy fallback in truthQuery by default, remove DayLog/manual-log influence from goal detail/progress, and gate legacy endpoints as migration-only.

2. **Lock data integrity invariants**
- Enforce unique active `(userId, habitId, dayKey)` at DB level, harden upsert for concurrency, and make DayKey/timezone derivation consistent at write and read boundaries.

3. **Cut logging friction and invalid client payloads**
- Remove double-click dependency, add explicit single-tap actions for touch, fix choice bundle day-view completion, and stop sending forbidden `completed` fields.
