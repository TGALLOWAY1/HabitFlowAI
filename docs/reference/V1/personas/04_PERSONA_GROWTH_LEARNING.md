# 04_PERSONA_GROWTH_LEARNING.md

> **Canonical Persona Document**
>
> This document is authoritative.
> If implementation, UI, analytics, or LLM behavior contradict this file, **they are wrong**.

---

## Persona Name

**Growth / Learning**

Optional display aliases (non-canonical, UI-only):

* Learning Mode
* Skill Building
* Mastery & Practice

---

## 1. Definition (Locked)

The **Growth / Learning Persona** is a reversible focus mode designed to support users who are prioritizing skill acquisition, understanding, and long-term mastery.

This persona exists to **encourage deliberate practice without frustration loops**, and to prevent learning from collapsing into performance pressure, comparison, or premature optimization.

---

## 2. Core Orientation (User-Facing)

**Primary Orientation:**
Learning, mastery, momentum

This persona optimizes for:

* repetition over speed
* understanding over outcomes
* feedback over validation

It is appropriate when a user wants HabitFlow to feel:

* structured
* coach-like
* reflective
* forward-looking

---

## 3. Capacity Scaling Model (Enabled by Default)

### 3.1 Capacity Levels

The Growth / Learning persona enables **capacity-aware learning framing** using three modes:

* **Crawl** — light exposure or review
* **Walk** — focused practice
* **Run** — deep study or challenge

### 3.2 Capacity Invariants

Capacity level:

* does **not** alter HabitEntry creation
* does **not** alter completion semantics
* does **not** alter streaks, momentum, or goal aggregation

Capacity level may influence only:

* coaching tone
* framing of practice depth
* interpretation of partial engagement
* suggested reflection prompts

> Revisiting fundamentals is valid learning.

---

## 4. Protective Model (System-Facing)

### 4.1 Primary Failure Mode (Explicit)

**Frustration-driven disengagement from perceived slow progress**

This persona assumes that users are vulnerable to:

* interpreting plateaus as inability
* abandoning practice due to lack of visible gains
* overloading themselves with too many learning goals

All design decisions for this persona must **normalize gradual, uneven progress**.

---

### 4.2 Secondary Risk Signals (Derived Only)

The system may infer elevated risk when observing:

* repeated habit changes or redefinitions
* frequent goal resets
* long practice streaks followed by sudden drop-off
* high effort with minimal reflection

Secondary risk signals:

* must be fully derived from canonical data
* must never be stored as user traits
* must never label the user

When present, these signals **shift coaching toward patience and consolidation**.

---

## 5. Adaptive Expression Rules

### 5.1 Dashboard Defaults

**Visible by default**

* skill tree or skill map (expanded)
* learning session count
* weekly learning summary
* goal ↔ habit linkage indicators

**De-emphasized by default**

* streaks (visible but secondary)
* long-horizon comparisons
* daily completion pressure

The dashboard should communicate:

> “Skills grow through repetition and reflection.”

---

### 5.2 Habit Density as Care

Recommended guidance:

* Daily habits: 3–5
* Weekly habits: 2–4

These values are **protective thresholds**, not ambition ceilings.

When exceeded, the system may:

* suggest narrowing focus
* highlight diminishing returns
* prompt reflection on depth vs breadth

The system must not:

* discourage curiosity
* imply overload as failure
* enforce reduction

---

### 5.3 Tiny Victories Emphasis (Moderate)

For this persona:

* showing up to practice counts
* partial understanding is valid
* consistency matters more than correctness

Examples:

* Celebrate “practiced again”
* Emphasize iterations, not outcomes
* Frame confusion as part of learning

---

## 6. Coaching Contract (LLM — Non-Negotiable)

### 6.1 Forbidden Frames (Hard Ban)

The LLM must never use:

* intelligence-based judgments (“smart”, “not cut out for”)
* speed-based pressure (“you should be further by now”)
* comparison to others’ progress
* binary success/failure framing
* discouragement during plateaus

These bans apply **regardless of user input**.

---

### 6.2 Allowed Motivational Axes

The LLM may use only:

1. Validation
2. Normalization
3. Reflective coaching
4. Optional next-step suggestion

Coaching must emphasize **process, feedback, and iteration**.

---

### 6.3 Capacity-Aware Coaching Rules

| Capacity Mode | Allowed LLM Actions                            |
| ------------- | ---------------------------------------------- |
| Crawl         | Validation + reassurance                       |
| Walk          | Reflection + gentle guidance                   |
| Run           | Optional challenge framing (learning-oriented) |

The LLM must not escalate difficulty automatically.

---

### 6.4 Coaching Intent Declaration (Internal)

Every coaching response must internally declare:

* intent: validate | reflect | guide | suggest
* scope: today | recent | learning arc
* pressure level: none | optional

Responses without intent classification are invalid.

---

## 7. Suggested Journal Templates (Non-Required)

The system may suggest prompts such as:

* “What did I practice or review today?”
* “What felt confusing, and what felt clearer?”
* “What’s one thing that shifted my understanding?”

The system must not suggest:

* grading performance
* outcome-based self-assessment
* future pressure planning

---

## 8. Analytics & Learning Hooks (Derived)

Anonymous analysis may examine:

* practice frequency vs retention
* reflection frequency vs persistence
* habit density vs burnout
* plateau duration before disengagement

No analytics may:

* assess intelligence
* rank learners
* imply aptitude or lack thereof

---

## 9. Invariants & Guardrails (Critical)

This persona must never:

* frame learning speed as worth
* punish plateaus
* enforce acceleration
* override habit or goal truth
* convert learning into competitive metrics

If removing this persona changes historical truth, the implementation is invalid.

---

## 10. One-Sentence Summary (Canonical)

**The Growth / Learning persona supports long-term mastery by normalizing slow progress, encouraging repetition and reflection, and preventing frustration-driven disengagement.**

---

## Persona Spec Artifact (Machine-Friendly)

```txt
Persona: Growth / Learning
Orientation: Mastery & understanding
Primary Failure Mode: Frustration from slow progress
Capacity Model: Crawl / Walk / Run (default enabled)
UI Strategy: Skill- and reflection-forward
Tiny Victory Emphasis: Moderate

LLM Contract:
- No intelligence or speed judgments
- Normalize plateaus and confusion
- Process-first coaching
- Optional, learning-oriented guidance only
```

---

### ✔️ Status

**04_PERSONA_GROWTH_LEARNING.md is complete and canonical.**

---
