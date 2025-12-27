# HabitFlow Northstar (iOS-First)

## Purpose

This document defines the **foundational truths and invariants** that govern how data is modeled, stored, and interpreted in the HabitFlow iOS app.

If any screen, feature, or implementation conflicts with this document, **the implementation is wrong**.

This document exists to:

* Prevent data drift
* Avoid web-specific modeling artifacts
* Ensure long-term correctness as the app evolves

---

## Canonical Truth Objects

HabitFlow has **three first-class historical truth stores**.

These are the *only* objects that own time.

### 1. `HabitEntry` — Behavioral Truth

> A record of **what the user did**.

* Each HabitEntry represents a single instance of behavior.
* All progress, streaks, and completion states are **derived** from HabitEntries.
* HabitEntries are append-only by default.

**Rules**

* No other object may represent behavioral history.
* Completion is **never stored**.
* Deleting or editing a HabitEntry affects all derived views.

---

### 2. `JournalEntry` — Reflective Truth

> A record of **what the user reflected on or experienced**.

* JournalEntries capture subjective narrative and reflection.
* They are not behavior and must not affect behavioral progress.
* Journals are first-class, not auxiliary.

**Rules**

* JournalEntries never mutate habits, goals, or streaks.
* Journals may exist with or without habits.
* Journals are not derived from anything else.

---

### 3. `WellbeingEntry` — Subjective State Truth

> A record of **how the user felt at a moment in time**.

* WellbeingEntries capture scalar subjective metrics (mood, energy, sleep, etc.).
* They are orthogonal to both habits and journals.
* They exist solely for insight and self-awareness.

**Rules**

* WellbeingEntries never affect completion, streaks, or goals.
* Aggregation happens at read time.
* UI concepts (e.g., “morning check-in”) must not leak into the model.

Non-canonical UI metadata (e.g. session labels like “morning” or “evening”) may exist on truth objects provided they do not introduce additional aggregation boundaries or containers.

---

## Time & Aggregation

### Ownership of Time

Only truth objects own time:

* HabitEntry
* JournalEntry
* WellbeingEntry

Each must include:

* `timestampUtc`
* `dayKey` (derived using user timezone)

**No other object owns time.**

Objects above the entry layer may store informational dates (e.g. Goal target dates) that never participate in aggregation or truth evaluation.
---

### DayKey

* DayKey is the **only aggregation boundary**.
* All “daily” views are derived.
* DayKey must never be inferred implicitly at read time.

---

## Derived & Interpretive Layers

The following are **not truth** and must never be persisted as historical records:

* Completion
* Streaks
* Progress percentages
* Skill levels
* Readiness / engagement scores
* Charts, trends, summaries

These are:

* Computed from truth objects
* Cached in memory if needed
* Safe to delete without data loss

---

## Canonical Object Stack (Conceptual)

```
Persona      → visibility & framing (UI lens)
Identity     → meaning & narrative
Category     → organization
Goal         → commitment & aggregation intent
Habit        → definition of valid behavior

HabitEntry      → behavioral truth
JournalEntry    → reflective truth
WellbeingEntry  → subjective state truth

Derived Metrics → interpretation
```

**Important iOS rule**

> Anything above the entry layer must be deletable without losing history.

---

## Personas (iOS Interpretation)

Personas are **pure UI lenses**.

They:

* Choose which data to emphasize
* Decide which insights to show
* Influence tone and framing

They **must not**:

* Own data
* Store state
* Change what is written to disk

Switching personas must never cause:

* Data writes
* Migrations
* Recomputations of truth

---

## Goals & Categories

Goals and Categories define **intent**, not progress.

* Goals link to habits
* Categories group habits
* Neither stores completion or progress

**iOS rule**

> Goals behave like views over HabitEntries, not containers of state.

---

## Journals & Habits Are Independent

* A habit can exist without a journal.
* A journal can exist without a habit.
* Neither implies the other.

Do not embed journals inside habits or entries.

---

## Editing & Deletion

All truth objects:

* Support explicit user-initiated edits
* Prefer soft deletion (`deletedAt`)
* Trigger recomputation of derived views only

Deleting interpretations must never delete truth.

---

## Prohibited Modeling Patterns (iOS)

An iOS implementation must **not** introduce:

* Daily summary objects
* Stored “today” state
* Cached completion flags
* Persona-owned progress
* Session-based containers (AM/PM)
* Auto-generated journals
* Heuristic inference of user intent

If the UI needs it, derive it.

---

## Mental Model for iOS Engineers

> **Persist events. Render meaning.**

If a feature feels like it needs stored state, ask:

> “Can this be recomputed from entries?”

If yes, it must not be stored.

---

## Final Invariant

HabitFlow’s durability comes from a single rule:

> **Truth is minimal. Interpretation is flexible.**

The iOS app must protect this separation at all costs.