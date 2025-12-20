# 04_HABIT_POTENTIAL_EVIDENCE.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **HabitPotentialEvidence** record is a **non-authoritative signal** that something occurred which might justify creating a HabitEntry, pending explicit user confirmation.

HabitPotentialEvidence is **not** progress, **not** completion, and **not** history.

It is a **suggestion**, never a fact.

---

## Why This Object Exists

HabitPotentialEvidence exists to solve one narrow problem safely:

**How do we let routines help habits without letting routines own habit tracking?**

Without this object, the system is forced into one of two bad choices:

1. Auto-complete habits (violates autonomy; creates shadow tracking)
2. Ignore routines entirely (wasted signal)

HabitPotentialEvidence is the minimal, reversible middle layer.

---

## Core Invariants (Must Never Be Violated)

### Evidence Is Not an Entry

Evidence does not count toward:

- streaks
- goals
- momentum
- charts
- progress

Only a **HabitEntry** counts.

---

### Evidence Is Optional

The user may:

- confirm it
- ignore it
- dismiss it

Ignoring evidence has **zero** negative consequences.

---

### Evidence Is Ephemeral

Evidence is:

- time-bound
- scoped to a specific DayKey
- safe to delete

It must not be treated as permanent history.

---

### One-Way Flow Only

The only valid flow is:

```

RoutineExecution
↓
HabitPotentialEvidence
↓ (optional, user-confirmed)
HabitEntry

````

There is no valid path backward.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
HabitPotentialEvidence {
  id: string

  habitId: string

  routineId: string
  routineExecutionId: string

  dayKey: string              // YYYY-MM-DD, user-tz normalized

  source: "routine"

  createdAt: string
}
````

### Notes

* `dayKey` aligns evidence with habit daily views.
* Evidence is scoped to a specific routine execution — not generic.

---

## Creation Rules

HabitPotentialEvidence may be created only when:

1. A RoutineExecution exists (user intentionally started a routine)
2. The routine contains steps linked to habits

Evidence must never be created from:

* previewing routines
* browsing routines
* editing routines

---

## How Evidence Is Used (Allowed Behaviors)

### Habit UI (Primary Use)

Evidence may surface as:

> “A routine supporting this habit was started today.”

With a single action:

* **Count it**

This action is not “accepting progress.” It is **creating truth**.

---

### Confirming Evidence (Canonical Behavior)

When the user confirms evidence:

1. Create or update a HabitEntry

   * `source = "routine"`
   * attach routine metadata (routineId, routineExecutionId)
2. Delete or mark the evidence as consumed

Evidence must not survive confirmation.

---

## What Evidence Must NOT Do (Anti-Patterns)

Evidence must never:

* ❌ auto-create HabitEntries
* ❌ increment counters
* ❌ appear in charts
* ❌ affect streaks or momentum
* ❌ link directly to goals
* ❌ persist across long time windows

If any of these occur, evidence has become a tracker — which is forbidden.

---

## Deletion & Cleanup Semantics

Evidence may be safely deleted when:

* the day changes
* the routine execution is deleted
* the user dismisses it
* the habit entry is confirmed

Deleting evidence must never delete HabitEntries.

---

## LLM / Design Decision Checklist

Before touching HabitPotentialEvidence, the system must ask:

1. Is this a suggestion, not a fact?
2. Can the user ignore this with no penalty?
3. Does confirmation explicitly create a HabitEntry?
4. Is this scoped to a specific routine execution and DayKey?

If any answer is **no**, this object is being misused.

---

## One-Sentence Summary

HabitPotentialEvidence is an ephemeral, non-authoritative signal that a routine may have supported a habit, pending explicit user confirmation before becoming a HabitEntry.