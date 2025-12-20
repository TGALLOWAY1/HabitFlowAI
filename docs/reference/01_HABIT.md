 # 01_HABIT.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, or derived documents disagree with this file, **they are wrong**.

---

## Definition (Non-Negotiable)

A **Habit** is a *repeatable behavior* that a user chooses to track over time.

It is the **primary unit of action** in HabitFlow.

All progress, streaks, momentum, goals, analytics, and visualizations are ultimately derived from **HabitEntries** linked to Habits.

A Habit:
- Represents **intent** (“I want to do this repeatedly”)
- Does **not** store outcomes directly
- Never tracks completion without an Entry

This definition applies uniformly across:
- Daily habits
- Weekly habits
- Bundled habits
- Habits linked to routines

---

## Conceptual Role (Why Habits Exist)

Habits exist to:

1. Anchor identity  
   (“I am someone who runs”)
2. Normalize imperfect consistency  
   (no punishment for misses)
3. Serve as the **single source of behavioral intent**
4. Feed higher-order abstractions  
   (Goals, Skills, Wellbeing insights)

Habits explicitly **do NOT**:

- Enforce schedules
- Judge performance
- Store derived metrics (streaks, momentum, totals)
- Compete with Goals as a tracking system

---

## Core Invariants (Must Never Be Violated)

### Entry-Driven Truth

- A Habit is **only complete** for a given day or week if at least one valid `HabitEntry` exists.
- Completion state is **always computed**, never stored.

There is no such thing as “habit completion data” independent of entries.

---

### Habits Own Tracking (Not Goals or Routines)

- Habits are the sole tracking primitive.
- Goals aggregate HabitEntries.
- Routines generate *potential evidence* only.

No other object may bypass or replace Habits as the tracking authority.

---

### Habits Are Non-Punitive

- Missing a habit creates **no failure state**
- No overdue, decay, or negative indicators by default
- No red states or shame mechanics

This rule governs **UI, analytics, copy, and coaching**.

---

## Habit Taxonomy (Variants of One Concept)

An LLM or implementation must treat these as **variants**, not separate objects.

---

### Frequency

Habit frequency encodes how often a behavior is intended to be *mentally present*, not when it is scheduled.

Supported frequencies are intentionally limited.

Rationale:
- Habits must recur often enough to support identity, momentum, and non-punitive normalization.
- Cadences longer than one week do not produce reliable behavioral reinforcement.
- Monthly or longer intervals shift the object from "habit" to "commitment" or "project", which belong in Goals or Journals.

If a behavior does not meaningfully recur within a 7-day window, it is not a Habit.

```ts
frequency: "daily" | "weekly"
``` 

Daily: evaluated once per DayKey
Weekly: evaluated against a weekly intent
Weekly habits:
Do not render empty daily cells
Aggregate entries across a week window

One-Sentence Summary
A Habit is the primary, non-punitive unit of behavior tracking in HabitFlow; it owns intent, delegates history to entries, and feeds all higher-order systems without being overridden by them.