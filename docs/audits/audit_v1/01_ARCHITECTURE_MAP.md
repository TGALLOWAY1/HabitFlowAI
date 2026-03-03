# Architecture Map

## Stack
- Frontend: React 19 + Vite + TypeScript (`package.json`, `src/main.tsx`).
- Backend: Express 5 + TypeScript (`src/server/index.ts`).
- Database: MongoDB (`src/server/lib/mongoClient.ts`).
- Auth (current): `X-User-Id` header middleware with anonymous fallback (`src/server/middleware/auth.ts`).
- Charts/UI infra: Recharts + Tailwind + custom contexts/stores.
- PWA shell: `public/manifest.webmanifest`, `public/sw.js` (prod registration in `src/main.tsx:12-18`).

## Folder Map (Major)
- `src/App.tsx`
- Purpose: query-param router + top-level view composition (`view=dashboard|tracker|...`).

- `src/store/`
- `HabitContext.tsx`: habits/categories/logs/wellbeing/evidence state + mutation orchestration.
- `RoutineContext.tsx`: routines/routineLogs + unused internal execution state machine.

- `src/context/TaskContext.tsx`
- Task state + CRUD (uses raw `fetch`, not shared API client).

- `src/pages/`
- User surfaces: goals, journal, tasks, wellbeing history, debug entries.

- `src/components/`
- Major product UI: `TrackerGrid`, day view, dashboards, routines, modals.

- `src/lib/`
- API client (`persistenceClient.ts`), cache (`goalDataCache.ts`), data hooks.

- `src/server/routes/`
- HTTP handlers for habits/categories/entries/goals/routines/day summary/dashboard/etc.

- `src/server/repositories/`
- Mongo read/write layer per collection.

- `src/server/services/`
- Derived read model logic: `truthQuery`, `dayViewService`, `streakService`, momentum.

- `src/server/utils/`
- DayKey normalization, recompute utilities, goal progress utilities, migrations.

## Runtime Data Flow (Current)
```text
UI interactions (TrackerGrid/DayView/Goals/Routines)
  -> src/lib/persistenceClient.ts (mostly)
  -> Express routes (src/server/index.ts mounts)
  -> repositories/services
  -> Mongo collections
  <- HTTP JSON response
  <- Context state updates (HabitContext/RoutineContext/TaskContext)
```

### Behavioral Truth + Derived Layers (as implemented)
```text
HabitEntry writes (POST/PUT/PATCH/DELETE /api/entries)
  -> habitEntries collection (source of truth intent)
  -> recomputeDayLogForHabit(...) on mutation
  -> dayLogs collection (legacy derived cache)

Reads
  A) canonical-target path: truthQuery + dayViewService (EntryView-based)
  B) mixed path: truthQuery default merge includes dayLogs fallback
  C) legacy path: /api/dayLogs direct reads (still exposed)
```

## Canonical Truth Location
- Intended canonical behavioral truth:
  - Collection: `habitEntries`
  - Write/read paths: `src/server/routes/habitEntries.ts`, `src/server/repositories/habitEntryRepository.ts`
  - DayKey utility: `src/domain/time/dayKey.ts`
  - API guards: `src/server/domain/canonicalValidators.ts`

- Current caveat:
  - truthQuery merges legacy DayLogs by default (`src/server/services/truthQuery.ts:85`, `:144`).

## Derived Metric Computation Map
- Day summary (derived logs for UI):
  - Route: `GET /api/daySummary`
  - File: `src/server/routes/daySummary.ts`
  - Inputs: habits + habitEntries
  - Output: `logs` record keyed by `${habitId}-${dayKey}`

- Day view (entries-first):
  - Route: `GET /api/dayView`
  - Service: `src/server/services/dayViewService.ts`
  - Uses truthQuery with `includeLegacyFallback: false` (`:274`)

- Progress overview:
  - Route: `GET /api/progress/overview`
  - File: `src/server/routes/progress.ts`
  - Derives streak/momentum from aggregated entries + goalsWithProgressV2

- Dashboard streaks:
  - Route: `GET /api/dashboard/streaks`
  - File: `src/server/routes/dashboard.ts`

- Goals with progress:
  - Route: `GET /api/goals-with-progress`
  - File: `src/server/routes/goals.ts:296`
  - Utility: `src/server/utils/goalProgressUtilsV2.ts`
  - Caveat: still includes manual logs and truthQuery legacy merge path.

- Goal detail (legacy path still active):
  - Route: `GET /api/goals/:id/detail`
  - File: `src/server/routes/goals.ts:925`
  - Uses old `computeGoalProgress` + DayLogs + manual logs.

## Legacy vs New Parallel Systems
1. **HabitEntries vs DayLogs**
- New/Canonical: HabitEntry-based derivation.
- Legacy: persisted DayLog cache still read by truthQuery and exposed under `/api/dayLogs`.

2. **Goal progress V2 vs Goal detail V1 logic**
- V2: `computeGoalProgressV2` (truthQuery-based).
- Legacy: `computeGoalProgress` + DayLog + manual logs still in goal detail route.

3. **WellbeingEntries vs WellbeingLogs**
- New canonical route: `/api/wellbeingEntries`.
- Legacy compatibility route still active: `/api/wellbeingLogs` with adapter writes to entries.

4. **Routine evidence semantics vs implementation**
- Canon expects ephemeral evidence + explicit confirmation flow.
- Current implementation persists evidence in Mongo and also supports direct routine habit logging at submit.

## DB Collections Observed
- Core: `categories`, `habits`, `habitEntries`, `goals`, `routines`, `tasks`, `journalEntries`.
- Derived/legacy: `dayLogs`, `routineLogs`, `goalManualLogs`, `wellbeingLogs`.
- Canonical newer read model inputs: `wellbeingEntries`.
- Support/other: `habitPotentialEvidence`, `routineImages`, `dashboardPrefs`.

## Index / Integrity Highlights
- Ensured globally on startup (`src/server/lib/mongoClient.ts`):
  - `habitEntries`: unique `(userId,id)`, non-unique `(userId,habitId,dayKey,deletedAt)`.
  - `dayLogs`: unique `(userId,compositeKey)`.
- Missing canonical constraint: unique active `(userId, habitId, dayKey)`.
