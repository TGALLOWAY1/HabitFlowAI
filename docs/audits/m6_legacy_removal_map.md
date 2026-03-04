# M6 Legacy Removal Map

Audit of legacy paths for Milestone 6 cleanup. For each item: file paths, callers, and whether it is **safe to delete now**. Ends with a **deletion order** that minimizes breakage.

---

## 1. DayLogs routes, services, repos, and callers

### 1.1 DayLog API routes (`/api/dayLogs`)

| Location | Description |
|----------|-------------|
| `src/server/routes/dayLogs.ts` | Defines `getDayLogs`, `getDayLogRoute`, `upsertDayLogRoute`, `deleteDayLogRoute`. GET in prod → 410; POST/PUT/DELETE always 410. |
| `src/server/index.ts` (lines 13, 93–99) | Mounts: `GET /api/dayLogs`, `GET /api/daySummary`, `POST/PUT /api/dayLogs`, `GET /api/dayLogs/:habitId/:date`, `DELETE /api/dayLogs/:habitId/:date`. |

**Callers (frontend):**

- **None for GET /api/dayLogs.** The app uses `fetchDaySummary` (canonical `/api/daySummary`) only:
  - `src/store/HabitContext.tsx`: `refreshDayLogs` → `fetchDaySummary(startDayKey, endDayKey, timeZone)` (lines 108, 645).
- **No frontend** calls `fetchDayLogs()`; it exists only in `src/lib/persistenceClient.ts` and is unused.

**Callers (backend):**

- None. DayLog routes are only invoked by HTTP (dev or 410 in prod).

**Safe to delete now (route layer):**  
- **Yes**, for the **route file and mount points** (see deletion order). Removing the routes does not break the app; frontend already uses `/api/daySummary`.

---

### 1.2 DayLog repository (`dayLogRepository.ts`)

| Location | Exports used elsewhere |
|----------|-------------------------|
| `src/server/repositories/dayLogRepository.ts` | `getDayLogsByUser`, `getDayLogsByHabit`, `getDayLog`, `upsertDayLog`, `deleteDayLog`, `deleteDayLogsByHabit` |

**Import graph:**

| Consumer | Uses | Purpose |
|----------|------|---------|
| `src/server/routes/dayLogs.ts` | `getDayLogsByUser`, `getDayLogsByHabit`, `getDayLog` | Legacy GET dayLogs (dev-only / 410 in prod). |
| `src/server/services/truthQuery.ts` | `getDayLogsByHabit`, `getDayLogsByUser` | Legacy fallback merge into EntryViews when `LEGACY_DAYLOG_READS=true`. |
| `src/server/utils/recomputeUtils.ts` | `upsertDayLog`, `deleteDayLog` | Writes derived DayLog cache after HabitEntry mutations. |
| `src/server/routes/habits.ts` | `deleteDayLogsByHabit` | Cascade delete DayLogs when a habit is deleted. |
| `src/server/utils/migrationUtils.ts` | `getDayLogsByHabit` | Backfill DayLogs → HabitEntries. |
| `src/server/routes/__tests__/milestoneA.integration.test.ts` | mock `getDayLogsByHabit`, `getDayLogsByUser` | Tests. |
| `src/server/routes/__tests__/routines.submit.test.ts` | `getDayLog` | Tests. |
| `src/server/repositories/__tests__/dayLogRepository.test.ts` | All repo functions | Unit tests for repo. |
| `src/server/routes/__tests__/habits.deleteCascade.test.ts` | mock `deleteDayLogsByHabit` | Tests. |
| `src/server/services/truthQuery.test.ts` | mock `getDayLogsByHabit`, `getDayLogsByUser` | Tests. |

**Safe to delete now:**  
**No.** The repo is still required for:

1. **recomputeUtils** – writes DayLog derived cache (used by entry routes, routines completion).
2. **habits.ts** – cascade delete on habit delete.
3. **truthQuery** – legacy fallback when `LEGACY_DAYLOG_READS=true`.
4. **migrationUtils** – backfill (if still run).

Deletion of the **repository** depends on: (a) removing DayLog writes (recomputeUtils) and legacy reads (truthQuery), (b) switching habit-delete cascade to entries-only or keeping a one-off cleanup script, (c) retiring or moving backfill.

---

### 1.3 DaySummary route (canonical – keep)

| Location | Description |
|----------|-------------|
| `src/server/routes/daySummary.ts` | Builds “day log” shape from **HabitEntries only** (aggregation). No DayLog collection read. |
| `src/server/index.ts` | `GET /api/daySummary` |

**Callers:**  
- `src/store/HabitContext.tsx` → `fetchDaySummary` (in `persistenceClient.ts`).  
- **Verdict:** **Keep.** This is the canonical source for the grid; do not delete.

---

### 1.4 Client: `fetchDayLogs` vs `fetchDaySummary`

| Function | File | Called from |
|----------|------|-------------|
| `fetchDaySummary` | `src/lib/persistenceClient.ts` | `HabitContext.tsx` only (refreshDayLogs). **In use.** |
| `fetchDayLogs` | `src/lib/persistenceClient.ts` | **Nowhere.** Unused. |

**Safe to delete now:**  
- **Yes** – remove `fetchDayLogs` from `persistenceClient.ts` (and the legacy comment block around it can be trimmed). Do not remove `fetchDaySummary`.

---

## 2. Manual goal log code paths

### 2.1 Backend: manual log routes and repo

| Location | Description |
|----------|-------------|
| `src/server/routes/goals.ts` | `createGoalManualLogRoute` (POST) → always 410. `getGoalManualLogsRoute` (GET) → returns manual logs. `getGoalDetailRoute` → still fetches `manualLogs` via `getGoalManualLogsByGoal` for display. |
| `src/server/index.ts` (lines 20, 159–160) | `POST /api/goals/:id/manual-logs` → 410; `GET /api/goals/:id/manual-logs` → live. |
| `src/server/repositories/goalManualLogRepository.ts` | `createGoalManualLog`, `getGoalManualLogsByGoal`, `getGoalManualLogsByGoals`, `deleteGoalManualLog`. |

**Callers:**

- **createGoalManualLogRoute:** Only invoked by client `createGoalManualLog()` → 410. No successful write path.
- **getGoalManualLogsByGoal:** Used by `goals.ts` in `getGoalManualLogsRoute` and `getGoalDetailRoute` (returns `manualLogs` for UI).
- **goalProgressUtilsV2** (and thus goal progress): Uses `manualLogs` for cumulative goals (summed with entry values). So manual logs are still **read** for progress and detail.

**Safe to delete now:**  
- **Route (POST):** Safe to remove the route registration and handler; client already gets 410.  
- **Route (GET) + repo + progress/detail usage:** Only safe to remove after: (1) deciding manual logs are no longer displayed or computed, (2) removing UI that shows “Add manual progress” and the modal that calls `createGoalManualLog`, (3) dropping or migrating `goalManualLogs` collection if desired.

---

### 2.2 Frontend: GoalManualProgressModal and createGoalManualLog

| Location | Description |
|----------|-------------|
| `src/components/goals/GoalManualProgressModal.tsx` | Modal that calls `createGoalManualLog(goal.id, …)`. API returns 410; user action does nothing useful. |
| `src/pages/goals/GoalsPage.tsx` | Imports and renders `GoalManualProgressModal`; has `manualProgressGoalId` state and “Add manual progress” (or similar) that opens it. |
| `src/lib/persistenceClient.ts` | `createGoalManualLog(goalId, payload)` → POST to `/goals/:id/manual-logs` (410). |
| `src/components/goals/GoalCard.tsx` | `onAddManualProgress` prop; shows manual progress button for cumulative goals. |
| `src/components/goals/GoalGridCard.tsx` | Passes `onAddManualProgress`. |
| `src/components/goals/GoalCardStack.tsx` | Optional `onAddManualProgress`. |
| `src/pages/goals/GoalDetailPage.tsx` | Comment: “GoalManualProgressModal removed — manual goal logs deprecated in V1”. No modal there. |

**Safe to delete now (UI + client API):**  
- **Yes**, from a “no longer support manual goal logs” perspective: you can remove the modal, the “Add manual progress” affordance, and `createGoalManualLog` client function in one go. Users will no longer have a dead button.  
- Backend GET manual-logs and repo can be removed in a later step once you stop returning `manualLogs` in goal detail/progress (see deletion order).

---

## 3. V1 goal progress utilities (`goalProgressUtils.ts`)

- **File `src/server/utils/goalProgressUtils.ts`:** **Does not exist.** Removed in M2.
- **V2 in use:** `src/server/utils/goalProgressUtilsV2.ts` is the only goal progress utility. Used by:
  - `src/server/routes/goals.ts` (getGoalProgress, getGoalsWithProgress, getGoalDetailRoute, etc.)
  - `src/server/routes/progress.ts`
  - `src/server/services/skillTreeService.ts`
  - Tests: `goalProgressUtilsV2.test.ts`, `skillTreeService.test.ts`, `progress.overview.test.ts`, etc.

**Verdict:** Nothing to delete for V1. Keep `goalProgressUtilsV2.ts`.

---

## 4. Dead endpoints / features: `freezeHabit`

| Location | Description |
|----------|-------------|
| `src/lib/persistenceClient.ts` (lines 483–498) | `freezeHabit(id, date)` → `POST /api/habits/:id/freeze`. |
| `src/server/routes/habits.ts` | **No** `/freeze` handler. |
| `src/server/index.ts` | No mount for `POST /api/habits/:id/freeze`. |

**Callers:**  
- Grep of `src` shows **no** callers of `freezeHabit` in UI or other code. Only definition in `persistenceClient` and docs/audits referencing it.

**Safe to delete now:**  
- **Yes.** Remove `freezeHabit` from `persistenceClient.ts` to avoid future 404s if something ever calls it. Optional: add a short comment that manual freeze is not implemented and auto-freeze lives in `freezeService` if you want to preserve intent.

---

## 5. Legacy flags: `LEGACY_DAYLOG_READS`

| Location | How it’s used |
|----------|----------------|
| `src/server/config/index.ts` | `isLegacyDaylogReadsEnabled()` – reads `LEGACY_DAYLOG_READS` env; production forces `false`. |
| `src/server/services/truthQuery.ts` | Uses `isLegacyDaylogReadsEnabled()` to decide whether to merge DayLogs into EntryViews; `warnOncePerRequest(LEGACY_DAYLOG_READS_WARNING)` when enabled. |
| Tests | `truthQuery.test.ts`, `entriesOnly.invariants.test.ts`, `goals.entriesDerived.test.ts`, `routines.completion-guardrail.test.ts` set `process.env.LEGACY_DAYLOG_READS = 'false'` or `'true'`. |
| `src/server/middleware/requestContext.test.ts` | Asserts on the warning string `'LEGACY_DAYLOG_READS enabled'`. |
| `scripts/compare-legacy-vs-canonical.ts` | Toggles the flag for comparison. |

**Safe to delete now:**  
- **No.** The flag and `isLegacyDaylogReadsEnabled()` are still used in `truthQuery`. Remove them only when you remove the legacy DayLog merge path from `truthQuery` (and then delete the flag, the warning, and update tests).

---

## 6. Other legacy-related files (reference only)

- **`src/utils/legacyReadWarning.ts`** – `warnLegacyDayLogRead`, `warnLegacyCompletionRead`, etc. Only `warnLegacyCompletionRead` is imported (`DayCategorySection.tsx`). Can be removed or simplified when legacy read paths are gone.
- **`scripts/check-invariants.ts`** – References legacy DayLog writes and dayLogRepository; update when DayLog writes are removed.
- **Mongo indexes** – `src/server/lib/mongoClient.ts` creates indexes on `dayLogs`. Leave until you drop the `dayLogs` collection or stop writing.

---

## 7. Deletion order (minimize breakage)

Do in this order so nothing that still depends on legacy code breaks.

1. **Client dead code (no server change)**  
   - Remove `freezeHabit` from `src/lib/persistenceClient.ts`.  
   - Remove `fetchDayLogs` from `src/lib/persistenceClient.ts` (keep `fetchDaySummary`).

2. **DayLog HTTP routes only**  
   - In `src/server/index.ts`: remove the 5 DayLog route mounts (`GET/POST/PUT /api/dayLogs`, `GET /api/dayLogs/:habitId/:date`, `DELETE /api/dayLogs/:habitId/:date`). Keep `GET /api/daySummary`.  
   - Optionally delete `src/server/routes/dayLogs.ts` and update any tests that import from it (e.g. `dayLogs.deprecated.test.ts` – adjust or remove).

3. **Manual goal log UI and client write**  
   - Remove “Add manual progress” from GoalsPage/GoalCard/GoalGridCard/GoalCardStack (and any handlers).  
   - Remove `GoalManualProgressModal.tsx` and its usage in `GoalsPage.tsx`.  
   - Remove `createGoalManualLog` from `src/lib/persistenceClient.ts`.  
   - Remove `POST /api/goals/:id/manual-logs` route and `createGoalManualLogRoute` from server (already 410).

4. **Legacy DayLog merge and flag**  
   - In `truthQuery.ts`: remove the legacy DayLog fetch/merge branch (and `getDayLogsByUser` / `getDayLogsByHabit` usage there).  
   - In `config/index.ts`: remove `isLegacyDaylogReadsEnabled()` (and any `getFeatureFlag('LEGACY_DAYLOG_READS', …)` for it).  
   - Update tests that set `LEGACY_DAYLOG_READS` or assert on the legacy warning; remove or rewrite `compare-legacy-vs-canonical.ts` if it only toggles this.

5. **DayLog writes (recomputeUtils)**  
   - Stop calling `recomputeDayLogForHabit` from entry and routine handlers (or replace with a no-op if you want to keep the call sites for a later “recompute to different store” step).  
   - Remove `recomputeUtils.ts` usage of `upsertDayLog`/`deleteDayLog`, then remove the repo dependency from recomputeUtils.

6. **Habit delete cascade**  
   - In `habits.ts` delete route: either keep calling `deleteDayLogsByHabit` until DayLog collection is dropped, or remove it and rely on “entries only” (and optional one-off cleanup script for existing DayLogs).

7. **Manual goal logs (read path)**  
   - In `goals.ts`: stop fetching `manualLogs` in `getGoalDetailRoute` and `getGoalManualLogsRoute`; in `goalProgressUtilsV2` stop including manual logs in progress.  
   - Remove `GET /api/goals/:id/manual-logs` route and `getGoalManualLogsRoute`.  
   - Delete `src/server/repositories/goalManualLogRepository.ts` (and its tests) or reduce to migration-only.  
   - Optionally migrate or drop `goalManualLogs` collection.

8. **DayLog repository and collection**  
   - After migrationUtils no longer needs DayLog reads (or backfill is retired), remove `getDayLogsByHabit` from migrationUtils.  
   - Remove `dayLogRepository.ts` and its unit tests; remove remaining mocks in integration tests.  
   - Drop `dayLogs` collection and remove indexes from `mongoClient.ts` (or leave indexes if you keep the collection for a while).

9. **Cleanup**  
   - Remove `src/utils/legacyReadWarning.ts` (or only the DayLog-related helpers) once no callers remain.  
   - Update `scripts/check-invariants.ts` and any docs that reference removed endpoints or flags.

---

## Summary table

| Item | Location(s) | Callers | Safe to delete now? |
|------|-------------|----------|---------------------|
| DayLog GET/POST/PUT/DELETE routes | `server/routes/dayLogs.ts`, `server/index.ts` | None (frontend uses daySummary) | Yes (routes + file) |
| fetchDayLogs (client) | `lib/persistenceClient.ts` | None | Yes |
| DayLog repository | `server/repositories/dayLogRepository.ts` | truthQuery, recomputeUtils, habits, migrationUtils, tests | No (until steps 4–6 and 8) |
| goalProgressUtils.ts (V1) | (removed) | — | N/A |
| goalProgressUtilsV2.ts | `server/utils/goalProgressUtilsV2.ts` | goals, progress, skillTreeService | Keep |
| freezeHabit (client) | `lib/persistenceClient.ts` | None; no server route | Yes |
| Manual goal: POST route + modal + createGoalManualLog | goals.ts, GoalManualProgressModal, GoalsPage, persistenceClient | UI only (410) | Yes (UI + client + POST route) |
| Manual goal: GET route + repo + detail/progress | goals.ts, goalManualLogRepository, goalProgressUtilsV2 | getGoalDetail, getGoalManualLogs, progress computation | No (until step 7) |
| LEGACY_DAYLOG_READS | config, truthQuery, tests | truthQuery legacy merge | No (until step 4) |
| daySummary route / fetchDaySummary | server/routes/daySummary.ts, persistenceClient | HabitContext | Keep (canonical) |
