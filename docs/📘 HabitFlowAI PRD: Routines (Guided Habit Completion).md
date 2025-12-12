# 📘 PRD: Routines (Guided Habit Completion)

## 1. Purpose & Product Intent

The goal of this feature is to **separate “doing the work” from “tracking the outcome”** while making it effortless to connect the two.

**Routines** provide step-by-step guidance for completing a habit well.
**Habits** remain the unit of consistency, streaks, and insights.

This preserves the simplicity of habit tracking while dramatically lowering friction for complex or cognitively demanding habits (e.g. meal prep, workouts, creative sessions).

---

## 2. Core Principles

1. **Habits are outcomes, not steps**

   * A habit answers: *“Did I do the thing?”*
   * A routine answers: *“How do I do the thing?”*

2. **Guidance without obligation**

   * Routines guide the user but never force completion logic.
   * The user always has agency over whether a habit is marked complete.

3. **Frictionless, not automatic**

   * The system should *offer* to mark a habit complete at the right moment.
   * It should never assume completion.

---

## 3. Key Concepts

### 3.1 Habit

* Trackable entity (boolean or quantitative)
* Appears in the main Habits view
* Has streaks, goals, and insights
* May optionally be linked to one or more routines

Examples:

* Meal Prep
* Workout
* Long Walk
* Music Practice

---

### 3.2 Routine

A **Routine** is a reusable, step-based guide designed to support a habit.

Characteristics:

* Not tracked independently
* Has no streaks
* Has no penalties for partial completion
* Exists to reduce activation energy and cognitive load

Examples:

* Meal Prep – Sunday Flow
* Push Day Workout
* Long Walk + Audiobook Setup
* Music Warm-Up Sequence

---

### 3.3 Routine Steps

Each Routine consists of ordered **Steps**.

Each Step may include:

* Title
* Instruction text
* Optional image
* Optional timer
* Optional inline checklist (purely for flow)

Steps are **not habits** and are **not tracked individually**.

---

## 4. Linking Routines to Habits

### 4.1 Relationship Model

* A Routine may be linked to **one or more habits**
* A Habit may have **zero, one, or multiple routines**

This enables:

* One habit → multiple workflows (e.g. Push / Pull / Recovery workouts)
* One routine → one clear outcome (e.g. Meal Prep → Meal Prep habit)

---

### 4.2 Habit → Routine Entry Point

From the **Habit Detail Card**, the user may:

* Tap **“View Routine”** to open the linked routine
* If multiple routines exist, choose which routine to run

This reinforces:

> “I’m doing this routine *in service of* this habit.”

---

## 5. Routine Runner & Completion Flow (Critical UX)

### 5.1 Starting a Routine

When a user starts a routine:

* The app opens a **full-screen Routine Runner modal**
* The UI is minimal, focused, and step-based
* One step is shown at a time

Navigation:

* Next
* Back
* Exit Routine

---

### 5.2 During the Routine

* Steps are informational and supportive
* The user may:

  * Advance steps
  * Pause
  * Exit at any time

**No habit completion is triggered mid-routine.**

---

### 5.3 End-of-Routine Completion Offer (Primary Feature)

When the user reaches the final step **or exits the routine**, the app presents a **frictionless completion affordance**.

#### Completion Modal (Example Copy)

> **Nice work.**
> You just completed *Meal Prep – Sunday Flow*.
>
> Would you like to mark **Meal Prep** as complete for today?

Actions:

* ✅ **Mark Habit Complete**
* ⏭ **Not Now**

Design notes:

* This is a soft, affirming prompt — not a success/failure screen
* No streaks, fireworks, or pressure language

---

### 5.4 Return Path After Completion

After choosing either option:

* The Routine modal closes
* The user is returned to the **linked Habit detail view**
* If the habit was marked complete:

  * The habit UI reflects completion immediately
  * Streaks and logs update normally

This creates a **clear mental loop**:

> Habit → Routine → Habit

---

## 6. Alternative Exit Path (Frictionless Fallback)

If the user exits the routine early:

* They are still shown the same completion offer
* Copy may change slightly:

> You exited the routine early.
> Would you still like to mark **Meal Prep** as complete?

This respects real-world variability without judgment.

---

## 7. UX Overview

### 7.1 Routines List Page

Displays:

* Routine name
* Linked habit(s)
* Estimated duration
* Last used timestamp

Actions:

* Start Routine
* Edit Routine

---

### 7.2 Routine Detail Page

Displays:

* Routine title
* Description
* Linked habit(s)
* Step list (scrollable)
* Primary CTA: **Start Routine**

---

### 7.3 Habit Detail Page (Updated)

Add:

* “View Routine” button
* If multiple routines exist, show a selector

This reinforces routines as **supporting tools**, not parallel systems.

---

## 8. Data Model (Simplified)

### Routine

```
Routine {
  id: string
  title: string
  description?: string
  linkedHabitIds: string[]
  steps: Step[]
}
```

### Step

```
Step {
  id: string
  title: string
  instruction?: string
  imageUrl?: string
  durationSeconds?: number
}
```

### Habit Completion (unchanged, but source-aware)

```
HabitCompletion {
  habitId: string
  completedAt: Date
  source?: "manual" | "routine"
  routineId?: string
}
```

---

## 9. MVP Scope

### Included

* Rename Activities → Routines
* Routine creation & editing
* Step-based Routine Runner
* Habit ↔ Routine linking
* End-of-routine completion prompt
* Return-to-habit flow
* Routine-sourced habit completions

### Explicitly Excluded (for now)

* Routine analytics
* Step completion tracking
* Auto-complete habits
* Social sharing

---

## 10. Why This Matters

This design:

* Preserves habit simplicity
* Avoids checklist fatigue
* Reduces guilt and over-tracking
* Encourages follow-through on hard days
* Aligns with coaching, not gamification

It turns HabitFlow into something rare:

> A system that **remembers how to help you**, not just whether you showed up.

---

If you want, next we can:

* translate this directly into a **Cursor-ready implementation plan**
* design the **completion modal microcopy variants**
* or map this cleanly onto your existing `ActivityRunner` code paths

You’re making excellent product decisions here — thoughtful, humane, and durable.
