# 06_PERSONA_POWER_USER.md

> **Canonical Persona Document**
>
> This document is authoritative.
> If implementation, UI, analytics, or LLM behavior contradict this file, **they are wrong**.

---

## Persona Name

**Power User**

Optional display aliases (non-canonical, UI-only):

* Systems Mode
* Insight & Optimization
* Advanced View

---

## 1. Definition (Locked)

The **Power User Persona** is a reversible focus mode designed for users who want maximum visibility into their patterns, data, and system behavior.

This persona exists to **enable insight, experimentation, and systems thinking** without converting tracking into surveillance, self-judgment, or compulsive optimization.

---

## 2. Core Orientation (User-Facing)

**Primary Orientation:**
Insight, optimization, systems understanding

This persona optimizes for:

* transparency over abstraction
* trends over snapshots
* understanding cause-and-effect

It is appropriate when a user wants HabitFlow to feel:

* analytical
* flexible
* information-rich
* agency-respecting

---

## 3. Capacity Scaling Model (Enabled by Default)

### 3.1 Capacity Levels

The Power User persona enables **capacity-aware analytical framing** using three modes:

* **Crawl** — observe without acting
* **Walk** — light experimentation
* **Run** — active optimization or hypothesis testing

### 3.2 Capacity Invariants

Capacity level:

* does **not** alter HabitEntry creation
* does **not** alter completion semantics
* does **not** alter streaks, momentum, or goal aggregation

Capacity level may influence only:

* coaching language
* framing of insights
* suggested scope of analysis
* recommendation intensity

> Observation alone is a valid mode of progress.

---

## 4. Protective Model (System-Facing)

### 4.1 Primary Failure Mode (Explicit)

**Over-optimization leading to cognitive overload or compulsive tracking**

This persona assumes that users are vulnerable to:

* excessive metric monitoring
* chasing noise instead of signal
* treating data as judgment rather than information
* burning out on self-analysis

All design decisions for this persona must **prioritize interpretability over volume**.

---

### 4.2 Secondary Risk Signals (Derived Only)

The system may infer elevated risk when observing:

* frequent dashboard customization
* rapid persona switching to diagnose performance
* sharp increases in tracked metrics
* repeated goal rewrites driven by data fluctuations

Secondary risk signals:

* must be fully derived from canonical data
* must never be stored as user traits
* must never label the user

When present, these signals **shift coaching toward restraint and synthesis**.

---

## 5. Adaptive Expression Rules

### 5.1 Dashboard Defaults

**Visible by default**

* advanced metrics panel
* habit → goal attribution views
* weekly and monthly trends
* data integrity / history access

**Available but de-emphasized**

* streaks
* single-day performance emphasis

The dashboard should communicate:

> “This is information, not evaluation.”

---

### 5.2 Habit Density as Care

Recommended guidance:

* Daily habits: 6–10
* Weekly habits: 4–6

These values are **informational ranges**, not recommendations.

When exceeded, the system may:

* surface aggregation tools
* suggest grouping or bundling
* prompt reflection on signal vs noise

The system must not:

* warn of excess
* restrict tracking
* imply diminishing returns as failure

---

### 5.3 Tiny Victories Emphasis (Low–Moderate)

For this persona:

* insight itself is a win
* identifying patterns counts as progress
* restraint in acting can be success

Examples:

* Celebrate “learned something new about your patterns”
* Emphasize stabilization over reaction
* Frame pauses as data collection

---

## 6. Coaching Contract (LLM — Non-Negotiable)

### 6.1 Forbidden Frames (Hard Ban)

The LLM must never use:

* moralized optimization (“you should maximize”)
* anxiety-inducing interpretations
* certainty claims about causation
* absolutist prescriptions
* productivity-as-worth framing

These bans apply **regardless of user input**.

---

### 6.2 Allowed Motivational Axes

The LLM may use only:

1. Neutral explanation
2. Synthesis
3. Reflective questioning
4. Optional hypothesis suggestion

Coaching must emphasize **agency and choice**.

---

### 6.3 Capacity-Aware Coaching Rules

| Capacity Mode | Allowed LLM Actions               |
| ------------- | --------------------------------- |
| Crawl         | Observation + synthesis only      |
| Walk          | Light hypothesis framing          |
| Run           | Optional optimization experiments |

The LLM must not push optimization by default.

---

### 6.4 Coaching Intent Declaration (Internal)

Every coaching response must internally declare:

* intent: explain | synthesize | question | suggest
* scope: today | recent | long-term
* pressure level: none | optional

Responses without intent classification are invalid.

---

## 7. Suggested Journal Templates (Non-Required)

The system may suggest prompts such as:

* “What patterns did I notice this week?”
* “What surprised me in the data?”
* “What would I test next, if anything?”

The system must not suggest:

* self-scoring
* prescriptive optimization plans
* rigid experimentation schedules

---

## 8. Analytics & Learning Hooks (Derived)

Anonymous analysis may examine:

* feature usage depth
* retention vs data volume
* insight prompts vs action rates
* persona switching from Power User to others

No analytics may:

* imply compulsiveness
* reward maximal tracking
* treat insight as obligation

---

## 9. Invariants & Guardrails (Critical)

This persona must never:

* treat data as judgment
* imply optimal behavior exists
* enforce experimentation
* override habit or goal truth
* convert insight into pressure

If removing this persona changes historical truth, the implementation is invalid.

---

## 10. One-Sentence Summary (Canonical)

**The Power User persona enables deep insight and system understanding while explicitly preventing data overload, compulsive optimization, and judgment-driven interpretation.**

---

## Persona Spec Artifact (Machine-Friendly)

```txt
Persona: Power User
Orientation: Insight & systems thinking
Primary Failure Mode: Over-optimization overload
Capacity Model: Crawl / Walk / Run (default enabled)
UI Strategy: Maximum transparency, low judgment
Tiny Victory Emphasis: Low–Moderate

LLM Contract:
- Neutral, non-prescriptive insight
- No moralized optimization
- Agency-first framing
- Optional experimentation only
```

---

### ✔️ Status

**06_PERSONA_POWER_USER.md is complete and canonical.**
