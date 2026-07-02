# M2 Cleanup (Legacy Removal)

Follow-up cleanup after Milestone 2 data-integrity work. Reduces drift and removes legacy paths that could reintroduce bad data.

## Removed

### V1 goal progress (goalProgressUtils.ts)

- **What:** Entire `src/server/utils/goalProgressUtils.ts` (V1) removed.
- **Why:** V1 computed goal progress from DayLogs. All production paths use `goalProgressUtilsV2`, which uses truthQuery (HabitEntry/EntryView). The only remaining consumer was `skillTreeService`, which now uses `computeGoalProgressV2` with the canonical default timezone.
- **History:** File deleted; git history preserved.

### Legacy DayLog route behavior in production

- **What:** `GET /api/dayLogs` and `GET /api/dayLogs/:habitId/:date` now return **410 Gone** when `NODE_ENV === 'production'`.
- **Why:** DayLogs are derived caches; source of truth is HabitEntries. Exposing DayLog reads in prod encourages clients to treat them as truth. In dev, GET still works for debugging.
- **Unchanged:** POST/PUT/DELETE on `/api/dayLogs` already returned 410; no direct DayLog writes by clients. Server-side `recomputeDayLogForHabit()` still updates the dayLogs collection as a cache after HabitEntry mutations (not as behavioral truth).

## Not removed (by design)

- **GoalManualProgressModal:** Still reachable from GoalsPage; left in place. Manual goal logs are deprecated but the UI branch was not removed.
- **DayLog repository and recompute:** Repository and `recomputeDayLogForHabit()` remain so that existing HabitEntry write paths can keep the dayLogs cache in sync until a future migration drops the cache entirely.
- **fetchDayLogs (client):** Still defined in `persistenceClient.ts` but not referenced elsewhere; calling it in prod would now receive 410 from the server.

## Verification

- `npx vitest run src/server/services/skillTreeService.test.ts src/server/routes/__tests__/dayLogs.deprecated.test.ts src/server/utils/goalProgressUtilsV2.test.ts src/server/routes/__tests__/progress.overview.test.ts` — all pass.
- Full suite (`npx vitest run`) was run; some pre-existing failures remain in other test files (e.g. TrackerGrid double-click toast provider, persona regression, entriesOnly HTTP parse). This cleanup does not introduce new failures.
