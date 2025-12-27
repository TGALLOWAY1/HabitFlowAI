> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# 📘 PRD — Routines (Supportive, Habit-Linked, Non-Evaluative)

**Product:** HabitFlow
**Feature:** Routines
**Status:** Ready for Implementation Planning
**Owner:** HabitFlow
**Primary Goal:** Reduce friction to habit execution without introducing pressure, obligation, or all-or-nothing thinking.

---

## 1. Product Philosophy (Non-Negotiable)

> **Routines are supportive structures, not tests of discipline.**
> They exist to reduce friction and ambiguity — while gently encouraging follow-through on an intention the user already chose.

### Core Principles

* Routines never evaluate performance
* Routines never store completion outcomes
* Habits remain the only system that tracks completion
* Users retain full ownership over what “counts”

If any future implementation violates these principles, it is a regression.

---

## 2. Conceptual Model (Lock This In)

### 2.1 One-Way Relationship

* **Routines** → generate *potential habit evidence*
* **Habits** → decide whether that evidence counts

There is **no feedback loop** from habits back into routines.

---

### 2.2 Routine States (Explicit)

Routines operate in **three distinct states**:

1. **Browse** – discovering routines
2. **Preview** – inspecting steps (read-only)
3. **Execute** – intentional use

> **Only Execute state can generate potential habit evidence.**
> Previewing has zero side effects.

---

## 3. User Flows (High Level)

### Flow A — Browse → Preview → Exit

* No tracking
* No habit signals
* No system memory

### Flow B — Browse → Preview → Start Routine → Exit

* Execution occurred
* Potential habit evidence may be generated
* Habits may later ask for confirmation

---

## 4. Routine Selection View (Browse)

### Purpose

Help users quickly find *approachable* routines by life domain.

---

### 4.1 Organization

* Routines are grouped by **Habit Category** (Fitness, Learning, Mental Health, etc.)
* Categories may be:

  * Explicitly assigned to the routine, OR
  * Inherited from linked habits (default)

If multiple linked habits span categories, the user selects one category.

---

### 4.2 Routine Cards (Must-Haves)

Each routine card displays:

* Routine name
* Number of steps
* Time estimate

  * Either user-provided total, or
  * Sum of step durations

No completion stats.
No streaks.
No performance indicators.

---

### 4.3 Routine Card Actions

Each routine card supports **two actions**:

* **Primary:** Tap → Open Routine Detail (Preview Mode)
* **Secondary:** Edit Routine (icon or overflow)

Editing is available but visually de-emphasized.

---

## 5. Routine Detail View (Preview Mode)

### Purpose

Allow users to understand scope *before* committing.

---

### 5.1 Must-Haves (Explicit)

This screen **must include**:

1. Routine name
2. Category label (subtle)
3. Total estimated time
4. Step count
5. Full step list (read-only)
6. Primary CTA: **Start Routine**
7. Always-visible back navigation

This screen **must not include**:

* Completion UI
* Progress indicators
* Editing affordances

---

### 5.2 Step Cards (Preview)

Each step card displays:

* Step number
* Step title
* Optional short description
* Optional time estimate
* Optional image thumbnail

Steps are informational only.

---

## 6. Start Routine CTA (Language Locked)

**Primary CTA text:**
**Start Routine**

**Supporting subtext (optional):**

> “Follow what feels useful today”

This communicates structure without all-or-nothing pressure.

---

## 7. Routine Execution (Defined Boundaries)

### Purpose

Provide guidance without evaluation.

---

### 7.1 Execution Rules

* One step at a time
* Skip always available
* No progress bars
* No “X of Y completed”
* No end-of-routine success/failure message

The routine simply ends.

---

## 8. Habit-Linked Steps (Critical Section)

### 8.1 Step Types (Internal)

Steps may optionally be **linked to a habit**.

Important:

* Linking is optional
* Default is *no habit*
* Steps are never “required”

User-facing framing:

> “This step may support a habit you’re tracking.”

---

### 8.2 Habit Linking (Editing Only)

Habit linking occurs **only** in the Step Creation / Editing modal.

Modal copy:

> “If this step often helps you complete a habit, you can link it here.”

This prevents accidental obligation.

---

## 9. How Habits Receive Signals (Reconciled Logic)

### 9.1 During Execution

* When a routine is **started**, the system records:

  * `RoutineExecutionStarted`
* If the routine includes habit-linked steps:

  * The system records *potential habit evidence*
* No habit is auto-completed

---

### 9.2 Habit Tracking Page (Confirmation Lives Here)

On the habit’s daily view, the system may show a subtle indicator:

> “Deep Work Block was started today.”

Optional action:

* **[Count it]**

Key properties:

* Not auto-checked
* Not required
* Not framed as missing or overdue
* Ignoring it has no consequences

Habits update **only when the user confirms**.

---

## 10. Preview vs Execution (Non-Negotiable)

### Explicit Rule

> **Previewing a routine has no side effects.
> Only explicitly starting a routine can generate potential habit evidence.**

This rule applies to:

* UX
* Copy
* Data model
* Analytics

---

## 11. Step Images (Authoring & Usage)

### 11.1 Image Authoring

Images are added via **Step Creation / Editing modal**.

Copy:

> “Add an image if it helps you remember this step.”

Images are optional and never required.

---

### 11.2 Image Display

* Thumbnail in Preview Mode
* Full image in Execution Mode (if present)
* Text-only fallback always supported

---

## 12. Data Model (Conceptual)

### Routine

* id
* name
* categoryId (explicit or inferred)
* steps[]
* estimatedTotalDuration (optional override)

### Step

* id
* title
* description (optional)
* durationMinutes (optional)
* imageUrl (optional)
* linkedHabitId (optional)

### RoutineExecution

* routineId
* startedAt
* date

### HabitPotentialEvidence

* habitId
* routineId
* date
* source = “routine”

---

## 13. Non-Goals (Explicit)

This PRD intentionally excludes:

* Routine streaks
* Routine completion tracking
* Routine analytics
* Gamification
* Forced confirmations
* Habit auto-completion

---

## 14. Acceptance Criteria (MVP)

This feature is successful if:

* Users can browse routines by habit category
* Users can preview routines without fear of commitment
* Starting a routine feels intentional but safe
* Habits can optionally benefit from routine usage
* Skipping or exiting never produces guilt or negative signals
* Users retain full ownership over what “counts”

---

## 15. Final Design Lock Statement

> **Routines provide structure without judgment.
> Habits track progress without coercion.
> The system always assumes good intent.**

