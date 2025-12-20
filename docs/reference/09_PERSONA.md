# 09_PERSONA.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **Persona** is a user-selected **focus mode** that represents how the user wants to engage with HabitFlow *right now*.

A Persona shapes **attention, defaults, and emphasis** — not truth, ownership, or identity.

A Persona answers:

> “What kind of progress am I focusing on in this season?”

It does **not** answer:

- Who am I, fundamentally?
- What data exists?
- What counts as success?

---

## Why Persona Exists (System Purpose)

Persona exists to:

1. Reduce cognitive overload
2. Support seasonal or situational focus
3. Personalize defaults without mutating data
4. Frame onboarding and re-onboarding flows
5. Control what is surfaced — not what is stored

Persona is a **lens**, not a container.

---

## Core Invariants (Must Never Be Violated)

### Persona Owns No Data

A Persona must never:

- own habits
- own goals
- own categories
- own entries
- own progress

If deleting a Persona deletes or invalidates data, the system is wrong.

---

### Persona Is Non-Exclusive

- A habit may be relevant to many personas
- A persona does not “claim” objects
- Switching personas must not require reassignment

Persona controls **visibility and emphasis only**.

---

### Persona Is Optional and Reversible

- Users may have zero personas
- Users may switch personas freely
- Personas may be renamed, archived, or replaced

No migrations. No penalties.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
Persona {
  id: string

  name: string                  // e.g. "Runner", "Creative", "Stability Mode"
  description?: string          // optional framing copy

  isSystemProvided?: boolean    // seeded vs user-created
  isActive?: boolean            // UI state; at most one active

  createdAt: string
  updatedAt: string
}
````

### Notes

* `isActive` is a UI/state concept, not a hard data constraint
* Multiple personas may exist; typically one is “in focus”

---

## Persona’s Position in the Hierarchy (Influence Only)

Persona sits at the top of the **influence chain**, not the ownership chain.

```
Persona (focus mode)
  ↓ primes
Identity (narrative meaning)
  ↓ informs
Goals (commitments)
  ↓ aggregate
Habits / Routines / Journals
```

Parallel and orthogonal:

```
Categories → organize Habits / Routines / Goals
```

Persona influences **what is emphasized**, not **what exists**.

---

## What Persona Can Influence (Allowed)

### Onboarding & Re-Onboarding

Persona may influence:

* which categories are highlighted
* which example habits are suggested
* which goals are prefilled
* language and tone used in copy

---

### Dashboard & Day View

Persona may influence:

* which categories are expanded by default
* which habits are pinned or surfaced
* which metrics are shown first (e.g., sleep vs training)

All underlying data remains intact.

---

### Coaching & LLM Context

Persona is valid context for:

* coaching tone
* reminder framing
* reflection prompts

Example:

> “As someone in Runner mode, what would a good day look like — even if imperfect?”

---

## What Persona Must NOT Do (Anti-Patterns)

Persona must never:

* ❌ filter or hide data permanently
* ❌ override habit logic
* ❌ enforce priorities
* ❌ change aggregation rules
* ❌ imply obligation or failure

If Persona changes what *counts*, it is dangerous.

---

## Deletion & Archival Semantics

* Deleting or archiving a Persona:

  * removes it from selection
  * does not affect habits, goals, entries, or categories
* Switching personas must be instant and reversible

---

## LLM / Design Decision Checklist

Before implementing anything involving Persona, the system must ask:

1. Is this changing what the user sees, not what exists?
2. Would switching personas leave all data intact?
3. Am I shaping emphasis, not rules?
4. Could this be undone without consequence?

If any answer is **no**, Persona is being misused.

---

## One-Sentence Summary

Persona is a reversible focus mode that shapes attention, defaults, and tone without owning or mutating any data.