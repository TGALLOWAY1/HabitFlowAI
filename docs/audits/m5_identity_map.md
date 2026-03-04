# M5 Identity & Scoping Map

**Goal:** Map identity plumbing before adding household scoping (householdId) and removing hardcoded identity.

---

## 1. Where `userId` comes from on the server

### Headers
- **`X-User-Id`** — Primary source. Sent by the client on every API request. Read in auth middleware.

### Middleware (order in `src/server/index.ts`)
1. **`requestContextMiddleware`** — AsyncLocalStorage for request-scoped warnings; does **not** set `userId`.
2. **`userIdMiddleware`** (`src/server/middleware/auth.ts`) — **Sets `req.userId`:**
   - If `X-User-Id` is present and non-empty: uses trimmed header value.
   - **Demo guard:** If value equals `DEMO_USER_ID` (`demo_emotional_wellbeing`), only accepts it when `NODE_ENV !== 'production'` and `DEMO_MODE_ENABLED=true`; otherwise forces `anonymous-user`.
   - If header missing or empty: sets `(req as any).userId = 'anonymous-user'`.
3. **`devUserIdOverride`** (`src/server/middleware/devUserIdOverride.ts`) — Dev-only. When `DEMO_MODE_ENABLED=true` and `x-user-id === DEMO_USER_ID`, re-sets `req.userId` to `DEMO_USER_ID`. No-op in production.
4. **`noPersonaInHabitEntryRequests`** — Validates persona header; does not set `userId`.

### Constants
- **`DEMO_USER_ID`** — `'demo_emotional_wellbeing'` (`src/shared/demo.ts`), re-exported in `src/server/config/demo.ts`).
- No server-side constant for a “known” or default userId; fallback is the string `'anonymous-user'` at each route.

### Summary
- **Server identity:** Always from `req.userId`, which is set only by `userIdMiddleware` (and optionally overridden by `devUserIdOverride`). Source is **header `X-User-Id`**, with fallback **`'anonymous-user'`** when header is missing.

---

## 2. How the client chooses `userId` today

- **Storage:** `localStorage` key `habitflow_user_id` (`USER_ID_STORAGE_KEY` in `src/lib/persistenceClient.ts`).
- **Default:** On first visit or empty storage, client uses **`DEFAULT_USER_ID`** = `'8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb'`, persists it, and uses it for all subsequent “real” mode requests.
- **Effective userId:** `getActiveUserId()` in `persistenceClient.ts`:
  - If **demo mode** (`habitflow_active_user_mode === 'demo'`): returns `DEMO_USER_ID` (`demo_emotional_wellbeing`).
  - Otherwise: returns `getOrCreateUserId()` → localStorage value or `DEFAULT_USER_ID` if empty.
- **Sending to server:** Every `apiRequest()` and routine/wellbeing fetch adds header **`X-User-Id`: &lt;effective userId&gt;**.
- **Dev UI:** `DevIdentityPanel` (dev-only) allows switching among well-known IDs (including `anonymous-user` and the primary UUID) and persisting a custom userId; switch triggers a full reload.

**Conclusion:** Identity is **not** hardcoded per request; it’s a **sticky default** (`DEFAULT_USER_ID`) on first run, then whatever is in localStorage. The only “hardcoded” piece is that default bootstrap value; all API calls use the same client-chosen userId via `X-User-Id`.

---

## 3. All server queries that filter by `userId`

### Route handlers (extract `userId` then call repos/services)

| File | How userId is obtained | Fallback |
|------|------------------------|----------|
| `src/server/routes/categories.ts` | `(req as any).userId \|\| 'anonymous-user'` | yes |
| `src/server/routes/habits.ts` | same | yes |
| `src/server/routes/goals.ts` | same | yes |
| `src/server/routes/habitEntries.ts` | same (except batch + delete-by-key use fallback; batchCreateEntriesRoute uses `(req as any).userId` and returns 401 if missing) | mixed |
| `src/server/routes/routines.ts` | same | yes |
| `src/server/routes/journal.ts` | same | yes |
| `src/server/routes/tasks.ts` | same | yes |
| `src/server/routes/wellbeingLogs.ts` | same | yes |
| `src/server/routes/wellbeingEntries.ts` | same | yes |
| `src/server/routes/dashboardPrefs.ts` | same | yes |
| `src/server/routes/habitPotentialEvidence.ts` | `getUserId(req)` → `req.userId` or `'anonymous-user'` | yes |
| `src/server/routes/dayView.ts` | `(req as any).userId \|\| 'anonymous-user'` | yes |
| `src/server/routes/dayLogs.ts` | same | yes |
| `src/server/routes/daySummary.ts` | `getUserIdFromRequest(req)` → candidate or `'anonymous-user'` | yes |
| `src/server/routes/dashboard.ts` | same | yes |
| `src/server/routes/progress.ts` | same | yes |
| `src/server/routes/admin.ts` | same | yes |
| `src/server/routes/devDemoEmotionalWellbeing.ts` | `(req as any).userId \|\| 'anonymous-user'` (and checks === DEMO_USER_ID for demo actions) | yes |
| `src/server/routes/skillTree.ts` | `(req as any).userId` only; 401 if missing | no |
| `src/server/routes/routineLogs.ts` | `(req as any).userId` only; throws if missing | no |

### Repositories / services that filter by `userId`

| Path | Functions that take or filter by userId |
|------|----------------------------------------|
| `src/server/repositories/categoryRepository.ts` | createCategory, getCategoriesByUser, getCategoryById, updateCategory, deleteCategory, reorderCategories (find/delete by userId) |
| `src/server/repositories/habitRepository.ts` | createHabit, getHabitsByUser, getHabitsByCategory, getHabitById, updateHabit, deleteHabit (find/delete by userId) |
| `src/server/repositories/goalRepository.ts` | getGoalsByUser, getGoalById, createGoal, updateGoal, deleteGoal (find/delete by userId) |
| `src/server/repositories/goalManualLogRepository.ts` | createManualLog, getManualLogsByGoal, getManualLogsByGoals, deleteManualLog (goalId + userId) |
| `src/server/repositories/habitEntryRepository.ts` | getHabitEntriesByHabit, getHabitEntriesForDay, upsertHabitEntry, getHabitEntriesByUser, deleteByKey, etc. (habitId + userId or userId only) |
| `src/server/repositories/dayLogRepository.ts` | getDayLogsByUser, getDayLogsByHabit, getDayLog, upsertDayLog, deleteDayLog, deleteDayLogsByHabit (userId or habitId+userId) |
| `src/server/repositories/routineRepository.ts` | getRoutines, getRoutine, createRoutine, updateRoutine, deleteRoutine (userId) |
| `src/server/repositories/routineLogRepository.ts` | getRoutineLogsByUser (userId) |
| `src/server/repositories/journal.ts` | getEntriesByUser, getEntryById, createEntry, upsertByKey, updateEntry, deleteEntry (userId) |
| `src/server/repositories/taskRepository.ts` | createTask, getTasks, updateTask, deleteTask (userId) |
| `src/server/repositories/wellbeingLogRepository.ts` | getWellbeingLogsByUser, getWellbeingLogByDate, upsertWellbeingLog, deleteWellbeingLog (userId) |
| `src/server/repositories/wellbeingEntryRepository.ts` | createWellbeingEntries, getWellbeingEntries (params.userId) |
| `src/server/repositories/dashboardPrefsRepository.ts` | getDashboardPrefs, updateDashboardPrefs (userId) |
| `src/server/repositories/habitPotentialEvidenceRepository.ts` | createPotentialEvidence, getPotentialEvidence, evidenceExistsForStep (userId) |
| `src/server/services/dayViewService.ts` | computeDayView(userId, ...) → getHabitsByUser, getEntryViewsForHabits |
| `src/server/services/skillTreeService.ts` | getSkillTree(userId), seedDefaultSkillTree (getCategoriesByUser, getGoalsByUser, getHabitsByUser, computeGoalProgressV2) |
| `src/server/utils/goalProgressUtilsV2.ts` | resolveBundleIds, computeGoalProgressV2, computeGoalsWithProgress (getHabitsByUser, getGoalById, getEntryViewsForHabits, getGoalsByUser) |
| `src/server/utils/migrationUtils.ts` | backfillDayLogsToEntries(userId) (getHabitsByUser, getDayLogsByHabit, getHabitEntriesByHabit, etc.) |

### Collections that do not store or filter by `userId` in repo
- **`routineImages`** — Keyed by `routineId` only. Access control is effectively by routine ownership (routes that serve/update images resolve routine by `userId` first).

---

## 4. Collections / models that should be household-scoped

All of the following are currently **user-scoped** (by `userId`). For M5 they should be treated as **household-scoped** (same data shared by household members); add `householdId` and scope queries by household (and optionally still store/validate `userId` for audit or creator).

| Collection | Repo | Current scope | Notes |
|------------|------|----------------|-------|
| categories | categoryRepository | userId | Household-scoped |
| habits | habitRepository | userId | Household-scoped |
| goals | goalRepository | userId | Household-scoped |
| goalManualLogs | goalManualLogRepository | userId | Household-scoped |
| habitEntries | habitEntryRepository | userId | Household-scoped |
| dayLogs | dayLogRepository | userId | Household-scoped (derived from habitEntries) |
| routines | routineRepository | userId | Household-scoped |
| routineLogs | routineLogRepository | userId | Household-scoped |
| habitPotentialEvidence | habitPotentialEvidenceRepository | userId | Household-scoped |
| journalEntries | journal (repo) | userId | Household-scoped (or keep user-private; product decision) |
| tasks | taskRepository | userId | Household-scoped (or user-private) |
| wellbeingLogs | wellbeingLogRepository | userId | Household-scoped (or user-private) |
| wellbeingEntries | wellbeingEntryRepository | userId | Household-scoped (or user-private) |
| dashboardPrefs | dashboardPrefsRepository | userId | Often **per-user** (UI prefs); may stay userId or become user-in-household |

**Indirect / derived**
- **routineImages** — Keyed by routineId; household scope follows routines.
- **Skill tree / day view / progress** — Aggregations over habits, goals, entries; scope follows underlying collections once they are household-scoped.

**New or to define**
- **households** (or equivalent) — New collection or table to map `userId` → `householdId` (and optionally household membership). Needed for V1 if we add `householdId` to data.

---

## 5. Remaining anonymous-user fallback usage

- **Route-level fallback:** Most route handlers use `(req as any).userId || 'anonymous-user'`. So if the client omits `X-User-Id` or middleware leaves `req.userId` unset, all those routes treat the request as **anonymous-user** (shared bucket).
- **Routes that do not fallback (require identity):** `skillTree.ts`, `routineLogs.ts`, and `habitEntries.batchCreateEntriesRoute` use `req.userId` only and return 401 or throw if missing.
- **Client:** `useWellbeingEntriesRange.ts` has one place that uses `'anonymous-user'` when merging/updating cache for an entry that has no `userId` in the list (fallback for legacy/consistency).
- **Scripts/migrations:** `migrateDayLogsToEntries.ts` uses `log.userId || 'anonymous-user'` when backfilling. `cleanupTestUsers.ts` lists `'anonymous-user'` as a known test user to clean. `compare-legacy-vs-canonical.ts` uses `process.env.COMPARE_USER_ID || 'anonymous-user'`.
- **habitPotentialEvidence route:** `getUserId(req)` returns `'anonymous-user'` when `req.userId` is missing or empty.

---

## 6. Minimal V1 approach: add `householdId` and remove hardcoded identity (smallest diff)

### Assumptions for V1
- One household per user for now (no multi-household membership).
- `householdId` can be derived from the “current user” (e.g. same UUID as userId, or a separate lookup table).

### Option A — Smallest diff (recommended for V1)
1. **Keep `userId` as-is from header** — Still set `req.userId` via `X-User-Id`; no change to auth middleware.
2. **Add `householdId` on the server only where needed:**
   - Add a small helper, e.g. `getHouseholdId(req)`: for V1 return `(req as any).userId` (1:1 user–household), or read from a new optional header `X-Household-Id` if present and valid, otherwise `req.userId`.
3. **Use `householdId` in repositories instead of `userId` for household-scoped collections:**  
   In each repo listed in §4 (categories, habits, goals, habitEntries, dayLogs, routines, routineLogs, habitPotentialEvidence, etc.), change every `find`/`findOne`/`deleteOne`/`insert` that currently uses `userId` to use `householdId` (and still store `userId` on documents for audit/creator if desired).  
   - **Smallest diff:** Introduce a single “context” object passed from routes: `{ userId, householdId }`. Routes compute `householdId = getHouseholdId(req)` and pass both into repos; repos use `householdId` for filtering and optionally persist `userId` for writes.
4. **Client:** No change for V1 — keep sending only `X-User-Id`. Optionally later add `X-Household-Id` when we support multi-household.
5. **Remove “hardcoded” identity:**  
   - **Server:** No constants for a default userId; already the case (fallback is the string `'anonymous-user'`).  
   - **Client:** Replace `DEFAULT_USER_ID` with a generated UUID on first run (e.g. `crypto.randomUUID()`), and persist that in localStorage so we never ship a shared default. That removes the single hardcoded bootstrap value and avoids multiple installs sharing the same ID.

### Option B — Full household entity
- Add a `households` collection and a `user_households` (or `users`) collection storing `userId` → `householdId`.
- On first request with a new `userId`, create a household and attach the user. Then use `householdId` everywhere for household-scoped data. Larger diff; better for multi-member households later.

### Suggested V1 steps (Option A)
1. Add `getHouseholdId(req)` (and optionally `getRequestIdentity(req): { userId, householdId }`).
2. Update **one** household-scoped route + repo (e.g. **categories**) to pass `householdId` and filter by it; keep storing `userId` on create/update for audit.
3. Roll the same pattern to the other household-scoped repos (habits, goals, habitEntries, dayLogs, routines, routineLogs, habitPotentialEvidence, journal, tasks, wellbeingLogs, wellbeingEntries). dashboardPrefs can stay userId-only for V1.
4. Client: in `getOrCreateUserId()`, if localStorage is empty, set `userId = crypto.randomUUID()` instead of `DEFAULT_USER_ID`, then persist. Remove or keep `DEFAULT_USER_ID` only for tests/migrations if needed.
5. (Optional) Add a migration or script to backfill `householdId` on existing documents (e.g. `householdId = userId` for all existing records).

This yields a minimal diff: one new helper, consistent use of `householdId` in repos, and client-side identity that is no longer a shared hardcoded constant.
