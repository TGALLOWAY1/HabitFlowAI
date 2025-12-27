# 07_IDENTITY.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, coaching logic, or UI flows disagree with this file, **they are wrong**.

---

## Definition (Locked)

An **Identity** is a user-authored **narrative self-image** that represents the kind of person the user wants to become *right now*.

Identity provides **meaning and motivation**, not structure, tracking, or constraints.

An Identity answers:

> “Who am I trying to be?”

It does **not** answer:

- What should I do today?
- Did I complete something?
- How much progress have I made?

---

## Identity’s Role in HabitFlow

Identity exists to:

1. Frame goal selection
2. Shape language and coaching tone
3. Provide psychological safety
4. Reduce shame when habits lapse
5. Support reflection and recommitment

Identity exists **outside the data graph**.

---

## Core Invariants (Must Never Be Violated)

### Identity Owns No Tracking

Identity must never:

- create HabitEntries
- aggregate progress
- own streaks or metrics
- gate or block behavior

If removing Identity changes any computed data, the system is broken.

---

### Identity Is Non-Referential

Identity:

- has **no foreign keys**
- is **not required** for any object
- is **never a join target**

No other object may depend on Identity to function.

---

### Identity Is User-Editable and Ephemeral

Users may:

- change it
- contradict it
- abandon it
- leave it blank

There are:

- no migrations
- no cascading effects
- no penalties

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
Identity {
  id?: string           // optional; identity may be free-text only
  label: string         // e.g. "I am a runner"
  createdAt?: string
  updatedAt?: string
}
````

### Notes

* Identity may be stored as:

  * a single active string, or
  * a list of historical strings
* Both are acceptable because identity is **narrative**, not relational

---

## Hierarchy Placement (Influence, Not Ownership)

Identity sits above structural objects as **context**, not parentage.

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

**Key principle:**
Identity influences **why**, not **what** or **how**.

---

## How Identity Is Used (Allowed)

### Onboarding & Refocus

Identity may be prompted during:

* onboarding
* resets
* major life transitions

Example prompts:

* “What kind of person do you want to be right now?”
* “Complete the sentence: *I am a ___ person.*”

---

### Goal Creation

Identity may:

* preface goal creation flows
* influence copy and suggestions
* frame commitments as expressions of self

Example:

> “As someone who sees themselves as a runner, what commitment feels right?”

No linking occurs.

---

### Journaling & Coaching

Identity is ideal for:

* reflection prompts
* LLM coaching context
* motivation nudges

Example:

> “How did today support the person you’re becoming?”

---

## What Identity Must NOT Do (Anti-Patterns)

Identity must never:

* ❌ tag habits
* ❌ filter data
* ❌ drive analytics
* ❌ enforce prioritization
* ❌ imply obligation

If Identity changes behavior without explicit user intent, it is misused.

---

## Deletion & Mutation Rules

* Identity can be edited, replaced, or cleared
* No downstream effects are allowed
* No data invalidation occurs

---

## LLM / Design Decision Checklist

Before touching Identity, the system must ask:

1. Is this narrative, not operational?
2. Would removing Identity break nothing?
3. Is the user in full control of meaning?
4. Am I shaping tone, not logic?

If any answer is **no**, Identity is being misused.

---

## One-Sentence Summary

Identity is a user-authored narrative self-image that provides motivation and context without owning data or enforcing behavior.
