# HabitFlow PRD

## Choice Bundle v2 — Option Habits, Entries, Metrics, and Goal Attribution

---

## 1. Overview

### Feature Name

**Choice Habit Bundle v2 (Option Habits + Metric Entries)**

### Status

Proposed – Ready for implementation planning

### Owner

HabitFlow Core

---

## 2. Problem Statement

Users often practice a *category of behavior* (e.g., Calisthenics, Learning, Cardio) using multiple specific actions (pushups, pull-ups, squats). Today, HabitFlow allows a binary “choice” habit, but:

* It hides *which* actions were taken
* It does not allow meaningful contribution tracking toward goals
* It conflates “did the habit” with “how the habit was done”
* It prevents flexible historical analysis (days vs totals)

Users want:

* One **parent habit** for consistency and streaks
* Multiple **option habits** representing real actions
* A **single source of truth** for historical data
* Metrics that are optional at creation but **strictly enforced once defined**
* Goal progress that reflects *how* they showed up, not just *if*

---

## 3. Design Philosophy

This feature is guided by four core principles:

1. **Habits are habits**
   Option choices are real habits, not “sub-events” or “metadata.”

2. **Entries are the source of truth**
   All historical insights (days, totals, averages) derive from entries.

3. **Consistency ≠ Uniformity**
   A habit can be completed in multiple valid ways without fragmenting the habit list.

4. **Explicit beats clever**
   Metric expectations must be clear and enforced to avoid ambiguous history.

---

## 4. Key Concepts & Terminology

### Parent Habit

A top-level habit tracked for consistency.

* Example: *Calisthenics*
* Completion is **binary per day**
* Completion is **derived**, not manually entered

### Option Habit

A habit that exists **within** a parent habit’s bundle.

* Example: *Pushups*, *Pull-ups*, *Squats*
* Optional on any given day
* Can contribute to goals independently

### Entry

The atomic record of something the user did on a day.

* One entry = one option habit on one date
* Entries power all aggregations

---

## 5. User Scenarios

### Scenario 1: Binary consistency + rich attribution

* User tracks *Calisthenics*
* On Monday: does pull-ups and squats
* Calisthenics = complete
* History shows:

  * Pull-ups: 15 reps
  * Squats: 60 reps

### Scenario 2: Optional metric habits

* User creates *Running* option habit
* Metric = miles (required)
* Every time Running is selected, miles must be entered
* User can later see:

  * Total miles
  * Days run
  * Average miles per run

### Scenario 3: Goal linkage

* Goal: *Run 500 miles*
* Linked directly to option habit *Running*
* Goal progress derives from entry totals, not parent habit completion

---

## 6. Functional Requirements

### 6.1 Choice Bundle Configuration

A Parent Habit can be configured as a **Choice Bundle**.

#### Bundle Properties

* `bundleType = "choice"`
* `multiSelect = true` (always enabled in v2)

#### Option Habit Definition

Each option includes:

* `id`
* `name`
* `metricMode`

  * `"none"` – completion only
  * `"required"` – numeric value required for every entry
* If `metricMode = required`:

  * `unitName` (string, e.g., reps, miles, minutes)
  * `allowDecimal` (boolean)
  * `suggestedIncrements` (optional UX helper)

> **Important rule**
> Metric mode is optional at creation, but once set to `required`, **all entries must include a value**. Mixed-mode entries are not allowed.

---

### 6.2 Logging Behavior (Daily)

#### Entry Creation Rules

* A user may select **0..N option habits** per day
* For each selected option habit:

  * Create or update **one entry** for that date
* If option habit requires metric:

  * Value input is mandatory
  * Save is blocked without valid value

#### Parent Habit Completion

* Parent habit is **complete** on a date **iff**

  * ≥ 1 option habit entry exists for that parent on that date

Parent completion is **derived**, not independently set.

---

### 6.3 Entry Model (Source of Truth)

#### OptionHabitEntry

```
optionHabitId
parentHabitId
dateKey
value? (number)
unit? (string, stored for historical integrity)
source (manual, routine, activity)
createdAt
updatedAt
```

#### Constraints

* Max one entry per (optionHabitId, dateKey)
* Value required iff option habit metricMode = required

---

## 7. Historical Aggregations (Derived, Not Stored)

All analytics derive from entries:

### Supported Aggregations

For a given option habit:

* **Days used**
  = count of distinct dateKeys with entries
* **Total units**
  = sum of `value` (metric habits only)
* **Average per day used**
* **Best / max day**
* **Trends over time**

For parent habit:

* **Days completed**
* **Streaks**
* **Completion rate**

No separate counters or caches should introduce conflicting logic.

---

## 8. Goal Integration

### Goal Linking Sources

A Goal may link to:

1. Parent Habit (binary completion)
2. Option Habit (preferred for metrics)

### Aggregation Mode

Derived automatically:

* If option habit has metric → `sum(value)`
* If no metric → `count(days with entry)`

### GoalLink Model

```
goalId
sourceType = "habit" | "optionHabit"
habitId?
optionHabitId?
aggregationMode
```

---

## 9. UI / UX Requirements

### 9.1 Habit Logging Modal

#### Layout

* Title: Parent Habit name
* Subtext: “Select what you did today (you can choose multiple)”

#### Option Rows

Each row includes:

* Checkbox
* Option habit name
* If metric required:

  * Numeric input + unit label
  * Increment chips (optional)

#### Validation

* Save disabled until:

  * At least one option selected
  * All required-metric options have valid values

---

### 9.2 Habit Details Page

#### Sections

1. **Today’s Breakdown**

   * Chips showing selected options + values
2. **Option Habit Breakdown**

   * Toggle: Days | Total | Average
3. **Chart**

   * Stacked or grouped by option habit
4. **Linked Goals**

   * Shows which option habits contribute where

---

## 10. Non-Goals (Explicitly Out of Scope)

* Multiple entries per option per day
* Option habit streaks (future enhancement)
* Free-text or mixed metric entries
* Auto-completion via routines without user confirmation

---

## 11. Edge Cases & Rules

* Changing metric units does **not** retroactively alter old entries
* Deleting an option habit deletes its entries (with confirmation)
* Parent habit cannot be completed manually if no option entries exist
* If all option entries are deleted for a day, parent completion disappears

---

## 12. Success Metrics

* Users can answer:

  * “Did I do this habit?”
  * “How did I do it?”
  * “How much did I do?”
* Reduced habit list clutter
* Increased goal attribution clarity
* No ambiguous historical data

---

## 13. Implementation Readiness

This PRD is designed to:

* Map cleanly to existing HabitFlow concepts (Habits, Entries, Goals)
* Avoid dual sources of truth
* Scale to future features (weekly habits, routines, streak variants)
* Remain explainable to users without jargon
