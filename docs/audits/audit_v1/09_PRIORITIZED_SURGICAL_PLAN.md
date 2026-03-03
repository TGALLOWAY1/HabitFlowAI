# Prioritized Surgical Plan

## Milestone Plan

### M1 — Canonical Truth Lock (Highest Priority)
**Goal / outcome**
- Make HabitEntry the only behavioral truth path for V1 reads and goal progress.
- Remove active user-facing dependence on DayLog/manual-log truth paths.

**Exact tasks**
1. Flip `truthQuery` default to entries-only and require explicit opt-in for legacy fallback.
2. Rewire `GET /api/goals/:id/detail` to V2 entry-based progress (`computeGoalProgressV2` + EntryViews).
3. Deprecate goal manual-log write endpoint for V1 (`POST /api/goals/:id/manual-logs` -> `410`), keep temporary read-only migration visibility if needed.
4. Align evidence API response contract with client (`{ evidence: [] }`) and fix request user scoping.

**Files likely touched**
- `src/server/services/truthQuery.ts`
- `src/server/routes/habitEntries.ts`
- `src/server/routes/goals.ts`
- `src/server/utils/goalProgressUtils.ts` (deprecate path markers)
- `src/server/utils/goalProgressUtilsV2.ts`
- `src/server/routes/habitPotentialEvidence.ts`
- `src/lib/persistenceClient.ts`

**Verification steps**
1. Run targeted tests:
   - `npm run test:run -- src/server/services/truthQuery.test.ts`
   - `npm run test:run -- src/server/routes/__tests__/progress.overview.test.ts`
   - `npm run test:run -- src/server/routes/__tests__/dashboard.streaks.test.ts`
2. Add/execute new tests:
   - goal detail uses only entries-based progress path
   - evidence response shape contract test (`/api/evidence`)
3. Manual API checks:
   - `GET /api/goals/:id/progress` and `GET /api/goals/:id/detail` return matching `currentValue` semantics for same goal/day window.

**Suggested commit boundaries**
1. `refactor(truth): default truthQuery to HabitEntry-only reads`
2. `fix(goals): move goal detail to V2 entries-based progress`
3. `deprecate(goals): disable manual goal logs for V1 path`
4. `fix(evidence): scope to request user and normalize response payload`

---

### M2 — Data Integrity and DayKey Correctness
**Goal / outcome**
- Enforce canonical invariants at DB/API boundaries to prevent silent drift and duplicate data.

**Exact tasks**
1. Add unique active index on `habitEntries` for `(userId, habitId, dayKey)` with soft-delete-aware strategy.
2. Replace read-then-insert upsert with atomic upsert for habit entries.
3. Make default day range derivation timezone-aware in `daySummary`.
4. Reduce/retire silent UTC fallback in write paths that derive DayKey from timestamp.
5. Add integrity repair script for existing duplicate active entries.

**Files likely touched**
- `src/server/lib/mongoClient.ts`
- `src/server/repositories/habitEntryRepository.ts`
- `src/server/routes/daySummary.ts`
- `src/server/utils/dayKeyNormalization.ts`
- `src/server/routes/habitEntries.ts`
- `scripts/` (new one-off duplicate repair script)

**Verification steps**
1. Run tests:
   - `npm run test:run -- src/server/routes/__tests__/habitEntries.dayKey.test.ts`
   - `npm run test:run -- src/server/routes/__tests__/habitEntries.validation.test.ts`
   - `npm run test:run -- src/server/routes/__tests__/daySummary.test.ts`
2. Add/execute new tests:
   - concurrent upsert collision test for `(habitId, dayKey)`
   - DST boundary test for user timezones (`America/New_York`, `America/Los_Angeles`)
3. Run integrity report before/after migration:
   - `GET /api/admin/integrity-report` (after auth hardening in M4)

**Suggested commit boundaries**
1. `feat(db): enforce unique active habit-entry key`
2. `fix(entries): atomic upsert keyed by user+habit+dayKey`
3. `fix(daykey): timezone-aware daySummary defaults and stricter normalization`
4. `chore(migration): add duplicate-entry repair utility`

---

### M3 — Logging UX Friction Removal (Desktop + iPhone/PWA)
**Goal / outcome**
- Make daily logging fast and obvious on touch and desktop without adding V2 complexity.

**Exact tasks**
1. Replace double-click delete behavior in tracker with explicit one-tap affordance (e.g., inline clear button/context menu).
2. Remove delayed single-click logic that causes mobile misfires.
3. Complete day-view choice bundle completion rendering (remove TODO path).
4. Add immediate feedback/undo after log actions.
5. Route Task and Routine evidence calls through shared API client for consistent identity and errors.

**Files likely touched**
- `src/components/TrackerGrid.tsx`
- `src/components/day-view/DayCategorySection.tsx`
- `src/store/HabitContext.tsx`
- `src/context/TaskContext.tsx`
- `src/store/RoutineContext.tsx`
- `src/lib/persistenceClient.ts`

**Verification steps**
1. Run tests:
   - `npm run test:run -- src/components/TrackerGrid.doubleClickDelete.test.tsx`
2. Add/execute new UI tests:
   - single tap logs entry on touch simulation
   - explicit clear action deletes without double-click requirement
   - day-view choice bundle reflects selected option from entries/dayView data
3. Manual iPhone/PWA smoke:
   - Today logging path (log, undo, delete) with no accidental multi-tap behavior.

**Suggested commit boundaries**
1. `fix(tracker): replace double-click delete with explicit clear action`
2. `fix(day-view): wire choice bundle completion from entry state`
3. `refactor(client): centralize task/routine API calls in persistence client`
4. `feat(ui): add post-log feedback and undo action`

---

### M4 — Security and Operational Hardening
**Goal / outcome**
- Move server from dev-trust model toward safe V1 production posture.

**Exact tasks**
1. Reject missing/invalid identity in production; keep anonymous fallback dev-only.
2. Restrict CORS origins by environment allowlist.
3. Protect admin routes (`/api/admin/*`) with explicit admin auth/token middleware.
4. Harden upload acceptance (goal badges: JPEG/PNG/WebP only, byte-signature checks).
5. Add request-id + structured API logging and minimal rate limiting on mutation-heavy routes.

**Files likely touched**
- `src/server/middleware/auth.ts`
- `src/server/index.ts`
- `src/server/routes/goals.ts`
- `src/server/utils/fileStorage.ts`
- `src/server/routes/admin.ts`
- `src/server/middleware/` (new admin guard + request-id middleware)

**Verification steps**
1. Add/execute API auth contract tests:
   - missing identity => `401` in production mode
   - invalid admin token => `403` on admin routes
2. Run regression suite:
   - `npm run test:run -- src/server/routes/__tests__`
3. Manual checks:
   - CORS denies unapproved origin in production config
   - uploads reject `image/svg+xml` and oversized payloads.

**Suggested commit boundaries**
1. `feat(auth): enforce identity validation in production`
2. `chore(server): add CORS allowlist and admin route guard`
3. `fix(uploads): strict image validation for goal badges`
4. `chore(observability): add request-id and structured API logs`

---

### M5 — Legacy Removal and Cleanup
**Goal / outcome**
- Remove migration-era dead paths after M1-M4 verification passes.

**Exact tasks**
1. Remove DayLog public read endpoints from active client paths.
2. Delete legacy goal progress utility path and manual-log repository/routes.
3. Remove duplicate schema declarations and dead helper branches (`freezeHabit` orphan client call).

**Files likely touched**
- `src/server/routes/dayLogs.ts`
- `src/server/utils/goalProgressUtils.ts`
- `src/server/repositories/goalManualLogRepository.ts`
- `src/models/persistenceTypes.ts`
- `src/lib/persistenceClient.ts`

**Verification steps**
1. Full regression:
   - `npm run test:run`
2. Invariants scan:
   - `npm run check:invariants`
3. Manual smoke:
   - Today logging, Goals detail, Dashboard streaks, Routine submit.

**Suggested commit boundaries**
1. `chore(legacy): remove dayLogs API from user-facing flow`
2. `chore(goals): remove manual-log persistence path`
3. `chore(types): collapse duplicate persistence schema definitions`
4. `fix(client): remove dead freezeHabit endpoint call`

## Backlog (Not V1)
1. Personas as adaptive UX layer (selection logic, persona-specific copy/flows).
2. Psychological safety / coaching safeguards beyond basic neutral UX messaging.
3. Advanced interpretive analytics beyond basic dashboards (predictive coaching, semantic narrative layers, autonomous recommendations).
