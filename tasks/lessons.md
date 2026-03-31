# Lessons Learned

## Habit Archiving Data Loss Pattern (2026-03-30)

**Problem**: `uncategorizeHabitsByCategory()` cleared `archivedReason` via `$unset` but did NOT set `archived: false`. This left habits permanently invisible — they had `archived: true` with no `archivedReason`, so the recovery function (`recoverCategoryDeletedHabits`) couldn't find them.

**Pattern**: When clearing a "reason" field for a state, always also clear the state itself. Don't `$unset` the reason without also `$set`-ting the status flag.

**Fix**: `uncategorizeHabitsByCategory` now explicitly sets `archived: false` alongside clearing `archivedReason`.

## Ghost References on Entity Deletion

**Problem**: Deleting a goal left `linkedGoalId` on habits pointing to a nonexistent goal. No cascade cleanup existed.

**Pattern**: When deleting an entity, clean up references from related entities. Follow the category deletion pattern (which calls `uncategorizeHabitsByCategory` before deleting the category).

## Inconsistent Archived Filtering

**Problem**: `EditGoalModal` displayed ALL habits (no `archived` filter) while every other view filtered with `!h.archived`. This made archived habits visible only in the goal modal, confusing users.

**Pattern**: Always filter `!h.archived` when displaying habits. If a component uses `habits` from the store, apply the archived filter consistently.
