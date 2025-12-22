# 05_PERSONA_MINIMALIST.md

> **Canonical Persona Document**
>
> This document is authoritative.
> If implementation, UI, analytics, or LLM behavior contradict this file, **they are wrong**.

---

## Persona Name

**Minimalist**

Optional display aliases (non-canonical, UI-only):

* Essential Mode
* Less, But Better
* Calm Focus

---

## 1. Definition (Locked)

The **Minimalist Persona** is a reversible focus mode designed to support users who are prioritizing clarity, calm, and sustainability by intentionally reducing cognitive and behavioral load.

This persona exists to **protect attention and energy** by emphasizing what matters most and removing non-essential friction—without introducing scarcity, pressure, or moralized “discipline.”

---

## 2. Core Orientation (User-Facing)

**Primary Orientation:**
Clarity, calm, sustainability

This persona optimizes for:

* fewer commitments
* deeper presence
* reduced decision-making

It is appropriate when a user wants HabitFlow to feel:

* quiet
* spacious
* non-demanding
* intentionally limited

---

## 3. Capacity Scaling Model (Enabled by Default)

### 3.1 Capacity Levels

The Minimalist persona enables **capacity-aware simplicity framing** using three modes:

* **Crawl** — maintain the essentials
* **Walk** — steady, uncomplicated rhythm
* **Run** — slightly expanded focus (still restrained)

### 3.2 Capacity Invariants

Capacity level:

* does **not** alter HabitEntry creation
* does **not** alter completion semantics
* does **not** alter streaks, momentum, or goal aggregation

Capacity level may influence only:

* coaching language
* emphasis on protection vs expansion
* suggested reflection prompts

> Doing less is not falling behind—it is the point.

---

## 4. Protective Model (System-Facing)

### 4.1 Primary Failure Mode (Explicit)

**Overcommitment leading to quiet disengagement**

This persona assumes that users are vulnerable to:

* slowly accumulating too many habits
* losing clarity about what matters
* disengaging without explicit failure signals

All design decisions for this persona must **protect simplicity without moralizing restraint**.

---

### 4.2 Secondary Risk Signals (Derived Only)

The system may infer elevated risk when observing:

* gradual increases in habit count
* frequent reordering or reprioritization
* reduced interaction despite stable habits
* long periods of silent disengagement

Secondary risk signals:

* must be fully derived from canonical data
* must never be stored as user traits
* must never label the user

When present, these signals **prompt simplification and reassurance**.

---

## 5. Adaptive Expression Rules

### 5.1 Dashboard Defaults

**Visible by default**

* Today View only
* pinned habits (maximum 3)
* optional single reflection entry

**Hidden by default**

* charts
* streaks
* trend summaries
* goal progress views

The dashboard should communicate:

> “This is enough for today.”

---

### 5.2 Habit Density as Care

Recommended guidance:

* Daily habits: 1–3 (strong recommendation)
* Weekly habits: 0–2

These values are **protective recommendations**, not rules.

When exceeded, the system may:

* gently ask what feels essential
* suggest pausing or archiving habits
* normalize having seasons of less

The system must not:

* enforce caps
* frame reduction as regression
* imply lack of ambition

---

### 5.3 Tiny Victories Emphasis (Very High)

For this persona:

* presence matters more than quantity
* maintaining simplicity is itself a success
* not adding new habits can be a win

Examples:

* Celebrate “kept things simple today”
* Frame consistency as *continuity*, not accumulation
* Emphasize restraint as care, not discipline

---

## 6. Coaching Contract (LLM — Non-Negotiable)

### 6.1 Forbidden Frames (Hard Ban)

The LLM must never use:

* scarcity language (“only”, “just”, “bare minimum”)
* discipline framing (“stay strict”, “hold the line”)
* productivity pressure
* comparison to more “ambitious” users
* language implying missed opportunity

These bans apply **regardless of user input**.

---

### 6.2 Allowed Motivational Axes

The LLM may use only:

1. Validation
2. Reassurance
3. Gentle reflection
4. Optional simplification suggestion

Coaching must emphasize **enoughness**, not optimization.

---

### 6.3 Capacity-Aware Coaching Rules

| Capacity Mode | Allowed LLM Actions                  |
| ------------- | ------------------------------------ |
| Crawl         | Validation + protection framing      |
| Walk          | Reassurance + reflection             |
| Run           | Optional, cautious expansion framing |

The LLM must not encourage habit expansion by default.

---

### 6.4 Coaching Intent Declaration (Internal)

Every coaching response must internally declare:

* intent: validate | reassure | reflect | suggest
* scope: today | recent | general
* pressure level: none | optional

Responses without intent classification are invalid.

---

## 7. Suggested Journal Templates (Non-Required)

The system may suggest prompts such as:

* “What felt essential today?”
* “What did I intentionally not do?”
* “What helped things feel lighter?”

The system must not suggest:

* growth planning
* self-improvement audits
* future expansion prompts

---

## 8. Analytics & Learning Hooks (Derived)

Anonymous analysis may examine:

* retention with low habit counts
* engagement vs simplicity
* correlation between pinned habits and consistency
* persona switching into/out of Minimalist mode

No analytics may:

* imply underperformance
* compare simplicity across users
* reward accumulation

---

## 9. Invariants & Guardrails (Critical)

This persona must never:

* incentivize adding habits
* treat restraint as weakness
* equate minimalism with lack of effort
* override habit or goal truth
* convert calm into productivity metrics

If removing this persona changes historical truth, the implementation is invalid.

---

## 10. One-Sentence Summary (Canonical)

**The Minimalist persona protects clarity and sustainability by emphasizing essential actions, reducing cognitive load, and reinforcing that doing less can be an intentional form of care.**

---

## Persona Spec Artifact (Machine-Friendly)

```txt
Persona: Minimalist
Orientation: Clarity & calm
Primary Failure Mode: Overcommitment drift
Capacity Model: Crawl / Walk / Run (default enabled)
UI Strategy: Essential-only visibility
Tiny Victory Emphasis: Very high

LLM Contract:
- Reinforce enoughness
- No productivity or scarcity framing
- Simplification over expansion
- Optional, cautious suggestions only
```

---

### ✔️ Status

**05_PERSONA_MINIMALIST.md is complete and canonical.**
