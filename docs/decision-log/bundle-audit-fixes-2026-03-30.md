# Bundle Audit Fixes — Concrete Problem Descriptions

**Status:** In Progress
**Date:** 2026-03-30
**Related:** `docs/BUNDLE_AUDIT_2026-03-30.md`

## Background

A habit "bundle" is a parent habit that groups child habits. There are two types:

- **Checklist bundle** — e.g., "Morning Routine" with children "Brush teeth", "Meditate", "Stretch". The parent is "done" when enough children are done (configurable: all, any, N, or X%).
- **Choice bundle** — e.g., "Exercise" with children "Run", "Swim", "Bike". The parent is "done" when at least one child is done.

The key rule: **parent completion is always derived from children's entries — never stored directly.**

---

## Problem 1 (Critical): Grid writes entries on the parent instead of the child

### What happens today

Suppose you have a **choice bundle** called "Exercise" with children "Run" and "Swim".

**In Today view:** Clicking "Run" creates an entry for the "Run" habit. The server sees that "Run" is a child of "Exercise" and derives that "Exercise" is complete. Correct.

**In Grid view:** Clicking "Run" creates an entry on the **"Exercise" parent** habit with a field saying `choiceChildHabitId: "run-id"`. This is wrong — it writes to the parent, not the child.

This causes two problems:
1. The Grid and Today view store data differently for the same action, so switching views can show different completion states.
2. The parent upsert key is `(habitId, dayKey)`, meaning only one entry per parent per day. If you pick "Run" then pick "Swim", the second overwrites the first instead of adding to it.

**For checklist bundles:** Clicking the parent "Morning Routine" in the Grid creates a single entry on the parent (as if it were a regular habit). It should instead mark all children complete.

### Fix

- Grid choice children: Write entries to the **child** habit (like Today view does).
- Grid checklist parent click: Batch-toggle all children (mark them all done, or all undone if already complete).
- Grid cell rendering: Read completion from `logs[childId-date]` instead of `parentLog.completedOptions[childId]`.

### Files

- `src/components/TrackerGrid.tsx` — handleCellClick, handleBundleClick, cell rendering

---

## Problem 2 (High): Today view overrides the server's bundle completion answer

### What happens today

When Today view loads, it asks the server: "What's the status of each habit for today?" The server uses temporal membership records and the checklist success rule to compute the correct answer.

But then the client **recomputes** the parent's completion status using:
- The static `subHabitIds` list (ignores membership history)
- Hardcoded "all children must be done" logic for checklists (ignores the configurable success rule)

Example: You have "Morning Routine" with a success rule of `type: 'any'` (parent is done if any child is done). You complete "Brush teeth". The server says "Morning Routine" is complete. But the client recomputes and says "only 1 of 3 done → incomplete", overriding the server.

### Fix

Remove the client-side bundle parent recomputation. Trust the server's answer for parent completion. Only merge optimistic updates for the specific child that was just toggled, then refetch to reconcile the parent.

### Files

- `src/components/day-view/DayView.tsx` — `resolvedHabitStatusMap` memo (lines ~200-224)

---

## Problem 3 (High): Editing a bundle's children doesn't update the membership timeline

### What happens today

The app tracks which children belong to a bundle over time using `BundleMembership` records (e.g., "Run was part of Exercise from Jan 1 to Mar 15"). This is used for historical accuracy — if you view a past day, it knows which children were active then.

But when you edit a bundle in the Add Habit modal (add or remove a child), only the static `subHabitIds` array and `bundleParentId` field are updated. No membership record is created or ended.

Example: On March 30 you add "Yoga" to your "Exercise" bundle. The `subHabitIds` array now includes "Yoga". But there's no membership record saying "Yoga joined on March 30". If the server tries to compute what "Exercise" looked like on March 1, the membership-based path finds nothing for Yoga (correct), but the fallback to `subHabitIds` includes Yoga (incorrect — it wasn't a member then).

### Fix

When linking a child in the modal, also call `POST /api/bundle-memberships` with `activeFromDayKey: today`. When unlinking, find the active membership and call `PATCH /api/bundle-memberships/:id/end` with `activeToDayKey: today`.

### Files

- `src/components/AddHabitModal.tsx` — link/unlink flow (lines ~263-303)
- `src/lib/persistenceClient.ts` — add membership API client functions

---

## Problem 4 (High): Dashboard/rings use daySummary, which doesn't compute bundle parent status

### What happens today

The Dashboard rings show daily completion progress. They get data from the `/api/daySummary` endpoint. But daySummary only aggregates individual habit entries — it doesn't derive bundle parent completion from children.

Example: "Morning Routine" has 3 children, all marked done. Each child has an entry. But "Morning Routine" itself has no entry (parent completion is derived, not stored). DaySummary returns no log for "Morning Routine", so the ring shows it as incomplete even though all children are done.

### Fix

After aggregating entries in daySummary, identify bundle parents and derive their completion from children's entries, using the same logic as dayViewService (membership-based child resolution + success rule evaluation).

### Files

- `src/server/routes/daySummary.ts`

---

## Problem 5 (Medium): Rapid taps in Today view can cause stale UI

### What happens today

In the Today view's DayCategorySection, when you tap a choice option or clear a numeric value, the mutation call is fire-and-forget (no `await`). If you tap quickly:

1. Tap "Run" → starts creating entry (not awaited)
2. Tap "Swim" → starts creating entry while first is still in-flight
3. Both resolve, but the UI may show stale state because neither waited for the other

### Fix

Add `await` to all mutation calls. Add a `pending` flag to disable the controls while a mutation is in-flight.

### Files

- `src/components/day-view/DayCategorySection.tsx` — onChoiceSelect, onSubHabitToggle, numeric handlers

---

## Problem 6 (Medium): `computeBundleStatus` ignores the checklist success rule

### What happens today

The client utility `computeBundleStatus()` in habitUtils.ts always uses "all children must be complete" logic for checklist bundles. But bundles can have a `checklistSuccessRule` like `{ type: 'any' }` or `{ type: 'threshold', threshold: 2 }`.

Example: "Morning Routine" has `checklistSuccessRule: { type: 'threshold', threshold: 2 }` and 4 children. You complete 2 of 4. The server says "done" (2 meets the threshold). But Grid and Dashboard rings use `computeBundleStatus` which says "not done" (2 !== 4).

### Fix

Use `evaluateChecklistSuccess()` from `src/shared/checklistSuccessRule.ts` in both `computeBundleStatus` and `getBundleStats`.

### Files

- `src/utils/habitUtils.ts`

---

## Problem 7 (Medium): Deleting a bundle child is multi-step with no rollback

### What happens today

Removing a child from a bundle requires multiple sequential API calls:
1. Update parent's `subHabitIds` (remove child)
2. Update child's `bundleParentId` to null
3. End the membership record

If step 2 or 3 fails, you end up with orphaned state (child still thinks it belongs to the parent, or membership still active).

### Fix

Create a server-side endpoint that handles all three steps atomically.

### Files

- New route in `src/server/routes/` or enhancement to existing habit routes
