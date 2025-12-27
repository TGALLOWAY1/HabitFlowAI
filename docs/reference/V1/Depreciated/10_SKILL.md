# 10_SKILL.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **Skill** is an **interpretive capability layer** that represents what the user is becoming capable of through repeated habits over time.

A Skill **interprets progress — it does not track it**.

A Skill answers:

> “What ability am I building by doing these habits?”

It does **not** answer:

- Did I do the habit today?
- How many reps did I log?
- Am I on pace?

Those remain habit- and goal-level concerns.

---

## Why Skill Exists (System Purpose)

Skill exists to:

1. Reinforce identity-based motivation
2. Translate raw activity into capability growth
3. Provide a non-punitive sense of progress
4. Support long-horizon reflection
5. Power the Skill Tree visualization

Skill is **semantic glue**, not a tracker.

---

## Core Invariants (Must Never Be Violated)

### Skill Owns No Source Data

A Skill must never:

- create HabitEntries
- store totals
- store streaks
- override goals
- mutate habits

If deleting Skill changes any computed totals, the system is broken.

---

### Skill Is Derived from Habits

Skill may read from:

- HabitEntries
- Goals (derived views only)
- GoalLinks (aggregation semantics)

Skill must never write back.

---

### Skill Is Interpretive, Not Evaluative

- No failure states
- No decay
- No punishment
- Progress may plateau, but must never regress

This is critical for emotional safety.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
Skill {
  id: string

  name: string                 // e.g. "Endurance", "Emotional Regulation"
  description?: string

  categoryId?: string          // optional organizational anchor
  linkedHabitIds: string[]     // habits that contribute

  createdAt: string
  updatedAt: string
}
````

### Notes

* `linkedHabitIds` defines *what* contributes, not *how much*
* Category anchoring is organizational only

---

## Skill’s Position in the System

Skill sits **above** goals and habits as interpretation, not control.

```
Persona → focus
Identity → meaning
Category → structure
Goal → commitment
Habit → action
Routine → support
HabitEntry → truth
Skill → interpretation
```

Skill reads **downward only**.

---

## Skill Progress Computation (Derived, Not Stored)

### Inputs

Skill progress may derive from:

* count of HabitEntries
* sum of numeric values
* consistency over time
* weighted combinations

These formulas are **view-layer decisions**, not schema fields.

---

### Example Interpretations

| Skill                | Derived From                            |
| -------------------- | --------------------------------------- |
| Endurance            | Total running miles + long runs         |
| Strength             | Lift sessions + rep volume              |
| Emotional Regulation | Journaling frequency + breathing habits |
| Creative Fluency     | Music sessions + completed sketches     |

---

## Leveling & Visualization Rules

If levels are shown:

* Levels are **soft milestones**
* No regression
* No penalties
* Level-ups are celebratory, not coercive

Any `skillLevel` must be:

* monotonic
* derived
* recomputable

No skill state may be stored canonically unless fully recomputable.

---

## What Skill Must NOT Do (Anti-Patterns)

Skill must never:

* ❌ create goals
* ❌ gate habits
* ❌ enforce pacing
* ❌ block progress
* ❌ imply obligation
* ❌ override category grouping

If Skill starts behaving like a system of rules, it is broken.

---

## Deletion & Mutation Rules

* Deleting a Skill:

  * removes the interpretation
  * leaves all habits and goals intact
* Editing linked habits:

  * changes interpretation immediately
  * does not rewrite history

---

## LLM / Design Decision Checklist

Before touching Skill, the system must ask:

1. Is this purely interpretive?
2. Could I delete this without losing data?
3. Does this read from HabitEntries only?
4. Is progress non-punitive and monotonic?

If any answer is **no**, Skill is being misused.

---

## One-Sentence Summary

Skill is a read-only interpretive layer that translates habit activity into a sense of growing capability without owning or enforcing progress.
