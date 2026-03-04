# M6 Dead Code Removed

Summary of unused and dead code removed during M6 cleanup. No behavior changes; removal only.

---

## Removed in this pass (chore(cleanup) commit)

### Client (persistenceClient.ts)

| Item | Reason |
|------|--------|
| **freezeHabit(id, date)** | No backend route exists (`POST /api/habits/:id/freeze` never implemented). Call would always 404. Not referenced anywhere in app or tests. |
| **fetchDayLogs(habitId?)** | `/api/dayLogs` routes were removed in M6; this client helper would 404. App uses `fetchDaySummary` only. Not referenced anywhere. |

### V1 goal progress

- **goalProgressUtils.ts** (V1) was already removed in M2. Only **goalProgressUtilsV2.ts** exists and is in use. No further action.

---

## Previously removed in M6 (earlier commits)

- DayLogs routes, repository, truthQuery legacy merge, LEGACY_DAYLOG_READS, recomputeUtils DayLog writes, migrationUtils backfill.
- Manual goal log routes, goalManualLogRepository, GoalManualProgressModal, createGoalManualLog, onAddManualProgress UI.

---

## Optional follow-up (not changed in this commit)

| Item | Note |
|------|------|
| **scripts/compare-legacy-vs-canonical.ts** | Toggles `LEGACY_DAYLOG_READS`; that flag and legacy merge are gone. Script is obsolete; can be removed or repurposed. |
| **src/utils/legacyReadWarning.ts** | `warnLegacyDayLogRead` / `warnLegacyGoalProgressRead` are now redundant (no DayLog reads). `warnLegacyCompletionRead` still used by DayCategorySection; keep or simplify as needed. |
| **Duplicate PersistenceSchema** | Audit v1 noted duplicate declaration in persistenceTypes; left for a dedicated refactor. |

---

### Unused imports (from earlier M6 manual-log removal)

- **GoalCard.tsx** – Removed unused `Plus` import (manual progress button was removed).
- **GoalGridCard.tsx** – Removed unused `Plus` import.

---

## Verification

- **Targeted vitest:** `goals.entriesDerived`, `milestoneA.integration`, `goalProgressUtilsV2` — all pass.
- **Full build:** `npm run build` has pre-existing TS errors elsewhere (unused vars, categoryRepository test arity, etc.); this cleanup does not add new ones.
