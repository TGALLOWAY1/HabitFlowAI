# 06_GOAL_LINK.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **GoalLink** defines **how a specific Habit’s entries contribute to a specific Goal**.

A GoalLink is **pure configuration** — not data, not history, and not progress.

It answers exactly one question:

> “When this habit produces entries, how should they count toward this goal?”

---

## Why This Object Exists

Without an explicit GoalLink, systems tend to:

- guess aggregation rules
- hard-code assumptions (“sum if numeric, count otherwise”)
- silently change behavior when habit definitions change

GoalLink makes contribution:

- explicit
- inspectable
- stable over time

---

## Core Invariants (Must Never Be Violated)

### GoalLink Owns Rules, Not Data

GoalLink must never:

- store progress
- store totals
- create HabitEntries
- cache derived values

It is configuration only.

---

### Aggregation Always Pulls from HabitEntries

The only valid aggregation flow is:

```

HabitEntry[]
↓ (filtered by GoalLink)
Aggregation Function
↓
Goal Progress (derived)

```

If progress cannot be recomputed from **HabitEntries + GoalLinks**, the system is invalid.

---

### Directional and One-Way

Contribution flows:

```

Habit → Goal

````

There is no valid reverse influence:

- Goals do not affect habit cadence
- Goals do not change entry semantics
- Goals do not rewrite habit history

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
GoalLink {
  id: string

  goalId: string
  habitId: string

  aggregationMode: "count" | "sum"
  unit?: string              // required if aggregationMode == "sum"

  createdAt: string
}
````

### Notes

* `aggregationMode` must be **explicit** — never inferred at runtime
* `unit` exists to prevent silent mismatches (e.g., miles vs minutes)

---

## Aggregation Semantics (Locked)

### `count`

Used when:

* the habit is boolean, or
* the goal measures occurrences / sessions

Computation:

```ts
count(distinct HabitEntry.id)
```

---

### `sum`

Used when:

* the habit is numeric, and
* the goal measures accumulated quantity

Computation:

```ts
sum(HabitEntry.value)
```

Rules:

* Entries without a value are invalid
* Units must match or be explicitly convertible (future feature)

---

## Multiple Links (Allowed, but Controlled)

### One Habit → Many Goals

Allowed.

Example:

* “Run” contributes to:

  * “Run 500 miles” (sum)
  * “Exercise 100 times” (count)

Each GoalLink defines its own aggregation behavior.

---

### One Goal → Many Habits

Allowed.

Example:

* “Get Fit” aggregates:

  * Running (sum miles)
  * Lifting (count sessions)
  * Yoga (count sessions)

Goal progress is the **sum of each GoalLink’s contribution**.

---

## Editing Rules

### Editing a GoalLink

* Changes affect **past and future** aggregation
* No history rewrite occurs
* Progress is recomputed immediately

This behavior is expected and must be communicated in UI.

---

### Deleting a GoalLink

* Immediately removes that habit’s contribution
* Must **not** delete HabitEntries
* Must **not** mutate other GoalLinks

---

## Manual Goal Logging (Interaction with GoalLink)

When a user logs progress from the Goal UI:

Rules:

1. The user must select a **source habit**
2. The system uses the existing GoalLink
3. A HabitEntry is created or updated
4. Goal progress updates via aggregation

If no GoalLink exists:

* Prompt the user to create one, or
* Create one **explicitly** (never implicitly)

---

## What GoalLink Must NOT Do (Anti-Patterns)

GoalLink must never:

* ❌ store running totals
* ❌ create entries
* ❌ infer aggregation behavior dynamically
* ❌ “fix” unit mismatches silently
* ❌ bypass HabitEntry edits or deletes

If any of these occur, GoalLink has become a tracker — which is forbidden.

---

## LLM / Design Decision Checklist

Before touching GoalLink, the system must ask:

1. Is this configuration, not data?
2. Can aggregation be recomputed deterministically?
3. Are aggregation rules explicit and inspectable?
4. Would deleting all GoalLinks leave habits intact?

If any answer is **no**, the design is invalid.

---

## One-Sentence Summary

GoalLink is an explicit, read-only configuration that defines how a habit’s entries contribute to a goal without owning or storing progress.