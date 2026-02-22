# Domain Canon

This file intentionally summarizes canonical invariants and points to source documents.
It does not replace the canonical references.

## Canonical References

- `docs/reference/V1/00_NORTHSTAR.md` (HabitFlow Canonical Vocabulary)
- `docs/reference/iOS release V1/Feature_Prioritization.md` (HabitFlow iOS Feature Spec v1)
- `docs/reference/V1/02_HABIT_ENTRY.md`
- `docs/reference/V1/11_TIME_DAYKEY.md`
- `docs/reference/V2 (Current - iOS focus)/00_Northstar.md`

## Minimal Invariants (Enforced in Code)

1. Behavioral truth is `HabitEntry` only.
- Completion/progress are derived, never canonical stored truth.

2. DayKey is the aggregation boundary.
- `dayKey` (`YYYY-MM-DD`) is required for habit aggregation windows.

3. Routines and journals do not imply behavioral completion.
- Routines can provide support/evidence only.
- Journals are reflective truth, not behavioral truth.

4. Derived metrics are recomputable.
- Streaks, momentum, percentages, and charts are read-model outputs.

## Code Anchors

- Validators: `src/server/domain/canonicalValidators.ts`
- DayKey utilities: `src/domain/time/dayKey.ts`
- HabitEntry write/read routes: `src/server/routes/habitEntries.ts`
- Canonical types: `src/server/domain/canonicalTypes.ts`
- HabitEntry repository guardrails: `src/server/repositories/habitEntryRepository.ts`
