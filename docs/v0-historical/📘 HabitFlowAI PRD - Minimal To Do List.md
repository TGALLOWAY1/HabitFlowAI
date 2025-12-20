> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# 📋 PRD — Tasks (Minimal To-Do System)

## Status

**Proposed (Refined)**

## Owner

Product / UX

## Related Systems

* Habits
* Goals (Cumulative, Frequency, One-Time)
* Journal
* Routines

---

## 1. Purpose & Philosophy

### Purpose

To provide a **dedicated containment zone** for administrative noise and low-stakes obligations, protecting the Habit and Goal systems from becoming cluttered with logistics.

Tasks exist to **reduce cognitive load**, not to define success.

---

### Product Philosophy

**Tasks are chores. Habits are growth.**
We do not celebrate taking out the trash. We celebrate showing up consistently to what matters.

**Capture → Calm**
The system leverages the **Zeigarnik Effect**: once a task is captured, the brain releases it. Mental bandwidth is freed for deep work, habits, and creative output.

**Ephemeral by Design**
Tasks are meant to be *deleted*, not curated. A healthy Tasks list trends toward empty.

**Outcome vs. Step**

* Goals represent *outcomes* (the “why”).
* Tasks represent *steps* (the “how”).

Blurring this line creates anxiety and decision fatigue. This feature exists to prevent that.

---

## 2. Problem Statement

### The “Mixed Bag” Anxiety

Users currently pollute habit trackers with items like:

* “Buy milk”
* “Email landlord”
* “Schedule appointment”

This dilutes the emotional reward of completing a habit. Meaningful wins are buried under mundane chores.

---

### The Gap

HabitFlow currently supports:

* **Recurring Identity** → Habits
* **Major Outcomes** → Goals

HabitFlow lacks:

* A place for **cognitive chaff** — transient items that must be remembered but should *not* define success.

Without Tasks:

* Users misuse habits
* Or externalize tasks (Notes, Reminders), fragmenting attention

---

## 3. Solution Overview

A **dual-list task system** that functions as a mental clearinghouse:

* **Inbox** → capture without thinking
* **Today** → intentional, finite commitment

Design principles:

* **Visual quiet**
* **Binary state** (Pending → Gone)
* **Zero guilt**
* **Contextual (optional) linkage to Goals**

Tasks are supportive infrastructure, not a productivity engine.

---

## 4. Core Concepts

### 4.1 The Task Unit

A **Task** is a discrete, finishable unit of work.

**Characteristics**

* Text-heavy
* Rapid entry
* Binary completion
* Life expectancy: *hours to days* (not weeks)

**Nature**

* Administrative
* Logistical
* Transactional

**Rule of Thumb**

* If it takes **multiple sittings** → it’s a Goal
* If it takes **~5 minutes** → it’s a Task

---

### 4.2 The Two-List Logic (The Funnel)

To prevent decision paralysis, organization is strictly limited to two buckets.

---

#### A. Inbox — *The Holding Pen*

**Purpose**
Rapid capture. Get it out of the head.

**Psychology**

> “I’ve written it down. I can stop worrying.”

**Behavior**

* All new tasks land here
* Chronological order (newest first)
* No manual sorting
* No urgency implied

---

#### B. Today — *The Commitment*

**Purpose**
Intentional execution for the current day.

**Psychology**

* The **Fresh Start Effect**
* Represents *finite capacity*, not obligation

**Behavior**

* Users must *manually promote* tasks from Inbox
* This friction is intentional — it forces commitment
* Today should feel slightly constrained

---

## 5. User Experience & Interaction Design

### 5.1 Entry & Capture (Speed Is King)

**Requirement**
Capturing a task must be **faster than Apple Notes**, or users won’t use it.

**Mechanisms**

* Always-available “Add Task” button (thumb-zone)
* Global keyboard shortcut (e.g., Cmd + N)

**Micro-interaction**

* Input field appears instantly
* `Enter` saves and keeps the field open
* Enables rapid batch entry

**Defaults**

* All tasks go to **Inbox**
* No metadata required
* No confirmation modals

---

### 5.2 Planning Workflow (Inbox → Today)

**Action**

* Swipe right (mobile)
* Click / drag (desktop)

**Constraint**

* No bulk-select in MVP
* The friction discourages over-committing

---

### 5.3 The Midnight Reset (Behavioral Insight)

**Problem**
Waking up to yesterday’s “overdue” list creates **debt anxiety**.

**Decision (MVP)**
If a task in *Today* is not completed by midnight:

* It **remains in Today**
* It **loses visual emphasis**
* No red text
* No “Overdue” label
* No shaming language

This preserves continuity *without* creating failure signals.

> Today is not a deadline. It is a lens.

*(Judgment call: This avoids silent auto-rollbacks that feel like data loss while still neutralizing guilt.)*

---

### 5.4 Completing Tasks (Closure, Not Dopamine)

**Interaction**

* Checkbox or strikethrough

**Feedback**

* Subtle fade-out
* Optional soft “swish” sound or haptic

**Anti-Patterns (Explicitly Forbidden)**

* ❌ “Good job!” modals
* ❌ Confetti
* ❌ Streak counters
* ❌ Completion stats

Completion should feel like **relief**, not reward.

---

### 5.5 Visual Hierarchy

**Hierarchy Rule**

* Habits dominate visual attention
* Tasks recede

**Design Language**

* Smaller font
* Thin weight
* Grayscale palette
* Flat list (no cards)

**Metaphor**

> *Habits are the painting. Tasks are the sticky notes on the frame.*

---

## 6. Relationship to Other Systems

### 6.1 Tasks vs. One-Time Goals (Hard Line)

| Goals                  | Tasks          |
| ---------------------- | -------------- |
| Outcomes               | Steps          |
| Emotionally meaningful | Logistical     |
| Multi-session          | Single-session |
| Tracked                | Disposable     |

**Example**

* Goal: *Plan trip to Japan*
* Tasks:

  * Buy plane tickets
  * Renew passport

If a task starts growing branches, it has outgrown the Task system.

---

### 6.2 Contextual Linking to Goals (Allowed)

Tasks may optionally be **linked to a Goal**.

**Rules**

* One task → max one goal
* Optional
* No automatic goal progress updates
* Contextual only

**UX**

* Inside a Goal detail view, show a section:

  > “Related Tasks”

This allows intimidating goals to be broken down *without polluting dashboards*.

---

## 7. Data Model (MVP)

```ts
interface Task {
  id: string;
  userId: string;
  title: string;               // Recommended max: 140 chars
  status: 'active' | 'completed' | 'deleted';
  listPlacement: 'inbox' | 'today';
  linkedGoalId?: string;       // Nullable
  createdAt: ISO8601;
  completedAt?: ISO8601;
  movedToTodayAt?: ISO8601;    // Sorting for Today
}
```

---

## 8. Task Lifecycle

1. Created → Inbox
2. (Optional) Promoted → Today
3. Completed
4. Archived automatically

Archived tasks:

* Hidden by default
* No analytics
* No resurfacing

---

## 9. Explicit Non-Goals (Scope Fence)

The following are **intentionally excluded** from MVP:

❌ Dates / Reminders
❌ Priorities (High / Medium / Low)
❌ Subtasks
❌ Recurring Tasks
❌ Notifications
❌ Gamification
❌ Task analytics

**Rationale**
Every added field increases management cost. Tasks should cost *nothing* to manage.

---

## 10. Research & Cognitive Principles Used

* **Cognitive Offloading**
  *“The brain is for having ideas, not holding them.”* — David Allen

* **Zeigarnik Effect**
  Captured tasks reduce mental looping.

* **Fresh Start Effect**
  Today is a psychological reset, not a deadline.

* **Loss Aversion Avoidance**
  No “overdue” states → less shame → higher engagement.

---

## 11. Success Criteria (Qualitative)

This feature is successful if:

* Users stop misusing habits for chores
* Tasks lists trend toward empty
* Users report feeling “less cluttered”
* Habits regain emotional weight
* Tasks do not demand attention

---

## 12. One-Sentence Product Summary

> **Tasks exist to disappear. Habits exist to compound.**

---

### Final Note (UX Integrity)

This Tasks system is intentionally *boring*. That’s a feature, not a bug.
