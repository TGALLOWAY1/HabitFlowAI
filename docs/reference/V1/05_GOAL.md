# 05_GOAL.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **Goal** is a **directional aggregation of effort** derived from one or more Habits over time.

Goals **never track behavior directly**.

They only aggregate **HabitEntries** and exist to provide **meaning, context, and orientation** — not enforcement.

A Goal answers:

> “Am I moving toward what I care about?”

It does **not** answer:

- “Did I do the work today?”
- “Am I consistent?”
- “Did I fail?”

Those are habit-level questions.

---

## Core Invariants (Must Never Be Violated)

### Goals Are Read-Only with Respect to Progress

- A Goal never owns canonical progress data.
- A Goal may **display** progress but cannot be the source of truth.

If a Goal’s progress cannot be recomputed entirely from HabitEntries, the system is broken.

---

### Goals Do Not Create History

Goals must not:

- create HabitEntries
- maintain goal-level logs
- store “current progress” counters

Any object like `GoalProgress`, `GoalCompletion`, or `GoalStreak` is invalid unless fully derived.

---

### Habits Drive Goals (One-Way Only)

The only valid flow is:

```

HabitEntry → Goal aggregation → Goal UI

```

There is no valid flow:

```

Goal → HabitEntry

````

Manual goal logging is allowed **only** as a UX helper that ultimately creates or updates a HabitEntry.

---

## Conceptual Purpose (Why Goals Exist)

Goals exist to:

1. Aggregate effort across time  
2. Aggregate effort across multiple habits  
3. Provide a motivational narrative  
4. Surface long-horizon progress  
5. Support identity & skill interpretation  

They are **orientation tools**, not control systems.

---

## Canonical Goal Types

Goals differ only by **aggregation logic**, never by ownership of data.

---

### Quantity Goal

Examples:

- “Run 500 miles”
- “Write 100,000 words”

Rules:

- Aggregates `sum(entry.value)`
- Units must match or be explicitly convertible

---

### Count Goal

Examples:

- “Exercise 100 times”
- “Practice piano 50 sessions”

Rules:

- Aggregates `count(distinct HabitEntry.id)`

---

### Binary Milestone Goal

Examples:

- “Complete onboarding”
- “Establish a morning routine”

Rules:

- Aggregates count of completed days
- Still derived from HabitEntries
- No manual completion flags

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
Goal {
  id: string

  title: string
  description?: string

  goalType: "quantity" | "count"
  targetValue: number
  unit?: string

  startDate?: string
  targetDate?: string        // informational, not a deadline

  linkedHabitIds: string[]

  status: "active" | "paused" | "completed"

  createdAt: string
  updatedAt: string
}
````

### Notes

* `targetDate` is **non-punitive**
* Status must never auto-change due to missed pace
* Completion may be suggested but never forced

---

## Goal ↔ Habit Relationship (Critical)

### Linking Rules

* A Goal may link to many habits
* A Habit may link to many goals
* Links define **how entries contribute**, not whether they count

This relationship must be explicit and inspectable.

---

### Aggregation Source (Locked)

All Goal progress must be computed from:

* HabitEntries
* filtered by:

  * `habitId ∈ linkedHabitIds`
  * date range (if defined)
  * deletion state
  * value presence (for quantity goals)

No other data source is allowed.

---

## Manual Goal Logging (Allowed, but Constrained)

Manual goal logging is a **UX affordance**, not a data primitive.

Rules:

1. Manual logging must ultimately:

   * create a HabitEntry, or
   * update an existing HabitEntry
2. The user must select or create a source habit
3. If no habit exists, the system should prompt creation

Goals must never become a parallel tracking system.

---

## What Goals Must NOT Have (Anti-Patterns)

Goals must never own:

* ❌ goal-level entries
* ❌ goal streaks
* ❌ goal momentum
* ❌ cached goal totals
* ❌ independent history timelines
* ❌ penalties for being “behind”

If a feature requires these, it belongs elsewhere.

---

## Deletion & Mutation Rules

### Editing Goals

* Editing target values does **not** rewrite history
* Progress is recomputed immediately

---

### Deleting Goals

* Deletes only the Goal object
* Must **not** delete HabitEntries
* Must **not** mutate habits

---

## LLM / Design Decision Checklist

Before implementing anything involving Goals, the system must ask:

1. Can this progress be recomputed purely from HabitEntries?
2. Does this feature accidentally create goal-owned history?
3. If a habit is deleted, does the goal degrade gracefully?
4. Is this feature motivational, not evaluative?

If any answer is **no**, the proposal is invalid.

---

## One-Sentence Summary

A Goal is a read-only aggregation of HabitEntries that provides long-term orientation and meaning without owning or enforcing behavior.


