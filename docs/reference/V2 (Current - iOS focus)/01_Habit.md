# Habit — Canonical Object (V4)

> **Authority Notice**
> This document is authoritative.
> If any implementation, PRD, cache, or UI behavior disagrees with this document, **the implementation is wrong**.

---

## Definition (Non-Negotiable)

A **Habit** is a *repeatable behavioral intent* the user chooses to track.

A Habit:
* Defines **what kind of behavior may be logged**
* Represents **intent**, not outcome
* Never stores completion, progress, or metrics

All behavioral truth is represented **exclusively** by `HabitEntry`.

---

## Habit Types (Locked)

Every Habit is exactly one of the following:

```ts
type: "standard" | "bundle"
```

---

## Standard Habit

A **standard habit** represents a single, loggable behavior.

Examples:

* “Run”
* “Meditate”
* “Drink Water”

Standard habits:

* May create HabitEntries
* Are the **only** habits that ever produce entries
* Are the **atomic unit of behavioral truth**

---

## Bundle Habit (First-Class)

A **bundle habit** represents *compound intent* composed of multiple child habits.

A bundle habit:

* ❌ never produces HabitEntries
* ❌ cannot be logged directly
* ✅ derives completion exclusively from child habits
* ✅ exists only as an interpretive structure

> **If a bundle has a HabitEntry, the implementation is invalid.**

---

## Bundle Types (Non-Negotiable)

```ts
bundleType: "checklist" | "choice"
```

The bundle type is fixed at creation time.

---

## Checklist Bundle

### Mental Model

> “I want to do **all** of these.”

### Rules (Checklist)

* All children are standard habits
* Bundle completion is derived
* No ordering is enforced
* No partial credit is stored
* Bundle has zero entries

### Derived Completion (Checklist)

For a given `dayKey`:

```ts
isChecklistBundleComplete =
  forAll childHabitId:
    isHabitComplete(childHabitId, dayKey)
```

Completion is derived strictly from `HabitEntry`.

---

## Choice Bundle

### Mental Model

> “I want to do **one of these**.”

### Rules (Choice)

* Exactly **one** child may be completed per `dayKey`
* Children are mutually exclusive per day
* Logging a second child requires explicit replacement
* Bundle has zero entries

### Derived Completion (Choice)

```ts
completedChildren =
  count(childHabitId where isHabitComplete(childHabitId, dayKey))

isChoiceBundleComplete =
  completedChildren == 1
```

States:

* `0` → incomplete
* `1` → complete
* `>1` → invalid (must be prevented or repaired)

---

## Frequency (Aggregation Only)

```ts
frequency: "daily" | "weekly"
```

Frequency:

* Affects aggregation only
* Never enforces scheduling
* Never creates “missed” state
* Applies uniformly to bundles and children

All child habits in a bundle **must share the same frequency**.

---

## Category (Required)

Every Habit (including bundles) must belong to **exactly one Category**.

* Bundles and children must share the same `categoryId`
* Category is organizational only
* Category owns no logic or progress

---

## Canonical Habit Shape (Semantic)

```ts
Habit {
  id: string
  title: string
  description?: string

  categoryId: string        // REQUIRED

  frequency: "daily" | "weekly"
  valueType: "boolean" | "numeric"
  unit?: string

  type: "standard" | "bundle"
  bundleType?: "checklist" | "choice"

  childHabitIds?: string[]     // required if type == "bundle"
  parentBundleId?: string      // required if child

  isArchived?: boolean

  createdAt: string
  updatedAt: string
}
```

### Hard Constraints

* `type == "bundle"` → `childHabitIds.length >= 2`
* Bundle habits:

  * Must not appear in logging UI
  * Must never be assigned to HabitEntry
* Child habits:

  * Must not belong to more than one bundle of the same type

---

## Relationship to Other Objects

* **HabitEntry** → only references standard habits
* **Goals** → aggregate child habits, never bundles
* **Routines** → may reference child habits
* **Bundles** → never own history

---

## Prohibited Modeling Patterns

An implementation must not:

* Store bundle completion
* Create bundle entries
* Aggregate bundle progress into goals
* Allow logging bundles
* Treat bundles as behavioral truth

---

## Mental Model

> **Standard habits create truth.
> Bundles interpret truth.
> Entries remain the only facts.**

---

## One-Sentence Summary

A Habit defines behavioral intent; standard habits produce HabitEntries, while bundle habits derive their completion exclusively from child habits without ever owning history.

---
