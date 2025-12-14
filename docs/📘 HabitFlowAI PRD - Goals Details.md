Amazing — your feedback is *not* ambiguous. It actually sharpens the intent of the feature in an important way:

> **Goals should never become a parallel tracking system.
> Habits remain primary; goals aggregate and contextualize them.**

Below is a **clean, implementation-ready PRD** followed by a **Gemini 3 Pro prompt** you can hand directly to an implementation model. I’ve written this as if it’s going straight into your GitHub `/docs` or `/prd` folder and aligns with your existing Activity / Habit architecture .

---

# 📘 PRD — Goal Details Page (v2)

## 1. Purpose

The Goal Details page exists to:

1. Reinforce *why* the goal matters
2. Show *directional progress*, not judgment
3. Make it obvious how habits contribute to goals
4. Avoid duplicating habit tracking logic

**Non-Goal:**
This page should *not* become a second habit system or a calendar-heavy analytics view.

---

## 2. Core UX Principle

> **Habits are how goals are achieved.
> Goals aggregate effort; habits drive action.**

This principle must be visually and behaviorally reinforced throughout the page.

---

## 3. Page Structure & Information Hierarchy

### 3.1 Goal Header (Orientation Layer)

**Purpose:** Emotional grounding + constraint visibility

**Components**

* Goal Title
* Status badge (Active / Paused / Completed)
* **Mantra / Note** (1–2 lines, expandable)
* **Target Date** (formerly “Deadline”)
* Primary Progress Bar (see 3.2)

**Behavior**

* Mantra is prompted at goal creation:

  * “Why does this goal matter?”
  * “What do you want to remember when motivation dips?”
* Target Date is neutral in tone:

  * Only becomes visually emphasized if overdue

---

### 3.2 Progress Summary (Momentum Layer)

**Primary Visualization**

* Large horizontal progress bar
* Inline milestone markers (25 / 50 / 75 / 100%)
* No milestone cards

**Textual Summary**

* `2 of 100 miles`
* `2% complete`

**Formatting Rules**

* Integers render without decimals
* Decimals render only if user entered decimals
* Units are consistent and lowercase (`miles`, not `Miles`)
* **Scope:** Applies to Progress Summary, Daily Entry List, Weekly Summary, and Tooltips.

---

## 4. Tabs Architecture

The Goal Details page uses a **tabbed interface**.

### Tabs (Initial)

* **Cumulative** (default)
* **Day by Day**

> Future tabs may be added (e.g., “Insights”, “Notes”), but are out of scope for v2.

---

## 5. Tab: Cumulative

**Primary Question Answered:**

> “Am I moving forward over time?”

### 5.1 Cumulative Progress Graph

**Visualization**

* Line graph
* X-axis: Date (starts at Goal Creation Date, ends at Today)
* Y-axis: Total accumulated value
* Line is monotonic (never decreases)

**Optional Enhancements**

* Milestone markers on the line
* Optional “ideal pace” line (hidden by default)

---

### 5.2 Weekly Contribution Summary

**Purpose:** Tactical feedback without noise

**Display**

* Compact weekly bars or rows:

  * `This week: 7 miles`
  * `Last week: 4 miles`

**Rules**

* Weekly contribution is derived from goal entries (same source as cumulative graph)
* Shows net contribution per ISO week
* Limited to last 4–6 weeks
* Visually subordinate to the graph
* No daily breakdown here

---

## 6. Tab: Day by Day

**Primary Question Answered:**

> “What actually happened?”

### 6.1 Daily Contribution List

Each row:

```
Dec 13  •  3 miles   [Linked Habit Badge]
```

**Behavior**

* Tap row → edit / delete entry
* No calendar heatmap on this page (explicitly excluded)

---

## 7. Linked Habits Section (Action Layer)

### 7.1 Visual Callout

At the top of the section:

> **“Habits are how goals are achieved.”**

This is a first-class explanatory element, not helper text.

---

### 7.2 Linked Habit Cards

Each linked habit:

* Is clickable
* Navigates to:
  * **Habit Detail Page** (Preferred: with context showing it contributes to this goal)
  * Fallback: Habit history filtered to this goal

**Metadata Shown**

* Habit type (Binary / Quantified)
* Unit (if applicable)

---

## 8. Logging & Habit Synchronization Logic

### 8.1 Primary Interaction Philosophy

> **Users complete habits.
> Goals update automatically whenever possible.**

Manual goal logging exists, but should reinforce habit completion—not bypass it.

---

### 8.2 Manual Goal Logging Flow

When a user taps **“Log Contribution”**:
* *Helper Text:* "Most progress comes from completing linked habits."

#### Case A: Exactly One Linked Habit Exists

* **Auto-complete silently.** The habit is marked complete automatically, and the goal entry is created.
* UI Feedback: “Run marked complete and added to your goal.”

#### Case B: Multiple Linked Habits Exist

* System prompts: **“Which habit did this come from?”**
* User selects the source habit.
* Selected habit is marked complete; goal entry created.

#### Case C: No Linked Habit Exists

System presents options:

1.  **Link an existing habit**
2.  **Create a new habit**
3.  **Log just this contribution** (allowed, but discouraged)

This creates a *gentle nudge* toward habit-based tracking.

---

### 8.3 Habit-First Completion Flow (Preferred)

From Habit Completion UI:

* If habit is linked to one or more goals:

  * Goal progress updates automatically
* User never needs to visit the goal page to “maintain” it

---

## 9. Data Model Considerations (Incremental)

No major schema changes required.

### GoalEntry

* Source metadata:

  * `source: "habit" | "manual"`
  * `linkedHabitId?: string`

This enables:

* Attribution
* Future insights
* Clear edit/delete rules

---

## 10. Out of Scope (Explicit)

* Calendar heatmap on goal page
* Goal-specific streaks
* Goal-based penalties
* Auto-enforcement of pace

---

## 11. Success Criteria

This PRD is successful if:

* Users rarely need to manually log goal progress
* The goal page feels *encouraging*, not evaluative
* Users clearly understand how habits feed goals
* Progress is legible in under 5 seconds