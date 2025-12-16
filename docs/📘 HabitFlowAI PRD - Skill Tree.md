Perfect — I’ll proceed as **Lead UX Designer + Product Owner** and lock in the recommended options.
Below is a **clean, implementation-ready PRD** for the **Skill Tree View**, written to fit HabitFlow’s philosophy, architecture, and tone.

---

# 📘 PRD: Skill Tree View (Goals → Skill Tree Tab)

## 1. Overview

### Feature Name

**Skill Tree**

### Location

* Primary: **Goals → Skill Tree (tab)**
* Secondary (read-only deep link): Achievements / Badges

### Summary

The Skill Tree is a visual representation of personal development that shows how **habits build skills, and skills build identities**. It transforms raw habit data into a meaningful hierarchy that reinforces identity-based motivation and long-term progress.

The Skill Tree is **interpretive, not evaluative**:

* It does not replace habits, goals, or streaks
* It does not introduce penalties or decay
* It exists to answer: *“Who am I becoming by doing this?”*

---

## 2. High-Level Goals

### Primary Goals

* Reinforce **identity-based habit formation**
* Increase **perceived progress** without increasing cognitive load
* Help users connect daily actions to long-term capability
* Provide a calm, motivating alternative to gamified badges

### Non-Goals

* No competitive elements
* No social comparison
* No pressure-inducing failure states
* No replacement of existing goal logic

---

## 3. Conceptual Model

### Hierarchy

```
Identity → Skill → Habit → Milestones (derived)
```

### Definitions

* **Identity**: A broad area of self (e.g. Physical Health)
* **Skill**: A capability being developed (e.g. Strength Training)
* **Habit**: A concrete repeatable behavior (existing Habit object)
* **Milestones**: Derived thresholds for feedback only

This hierarchy is **semantic only** — all quantitative tracking remains owned by Habits and Goals.

---

## 4. UX Structure & Layout

### 4.1 Entry Point

**Goals Page**

* Add a tab: `Overview | Progress | Skill Tree`

Skill Tree loads as a **first-class Goals view**, not a secondary novelty screen.

---

### 4.2 Identity Nodes (Top Level)

Examples:

* Physical Health
* Mental Health
* Music & Creativity

**UX Rules**

* 3–6 identities maximum per user
* Always visible at top of tree
* Calm visual treatment (no constant animation)

**Each Identity Node Displays**

* Identity name
* Aggregate progress indicator (derived from skills)
* Subtle glow when any child skill is active

---

### 4.3 Skill Nodes (Mid Level)

Examples:

* Strength Training
* Conditioning
* Regulation
* Sound Design
* Arrangement

**UX Rules**

* Expandable / collapsible
* Visual emphasis > habits, < identities
* Soft glow reflects active progress

**Each Skill Node Displays**

* Skill name + icon
* Level (Lv. 1–5, shallow by design)
* Progress bar or radial meter
* Number of linked habits
* Expand/collapse affordance

---

### 4.4 Habit Nodes (Leaf Level)

Examples:

* Pull-Up Habit
* Long Run Habit
* Zone 2 Habit
* Journaling
* Breathing Exercises

**UX Rules**

* Mirrors existing habit data exactly
* No duplicate tracking
* No additional interaction logic

**Each Habit Node Displays**

* Habit name
* Current progress (e.g. 25 / 50 reps)
* Completion percentage
* Warning / attention state if habit is at risk (optional, existing logic only)

---

## 5. Live Behavior & Feedback

### 5.1 Real-Time Updates

When a habit is completed:

1. Habit node updates immediately
2. Parent skill animates softly (pulse / fill)
3. Identity node shows subtle activity feedback

**No cascading animations beyond one level**
(keeps UI calm and readable)

---

### 5.2 Skill Progress Calculation (Locked Decision)

**Hybrid Model (Approved)**

* Physical skills → volume-weighted (reps, minutes, sessions)
* Mental skills → consistency-weighted (distinct days)
* Creative skills → session-based (non-linear scaling)

Skill Tree **reads derived metrics only** — it never recomputes habit data.

---

### 5.3 Level-Ups

**Trigger Conditions**

* Crossing a cumulative threshold
* Sustained consistency over time

**UX Treatment**

* Short, tasteful animation
* Copy example:

  > “Strength Training reached Level 2”
* Optional future hook: reflection or note

No confetti. No sound. No interruption.

---

## 6. User Control & Customization

### Skill Definition Model (Approved)

**Semi-Structured Skills**

* App provides suggested skills per identity
* Users can:

  * Rename skills
  * Reassign habits
  * Add custom skills

This reduces paralysis while preserving ownership.

---

### Expand / Collapse

* Users can collapse entire identities
* Collapsed state persists per session

---

## 7. Data Model (MVP)

### Identity

```ts
Identity {
  id: string
  name: string
  skillIds: string[]
}
```

### Skill

```ts
Skill {
  id: string
  name: string
  identityId: string
  habitIds: string[]
  level: number
  progress: number
}
```

### Key Constraint

* Skill Tree **never owns habit completion data**
* It only consumes existing metrics

---

## 8. Accessibility & Emotional Safety

### Required UX Principles

* No flashing animations
* No red “failure” states
* No decay or loss of levels
* No negative copy

Progress may **pause**, but identity is never revoked.

This is essential for:

* Bipolar users
* Anxious users
* Burnout-prone high performers

---

## 9. Empty & Edge States

### New User

* Show example identities + skills
* Clear explanation:

  > “Your habits build skills. Skills shape identity.”

### Skill With No Habits

* Allowed
* Displays “Add habits to grow this skill”

### Deleted Habit

* Automatically removed from skill
* Skill recalculates progress safely

---

## 10. Performance Requirements

* Tree renders under 100ms for typical users
* Virtualize large habit lists
* Animations GPU-friendly
* No blocking recomputations

---

## 11. Acceptance Criteria

* Skill Tree renders correctly on all screen sizes
* Hierarchy is understandable in <10 seconds
* Nodes update live from habit data
* Expand/collapse works reliably
* Animations feel calm and meaningful
* Users can verbally explain:

  > “This habit builds this skill, which supports this identity.”

---

## 12. Future Enhancements (Explicitly Out of Scope)

* Alternate visual layouts (radial / constellation)
* Reflection prompts on level-up
* Skill-based goal suggestions
* Identity journaling
* Sharing / social views
