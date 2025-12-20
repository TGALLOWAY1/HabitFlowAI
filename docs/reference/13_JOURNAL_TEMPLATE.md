# 13_JOURNAL_TEMPLATE.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **JournalTemplate** is a **structured prompt definition** that helps a user create a journal entry with minimal friction.

JournalTemplates define **what to ask**, not **what is true**.

Templates are:

- reusable
- optional
- non-evaluative

They support reflection, not tracking.

---

## Core Invariants (Must Never Be Violated)

### Templates Store Structure, Not Responses

A JournalTemplate must never:

- store user answers
- store completion state
- track usage frequency

Templates are static prompt schemas.

---

### Templates Do Not Track Progress

JournalTemplates must never:

- create HabitEntries
- affect streaks or momentum
- imply obligation (“missed journals” is forbidden)

Journaling is always optional.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
JournalTemplate {
  id: string

  title: string                 // e.g. "Workout Log"
  description?: string

  categoryId?: string           // UI grouping only

  fields: JournalField[]

  sortOrder?: number
  isArchived?: boolean

  createdAt: string
  updatedAt: string
}
````

---

### JournalField

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

## Category Relationship

* `categoryId` is **organizational only**
* Used for:

  * template browsing
  * grouped template libraries
* Must not imply meaning, priority, or obligation

---

## System-Provided vs User-Created Templates

Both are allowed.

Rules:

* System templates may be seeded
* Users may edit or create templates
* Editing a template does **not** affect existing JournalEntries

Templates are versionless by default.

---

## What JournalTemplate Must NOT Do (Anti-Patterns)

JournalTemplate must never:

* ❌ own entries
* ❌ track completion
* ❌ affect habits or goals
* ❌ enforce frequency
* ❌ encode evaluation or judgment

If deleting all templates changes any progress metric, the system is broken.

---

## Deletion & Archival Semantics

* Archiving a template hides it from creation flows
* Existing JournalEntries remain intact
* Deleting a template must never delete entries

---

## LLM / Design Decision Checklist

Before implementing anything involving JournalTemplate, the system must ask:

1. Is this defining prompts, not truth?
2. Would deleting templates leave all tracking intact?
3. Is this optional and non-evaluative?
4. Is Category used only for organization?

If any answer is **no**, the design is invalid.

---

## One-Sentence Summary

JournalTemplate is a reusable, non-evaluative prompt schema that helps users reflect without tracking, scoring, or enforcing behavior.
