# Milestone 1: Canonical Truth Lock — Entries-only everywhere

Makes **HabitEntries** the **only behavioral truth** for all V1 reads. Manual goal logs are deprecated (410). Evidence endpoints are user-scoped with a consistent API contract.

---

## Truth Sources Checklist

- [x] Day view derives from HabitEntries (via `dayViewService.ts` → `truthQuery.getEntryViewsForHabits`)
- [x] Progress overview derives from HabitEntries (via `progress.ts` + `computeGoalsWithProgressV2`)
- [x] Goal progress/detail derives from HabitEntries (via `computeGoalProgressV2` → `truthQuery`)
- [x] No manual logs counted (manual log values ignored in V2 computation)
- [x] Evidence endpoints use request identity (not hardcoded `anonymous-user`)

---

## Key File Paths Touched

| File | Change |
|------|--------|
| `src/server/services/truthQuery.ts` | Added `assertNoLegacyMerge` guard; throws in dev when legacy merge attempted without flag |
| `src/server/routes/goals.ts` | Goal detail uses V2; `createGoalManualLogRoute` returns 410 |
| `src/server/utils/goalProgressUtilsV2.ts` | Removed manual log fetch/counting |
| `src/server/routes/habitPotentialEvidence.ts` | Use `req.userId`; return `{ evidence: [...] }` envelope |
| `src/pages/goals/GoalDetailPage.tsx` | Removed "Add Contribution" section + manual progress modal |
| `src/lib/persistenceClient.ts` | Handle 410 Gone in `apiRequest` |
| `src/store/RoutineContext.tsx` | Add `X-User-Id` header to evidence fetch |

---

## Verification

```bash
npx vitest run src/server/services/truthQuery.test.ts src/server/utils/goalProgressUtilsV2.test.ts src/server/routes/__tests__/milestoneA.integration.test.ts src/server/routes/__tests__/entriesOnly.invariants.test.ts src/server/routes/__tests__/goals.entriesDerived.test.ts src/server/routes/__tests__/evidence.userScoping.test.ts src/server/routes/__tests__/goals.create.test.ts src/server/routes/__tests__/progress.overview.test.ts src/server/services/dayViewService.unit.test.ts src/server/services/dayViewService.test.ts
```

**Result:** 10 test files, 56 tests passed.

---

## Commits (in order)

1. `refactor(truth): default derived reads to HabitEntries only`
2. `fix(goals): goal detail/progress uses entries-derived computation`
3. `deprecate(goals): disable manual goal logs (410) + remove UI hooks`
4. `fix(evidence): correct contract + enforce user scoping`
5. `test(goals): add regression tests for entries-derived goals`

---

## Known Follow-ups

- Legacy DayLog routes still registered — cleanup in M2
- `GoalManualProgressModal.tsx` still exists (frequency mode works); cumulative branch removed from page
- `computeGoalProgress` (V1) in `goalProgressUtils.ts` unused; safe to remove in M2
- Some pre-existing test failures in unrelated areas (TrackerGrid, habitEntries.dayKey, etc.) — not caused by this PR
