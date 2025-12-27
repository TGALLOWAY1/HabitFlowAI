# Metrics (iOS Canonical)

> **Canonical Concept**
>
> This document is authoritative.
> If implementation, PRDs, caches, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

**Metrics** are **derived, non-authoritative read models** computed from canonical sources of truth.

Metrics:

* are **never stored as historical truth**
* are **fully recomputable**
* exist only to **support UI, feedback, and insight**

If deleting all metrics changes what actually happened, the system is broken.

---

## Canonical Sources of Truth

Metrics may derive **only** from:

1. **HabitEntry** — behavioral truth
2. **DayKey** — aggregation boundary
3. **GoalLink** — contribution semantics

Metrics must **never** derive from:

* cached logs
* UI state
* stored completion flags
* server-only aggregates

---

## Time Semantics (DayKey)

### DayKey Is the Aggregation Boundary

A **DayKey** is a timezone-normalized calendar date (`YYYY-MM-DD`) representing the user’s *subjective day*.

All metrics aggregate by **DayKey**, never by timestamps.

```ts
DayKey = "YYYY-MM-DD"
```

---

### DayKey Derivation Rules (iOS)

When creating any time-based record:

1. Capture `timestampUtc`
2. Convert to user’s active timezone
3. Derive DayKey
4. Persist DayKey immutably

**DayKey is derived once and never recomputed.**

Changing timezones later does not rewrite history.

---

### iOS Responsibility

* iOS may derive DayKey locally **or**
* receive DayKey from backend

Both are valid **as long as the rule above is honored**.

---

## Metric Categories
Metrics fall into four canonical groups:

1. Completion
2. Streak
3. Momentum
4. Progress

All are **derived at read time**.

# REVISIT THIS 
All weekly and momentum metrics use rolling windows by default.
Calendar-aligned weeks are not used unless explicitly added in the future.


---

## Completion Metrics

### Daily Habit Completion

A habit is complete on a DayKey **iff**:

```ts
exists HabitEntry
where habitId == X
  and dayKey == Y
  and deletedAt == null
```

Notes:

* No boolean completion field exists
* Presence of an entry is completion

---

### Weekly Habit Completion

Weekly completion aggregates over a **set of DayKeys**.

**Binary weekly habit**

```ts
isComplete = count(entriesInWeek) >= 1
```

**Frequency weekly habit**

```ts
isComplete = count(entriesInWeek) >= weeklyTarget
```

**Quantity weekly habit**

```ts
isComplete = sum(entry.value) >= weeklyTarget
```

No stored weekly counters. Ever.

---

## Streak Metrics

### Definition

A **streak** is the count of **consecutive qualifying windows** (days or weeks) where completion conditions were met.

Streaks:

* are derived
* are non-punitive
* reset naturally

---

### Daily Streak

```ts
dailyStreak(habitId, referenceDayKey)
```

Computed as consecutive completed DayKeys ending at the reference.

Rules:

* If today is incomplete → current streak = 0
* Best/previous streaks may still be shown

---

### Weekly Streak

```ts
weeklyStreak(habitId, referenceWeek)
```

A week either qualifies or does not.

No partial penalties.

---

## Momentum Metrics

### Definition

**Momentum** answers:

> “Is this habit alive right now?”

It does **not** measure success or failure.

---

### Canonical Momentum Computation

**Daily habits**

* Lookback: last 7 DayKeys
* Range: 0–7

```ts
momentum7 = count(completedDayKeys in window)
```

**Weekly habits**

* Lookback: last 4 weeks
* Range: 0–4

Momentum should decay naturally and be framed positively in UI.

---

## Progress Metrics

### Habit Progress

Derived using:

* entry count (frequency)
* entry sum (quantity)

Progress is always computed from HabitEntries.

---

### Goal Progress

Goal progress is derived from linked habits:

```ts
goalProgress =
  Σ over GoalLinks:
    count(entries) OR sum(entry.value)
```

Rules:

* Goals never store progress
* Bundles resolve to child habits before aggregation
* Goals linked to habits have enforced unit alignment

Any manual correction to goal progress must occur by editing or creating a HabitEntry for the relevant day.

---

### Skill / Insight Metrics (Optional)

Skill levels, scores, or insights:

* are interpretive
* must be monotonic if used for “levels”
* must never affect habit or goal truth

---

## Storage Rules (Critical)

### Allowed

* Runtime caches (in-memory)
* UI snapshots
* On-demand recomputation

Any cached or backend-provided metric is non-authoritative.

Metrics must be recomputable from:
- HabitEntry
- GoalLink
- DayKey

Cached metrics must be discardable without data loss.


### Forbidden

* ❌ stored completion flags
* ❌ stored streak counters
* ❌ stored momentum values
* ❌ stored goal totals
* ❌ stored weekly summaries

If it can drift from HabitEntry → it must not be stored.

---

## iOS Implementation Notes

### What iOS Should Compute Locally

* Daily completion (presence check)
* Day view completion state
* Simple streaks (if data window is available)
* Momentum indicators for UI

### What iOS May Request from Backend

* Aggregated metric views (optional)
* Historical windows for charts
* Goal progress summaries

In all cases:

> **Backend responses must be derivable from HabitEntry + DayKey.**

---

## Anti-Patterns (Do Not Implement)

* ❌ DayLog-style stored aggregates
* ❌ Completion booleans on habits
* ❌ Incrementing streak counters
* ❌ “Late” or “missed” penalties
* ❌ Time-based punishment mechanics

---

## Design Checklist (Before Shipping Any Metric)

Ask:

1. Can this be recomputed from HabitEntry + DayKey?
2. If all metrics are deleted, does truth remain?
3. Does timezone change preserve history?
4. Is this non-punitive by default?

If **any answer is no**, do not ship.

---

## One-Sentence Summary

**Metrics are fully derived, non-authoritative read models computed from HabitEntries using DayKey windows to support insight and motivation without ever becoming truth.**

