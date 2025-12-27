
# Feature Prioritization (Updated)

Anything not in **Must** is *explicitly deferred*.

---

## ✅ MUST HAVE (Launch-Blocking)

These define whether the app is **functionally HabitFlow**.
If any item here is missing or broken, launch is blocked.

---

### 1. Fully Functional Habits (Core Truth Layer)

#### Habit Definitions

* Daily habits
* Weekly habits
* Checklist bundles
* Choice bundles
* Binary and numeric habits
* Habit categories (required for all habits)

#### Habit Interactions

* Add HabitEntry (manual)
* Edit HabitEntry
* Delete HabitEntry (soft delete)
* Backfill HabitEntries to past days (with confirmation)
* Enforce **single entry per habit per day**
* Enforce **choice-bundle mutual exclusion**
* Enforce **checklist bundle derived completion**

#### Required Guarantees

* HabitEntries are the sole behavioral truth
* Bundle habits never create entries
* Completion is always derived, never stored

---

### 2. Habits View (Primary Interaction Surface)

> **The Habits View is the required core surface.**

* Browse habits grouped by Category
* Clearly distinguish:

  * Daily vs Weekly habits
  * Standard vs Bundle habits
* Log / edit / delete entries directly from this view
* Derived completion shown (read-only)

> **Note:**
> The **Today View is NOT required for launch**.
> Habits View is sufficient and canonical.

---

### 3. Fully Functional Goals (Aggregation Layer)

#### Goal Creation

* Support goal types:

  * **Cumulative** (e.g. “Run 500 miles”)
  * **One-Time Event** (e.g. “Run a marathon once”)
* Functioning **Create Goal modal**
* Link goals to:

  * Habits (standard habits only)
  * Category (for organization)

#### Goal Aggregation

* Aggregate exclusively from HabitEntries
* Support:

  * Count-based goals
  * Quantity-based goals
* Recompute correctly after:

  * Entry edits
  * Entry deletions
  * Backfills
* Goals never store progress

---

### 4. System Guarantees (Non-Negotiable)

These must be **correct**, not partial.

* DayKey correctness
* Single-entry-per-habit-per-day enforcement
* Deterministic recomputation after edits
* Offline logging support
* Sync does not invent truth
* Zero stored completion flags
* Zero shadow tracking systems

---

### 5. Default Dashboard / Homepage (Defined, Minimal)

A default landing surface **must exist**, but it may be minimal.

Requirements:

* Orients the user
* Provides clear navigation to:

  * Habits
  * Goals
  * Routines
  * Journal
* Does **not** need advanced insights or charts
* Must not invent metrics

> This may be:
>
> * A lightweight overview
> * A Habits-first dashboard
> * A neutral “Today / Overview” surface
>
> **But it must be explicitly defined, not accidental.**

---

### 6. Routines (Structure Layer)

* Dedicated **Routines page**
* Routine creation modal
* Ability to:

  * Define routines
  * Associate routines with habits
* Starting a routine creates:

  * RoutineExecution (intent only)
* Routines must:

  * Never auto-complete habits
  * Never create HabitEntries directly

---

### 7. Journaling (Reflection Layer)

* Dedicated **Journal page**
* Ability to:

  * Create journal entries
  * Edit journal entries
  * Delete journal entries
* Journals:

  * Are time-bound
  * Are non-punitive
  * Never imply habit completion
  * Never affect goal progress

---

## 🟡 SHOULD HAVE (If Time Allows)

These improve UX but do **not** define correctness.

* Today View (as an alternate surface)
* HabitPotentialEvidence (routine → habit suggestion)
* HabitEntryReflection (light notes / effort / mood)
* Basic derived metrics:

  * Daily completion
  * Weekly progress
  * Simple streaks (derived)
* Category reordering
* Visual polish / delight

---

## 🔵 COULD HAVE (Post-Launch / Phase 1+)

Explicitly deferred.

* Skills / Skill Tree
* Persona switching UX
* Identity prompts & coaching
* Wellbeing metrics
* Advanced insights & correlations
* Rich charts
* LLM-powered coaching or analysis

---

## ❌ WON’T HAVE (At Launch)

These are **explicitly forbidden** in v1.

* Auto-completion from routines
* Goal-owned progress logs
* Bundle-owned progress
* Punitive streak decay
* “Overdue” or “missed” states
* Schedule enforcement
* AI predictions
* Smart defaults that mutate truth

If any of these appear in v1, it is a **regression**, not a feature.