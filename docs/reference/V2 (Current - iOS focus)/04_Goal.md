# Goal — Canonical Object (V3)

> **Authority Notice**
> This document defines the canonical meaning and behavior of `Goal` in HabitFlow.
> If any implementation, UI behavior, cache, or analytics interpretation disagrees with this document, **the implementation is wrong**. 

---

## Definition (Locked)

A **Goal** is a **read-only aggregation of effort** derived from one or more **standard habits** over time.

Goals:

* ❌ never track behavior directly
* ❌ never own history, time, or completion
* ✅ aggregate **HabitEntries only**
* ✅ exist to provide **long-horizon orientation and meaning**

A Goal answers:

> **“Am I moving toward what I care about?”**

It does **not** answer:

* “Did I do the habit today?”
* “Am I consistent?”
* “Did I fail?”

Those are habit-level questions.

---

## Canonical Role in the iOS App

In the iOS app:

* Goals are **orientation and aggregation objects**
* Goals never create or mutate behavioral truth
* All progress is **derived at render time**

If goal progress cannot be recomputed from canonical sources, the implementation is invalid.

---

## Core Invariants (Must Never Be Violated)

### 1. Goals Are Read-Only With Respect to Progress

A Goal must never store:

* totals
* percentages
* counters
* streaks
* completion flags

Deleting all derived state must leave goals intact and correct.

---

### 2. Goals Do Not Create History

Goals must never:

* create HabitEntries
* maintain goal-level logs
* bypass Habits as the tracking unit

All behavioral truth lives in `HabitEntry`.

---

### 3. Directional, One-Way Influence

The only valid flow is:

```
HabitEntry → Goal aggregation → Goal UI
```

There is **no valid flow**:

```
Goal → HabitEntry
```

Any UI that appears to “log a goal” must ultimately create or update a **HabitEntry** for a **standard habit**.

---

## Goals and Habit Bundles (Locked Semantics)

### Critical Rule

> **Goals aggregate standard habits only.
> Goals must never aggregate bundle habits directly.**

Bundles are **interpretive structures**, not sources of behavioral truth.

---

### Why Bundles Are Excluded

* Bundles never produce HabitEntries
* Bundle completion is derived from child habits
* Aggregating bundles would cause:

  * double counting
  * semantic ambiguity
  * shadow tracking

Therefore:

* ❌ Goals must not link to bundle habits
* ❌ Goals must not count bundle completion
* ✅ Goals aggregate **child habits only**

---

### Valid Goal–Bundle Interaction (Read-Only)

Bundles may be used **only for UI context**, such as:

* displaying grouped contributions
* labeling effort (“from Morning Routine”)

But **never** as aggregation inputs.

---

## Canonical Sub-Object: GoalLink (Required)

A **GoalLink** defines **how a specific standard habit contributes to a specific goal**.

GoalLink is **pure configuration**, not data.

It answers exactly one question:

> “When this habit produces entries, how should they count toward this goal?”

---

### GoalLink Core Invariants

* Owns **rules**, not history
* Stores **no progress**
* Aggregation behavior is explicit
* Progress is always recomputable from HabitEntries
* Bundles are **invalid targets**

---

### Canonical GoalLink Shape (Semantic)

```ts
GoalLink {
  id: string

  goalId: string
  habitId: string        // MUST reference a standard habit

  aggregationMode: "count" | "sum"
  unit?: string          // required if aggregationMode == "sum"

  createdAt: string
}
```

#### Hard Constraints

* `habitId` must not reference a bundle habit
* Aggregation mode must never be inferred dynamically
* Unit mismatches must never be silently corrected

---

## Canonical Goal Shape (Semantic)

```ts
Goal {
  id: string

  title: string
  description?: string

  goalType: "quantity" | "count"
  targetValue: number
  unit?: string

  startDate?: string
  targetDate?: string        // informational only, never punitive

  status: "active" | "paused" | "completed"

  createdAt: string
  updatedAt: string
}
```

---

## Goal Types (Aggregation Only)

Goals differ **only by aggregation logic**, never by ownership of data.

---

### Quantity Goals

Examples:

* “Run 500 miles”
* “Write 100,000 words”

Rules:

* Aggregate `sum(HabitEntry.value)`
* Require numeric habits
* Units must match GoalLink configuration

---

### Count Goals

Examples:

* “Exercise 100 times”
* “Practice piano 50 sessions”

Rules:

* Aggregate `count(distinct HabitEntry.id)`
* Each qualifying entry counts once

---

## Habit ↔ Goal Relationships

### Many-to-Many (Explicit)

* A Goal may link to many standard habits
* A standard habit may contribute to many goals
* Each relationship is defined by a GoalLink

No implicit linking is allowed.

---

### Aggregation Source (Locked)

Goal progress must be computed **only** from:

* HabitEntries
* filtered by:

  * GoalLinks
  * deletion state
  * date range (if defined)
  * value presence (for quantity goals)

No other data source is valid.

---

## Manual Goal Logging (UX-Only Affordance)

Manual goal logging is **not** a data primitive.

Rules:

1. User must select or create a **standard habit**
2. A GoalLink must exist (or be explicitly created)
3. A HabitEntry is created or updated
4. Goal progress updates naturally via aggregation

Goals must never become a parallel tracking system.

---

## Status Semantics (Non-Punitive)

* `active`: aggregating normally
* `paused`: hidden from focus, not deleted
* `completed`: user-acknowledged milestone

Status:

* never auto-changes due to pace
* never penalizes missed time
* never blocks future contribution

---

## What Goals Must NEVER Own (Hard Prohibitions)

Goals must never own:

* ❌ goal-level entries
* ❌ stored totals or counters
* ❌ streaks or momentum
* ❌ bundle completion
* ❌ independent timelines
* ❌ punitive deadlines or failure states

If a feature requires these, it does not belong in Goals.

---

## iOS-Specific Enforcement Notes

* Editing or deleting HabitEntries must immediately recompute goal progress
* Offline edits must reconcile deterministically
* Deleting a Goal must never delete:

  * HabitEntries
  * Habits
  * Bundles

---

## Mental Model for Engineers

> **Standard habits generate truth.
> Bundles interpret structure.
> Goals aggregate truth.
> Goals never create truth.**

If progress cannot be recomputed from `HabitEntry + GoalLink`, the design is invalid.

---

## One-Sentence Summary

A Goal is a read-only, non-punitive aggregation of HabitEntries from standard habits only; bundle habits provide structure and context but never contribute directly to goal progress.
