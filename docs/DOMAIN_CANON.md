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

## Bundle Identity Model

HabitFlow distinguishes between **identity**, **specificity**, and **direction**:

- **Identity** is the long-term habit (parent bundle habit, e.g., "Study daily")
- **Specificity** is the current focus (child/segment habit, e.g., "Study GRE")
- **Direction** is the outcome (goal, e.g., "Pass GRE")

The system is designed so identity can persist while specificity and direction evolve over time.

### Vocabulary

- **Parent Habit (Choice Bundle Parent):** The long-term identity habit that persists over time. Completion is derived from its children.
- **Child Habit (Bundle Child / Segment Habit):** A time-bound habit that belongs to a parent bundle during a specific period (Bundle Membership Period).
- **Bundle Membership Period:** The time range (`activeFromDayKey` to `activeToDayKey`) during which a child habit contributes to a parent bundle's completion.
- **Archived Child Habit:** A child habit that is no longer active but still contributes to historical bundle analytics.

### Example — Study Habit Over Time

- **Parent Habit:** Study Daily
- **Child Habits Over Time:**
  - Study GRE (Jan–Mar) → Goal: Pass GRE
  - Study Linear Algebra (Mar–Jun) → Goal: Finish Course
  - Study Machine Learning (Jun–Present) → Goal: Build ML Portfolio

**Behavior:**
- The Study Daily streak continues across all topics
- Each topic has its own streak and analytics
- The parent habit aggregates all study activity
- Removing "Study GRE" does not remove past study history
- Analytics show study activity by topic over time

## Code Anchors

- Validators: `src/server/domain/canonicalValidators.ts`
- DayKey utilities: `src/domain/time/dayKey.ts`
- HabitEntry write/read routes: `src/server/routes/habitEntries.ts`
- Canonical types: `src/server/domain/canonicalTypes.ts`
- HabitEntry repository guardrails: `src/server/repositories/habitEntryRepository.ts`
