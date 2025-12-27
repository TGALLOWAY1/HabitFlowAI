# 01_PERSONA_EMOTIONAL_REGULATION.md

> **Canonical Persona Document**
>
> This document is authoritative.
> If implementation, UI, analytics, or LLM behavior contradict this file, **they are wrong**.

---

## Persona Name

**Emotional Regulation**

Optional display aliases (non-canonical, UI-only):

* Stability Mode
* Care & Grounding
* Nervous System Support

---

## 1. Definition (Locked)

The **Emotional Regulation Persona** is a reversible focus mode designed to support users who are prioritizing psychological safety, emotional stability, and self-trust over performance or output.

This persona exists to **reduce shame-driven disengagement** and to ensure that habit tracking and coaching remain supportive during periods of emotional vulnerability.

---

## 2. Core Orientation (User-Facing)

**Primary Orientation:**
Stability, self-trust, nervous system safety

This persona optimizes for:

* predictability over intensity
* presence over output
* consistency over throughput

It is appropriate when a user wants HabitFlow to feel:

* calm
* non-demanding
* emotionally safe

---

## 3. Capacity Scaling Model (Enabled by Default)

### 3.1 Capacity Levels

The Emotional Regulation persona enables **capacity-aware framing** using three user-selectable modes:

* **Crawl** — minimum viable presence
* **Walk** — meeting oneself where one is
* **Run** — optional surplus capacity

### 3.2 Capacity Invariants

Capacity level:

* does **not** alter HabitEntry creation
* does **not** alter completion semantics
* does **not** alter streaks, momentum, or goal aggregation

Capacity level may influence only:

* coaching language
* momentum messaging tone
* reflection prompts
* suggested journal templates

> Capacity scaling exists to preserve dignity, not to reclassify effort.

---

## 4. Protective Model (System-Facing)

### 4.1 Primary Failure Mode (Explicit)

**Shame-driven avoidance after inconsistency**

This persona assumes that:

* missed days are interpreted as personal failure
* self-criticism leads to disengagement
* pressure worsens outcomes

All design decisions for this persona must reduce the likelihood of shame accumulation.

---

### 4.2 Secondary Risk Signals (Derived Only)

The system may infer heightened vulnerability when observing patterns such as:

* extended inactivity following strong engagement
* repeated deletion of entries
* rapid habit creation followed by abandonment
* disengagement after “successful” weeks

Secondary risk signals:

* must be fully derived from canonical data
* must never be stored as user traits
* must never label the user

When present, these signals **soften system behavior**.

They must never escalate pressure.

---

## 5. Adaptive Expression Rules

### 5.1 Dashboard Defaults

**Visible by default**

* mood trends (morning / evening)
* reflection entry shortcut
* minimal habit surface (maximum 3 visible)

**Hidden by default**

* progress rings
* streaks
* aggregate totals
* comparative charts

Absence of these elements is **intentional and protective**.

---

### 5.2 Habit Density as Care

Recommended guidance:

* Daily habits: 1–3
* Weekly habits: 0–2

These values are **soft care thresholds**, not limits.

When exceeded, the system may:

* prompt curiosity
* suggest simplification
* normalize reduction

The system must not:

* block creation
* warn of risk
* imply overload as failure

---

### 5.3 Tiny Victories Emphasis (Very High)

For this persona:

* presence is celebrated
* effort is contextualized
* output is optional

Examples:

* Emphasize “showing up” over “completing”
* Frame continuity, not totals
* Avoid numerical dominance in copy

---

## 6. Coaching Contract (LLM — Non-Negotiable)

### 6.1 Forbidden Frames (Hard Ban)

The LLM must never use:

* deficit framing (“behind”, “not enough”)
* moral judgment (“should”, “discipline”, “failure”)
* urgency (“you need to”, “act now”)
* comparison (“most people”, “others”)
* pressure escalation

These bans apply **regardless of user input**.

Self-critical language must not be mirrored or reinforced.

---

### 6.2 Allowed Motivational Axes

The LLM may use only the following axes, in order of priority:

1. Validation
2. Normalization
3. Gentle reflection
4. Optional suggestion (invitation-only)

Planning and optimization are **not default behaviors**.

---

### 6.3 Capacity-Aware Coaching Rules

| Capacity Mode | Allowed LLM Actions              |
| ------------- | -------------------------------- |
| Crawl         | Validation only                  |
| Walk          | Validation + reflection          |
| Run           | Reflection + optional suggestion |

The LLM must not suggest increasing effort on Crawl days.

---

### 6.4 Coaching Intent Declaration (Internal)

Every coaching response must internally declare:

* intent: validate | reflect | suggest | summarize
* scope: today | recent | general
* pressure level: none | optional

Responses without a valid intent classification are invalid.

---

## 7. Suggested Journal Templates (Non-Required)

The system may suggest reflective prompts such as:

* “What helped me feel a little steadier today?”
* “What felt heavy, without fixing it?”
* “One small thing I did for myself”

The system must not suggest:

* performance reviews
* forward planning
* self-evaluation beyond mood awareness

---

## 8. Analytics & Learning Hooks (Derived)

Anonymous analysis may examine:

* re-engagement after missed days
* response to validation-only coaching
* habit density vs retention
* capacity mode distributions

No analytics may:

* score emotional performance
* rank users
* infer clinical states

---

## 9. Invariants & Guardrails (Critical)

This persona must never:

* mutate core domain logic
* alter completion semantics
* override derived metrics
* create penalties for disengagement
* imply obligation or permanence

If removing this persona changes historical truth, the implementation is invalid.

---

## 10. One-Sentence Summary (Canonical)

**The Emotional Regulation persona is a safety-first focus mode that prioritizes dignity, self-trust, and gentle continuity by shaping visibility and coaching language without altering behavioral truth.**

---

## Persona Spec Artifact (Machine-Friendly)

```txt
Persona: Emotional Regulation
Orientation: Stability & self-trust
Primary Failure Mode: Shame-driven avoidance
Capacity Model: Crawl / Walk / Run (default enabled)
UI Strategy: Protective minimalism
Tiny Victory Emphasis: Very high

LLM Contract:
- Validation-first
- No urgency or deficit framing
- Capacity-aware responses
- Planning only by invitation
```

---

### ✔️ Status

This persona document is **complete and canonical**.
