# Persona — Canonical Object (V2, iOS-First)

> **Authority Notice**
> This document is authoritative.
> If any iOS implementation, PRD, analytics layer, or UI behavior disagrees with this document, **the implementation is wrong**.

---

## Definition (Locked)

A **Persona** is a user-selected **focus mode** that shapes how the user engages with HabitFlow *in the current season*.

A Persona influences **attention, defaults, framing, and emphasis** —
**never truth, ownership, or data semantics**.

A Persona answers:

> **“What kind of progress am I focusing on right now?”**

It does **not** answer:

* Who am I, fundamentally?
* What data exists?
* What counts as completion or success?

---

## Persona’s Role in the iOS App

In the iOS app, Persona is:

* A **pure UI lens**
* A **context provider** for dashboards, onboarding, and coaching
* A way to reduce cognitive load by surfacing *relevant* things first

Persona is **never**:

* A data container
* A filter that removes access to data
* A rules engine

Switching Personas must be:

* Instant
* Reversible
* Side-effect free

---

## Core Invariants (Must Never Be Violated)

### 1. Persona Owns No Data

A Persona must never own, create, delete, or mutate:

* Habits
* HabitEntries
* Goals
* Categories
* Journals
* Wellbeing entries
* Progress, streaks, or metrics

Deleting all Personas must leave **all data intact and meaningful**.

---

### 2. Persona Is Non-Exclusive

* A Habit may be relevant to multiple Personas
* A Goal may surface under different Personas
* A Category may appear in many Personas

Persona **never claims objects**.

---

### 3. Persona Is Optional and Reversible

* Users may have zero Personas
* Users may switch Personas freely
* Personas may be renamed, archived, or replaced

No migrations.
No penalties.
No data loss.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
Persona {
  id: string

  name: string                  // e.g. "Fitness", "Creative"
  description?: string          // short framing copy

  type?: "system" | "custom"    // system-seeded vs user-defined

  isActive?: boolean            // UI state only; at most one active

  createdAt: string
  updatedAt: string
}
```

### Notes

* `isActive` is a **view concern**, not a persistence rule
* Personas should be cheap to toggle and safe to ignore

---

## System Personas (Seeded, Non-Exclusive)

The iOS app ships with **four system Personas**.
These are *presets*, not hard modes.

---

### 1. Fitness Persona

**Focus:** Physical health, training, recovery, consistency

Persona emphasizes:

* Fitness-related Categories (e.g. Strength, Cardio, Mobility)
* Habits with physical effort or recovery signals
* Metrics like:

  * Energy
  * Sleep
  * Readiness (derived)

Dashboard tendencies:

* Readiness / recovery surfaced early
* Training-related habits prioritized
* Longer-term progress framing (weeks, months)

Must **not**:

* Enforce training schedules
* Penalize missed days
* Change habit frequency logic

---

### 2. Emotion Regulation Persona

**Focus:** Emotional stability, self-awareness, regulation

Persona emphasizes:

* Emotional wellbeing habits
* Journaling and reflection surfaces
* Wellbeing metrics (mood, calm, stress)

Dashboard tendencies:

* Gentle language
* Fewer, calmer visuals
* Reflection prompts surfaced prominently

Must **not**:

* Gate or hide non-emotional habits
* Imply failure from negative states
* Turn wellbeing metrics into scores

---

### 3. Creative Persona

**Focus:** Expression, experimentation, output over consistency

Persona emphasizes:

* Creative Categories (Music, Writing, Art, etc.)
* Session-based habits
* Output-oriented goals

Dashboard tendencies:

* Fewer completion cues
* More “last touched / recent momentum” framing
* Encouragement toward exploration, not streaks

Must **not**:

* Penalize irregular cadence
* Force daily framing
* Treat gaps as regressions

---

### 4. Growth / Learning Persona

**Focus:** Skill development, learning loops, mastery over time

Persona emphasizes:

* Learning-related habits
* Repetition and revisit patterns
* Skill-adjacent insights (derived)

Dashboard tendencies:

* Weekly or longitudinal views
* Reinforcement of “practice, not performance”
* Surfacing revisit / review habits

Must **not**:

* Turn skills into rigid levels
* Lock learning behind metrics
* Penalize slow progress

---

## Persona’s Position in the System (Influence Only)

Persona sits at the **top of the influence stack**, never the ownership stack.

```
Persona (focus & emphasis)
   ↓
Identity (meaning, narrative)
   ↓
Goals (orientation & commitment)
   ↓
Habits / Routines / Journals
```

Parallel and orthogonal:

```
Categories → organization & navigation
```

Persona influences **what is surfaced first**, not **what exists**.

---

## What Persona May Influence (Allowed)

### Onboarding & Re-Onboarding

Persona may shape:

* Suggested Categories
* Example Habits
* Starter Goals
* Tone and language

All suggestions are optional and editable.

---

### Dashboard & Day View

Persona may influence:

* Which Categories expand by default
* Which Habits are pinned or surfaced
* Which derived metrics are shown first

Underlying data remains fully accessible.

---

### Coaching, Copy & LLM Context

Persona is valid context for:

* Coaching tone
* Reflection prompts
* Reminder phrasing

Example:

> “In Creative mode, what would *showing up* look like today?”

---

## What Persona Must NEVER Do (Hard Prohibitions)

Persona must never:

* ❌ Filter or hide data permanently
* ❌ Change aggregation rules
* ❌ Override habit frequency
* ❌ Imply obligation or failure
* ❌ Store progress or state
* ❌ Become a proxy for identity

If switching Persona changes *what counts*, it violates Northstar.

---

## Deletion & Archival Semantics

* Deleting or archiving a Persona:

  * Removes it from selection
  * Does **not** affect any data
* If the active Persona is deleted:

  * App falls back to a neutral / default view

---

## iOS Implementation Guidance

* Treat Persona like a **theme + lens**, not a mode
* Persona changes should trigger:

  * View recomposition
  * Copy/tone changes
* Persona changes must **not** trigger:

  * Writes
  * Migrations
  * Recomputations of truth

---

## Mental Model for iOS Engineers

> **Personas change emphasis, not reality.**
> **Truth stays put. Views adapt.**

If a feature feels like it needs Persona state, ask:

> “Is this shaping what we show, or changing what exists?”

If it’s the latter, it’s wrong.

---

## One-Sentence Summary

Persona is a reversible, non-exclusive focus mode that shapes attention, defaults, and tone in the iOS app without owning or mutating any data.
