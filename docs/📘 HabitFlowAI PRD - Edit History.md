# PRD: Editable Habit History (Daily & Weekly)

## Status

**Proposed → Ready for Implementation**

## Problem Statement

Users need the ability to **edit and delete historical habit data**. Currently:

* Weekly habits have no obvious editable entry point.
* Accidental test entries (e.g., `+50 pull-ups`) cannot be removed.
* Users cannot retroactively log or correct daily habits.
* Goals that aggregate habit data (e.g., “500 Pull Ups”) become permanently skewed by mistakes.

Without editability, the system loses **trust**, especially for power users and during onboarding/testing.

---

## Goals & Success Criteria

### Primary Goals

1. Allow users to **edit and delete habit history** for both daily and weekly habits.
2. Ensure **goals, streaks, momentum, and analytics recompute correctly** after edits.
3. Prevent accidental retroactive changes through **intentional friction**.

### Success Criteria

* Users can remove or correct any habit entry.
* Weekly habits expose their underlying entries.
* Editing past data clearly communicates impact.
* No “dead data” permanently pollutes goals.
* No silent changes to streaks or momentum.

---

## Non-Goals

* Full audit log UI (soft-delete only for now)
* Bulk CSV import/export
* Unlimited historical backfill by default
* Editing system-generated analytics directly

---

## Core Concept: Entries as Source of Truth

All habit progress is derived from **Habit Entries**.

> **There is no such thing as an uneditable completion — only entries.**

This applies equally to:

* Daily binary habits
* Metric habits (e.g., pull-ups)
* Weekly quota habits
* Habits completed via routines/activities

---

## Data Model

### HabitEntry (New / Canonical)

```
HabitEntry
- id
- habitId
- timestamp (UTC, normalized to user TZ)
- value (number | null) // null or 1 for binary habits
- source: manual | routine | quick | import | test
- activityId? (if created via routine)
- note?
- deletedAt?
```

### Derived (Computed)

* Daily completion state
* Weekly quota progress
* Streaks
* Momentum
* Linked goal progress

⚠️ **Nothing derived is stored permanently** — everything recomputes from entries.

---

## Feature Overview

### 1. Habit History Modal (Primary UX)

A unified modal for **viewing, editing, and deleting entries**.

#### Entry Points

* Habit row → “View history”
* Weekly habit row → “View week history”
* (Optional) Goal detail → “View contributing entries”

#### Modal Structure

**Header**

* Habit name
* Habit type (Daily / Weekly / Metric)
* Linked goals (read-only badges)

**Tabs**

* **Log** (required)
* **Calendar** (future enhancement)

#### Log View

Each row shows:

* Date (and time if applicable)
* Value (if numeric)
* Source (manual / routine / quick)
* Actions: **Edit** | **Delete**

---

### 2. Weekly Habit History (Critical Fix)

Weekly habits **must expose underlying entries**, not just totals.

#### Week-Based View

* Collapsible rows:

  * “Week of Dec 8–14: 1 / 3”
* Expanding a week reveals:

  * Individual entries (e.g., “+50 pull-ups on Dec 12”)

This allows:

* Deleting accidental test entries
* Editing values without breaking weekly logic

---

### 3. Editing & Deleting Entries

#### Edit Entry

* Change date
* Change value
* Change note (optional)

#### Delete Entry

* Soft delete (`deletedAt`)
* Immediate recomputation of:

  * Habit completion
  * Weekly quota totals
  * Streaks
  * Momentum
  * Linked goals

---

## Retrospective Entry Guardrails

### Past-Date Edit Confirmation Modal

Triggered when:

* Editing an entry in the past
* Creating a new entry on a past date

**Modal Copy**

* Title: “Edit past data?”
* Body: “This will affect streaks, momentum, and linked goals.”
* Checkbox (required): “I meant to change a past date”
* Optional dropdown: Reason

  * Correction
  * Backfill
  * Testing
  * Import
* Actions: Cancel / Confirm

### Default Backfill Limits

* Allowed window: **last 7–30 days** (configurable)
* Older dates require enabling “Allow deep backfill” in Settings

---

## Goal Impact Awareness

When editing or deleting an entry that contributes to a goal:

* Show preview:

  * “500 Pull Ups will change from 320 → 270”
* Stronger confirmation language

---

## Recompute Rules (Must-Have)

Any entry mutation triggers recomputation of:

1. Habit daily state
2. Weekly quota progress
3. Habit streak
4. Category momentum
5. Global momentum
6. All linked goals

Recomputation must be **idempotent** and **fast**.

---

## Optional (High-Value) Enhancements

### Testing Mode (Dev / Beta)

* Entries can be marked `source = test`
* Goals exclude test data by default
* Toggle: “Include test data”

### Undo Delete (Future)

* Restore soft-deleted entries within 24h

---

## UX Principles

* **Trust > rigidity**: Users must be able to correct mistakes.
* **Intentional friction**: Past edits are allowed, but never silent.
* **Transparency**: Always show what will change.
* **Consistency**: Same model for daily and weekly habits.

---

## Edge Cases

* Deleting the only entry in a completed day → day becomes incomplete
* Weekly habit with partial progress remains active
* Entry deletion can retroactively break streaks (expected behavior)
* Timezone normalization must be consistent

---

## Acceptance Criteria

* [ ] User can delete a mistaken weekly habit entry
* [ ] User can edit numeric values for metric habits
* [ ] Past-date edits require confirmation
* [ ] Goals recompute immediately after changes
* [ ] No orphaned or uneditable data exists

---

## Implementation Order (Suggested)

1. HabitEntry canonical model
2. Habit History Modal (Log view only)
3. Weekly habit history expansion
4. Edit/Delete + recompute pipeline
5. Retrospective confirmation modal
