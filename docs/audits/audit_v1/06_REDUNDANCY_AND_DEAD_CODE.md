# Redundancy and Dead Code Audit

## Duplicate / Parallel Implementations
| Area | Redundant paths | Evidence | Risk |
| --- | --- | --- | --- |
| Behavioral history reads | truthQuery + direct DayLog legacy | `src/server/services/truthQuery.ts` merges legacy fallback; `/api/dayLogs` still exposed (`src/server/routes/dayLogs.ts`) | Two read truths keep migration permanently incomplete. |
| Goal progress computation | V1 + V2 utilities coexist | `computeGoalProgress` (`src/server/utils/goalProgressUtils.ts`) and `computeGoalProgressV2` (`src/server/utils/goalProgressUtilsV2.ts`) both active; goal detail uses old path | Inconsistent numbers between goal endpoints/views. |
| Goal detail data sources | `/api/goals/:id/progress` vs `/api/goals/:id/detail` | Progress endpoint uses V2; detail endpoint uses DayLogs/manual logs | Same goal can report different derived progress. |
| Wellbeing storage | `wellbeingLogs` + `wellbeingEntries` | Both routes active (`src/server/routes/wellbeingLogs.ts`, `src/server/routes/wellbeingEntries.ts`) with compatibility adapter writes | Data model drift and doubled migration burden. |
| Persona UI controls | User menu persona selector + persona switcher component | `src/components/Layout.tsx` and `src/components/personas/PersonaSwitcher.tsx` | Duplicated UX controls and extra polling. |
| Client identity access | shared `apiRequest` vs raw `fetch` in contexts | `src/lib/persistenceClient.ts` vs `src/context/TaskContext.tsx`, `src/store/RoutineContext.tsx` | Auth/header inconsistency across feature surfaces. |
| Type schema declarations | `PersistenceSchema` declared twice | `src/models/persistenceTypes.ts:1005` and `:1176` | Type drift/confusion for persistence contracts. |

## Partially Implemented Features
| Feature | Partial state | Evidence | User-facing result |
| --- | --- | --- | --- |
| Day view choice bundle state | Placeholder TODO | `src/components/day-view/DayCategorySection.tsx:141-143` | Choice selections may not reflect actual entry state in day view. |
| Goals progress tab in UI | Placeholder copy only | `src/pages/goals/GoalsPage.tsx:305-310` | Feature appears selectable but not implemented. |
| Routine execution context machine | Declared but not integrated | `src/store/RoutineContext.tsx` execution APIs are not called by current runner/list flows | Dead complexity + unused side effects (evidence post). |
| Habit freeze client API | Client helper exists, no backend route | `src/lib/persistenceClient.ts:413-418`, no matching handler in `src/server/routes/habits.ts` | Dead API branch / potential runtime 404s. |

## Dead or Migration-Only Candidates
- `src/server/routes/dayLogs.ts`
- `src/server/repositories/dayLogRepository.ts` (after full entries-first cutover)
- `src/server/utils/goalProgressUtils.ts` (legacy DayLog/manual-based goal calc)
- `src/server/repositories/goalManualLogRepository.ts` + manual log routes (after migration to entry-based corrections)
- `src/components/personas/PersonaSwitcher.tsx` (if Layout user menu remains canonical persona control)
- Root one-off helper scripts likely historical (`clean_tracker_grid.py`, `fix_tracker_grid.py`, etc.)

## Deletion Plan (Dependency-Aware)

### Phase D1 — Safe deprecations (no behavior change)
1. Mark old goal progress utility as legacy-only in code comments and route usage map.
2. Add telemetry warnings on DayLog API reads and truthQuery legacy merge invocations.
3. Remove unreachable client helper `freezeHabit()` or implement the backend route.

### Phase D2 — Canonical cutover
1. Flip truthQuery default to no legacy fallback.
2. Repoint `GET /api/goals/:id/detail` to V2 progress path.
3. Disable manual-log routes for new writes.

### Phase D3 — Physical removals
1. Remove `/api/dayLogs` read routes once tracker/day views are fully entries-based.
2. Delete legacy `goalProgressUtils.ts` and manual-log repository/routes after migration.
3. Collapse duplicate `PersistenceSchema` declaration to one canonical type.

## Post-Deletion Verification Checklist
- `grep` confirms no route handler imports from removed modules.
- Integration tests for `daySummary`, `dayView`, `goals/:id/detail`, `goals-with-progress` all pass with DayLog/manual paths disabled.
- UI smoke checks: tracker toggle, day view choice selection, goal detail charts, routines submit flow.
