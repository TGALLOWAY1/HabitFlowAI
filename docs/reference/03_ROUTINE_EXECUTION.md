# 03_ROUTINE_EXECUTION.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **RoutineExecution** is a lightweight, non-evaluative event record that indicates a user intentionally **started** a routine at a specific time.

A RoutineExecution records **intent to use structure**, not success, completion, effort, or correctness.

> **Execution ≠ completion**

Nothing more is implied.

---

## Why This Object Exists (Canonical Purpose)

RoutineExecution exists to solve a very narrow set of problems safely:

1. **Prove intent**  
   The user explicitly chose to run a routine.
2. **Anchor time**  
   Provide a concrete timestamp and DayKey.
3. **Contextualize evidence**  
   Attribute later habit-related signals safely.
4. **Prevent architectural drift**  
   Block routines from becoming tracking systems.

If a feature proposal does not require at least one of these, it should **not** touch RoutineExecution.

---

## Core Invariants (Must Never Be Violated)

### Execution Is Not Completion

A RoutineExecution:

- does **not** mean the routine was finished
- does **not** mean steps were followed
- does **not** imply habit completion

There is no “successful” or “failed” execution.

---

### Append-Only Event

- RoutineExecutions are **created**, not updated to reflect progress
- They may optionally record an `endedAtUtc`, but this is **informational only**
- No mutable state machine lives here

---

### One-Way Influence Only

The only valid flow is:

```

RoutineExecution
↓ (may emit)
HabitPotentialEvidence
↓ (user confirms)
HabitEntry

````

There is **no valid path** where a RoutineExecution directly updates a Habit or HabitEntry.

---

### Preview Has Zero Side Effects

- Previewing or inspecting a routine must **not** create a RoutineExecution
- Only an explicit **Start Routine** action may do so

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
RoutineExecution {
  id: string

  routineId: string

  // Time
  startedAtUtc: string
  dayKey: string              // YYYY-MM-DD, normalized to user timezone
  endedAtUtc?: string         // optional, informational only

  // Audit-lite
  createdAt: string
}
````

### Notes

* `dayKey` exists to:

  * align with HabitEntry aggregation
  * avoid timezone drift
  * simplify “started today” logic
* `endedAtUtc` must **never** be interpreted as success or completion

---

## Relationships to Other Canonical Objects

### RoutineExecution ↔ Routine

* Routine is the **definition**
* RoutineExecution is a **single intentional use**
* Editing a routine must **not** mutate past executions

---

### RoutineExecution ↔ HabitPotentialEvidence

* A RoutineExecution may generate **zero or more** HabitPotentialEvidence records
* Evidence is a **signal**, not truth
* Evidence only matters if the user later confirms it

---

### RoutineExecution ↔ HabitEntry (Critical Boundary)

Only a **HabitEntry**:

* counts toward streaks
* contributes to goals
* appears in charts
* survives edit/delete workflows

RoutineExecution must never bypass this boundary.

---

## What RoutineExecution Must NOT Store

To prevent system corruption, this object must never store:

* ❌ completion flags
* ❌ step-level progress
* ❌ success/failure states
* ❌ scores or ratings
* ❌ links to goals
* ❌ counters or tallies

If any of these appear, the object is no longer a RoutineExecution.

---

## Allowed Queries (LLM-Safe Use)

RoutineExecution may safely answer:

* “Was this routine started today?”
* “How often do I choose to use structure?”
* “Did a habit-related signal come from an intentional routine run?”

It must **not** answer:

* “Did I do the habit?”
* “Did I finish the routine?”
* “Was I consistent?”

Those are HabitEntry-derived questions.

---

## Deletion & Mutation Rules

* RoutineExecutions may be deleted for cleanup or testing
* Deleting a RoutineExecution must:

  * delete dependent HabitPotentialEvidence
  * **never** delete HabitEntries

RoutineExecutions should not be retroactively edited to change meaning.

---

## LLM / Design Decision Checklist

Before touching RoutineExecution, the system must ask:

1. Am I recording **intent**, not outcome?
2. Would this still make sense if the user quit after step one?
3. Is this append-only and non-evaluative?
4. Does habit progress still require explicit confirmation?

If any answer is **no**, RoutineExecution is the wrong object.

---

## One-Sentence Summary

RoutineExecution is an append-only intent marker that a routine was intentionally started, used solely to contextualize potential habit evidence and never to measure success.
