# Routine — Canonical Object (V2, iOS-First)

> **Authority Notice**
> This document defines the canonical meaning and behavior of `Routine` in HabitFlow.
> If any implementation, PRD, UI behavior, or analytics interpretation disagrees with this document, **the implementation is wrong**.

---

## Definition (Locked)

A **Routine** is a **support structure**, not a tracking system.

A Routine:

* Provides optional structure that may *support* habits
* Helps users act with intention
* Never records progress, success, or completion on its own

Routines exist to **help habits happen**, not to replace habit tracking.

---

## Canonical Role in the System

In HabitFlow:

* **Habits** define *what* behavior matters
* **HabitEntries** define *what actually happened*
* **Routines** define *optional structure that may help*

A Routine is never a source of behavioral truth.

---

## What a Routine Owns (and Does Not Own)

### A Routine **owns**:

* A definition (name, steps, linked habits)
* Structure and ordering
* User intent to apply structure

### A Routine **does NOT own**:

* Time
* Completion
* Progress
* Success / failure
* Streaks, goals, or metrics

If a Routine appears to “track” anything, the design is wrong.

---

## Canonical Sub-Concepts

A Routine interacts with the system through **two strictly limited event types**:

```
Routine
↓
RoutineExecution        (intent marker)
↓
HabitPotentialEvidence  (optional suggestion)
↓ (user confirms)
HabitEntry              (truth)
```

There are **no other valid flows**.

---

## 1. RoutineExecution — Intent Marker

### Definition

RoutineExecution is a non-canonical, ephemeral intent marker used only to support short-lived UI flows.
It is not a historical truth object and must not be persisted long-term.

It records **intent to use structure**, nothing more.

> Execution ≠ completion
> Execution ≠ success
> Execution ≠ progress

---

### Core Invariants

* Append-only event
* Non-evaluative
* No success or failure states
* Starting a routine is the *only* way to create an execution

Previewing, browsing, or editing a routine must **never** create a RoutineExecution.

---

### Canonical Data Shape (Conceptual)

```ts
RoutineExecution {
  id: string
  routineId: string

  // Time
  startedAtUtc?: string
  endedAtUtc?: string         // optional, informational only

  createdAt: string
}
```

**Notes**

* `endedAtUtc` is never interpreted as success
* `dayKey` aligns routines with habit aggregation, nothing more

---

### Deletion Rules
RoutineExecution must not be persisted across app restarts.
It exists only in active UI state.

* RoutineExecutions may be deleted (cleanup, testing)
* Deleting a RoutineExecution:

  * deletes dependent HabitPotentialEvidence
  * **must never delete HabitEntries**

If persistence is required for debugging, it must be explicitly marked as non-authoritative and deletable without consequence.
---

## 2. HabitPotentialEvidence — Non-Authoritative Suggestion

### Definition

A **HabitPotentialEvidence** record is a **temporary suggestion** that a routine *may* have supported a habit.

It is:

* Not truth
* Not progress
* Not history

It is a **prompt for user confirmation**, nothing else.

HabitPotentialEvidence is ephemeral UI state.

It must not be persisted.
It expires automatically when the routine flow ends.


---

### Core Invariants

* Evidence is optional
* Evidence is ignorable with zero penalty
* Evidence expires or can be deleted safely
* Evidence never counts toward anything

Only a **HabitEntry** creates behavioral truth.

---

### Canonical Data Shape (Conceptual)

```ts
HabitPotentialEvidence {
  id: string

  habitId: string
  routineId: string
  routineExecutionId: string

  dayKey: string              // YYYY-MM-DD (user timezone)

  source: "routine"

  createdAt: string
}
```

---

### Creation Rules

HabitPotentialEvidence may be created **only if**:

1. A RoutineExecution exists
2. The routine contains steps linked to habits

Evidence must never be created from:

* Routine previews
* Browsing routines
* Editing routines

---

### Confirmation (Critical Boundary)

When a user confirms evidence:

1. A **HabitEntry** is created or updated

   * `source = "routine"`
   * routine metadata attached
2. The evidence is deleted or marked consumed

Evidence must **never survive confirmation**.

Confirming evidence must update the existing HabitEntry for the day, never create a second entry.

---

## What Routines Must NEVER Do (Hard Prohibitions)

To prevent architectural drift, Routines must never:

* ❌ Auto-create HabitEntries
* ❌ Track completion or progress
* ❌ Own time or DayKeys
* ❌ Increment counters
* ❌ Affect goals, streaks, or charts
* ❌ Create negative states if ignored
* ❌ Bypass explicit user confirmation

If any of these occur, the Routine has become a tracker — which is forbidden.

---

## iOS-Specific Guidance

### Routines Are Supportive, Not Central

In the iOS app:

* Routines should feel *optional*
* Ignoring routines must have no negative consequences
* The app must remain fully usable without routines

### No Session State Machines

iOS implementations must not introduce:

* “In progress” routine states
* Step completion tracking
* Partial routine scoring

Routines are **structural aids**, not workflows.

---

## Mental Model for iOS Engineers

> **Routines suggest.
> Users confirm.
> Only entries count.**

If a feature proposal makes a routine “count” for something, it violates Northstar.

---

## One-Sentence Summary

A Routine is a non-authoritative support structure that records user intent to apply structure and may emit optional, ignorable suggestions—only explicit HabitEntries ever create behavioral truth.
