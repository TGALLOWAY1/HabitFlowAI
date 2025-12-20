# 02_HABIT_ENTRY.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, caches, or analytics disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **HabitEntry** is the atomic, canonical record that a user performed (or logged) a habit on a specific day and time.

HabitEntries are the **single source of truth** for all historical data in HabitFlow.

Everything else — daily completion, weekly progress, streaks, momentum, goals, charts, analytics — is **derived** from HabitEntries.

There is no such thing as completion without an entry.

---

## Core Invariants (Must Never Be Violated)

### Source of Truth

- No other collection, cache, or field may be treated as authoritative for completion or totals.
- Any “completion state” shown in the UI must be computed from HabitEntries (plus deterministic rules).

> *There is no such thing as an uneditable completion — only entries.*

---

### One Entry per Habit per Day (Default)

- Canonical default constraint:

```ts
UNIQUE (habitId, dayKey)
````

* This applies to **daily tracking views**.
* Weekly habits may have multiple entries per week, but each still has a distinct DayKey.

If multi-entry-per-day is ever introduced, it must be:

* explicitly defined
* vocabulary-approved
* not accidental behavior

---

### Validity Is Determined by the Habit

* If a Habit requires a numeric value, the entry **must include a valid number**.
* Mixed-mode history (boolean + numeric) is forbidden.
* Entry validity rules are derived from the Habit definition at entry time.

---

### Units Are Preserved Historically

* Units are stored on the entry.
* Changing a habit’s unit must **not** rewrite historical entries.
* Historical integrity is more important than convenience.

---

### Entries Are Editable (With Guardrails)

Users must be able to:

* edit entries
* delete entries

Every mutation must trigger **full recomputation** of all derived views.

---

## Canonical Data Shape (Semantic Minimum)

This is the **conceptual contract**, not an implementation schema.

```ts
HabitEntry {
  id: string
  habitId: string

  // Time
  timestampUtc: string        // exact event time, stored in UTC
  dayKey: string              // YYYY-MM-DD, normalized to user timezone

  // Value
  value?: number | null       // null or 1 for boolean habits; required for numeric
  unit?: string               // stored for historical integrity

  // Provenance
  source: "manual" | "routine" | "quick" | "import" | "test"
  routineId?: string
  routineExecutionId?: string

  // Optional micro-reflection
  note?: string               // short text, not journaling

  // Audit-lite
  deletedAt?: string | null   // soft delete

  createdAt: string
  updatedAt: string
}
```

### Notes

* `dayKey` is required for:

  * stable aggregation
  * timezone correctness
  * recomputation safety
* Storing `unit` on the entry prevents retroactive corruption.

---

## How HabitEntries Drive Derived Systems

HabitEntries are **read once, interpreted many times**.

---

### Daily Completion (Daily Habits)

A daily habit is complete on `dayKey` **iff**:

```ts
exists HabitEntry
where habitId == X
  and dayKey == Y
  and deletedAt == null
```

No other signal may mark a habit complete.

---

### Weekly Progress (Weekly Habits)

Weekly habits aggregate entries whose DayKeys fall within the week window.

* **Binary**
  `count(entries) >= 1`

* **Frequency**
  `count(entries) >= weeklyTarget`

* **Quantity**
  `sum(entry.value) >= weeklyTarget`

Weekly state is always derived — never stored.

---

### Bundles

* Bundle parents do **not** have entries.
* Parent completion is derived from child habit entries.
* Child entries remain canonical.

---

### Goals

* Goals aggregate from HabitEntries only.
* Attribution should be preserved where possible.
* Goal-side counters or logs are forbidden.

---

## Edit & Delete Semantics (Canonical)

### Deleting an Entry

* Implemented as a **soft delete** (`deletedAt`)
* Immediate recomputation of:

  * daily completion
  * weekly progress
  * streaks
  * momentum
  * goal progress

Deleting an entry must never delete:

* habits
* goals
* routines

---

### Editing an Entry

Editable fields:

* `timestampUtc` (and thus `dayKey`)
* `value`
* `note`
* *(rarely)* `source` — only for test/import cleanup

Guardrails:

* Editing past dates should require explicit confirmation
* UI should preview affected goals where applicable

No cached state may survive an edit.

---

## Relationship to Routines (Critical Boundary)

* Routines may suggest that a habit was supported.
* The only thing that **counts** is a HabitEntry.

If a user confirms routine evidence:

* create or update a HabitEntry
* set `source = "routine"`
* attach routine metadata
* delete or consume the evidence

RoutineExecution must never bypass HabitEntry creation.

---

## What Must Never Exist (Anti-Patterns)

To prevent synchronization bugs:

* ❌ completion flags stored elsewhere
* ❌ “completedOptions” maps
* ❌ day completion caches treated as truth
* ❌ goal-owned progress counters
* ❌ parallel history stores (e.g. legacy DayLogs)

All history must converge on HabitEntry.

---

## LLM / Design Decision Checklist

Before implementing anything that touches history, the system must ask:

1. Does this create, update, or delete a HabitEntry?
2. Is there exactly **one** canonical history query path?
3. Will all derived views recompute deterministically?
4. Are unit and timezone preserved correctly?
5. Are past-date edits guarded and previewed?

If any answer is **no**, the design is invalid.

---

## One-Sentence Summary

A HabitEntry is the immutable unit of behavioral truth in HabitFlow; all progress, completion, and interpretation are derived from it and nothing may bypass it.