# HabitEntry — Canonical Object (V3)

> **Authority Notice**
> This document defines the canonical meaning of `HabitEntry`.
> If any implementation disagrees with this document, **the implementation is wrong**.

---

## Definition (Locked)

A **HabitEntry** is the atomic, time-bound record that a user performed a **standard habit**.

HabitEntries are the **only** persisted source of behavioral truth.

Bundles never produce entries.

---

## Core Invariants

### 1. Entry-Driven Truth

* All completion is derived from entries
* No entry → no behavior
* No bundle may ever have an entry

---

### 2. Time Ownership

Each entry stores:

* `timestampUtc`
* `dayKey`

All aggregation uses `dayKey`.

---

### 3. Completion Is Derived

A habit is complete for a window **iff** at least one non-deleted entry exists.

This applies equally to bundle derivation via child habits.

---

### 4. Single-Entry-Per-Day Rule (Daily Habits)

For `(habitId, dayKey)`:

* At most one non-deleted entry may exist
* Adjustments modify the existing entry
* Replacement requires explicit intent

---

## Canonical Data Shape

```ts
HabitEntry {
  id: string
  habitId: string           // MUST reference a standard habit

  timestampUtc: string
  dayKey: string

  value?: number | null
  unit?: string

  note?: string

  source?: "manual" | "routine" | "quick" | "import" | "test"
  routineId?: string
  routineExecutionId?: string

  deletedAt?: string | null

  createdAt: string
  updatedAt: string
}
```

### Hard Constraints

* `habitId` **must not** reference a bundle habit
* Any attempt to create a bundle entry is a **hard error**
* Numeric habits require `value`
* Units are preserved historically

---

## Relationship to Bundles

* Bundle completion is **derived only**
* Entries are always created on child habits
* Choice bundle exclusivity is enforced at entry-creation time

---

## Prohibited Patterns

An implementation must not:

* Create bundle entries
* Store derived completion
* Auto-merge entries across children
* Infer behavior from routines or journals

---

## Mental Model

> **Persist events.
> Derive meaning.
> Never store interpretation.**

---

## One-Sentence Summary

A HabitEntry is the sole, immutable record of behavioral reality for standard habits; bundle completion is always derived and never stored.
