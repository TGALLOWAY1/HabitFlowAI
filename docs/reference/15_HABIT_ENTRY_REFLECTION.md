# 15_HABIT_ENTRY_REFLECTION.md

> **Canonical Object (Optional but Recommended)**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **HabitEntryReflection** is a **lightweight qualitative annotation** attached to a specific HabitEntry.

It enriches a HabitEntry with subjective context (how it felt, how hard it was) **without changing truth**.

HabitEntryReflection is **metadata**, not evidence.

---

## Why This Object Exists

HabitEntryReflection exists to support a common user need:

> “I did the habit — but how did it feel?”

Without forcing the user into a full journaling flow.

This object allows:

- emotional context
- effort notes
- quick reflections

While preserving HabitEntry as the sole unit of truth.

---

## Core Invariants (Must Never Be Violated)

### Reflection Requires an Entry

A HabitEntryReflection:

- must reference an existing HabitEntry
- must not exist without one

If a HabitEntry is deleted, its reflections must be deleted as well.

---

### Reflection Does Not Affect Tracking

A HabitEntryReflection must never:

- change completion state
- affect streaks
- affect momentum
- affect goal progress
- act as evidence

Deleting all reflections must leave **all tracking unchanged**.

---

### Reflection Is Optional

- Users are never required to add a reflection
- Absence of reflection has no penalty
- Reflection must never be framed as obligation

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
HabitEntryReflection {
  id: string

  habitEntryId: string

  mood?: "great" | "good" | "neutral" | "hard" | "bad"
  effort?: number              // e.g. 1–5 scale
  note?: string                // short free-text

  createdAt: string
  updatedAt: string
}
````

### Notes

* Mood and effort are **optional** and subjective
* Scales must never be interpreted as scores
* No aggregation is allowed from these fields

---

## Relationship to Other Canonical Objects

### HabitEntryReflection ↔ HabitEntry

* One HabitEntry → zero or more reflections (typically one)
* Reflection is subordinate to HabitEntry
* HabitEntry remains canonical truth

---

### HabitEntryReflection ↔ JournalEntry

* HabitEntryReflection is **not** a JournalEntry
* It must remain lightweight
* Journaling remains the place for longer reflection

These two concepts must not be merged.

---

## Edit & Delete Semantics

### Editing Reflections

* Users may freely edit reflection content
* Edits must not trigger recomputation of metrics
* Editing reflections must not touch HabitEntry

---

### Deleting Reflections

* Reflections may be deleted freely
* Deleting reflections must not affect:

  * HabitEntries
  * Goals
  * Derived metrics

---

## What HabitEntryReflection Must NOT Do (Anti-Patterns)

HabitEntryReflection must never:

* ❌ act as completion evidence
* ❌ create or update HabitEntries
* ❌ influence goals or skills
* ❌ imply evaluation or judgment
* ❌ become required for “proper” logging

If reflection starts affecting behavior truth, it is broken.

---

## LLM / Design Decision Checklist

Before implementing anything involving HabitEntryReflection, the system must ask:

1. Is this strictly metadata on an existing HabitEntry?
2. Would deleting all reflections leave all tracking intact?
3. Is this lightweight enough to avoid journal bloat?
4. Am I preserving HabitEntry as the sole truth source?

If any answer is **no**, the design is invalid.

---

## One-Sentence Summary

HabitEntryReflection is a lightweight, optional qualitative annotation attached to a HabitEntry that adds subjective context without affecting tracking or progress.
