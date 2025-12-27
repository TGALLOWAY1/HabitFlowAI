# Journal — Canonical Object (V2, iOS-First)

> **Authority Notice**
> This document defines the canonical meaning and behavior of Journals in HabitFlow.
> If any iOS implementation, PRD, analytics layer, or UI behavior disagrees with this document, **the implementation is wrong**.

---

## Purpose

The Journal system exists to capture **reflection, narrative, and subjective context**.

Journals answer:

> **“What was this experience like for me?”**

They do **not** answer:

* Did I complete a habit?
* Did I make progress?

Those belong to **HabitEntry** and **derived metrics**, not Journals.

---

## Canonical Components

The Journal system consists of **two related but distinct objects**:

1. **JournalTemplate** — defines *what to ask*
2. **JournalEntry** — stores *what the user reflected*

Templates are optional.
Journal Entries are the only reflective historical truth.

---

## Position in the System (Critical)

Journals are a **first-class, orthogonal truth source**, alongside HabitEntry and WellbeingEntry.

They:

* own their own time
* never mutate behavioral progress
* never substitute for tracking

Deleting all journals must leave:

* habits
* goals
* insights

**unchanged**.

---

## JournalTemplate (Prompt Definition)

### Definition

A **JournalTemplate** is a reusable, non-evaluative **prompt schema** that helps users create JournalEntries with less friction.

Templates define **structure**, not truth.

---

### Core Invariants

JournalTemplates must never:

* store user responses
* store completion state
* track frequency or usage
* affect habits, goals, or streaks

Templates are **static definitions**, not logs.

---

### Canonical JournalTemplate Shape (Conceptual)

```ts
JournalTemplate {
  id: string

  title: string
  description?: string

  categoryId?: string           // organizational only

  fields: JournalField[]

  sortOrder?: number
  isArchived?: boolean

  createdAt: string
  updatedAt: string
}
```

#### JournalField

```ts
JournalField {
  id: string

  type: "text" | "number" | "scale" | "choice" | "multiChoice" | "time"
  label: string
  helperText?: string

  required?: boolean

  options?: {
    id: string
    label: string
  }[]
}
```

---

### Category Relationship (Templates)

* `categoryId` is **UI-only**
* Used for browsing and grouping templates
* Must not imply importance, priority, or obligation

---

### Lifecycle Rules

* System-provided and user-created templates are allowed
* Editing a template must **not** rewrite past JournalEntries
* Archiving hides templates from creation flows only
* Deleting templates must never delete JournalEntries

---

## JournalEntry (Reflective Truth)

### Definition

A **JournalEntry** is a **user-authored reflection record**, created either:

* from a JournalTemplate, or
* as free-form text

JournalEntries capture **experience and insight**, not evidence.

---

### Core Invariants

JournalEntries must never:

* create HabitEntries automatically
* increment streaks or totals
* mutate goal progress
* imply completion or success

Reflection is **not tracking**.

---

### Time Semantics (iOS-Critical)

Every JournalEntry must store:

* `timestampUtc`
* `dayKey`

This allows journals to **align with daily views** without owning aggregation logic.

---

### Canonical JournalEntry Shape (Conceptual)

```ts
JournalEntry {
  id: string

  // Time
  timestampUtc: string
  dayKey: string

  // Template (optional)
  templateId?: string

  // Content
  title?: string
  responses?: Record<string, any>   // keyed by JournalField.id
  text?: string                     // free-form narrative

  // Optional references (context only)
  referencedHabitIds?: string[]
  referencedGoalIds?: string[]

  // Audit
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}
```

---

## Structured vs Free-Form Journals

### Structured Entries

* Created from a JournalTemplate
* Store responses keyed by `JournalField.id`
* Template edits never retroactively change entries

### Free-Form Entries

* May contain `text` only
* No template required
* Equal in importance to structured entries

Both are first-class JournalEntries.

---

## Relationships to Other Objects (Non-Authoritative)

### JournalEntry ↔ Habit

* References are **contextual only**
* Must not affect completion
* Must not auto-create HabitEntries

### JournalEntry ↔ Goal

* References provide narrative meaning
* Must not affect aggregation
* Must not create goal-side history

### JournalEntry ↔ Category

* Optional, for browsing only
* No semantic meaning implied

referencedHabitIds and referencedGoalIds are optional context pointers.

They:
- enable deep linking
- do not affect aggregation or completion
- have no required semantics beyond display


---

## Editing & Deletion Semantics

### Editing

* Users may freely edit content
* Editing must never affect tracking or insights
* If timestamp/dayKey changes, confirm with the user

### Deletion

* Implemented as soft delete (`deletedAt`)
* Deleting a JournalEntry must never delete:

  * HabitEntries
  * Goals
  * Routines
* Derived metrics must remain unchanged

---

## iOS-Specific Guidance

* Journals should feel **safe, optional, and non-evaluative**
* No “missed journal” states
* No reminders framed as obligation
* Journals may be created independently of habits and routines
* Journals should be accessible even if the user never tracks habits

---

## Prohibited Modeling Patterns (Hard Rules)

An iOS implementation must not introduce:

* Stored journal “completion”
* Journal-driven habit logging
* Journal-based streaks or momentum
* Required journaling flows
* Implicit coupling to goals or routines

If deleting all journals changes progress, the implementation is invalid.

---

## Mental Model for iOS Engineers

> **Habits record behavior.
> Journals record experience.
> One must never replace the other.**

If a feature proposal makes journaling “count” for something, it violates Northstar.

---

## One-Sentence Summary

Journal is a first-class, non-authoritative reflection system composed of reusable templates and time-bound entries that provide narrative context without affecting tracking, completion, or progress.
