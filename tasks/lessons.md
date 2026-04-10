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

## "Workarounds" That Destroy Data (2026-04-10)

**Problem**: `EditGoalModal` had a comment-labeled "FIX FOR GHOST HABIT IDs" that stripped any linkedHabitId not present in the active habits list before saving. It existed to work around a backend `validateHabitIdsExist` that rejected any save whose `linkedHabitIds` contained a now-deleted habit. The workaround quietly erased historical progress contributions from deleted habits — the EXACT opposite of the documented invariant ("entries from deleted habits are preserved so goal progress still includes historical contributions" — see `deleteHabitRoute` and `computeGoalProgressV2`). Every edit of a tracked goal silently dropped preserved history.

**Pattern**: When a client-side workaround exists to sidestep a backend validation error, treat it as a symptom, not a fix. Ask: *what invariant is the validator protecting, and does stripping data to appease it violate a different invariant?* The correct fix was in the backend — only validate NEWLY-added IDs, allow pre-existing stale IDs to persist.

## Category Gate on Unchanged Values (2026-04-10)

**Problem**: The tracked-goal category gate rejected any PATCH whose body contained `categoryId` on a goal belonging to a track, without comparing the new value to the existing one. The Edit Goal modal always re-sent `categoryId` on every save — so every edit to a tracked goal (title, description, linked habits, deadline) tripped a "Cannot change category of a goal that belongs to a track" error. Users could not edit tracked goals at all.

**Pattern**: Immutability gates in PATCH handlers must compare the new value to the existing value before rejecting. `!== undefined` tells you the field is *present* in the patch, not that it's *changing*. Fetch the existing row, compute `if (existing.x !== patch.x)`, then gate.

## Bidirectional Sync That Breaks Many-to-Many (2026-04-10)

**Problem**: `Goal.linkedHabitIds` supports many-to-many (one habit contributing to many goals — the core workflow behind Goal Tracks), but `Habit.linkedGoalId` is singular. The sync helpers `linkHabitsToGoal` / `unlinkHabitsFromGoal` treated the singular side as authoritative: linking a shared habit to a second goal overwrote `linkedGoalId`, and removing a shared habit from any goal cleared `linkedGoalId` wholesale — even if other goals still referenced the habit. Progress math was unaffected (it uses `linkedHabitIds`), but the "primary goal" UI hint lied to users.

**Pattern**: When the authoritative relationship is many-to-many (array on one side) but there's also a singular denormalized "primary" hint on the other side, the sync helpers MUST consult BOTH sides. When setting: only update if the current value is missing or stale. When clearing: only clear if no other owner still references it; otherwise switch to a remaining owner. A blind `updateMany({ linkedX: oldId }, { $unset })` is a silent multi-tenant bug.
