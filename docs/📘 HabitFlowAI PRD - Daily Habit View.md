# 📘 Product Requirements Document

## Feature: **Day View (Today Board)**

**Product:** HabitFlow
**Status:** Proposed
**Priority:** High
**Owner:** Product / UX

---

## 1. Overview

### Summary

The **Day View (Today Board)** is a new habit tracking view that presents a **single-day, minimal, calm snapshot** of all habits relevant today. It complements the existing category-based, multi-day habit grid by answering a different user question:

> **“What do I want to do today?”**

This view emphasizes **habits over tasks**, supports **bundled habits**, and introduces **soft prioritization** through pinning — without introducing urgency, failure states, or calendar pressure.

---

## 2. Problem Statement

The existing HabitFlow habit view excels at:

* tracking consistency over time
* visualizing momentum
* reinforcing identity through repetition

However, it is **not optimized for day-level intention setting**.

Users may struggle to:

* quickly see everything relevant *today*
* focus attention on a small subset of habits
* mentally translate a grid of days into “what now?”

The Day View solves this by:

* collapsing time to **today only**
* reducing cognitive load
* maintaining HabitFlow’s non-punitive philosophy

---

## 3. Design Principles

These principles are **non-negotiable**:

1. **Habits > Tasks**
   This is not a task manager or to-do list.

2. **Visibility ≠ Obligation**
   Seeing a habit does not imply failure if it is not completed.

3. **Single-Day Focus**
   The view only represents *today*.

4. **Minimal by Default**
   Information density must be low; details appear on interaction.

5. **Non-Judgmental UI**
   No red states, no overdue indicators, no warnings.

---

## 4. User Goals

Primary user goals supported by this view:

* Quickly understand today’s intentions
* Decide what to focus on without guilt
* Complete habits opportunistically
* Maintain awareness of goal-aligned habits
* Avoid feeling behind

---

## 5. Scope

### Included (MVP)

* Single-day habit list
* Category grouping
* Bundle support
* Goal indicators
* Time estimates
* Habit pinning (“Today’s Focus”)

### Explicitly Excluded

* Calendar columns
* Weekly quotas
* Streaks
* Deadlines
* Urgency states
* Task semantics

---

## 6. Information Architecture

### Page Structure

```
Today
Monday · Dec 15

[ Today’s Focus (Pinned Habits) ]

▸ Fitness
▸ Learning
▸ Music
▸ Relationships
```

---

## 7. Today’s Focus (Pinned Habits)

### Purpose

Allow users to surface a **small set of habits** they want to prioritize today without hiding others.

### Behavior

* Any habit can be pinned
* Pinned habits appear in a **compact horizontal strip** at the top
* Pins persist across days until removed
* Pinning does **not** affect tracking logic

### Constraints

* No forced limits (recommended display: 3–7 visible)
* Pins are optional
* Pins do not imply obligation

---

## 8. Category Sections

### Structure

* Habits are grouped by category
* Categories are **collapsible**
* Default expansion:

  * Expanded if category has ≥1 incomplete habit today
  * Otherwise collapsed

### Ordering

* Category order is user-configurable
* Habit order within categories is user-configurable

---

## 9. Habit Row Specification

Each habit appears as **a single horizontal row**.

### Core Elements

| Element         | Description                            |
| --------------- | -------------------------------------- |
| Checkbox        | Marks today’s completion               |
| Habit name      | Primary label                          |
| Goal icon 🎯    | Indicates linkage to one or more goals |
| Time estimate ⏱ | Optional, editable                     |
| Bundle icon     | Checklist or Choice                    |
| Pin icon 📌     | Toggles Today’s Focus                  |

---

## 10. Goal Indicator

### Purpose

Provide **context**, not pressure.

### Behavior

* Displayed as a small 🎯 icon
* Appears only if habit contributes to ≥1 goal
* Hover / tap reveals goal name(s)
* No progress bars or warnings

---

## 11. Time Estimate

### Purpose

Support planning without scheduling.

### Behavior

* Shown as ⏱ icon if estimate exists
* Clicking opens inline edit (minutes only)
* Estimate is informational only
* No rollups or totals in this view

---

## 12. Bundled Habits

The Day View must support **explicit bundle types**.

---

### 12.1 Checklist Bundles

**Icon:** ☑ checklist

**Behavior**

* Multiple child habits
* Each child can be completed independently
* Bundle does not require full completion

**Display Rules**

* Shown as a single parent row
* Children are not expanded by default
* Hover / tap may show progress (e.g. “2 of 3”) subtly

---

### 12.2 Choice Bundles

**Icon:** ◯◯◯ (options / fork symbol)

**Behavior**

* Only one option may be completed per day
* Selecting one dims others
* Completion marks the bundle as satisfied

**Display Rules**

* Shown as a single row
* Options are implicit, not expanded
* No penalty for non-selection

---

## 13. Completion Logic

* All habits follow **single-entry-per-day**
* Completion updates immediately
* Bundles respect existing bundle rules
* No habit auto-completes another unless explicitly defined elsewhere

---

## 14. Sorting & Customization

### Supported

* Drag-and-drop reordering (habits within category)
* Drag-and-drop category reordering
* Pin/unpin habits

### Not Supported

* Priority numbers
* Automatic ranking
* Due-time sorting

---

## 15. Visual Design Guidelines

* Dark mode, consistent with existing app
* Soft green for completion
* Muted grays for inactive elements
* No red or alert colors
* Minimal iconography
* Subtle dividers only where necessary

---

## 16. Accessibility & Usability

* All icons must have tooltips or labels
* Checkbox targets sized for mobile
* Long-press alternatives on touch devices
* Keyboard navigation supported on web

---

## 17. Empty & Low-Engagement States

### Empty Today

> “Nothing is required today. Habits are signals, not obligations.”

### No Pins

> “Pin habits here to set today’s focus.”

Tone must always be **supportive and permissive**.

---

## 18. Success Metrics

Qualitative:

* Users report less overwhelm
* Users check the Day View first
* Users pin habits intentionally

Quantitative:

* Increased same-day habit completions
* Reduced churn on high-habit-count users
* Increased habit interaction frequency

---

## 19. Risks & Mitigations

| Risk               | Mitigation                     |
| ------------------ | ------------------------------ |
| Becomes task list  | No deadlines, no urgency       |
| Over-customization | Minimal controls               |
| Feature overlap    | Clearly framed as “Today View” |

---

## 20. Future Enhancements (Non-MVP)

* Optional timeline grouping (Morning / Anytime / Evening)
* Focus strip collapse rules
* Contextual journaling prompts
* Goal-aware insights (separate view)

---

## 21. Final Statement

The Day View is not about productivity.
It is about **clarity without pressure**.

If this view ever makes the user feel behind, it has failed.

