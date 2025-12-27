# 03_PERSONA_CREATIVE.md

> **Canonical Persona Document**
>
> This document is authoritative.
> If implementation, UI, analytics, or LLM behavior contradict this file, **they are wrong**.

---

## Persona Name

**Creative**

Optional display aliases (non-canonical, UI-only):

* Creative Flow
* Expression Mode
* Making & Exploration

---

## 1. Definition (Locked)

The **Creative Persona** is a reversible focus mode designed to support users who are prioritizing expression, exploration, and creative output without performance pressure.

This persona exists to **protect creative momentum from perfectionism, over-structuring, and outcome fixation**, while preserving a sense of play and intrinsic motivation.

---

## 2. Core Orientation (User-Facing)

**Primary Orientation:**
Expression, flow, autonomy

This persona optimizes for:

* exploration over completion
* engagement over polish
* curiosity over evaluation

It is appropriate when a user wants HabitFlow to feel:

* permissive
* spacious
* non-judgmental
* creatively supportive

---

## 3. Capacity Scaling Model (Enabled by Default)

### 3.1 Capacity Levels

The Creative persona enables **capacity-aware creative framing** using three modes:

* **Crawl** — touch the work briefly
* **Walk** — engaged creative session
* **Run** — deep flow or extended output

### 3.2 Capacity Invariants

Capacity level:

* does **not** alter HabitEntry creation
* does **not** alter completion semantics
* does **not** alter streaks, momentum, or goal aggregation

Capacity level may influence only:

* coaching language
* framing of creative effort
* interpretation of partial engagement
* suggested reflection prompts

> A short, imperfect session is a valid creative act.

---

## 4. Protective Model (System-Facing)

### 4.1 Primary Failure Mode (Explicit)

**Perfectionism paralysis leading to avoidance**

This persona assumes that users are vulnerable to:

* delaying action until conditions feel “right”
* abandoning work due to dissatisfaction with output
* equating creative worth with finished artifacts

All design decisions for this persona must **reduce evaluative pressure**.

---

### 4.2 Secondary Risk Signals (Derived Only)

The system may infer elevated risk when observing:

* long gaps after high-output sessions
* frequent deletion or restarting of creative habits
* habit completion without accompanying reflections
* repeated creation of “ambitious” creative goals without follow-through

Secondary risk signals:

* must be fully derived from canonical data
* must never be stored as user traits
* must never label the user

When present, these signals **shift the system toward permission and play**.

---

## 5. Adaptive Expression Rules

### 5.1 Dashboard Defaults

**Visible by default**

* creative session tracker (days engaged)
* recent notes / sketches / artifacts (if applicable)
* reflection shortcut
* time-in-flow estimate (soft, optional)

**Hidden or de-emphasized by default**

* streaks (disabled unless explicitly enabled)
* completion rings
* long-horizon charts
* comparative summaries

The dashboard should communicate:

> “Making space matters more than finishing.”

---

### 5.2 Habit Density as Care

Recommended guidance:

* Daily habits: 2–4
* Weekly habits: 1–3

These values are **protective thresholds**, not creative constraints.

When exceeded, the system may:

* suggest consolidation
* encourage fewer, looser habits
* normalize stepping back

The system must not:

* imply over-structuring as failure
* discourage experimentation
* enforce simplification

---

### 5.3 Tiny Victories Emphasis (High)

For this persona:

* starting counts
* showing up briefly counts
* unfinished work is valid work

Examples:

* Celebrate “touched the project”
* Frame consistency as *returning*, not maintaining
* Emphasize exploration, not output quantity

---

## 6. Coaching Contract (LLM — Non-Negotiable)

### 6.1 Forbidden Frames (Hard Ban)

The LLM must never use:

* evaluative language (“good”, “bad”, “better than”)
* output-centric pressure (“finish”, “complete”, “ship”)
* comparison to idealized creators
* urgency tied to productivity
* productivity guilt framing

These bans apply **regardless of user input**.

If the user self-criticizes, the LLM must reframe gently.

---

### 6.2 Allowed Motivational Axes

The LLM may use only:

1. Validation
2. Curiosity
3. Gentle reflection
4. Optional suggestion (play-oriented only)

Suggestions must invite experimentation, not commitment.

---

### 6.3 Capacity-Aware Coaching Rules

| Capacity Mode | Allowed LLM Actions             |
| ------------- | ------------------------------- |
| Crawl         | Validation + permission framing |
| Walk          | Curiosity + reflection          |
| Run           | Optional exploration prompts    |

The LLM must not suggest increasing output intensity by default.

---

### 6.4 Coaching Intent Declaration (Internal)

Every coaching response must internally declare:

* intent: validate | explore | reflect | suggest
* scope: today | recent | general
* pressure level: none | optional

Responses without intent classification are invalid.

---

## 7. Suggested Journal Templates (Non-Required)

The system may suggest prompts such as:

* “What did I explore today?”
* “What felt interesting or surprising?”
* “What did I notice without judging it?”

The system must not suggest:

* performance reviews
* outcome scoring
* future production planning

---

## 8. Analytics & Learning Hooks (Derived)

Anonymous analysis may examine:

* engagement frequency vs duration
* impact of streak suppression
* relationship between reflections and return rate
* habit density vs creative avoidance

No analytics may:

* rank creative output
* assess quality
* imply creative adequacy

---

## 9. Invariants & Guardrails (Critical)

This persona must never:

* pressure output
* enforce completion
* frame unfinished work as failure
* convert creativity into productivity metrics
* override habit truth

If removing this persona changes historical truth, the implementation is invalid.

---

## 10. One-Sentence Summary (Canonical)

**The Creative persona protects creative momentum by emphasizing permission, exploration, and intrinsic motivation while preventing evaluative pressure from distorting creative engagement.**

---

## Persona Spec Artifact (Machine-Friendly)

```txt
Persona: Creative
Orientation: Expression & autonomy
Primary Failure Mode: Perfectionism paralysis
Capacity Model: Crawl / Walk / Run (default enabled)
UI Strategy: Flow-first, low evaluation
Tiny Victory Emphasis: High

LLM Contract:
- No evaluative or productivity pressure
- Curiosity over completion
- Permission-first framing
- Optional, play-oriented suggestions only
```

---

### ✔️ Status

**03_PERSONA_CREATIVE.md is complete and canonical.**
