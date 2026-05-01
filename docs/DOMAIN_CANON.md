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
- Goal milestone *completion* is derived in `computeMilestoneStates` (`src/server/utils/goalProgressUtilsV2.ts`). Only milestone configuration (id, value) and `acknowledgedAt` are stored on `Goal.milestones`.

## Bundle Identity Model

HabitFlow distinguishes between **identity**, **specificity**, and **direction**:

- **Identity** is the long-term habit (parent bundle habit, e.g., "Study daily")
- **Specificity** is the current focus (child/segment habit, e.g., "Study GRE")
- **Direction** is the outcome (goal, e.g., "Pass GRE")

The system is designed so identity can persist while specificity and direction evolve over time.

### Vocabulary

- **Parent Habit (Bundle Parent):** The long-term identity habit that persists over time. Completion is derived from its children.
- **Child Habit (Bundle Child / Segment Habit):** A time-bound habit that belongs to a parent bundle during a specific period (Bundle Membership Period).
- **Bundle Membership Period:** The time range (`activeFromDayKey` to `activeToDayKey`) during which a child habit contributes to a parent bundle's completion.
- **Checklist Bundle:** A bundle where completion is determined by how many of the scheduled child habits were completed on a given day, evaluated against a configurable success rule.
- **Scheduled Checklist Item:** A checklist child habit that only appears on specific days of the week (`daysOfWeek` on the membership record).
- **Success Rule:** The rule that determines whether a checklist bundle is considered successful on a given day. Types: `any` (>=1), `threshold` (>=N), `percent` (>=N%), `full` (all).
- **Graduated Habit:** A habit that was previously part of a checklist bundle but was removed because the behavior became automatic. Graduated habits remain in historical analytics but no longer appear in the active checklist. Graduation is a success outcome tracked via `graduatedAt` on the membership.
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

### Example — Evolving Chores Checklist

- **Parent Habit:** Chores (checklist bundle, success rule: `full`)
- **Checklist Items Over Time:**
  - Vacuum (weekends only, `daysOfWeek: [0, 6]`)
  - Trash (daily)
  - Laundry (Wednesday, `daysOfWeek: [3]`)
  - Make Bed (daily) — **graduated** in April (behavior became automatic)

**Behavior:**
- March 10 (all 4 completed) → 4/4 fully complete
- April 10 (all 3 scheduled completed) → 3/3 fully complete
- Removing "Make Bed" does NOT change March history — March remains 4/4
- Monday denominator = 2 (Trash + Make Bed), Saturday denominator = 3 (Trash + Make Bed + Vacuum)
- Graduation of "Make Bed" is tracked as a success metric

### Checklist Bundle Philosophy

Checklist bundles represent routines whose standards can evolve over time.
The system evaluates each day based only on the checklist items that were active and scheduled on that day.
Removing or graduating a checklist item does not change past completion.
Success is determined by a configurable rule, allowing users to define what "good enough" means.
Graduation is considered a success outcome and is tracked as a measure of lasting behavior change.

## Code Anchors

- Validators: `src/server/domain/canonicalValidators.ts`
- DayKey utilities: `src/domain/time/dayKey.ts`
- HabitEntry write/read routes: `src/server/routes/habitEntries.ts`
- Canonical types: `src/server/domain/canonicalTypes.ts`
- HabitEntry repository guardrails: `src/server/repositories/habitEntryRepository.ts`
