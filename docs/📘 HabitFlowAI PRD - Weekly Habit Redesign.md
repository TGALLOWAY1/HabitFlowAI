# 📘 PRD — Weekly Habit Visuals & Creation Flow (HabitFlow)

## 1. Objective

Improve clarity, reduce pressure, and increase habit adherence by:

* Replacing the weekly habit grid with a **card-based progress view**
* Clearly differentiating **weekly intent types** via subtle visual indicators
* Simplifying habit creation by removing unnecessary scheduling decisions
* Strengthening the connection between **Habits ↔ Goals**

This change aligns weekly habits with how users *actually think*: progress over time, not calendar perfection.

---

## 2. Problem Statement

### Current issues

* Weekly habits rendered in a daily grid waste space and imply missed days
* Grid UI mixes incompatible mental models (daily vs weekly)
* Habit creation asks users to choose *which day* they’ll act, creating pressure
* Goal linkage is unclear and inconsistently surfaced

### Design principle

> Weekly habits should feel like **progress toward identity**, not scheduled obligations.

---

## 3. High-Level UX Changes

### Daily Habits

* Continue to use the **calendar grid**
* Optimized for consistency and streaks

### Weekly Habits (NEW)

* Removed from grid entirely
* Rendered as **uniform cards**, visually aligned with the Goals page
* Each card communicates *how progress is measured* at a glance

---

## 4. Weekly Habit Types (Intent-Based)

Each weekly habit must declare **one and only one intent type** at creation.

### 4.1 Weekly Habit Types

| Type          | Description                | Example      |
| ------------- | -------------------------- | ------------ |
| **Binary**    | Do once per week           | Yoga         |
| **Frequency** | Do N times per week        | Exercise 3×  |
| **Quantity**  | Accumulate toward a target | Run 30 miles |

This intent determines:

* Visual indicator
* Completion logic
* Interaction behavior

---

## 5. Weekly Habit Card — Visual Specification

All weekly habits share a **common card layout**.
Only the **progress indicator region** varies.

### 5.1 Shared Card Structure

```
[ Habit Title ]                 🔥 Momentum Indicator
[ Progress Indicator ]
[ Helper Copy ]
```

* Consistent spacing, typography, and actions
* No dates displayed
* No calendar affordances

---

### 5.2 Type-Specific Indicators

#### A. Binary Weekly Habit (Once per Week)

**Example:** Go to yoga

**Indicator**

* Single dot or checkmark
* Empty → Filled

**Helper Copy**

* Incomplete: `Not done yet this week`
* Complete: `Done this week`

**Interaction**

* “Mark Done” completes the habit for the week
* Additional completions are ignored (or logged but not counted)

---

#### B. Frequency Weekly Habit (N Times per Week)

**Example:** Exercise 3×

**Indicator**

* N small horizontal pips
* Filled left → right

**Helper Copy**

* In progress: `1 of 3 sessions — still counts`
* Complete: `3 of 3 sessions completed`

**Interaction**

* Each “Mark Done” fills one pip
* Multiple completions per day allowed (optional config later)

---

#### C. Quantity Weekly Habit (Accumulative)

**Example:** Run 30 miles

**Indicator**

* Continuous progress bar
* Displays current / target value

**Helper Copy**

* In progress: `18 of 30 miles this week`
* Complete: `Goal reached — extra still counts`

**Interaction**

* “Mark Done” opens numeric input (value + unit)
* Progress bar updates immediately

---

## 6. Habit Creation Modal — Updated Flow

### 6.1 Step 1: Habit Basics

Fields:

* Habit Name
* Category (required)
* Optional description

---

### 6.2 Step 2: Cadence Selection

User selects **Daily** or **Weekly**

#### Daily

* No change from current behavior

#### Weekly (NEW)

* User selects **Weekly Intent Type**:

```
○ Do once per week
○ Do multiple times per week
○ Reach a quantity this week
```

---

### 6.3 Step 3: Weekly Configuration (Conditional)

#### If Binary

* No additional input

#### If Frequency

* Numeric input: `Times per week (N)`

#### If Quantity

* Numeric target + unit

  * Example: `30 miles`
  * Units selectable (miles, minutes, reps, etc.)

⚠️ **Explicitly removed**

* ❌ “Which day will you do this?”
* ❌ Scheduling or calendar prompts

---

## 7. Goal Linking (Required Enhancements)

### 7.1 Linking During Habit Creation

Habit creation modal includes:

```
Link to a Goal (optional)
[ Select Goal ▼ ]
```

Rules:

* A habit may link to **0 or 1 goal**
* A goal may link to **multiple habits**

---

### 7.2 Goal Contribution Logic

| Habit Type | Contribution            |
| ---------- | ----------------------- |
| Binary     | +1 completion when done |
| Frequency  | +1 per session          |
| Quantity   | +value logged           |

Goal aggregation logic must respect habit intent:

* Frequency habits contribute **count**
* Quantity habits contribute **sum**
* Binary habits contribute **boolean / count**

---

### 7.3 Visual Indicators on Habit Cards

If a habit is linked to a goal:

* Display subtle goal badge or icon
* Clicking opens the Goal detail view

This reinforces purpose without adding pressure.

---

## 8. Weekly Reset Behavior

* Weekly habits reset automatically at the start of the week
* Visual indicators clear
* Momentum / streaks update independently of completion

Missed weeks do **not** show as failures.

---

## 9. Non-Goals (Explicitly Out of Scope)

* Scheduling weekly habits to specific days
* Penalizing incomplete weekly habits
* Showing missed progress visually
* Combining multiple indicator types in one habit

---

## 10. Success Criteria

This feature is successful if:

* Weekly habits feel lighter and less judgmental
* Users understand progress type at a glance
* Habit creation feels simpler and faster
* Goal alignment is clearer and more motivating
* The Habits page feels visually calmer and more intentional

---

## 11. Guiding Philosophy (Design North Star)

> **Habits measure consistency over time — not perfection in the moment.**

This system prioritizes:

* Autonomy
* Momentum
* Identity reinforcement
* Psychological safety

