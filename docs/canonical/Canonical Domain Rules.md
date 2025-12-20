# Canonical Domain Rules

**HabitFlow AI — Source of Truth for Behavior & Data Semantics**

> **Status:** Canonical Authority
> **Scope:** This document defines the non-negotiable rules governing core domain objects and their interactions.
> **Precedence:** If any other PRD, mockup, comment, or implementation contradicts this document, **this document wins**.

---

## 1. Canonical Objects (Vocabulary)

The system recognizes the following **canonical domain objects**.
These names are intentional and exclusive.

### Core Objects

* **Habit**
* **HabitEntry**
* **Routine**
* **RoutineExecution**
* **HabitPotentialEvidence**
* **Goal**
* **Skill**
* **Identity**
* **Journal**
* **JournalEntry**

> Legacy terms such as `Activity`, `DayLog`, or implicit completion state are **non-canonical** and may only exist in compatibility layers.

---

## 2. Source-of-Truth Rule (Most Important)

### **HabitEntry is the sole source of truth for all historical facts.**

All of the following MUST be derived from `HabitEntry`:

* Completion state
* Goal progress
* Streaks
* Weekly quotas
* Charts & analytics
* Momentum / freezes
* Bundle parent completion

❌ No other object may store authoritative completion or progress state.

If a historical fact cannot be reconstructed from entries, it is **not valid system state**.

---

## 3. Habits

### Definition

A **Habit** defines:

* What can be done
* How it can be logged
* How entries are interpreted

A Habit **does not** store:

* Completion history
* Streak counts
* Progress totals

### Habit Types (Canonical)

* Binary (done / not done)
* Numeric (value + unit)
* Bundle (choice / composite)

---

## 4. HabitEntry

### Definition

A **HabitEntry** represents:

> “A user-asserted fact that a habit occurred (or a value was recorded) on a specific date.”

### Rules

* Entries are **append-only** (edit/delete is allowed but must recompute all derivations).
* Each entry has a **dateKey** (not a timestamp) for aggregation.
* Multiple entries may exist per habit per day if the habit allows it.

### Consequences

Deleting or modifying an entry MUST:

* Recompute all derived views
* Update goals, streaks, quotas, charts

---

## 5. Goals

### Definition

A **Goal** represents an outcome or target state.

### Rules

* Goals NEVER track progress directly.
* Goals derive progress exclusively from linked HabitEntries.
* A goal may link to multiple habits.
* Goals may be cumulative, threshold-based, or milestone-based — but all math derives from entries.

If a goal chart or metric disagrees with entries, the chart is wrong.

---

## 6. Routines

### Definition

A **Routine** is a reusable structure for performing multiple actions together.

### Critical Rule

> **Routines do not complete habits. Ever.**

Routines may:

* Suggest habits
* Generate potential evidence
* Improve UX

Routines may NOT:

* Create HabitEntries directly
* Mark habits complete implicitly
* Store completion outcomes

---

## 7. RoutineExecution & HabitPotentialEvidence

### RoutineExecution

Represents:

> “A user ran this routine at this time.”

It stores **no habit completion state**.

### HabitPotentialEvidence

Represents:

> “This routine execution suggests this habit may have occurred.”

Rules:

* Evidence is **non-authoritative**
* Evidence must be confirmed by the user to create a HabitEntry
* Evidence may be ignored or dismissed

---

## 8. Bundles & Choice Habits

### Bundle Habits

* Parent bundle habits NEVER store completion.
* Child/option habits generate entries.
* Parent completion is **derived** from child entries.

### Choice Bundles

* Exactly one option may be completed per day (if configured).
* Option habits have stable IDs.
* Virtual rows in the UI must map to canonical option habit IDs.

---

## 9. Weekly Habits, Quotas, and Streaks

### Weekly / Quota Habits

* No “week state” is stored.
* Weekly progress is derived by querying entries within a week window.

### Streaks

* Streaks are pure derivations.
* Freezes or momentum modifiers may annotate derivation logic but never override entries.

---

## 10. Journal & Reflection

* Journals and JournalEntries are **orthogonal** to HabitEntries.
* A HabitEntry may optionally reference a JournalEntry.
* Journaling never implies completion.

---

## 11. Explicit Non-Rules (Things the System Never Does)

The system NEVER:

* Auto-completes habits from routines
* Stores cached completion counters as truth
* Treats UI state as authoritative
* Infers completion without an entry
* Mutates historical meaning without recomputation

If any implementation does these things, it is **incorrect by definition**.

---

## 12. Migration & Compatibility Policy

* Legacy concepts may exist only behind adapters.
* Compatibility layers MUST map legacy data into canonical semantics.
* Migration work must conform to these rules — **not modify them**.

---

## 13. How to Use This Document

* Developers: implement behavior to satisfy invariants here.
* LLM agents (Cursor): treat this as the highest-priority instruction.
* PRDs: explain intent and UX, not truth semantics.

---

### Final Authority Statement

> **This document defines what HabitFlow *is*.
> Everything else explains how it used to be, or how it should feel.**
