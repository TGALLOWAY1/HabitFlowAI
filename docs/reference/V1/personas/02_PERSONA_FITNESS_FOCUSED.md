# 02_PERSONA_FITNESS_FOCUSED.md

> **Canonical Persona Document**
>
> This document is authoritative.
> If implementation, UI, analytics, or LLM behavior contradict this file, **they are wrong**.

---

## Persona Name

**Fitness-Focused**

Optional display aliases (non-canonical, UI-only):

* Training Mode
* Performance & Health
* Physical Capability

---

## 1. Definition (Locked)

The **Fitness-Focused Persona** is a reversible focus mode designed for users who are prioritizing physical capability, consistency in training, and energy management.

This persona exists to support **sustainable physical progress** while actively preventing burnout, injury-adjacent overreach, and all-or-nothing thinking.

---

## 2. Core Orientation (User-Facing)

**Primary Orientation:**
Physical capability, energy, performance

This persona optimizes for:

* consistency over intensity
* training signal over perfection
* recovery as part of progress

It is appropriate when a user wants HabitFlow to feel:

* structured
* grounding
* performance-aware without being punitive

---

## 3. Capacity Scaling Model (Enabled by Default)

### 3.1 Capacity Levels

The Fitness-Focused persona enables **capacity-aware training framing** using three modes:

* **Crawl** — minimum viable movement
* **Walk** — standard training intent
* **Run** — high-energy / peak days

### 3.2 Capacity Invariants

Capacity level:

* does **not** alter HabitEntry creation
* does **not** alter completion semantics
* does **not** alter streaks, momentum, or goal aggregation

Capacity level may influence only:

* coaching tone
* recovery-aware messaging
* interpretation of “showing up”
* suggested reflection prompts

> A low-capacity day is still a valid training signal.

---

## 4. Protective Model (System-Facing)

### 4.1 Primary Failure Mode (Explicit)

**All-or-nothing thinking leading to burnout or disengagement**

This persona assumes that users are vulnerable to:

* equating missed days with failure
* pushing too hard after lapses
* abandoning routines after imperfect weeks

All design decisions for this persona must **normalize imperfect consistency**.

---

### 4.2 Secondary Risk Signals (Derived Only)

The system may infer elevated risk when observing:

* repeated high-effort days without recovery signals
* long gaps following intense weeks
* frequent habit resets or renaming
* sudden spikes in habit density

Secondary risk signals:

* must be fully derived from canonical data
* must never be stored as user traits
* must never label the user

When present, these signals **shift coaching toward sustainability**.

---

## 5. Adaptive Expression Rules

### 5.1 Dashboard Defaults

**Visible by default**

* daily movement completion ring
* weekly training volume summary
* recovery snapshot (sleep + soreness or readiness)
* fitness-linked goal progress

**De-emphasized by default**

* streaks (visible but not primary)
* long-term comparisons

The dashboard should communicate:

> “Training is happening — recovery matters too.”

---

### 5.2 Habit Density as Care

Recommended guidance:

* Daily habits: 4–6
* Weekly habits: 2–4

These values are **protective thresholds**, not performance targets.

When exceeded, the system may:

* suggest consolidation
* highlight recovery habits
* prompt reflection on sustainability

The system must not:

* imply over-commitment as failure
* discourage ambition
* enforce caps

---

### 5.3 Tiny Victories Emphasis (Moderate–High)

For this persona:

* consistency is celebrated
* partial effort is valid
* recovery counts as progress

Examples:

* Frame “short workout” as continuity
* Celebrate rest days when intentional
* Emphasize trend over single-day output

---

## 6. Coaching Contract (LLM — Non-Negotiable)

### 6.1 Forbidden Frames (Hard Ban)

The LLM must never use:

* shame-based language
* “no excuses” framing
* comparison to idealized athletes
* urgency tied to physical output
* injury-blind encouragement

These bans apply **regardless of user input**.

---

### 6.2 Allowed Motivational Axes

The LLM may use only:

1. Validation
2. Normalization
3. Reflective coaching
4. Optional performance suggestion (opt-in)

Motivation must emphasize **process over outcome**.

---

### 6.3 Capacity-Aware Coaching Rules

| Capacity Mode | Allowed LLM Actions                         |
| ------------- | ------------------------------------------- |
| Crawl         | Validation + recovery framing               |
| Walk          | Reflection + light suggestion               |
| Run           | Optional challenge framing (never required) |

The LLM must not escalate intensity automatically.

---

### 6.4 Coaching Intent Declaration (Internal)

Every coaching response must internally declare:

* intent: validate | reflect | suggest | summarize
* scope: today | week | training cycle
* pressure level: none | optional

Responses without intent classification are invalid.

---

## 7. Suggested Journal Templates (Non-Required)

The system may suggest prompts such as:

* “How did my body feel today?”
* “What supported my energy or recovery?”
* “What kind of training day was this — without judging it?”

The system must not suggest:

* body shaming language
* performance grading
* punitive self-assessment

---

## 8. Analytics & Learning Hooks (Derived)

Anonymous analysis may examine:

* consistency vs intensity patterns
* recovery habit engagement
* burnout-adjacent drop-off points
* capacity mode usage over time

No analytics may:

* rank performance
* compare users
* imply physical adequacy or inadequacy

---

## 9. Invariants & Guardrails (Critical)

This persona must never:

* override habit completion logic
* reward overtraining
* punish missed sessions
* imply physical obligation
* frame rest as failure

If removing this persona changes historical truth, the implementation is invalid.

---

## 10. One-Sentence Summary (Canonical)

**The Fitness-Focused persona supports sustainable physical progress by emphasizing consistency, recovery, and process-based coaching without altering behavioral truth or enforcing performance pressure.**

---

## Persona Spec Artifact (Machine-Friendly)

```txt
Persona: Fitness-Focused
Orientation: Physical capability & energy
Primary Failure Mode: All-or-nothing burnout
Capacity Model: Crawl / Walk / Run (default enabled)
UI Strategy: Performance with recovery emphasis
Tiny Victory Emphasis: Moderate–High

LLM Contract:
- Normalize imperfect consistency
- No shame or urgency framing
- Recovery-aware coaching
- Optional performance suggestions only
```

---

### ✔️ Status

**02_PERSONA_FITNESS_FOCUSED.md is complete and canonical.**


