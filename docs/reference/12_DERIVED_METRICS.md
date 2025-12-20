# 12_DERIVED_METRICS.md

> **Canonical Concept**
>
> This document is authoritative.  
> If implementation, PRDs, caches, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **Derived Metric** is any value that is **computed** from canonical records and must **never** be stored as authoritative state.

If deleting all cached or derived fields changes the ground truth, **the system is broken**.

---

## Canonical Sources of Truth

Derived metrics may read from:

- **HabitEntry** (primary)
- **DayKey** (aggregation boundary)
- **GoalLink** (contribution semantics)
- **HabitPotentialEvidence** (UI hints only; never truth)

Nothing else.

---

## Derived Metric: Completion State

### Daily Habit Completion

A daily habit is complete on a given DayKey **iff**:

```ts
exists HabitEntry
where habitId == X
  and dayKey == Y
  and deletedAt == null
````

This value is:

* computed
* not stored
* invalidated on every entry mutation

---

### Weekly Habit Completion / Progress

Weekly habits aggregate entries within a week window (set of DayKeys).

#### Binary Weekly Habit

```ts
isComplete = count(entriesInWeek) >= 1
```

---

#### Frequency Weekly Habit

```ts
progress = count(entriesInWeek)
isComplete = progress >= weeklyTarget
```

---

#### Quantity Weekly Habit

```ts
progress = sum(entry.value)
isComplete = progress >= weeklyTarget
```

Weekly state is always derived — never stored.

---

### Bundle Parent Completion

Bundle parents never have entries.

Completion is derived from child habits:

```ts
isBundleComplete(bundleHabitId, dayKey) =
  any childHabitId has isCompleteDaily(childHabitId, dayKey)
```

---

## Derived Metric: Streak

### Definition (Locked)

A **Streak** is the count of **consecutive qualifying time windows** in which a habit met its completion condition.

The window type depends on habit cadence.

---

### Daily Habit Streak

```ts
dailyStreak(habitId, referenceDayKey)
```

Computed as the number of consecutive DayKeys ending at `referenceDayKey` where daily completion is true.

Rules:

* If today is incomplete:

  * current streak = 0
  * best / last streak may still be shown
* Both values must derive from the same entries

---

### Weekly Habit Streak

```ts
weeklyStreak(habitId, referenceWeek)
```

Computed as the number of consecutive completed weeks ending at the reference week.

Rules:

* No day-level punishment inside a week
* A week either qualifies or does not

---

### What Streak Must NOT Do

* ❌ stored as a counter
* ❌ incremented imperatively
* ❌ used as punishment

Streak is a **read model**, not a state machine.

---

## Derived Metric: Momentum

### Definition (Locked)

**Momentum** is a **recency-weighted activity signal** indicating how active a habit has been lately.

Momentum answers:

> “Is this habit alive right now?”

It does **not** answer:

* Am I good?
* Am I failing?
* Am I behind?

---

### Canonical Momentum Computation (Recommended)

#### Daily Habits

* Lookback window: last 7 DayKeys
* Score range: 0–7

```ts
momentum7(habitId, todayKey) =
  count of completed DayKeys in [todayKey - 6 … todayKey]
```

---

#### Weekly Habits

* Lookback window: last 4 weeks
* Score range: 0–4

```ts
momentum4w(habitId, thisWeek) =
  count of completed weeks in lookback window
```

Momentum may decay naturally but must remain non-punitive in UI.

---

## Derived Metric: Progress

### Weekly Habit Progress

Already defined via frequency or quantity aggregation.

---

### Goal Progress

Goal progress is derived as:

```ts
goalProgress(goalId) =
  Σ over GoalLinks:
    if aggregationMode == "count":
      count(entries for habitId)
    if aggregationMode == "sum":
      sum(entry.value for habitId)
```

No goal-owned counters or logs are allowed.

---

### Skill Progress

Skill progress is **interpretive**, not canonical.

It may derive from:

* entry counts
* entry sums
* consistency measures
* weighted combinations

Rules:

* Must be monotonic for level-style UX
* Must be recomputable
* Must not affect habit or goal truth

---

## Storage Rules (Critical)

### Allowed Caching (Non-Authoritative)

Derived metrics may be cached **only** if:

* caches can be fully invalidated
* recomputation yields identical results
* edits, deletes, and backfills trigger invalidation

Examples:

* today view computed state
* weekly summary snapshots
* goal chart points

---

### Forbidden Storage (Never Allowed)

* ❌ habit completion booleans
* ❌ streak counters on Habit
* ❌ goal totals on Goal
* ❌ bundle parent completion flags
* ❌ progress snapshots treated as truth

If it can drift from HabitEntry, it must remain derived.

---

## LLM / Design Decision Checklist

Before introducing any new metric, field, or collection, the system must ask:

1. Can this be recomputed solely from HabitEntries + DayKey (+ GoalLink)?
2. If I delete this cache, do I get the same UI result?
3. Do edits, deletes, and backfills reflow correctly?
4. Am I accidentally creating a parallel tracking system?

If any answer is **no**, do not ship it.

---

## One-Sentence Summary

Derived metrics (completion, streak, momentum, progress) are recomputable read models computed from HabitEntries using DayKey windows and must never be stored as authoritative state.