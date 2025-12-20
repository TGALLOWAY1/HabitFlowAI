# 14_JOURNAL_ENTRY.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **JournalEntry** is a **user-authored reflection record** (structured and/or free-form) created from a JournalTemplate or from scratch.

JournalEntries provide **context and insight**, not completion.

A JournalEntry may reference habits or goals, but it must **never count** as completing them unless the user explicitly creates a HabitEntry separately.

---

## Core Invariants (Must Never Be Violated)

### Journaling Is Not Tracking

A JournalEntry must never:

- create HabitEntries automatically
- increment streaks or momentum
- change goal progress
- satisfy habit completion

Reflection is not evidence.

---

### Journaling Is Optional

- No overdue states
- No penalties
- No failure framing

Not journaling is always acceptable.

---

### DayKey Applies

JournalEntries are time-bound and must follow DayKey semantics:

- store `timestampUtc`
- store `dayKey`

This allows journaling to align with habit views **without owning aggregation**.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
JournalEntry {
  id: string

  // Time
  timestampUtc: string
  dayKey: string

  // Template
  templateId?: string

  // Content
  title?: string
  responses?: Record<string, any>   // keyed by JournalField.id
  text?: string                     // optional free-form narrative

  // Optional references (context only)
  referencedHabitIds?: string[]
  referencedGoalIds?: string[]

  // Audit
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}
````

---

## Structured vs Free-Form Entries

### Structured Entries

* Created from a JournalTemplate
* Store responses keyed by field ID
* Editing a template must not rewrite past entries

---

### Free-Form Entries

* May have `text` only
* May optionally include references
* No template required

Both are equally valid.

---

## Relationship to Other Canonical Objects

### JournalEntry ↔ Habit

* References are **contextual only**
* Must not affect habit completion
* Must not auto-create HabitEntries

---

### JournalEntry ↔ Goal

* References provide narrative context
* Must not affect goal aggregation
* Must not create goal-side history

---

### JournalEntry ↔ Category

* Category grouping is optional
* Used only for browsing and organization
* No semantic meaning implied

---

## Edit & Delete Semantics

### Editing JournalEntries

* Users may edit content freely
* Edits must not affect any tracking metrics
* Editing timestamps requires confirmation if DayKey changes

---

### Deleting JournalEntries

* Implemented as soft delete (`deletedAt`)
* Must not delete or mutate:

  * HabitEntries
  * Goals
  * Routines
* Derived metrics must remain unchanged

---

## What JournalEntry Must NOT Do (Anti-Patterns)

JournalEntry must never:

* ❌ act as evidence
* ❌ auto-log habits
* ❌ mutate goals
* ❌ imply obligation
* ❌ gate behavior

If deleting all JournalEntries changes progress, the system is broken.

---

## LLM / Design Decision Checklist

Before implementing anything involving JournalEntry, the system must ask:

1. Is this reflection-only?
2. Would deleting all journals leave all tracking intact?
3. Are references non-authoritative?
4. Does DayKey align correctly?

If any answer is **no**, the design is invalid.

---

## One-Sentence Summary

JournalEntry is a non-authoritative reflection record that provides context and insight without contributing to tracking, completion, or progress.