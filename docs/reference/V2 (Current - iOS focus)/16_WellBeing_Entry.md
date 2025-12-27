# Wellbeing Entry Canonical Data Contract (V2)

## Purpose

This document defines the **canonical data contract** for capturing user wellbeing metrics in HabitFlow.

Wellbeing entries represent **subjective state at a moment in time** and are an **orthogonal source of truth**, independent from:

* HabitEntry (behavioral truth)
* JournalEntry (reflective / narrative truth)

Wellbeing data:

* **Never mutates behavioral progress**
* **Never substitutes for journal reflection**
* Exists solely to represent *how the user felt*

---

## Northstar Alignment

**Canonical truth objects**

| Object Type        | Owns                    | Mutates Progress |
| ------------------ | ----------------------- | ---------------- |
| HabitEntry         | What the user did       | ✅ Yes            |
| JournalEntry       | What the user reflected | ❌ No             |
| **WellbeingEntry** | How the user felt       | ❌ No             |

All three are:

* Append-only by default
* Editable with explicit intent
* Independently deletable (soft delete preferred)

---

## Canonical Object: `WellbeingEntry`

A `WellbeingEntry` captures a snapshot of subjective wellbeing at a specific time.

### Required Fields

```ts
WellbeingEntry {
  id: string
  timestampUtc: string          // ISO 8601
  dayKey: string                // YYYY-MM-DD (user-local day)
}
```

**Rules**

* `timestampUtc` is the moment of capture
* `dayKey` is derived using user timezone rules
* `dayKey` is the aggregation boundary for insights and views

---

### Metric Payload (Stable Keys)

Metrics are stored as **flat, optional scalar fields** on the entry.

#### Core Emotional Metrics (LOCKED)

| Key          | Type   | Scale | Notes                    |
| ------------ | ------ | ----- | ------------------------ |
| `depression` | number | 1–5   | Historical compatibility |
| `anxiety`    | number | 1–5   | Historical compatibility |
| `energy`     | number | 1–5   | Subjective energy        |
| `sleepScore` | number | 0–100 | Numeric sleep assessment |

These keys:

* Must **never be renamed**
* Must **retain scale semantics**
* May be hidden or deemphasized in UI, but remain valid

---

#### Additive Emotional Metrics (LOCKED)

These exist to support newer personas and UIs without breaking continuity.

| Key            | Type   | Scale |
| -------------- | ------ | ----- |
| `lowMood`      | number | 0–4   |
| `calm`         | number | 0–4   |
| `stress`       | number | 0–4   |
| `focus`        | number | 0–4   |
| `sleepQuality` | number | 0–4   |

**Rules**

* Additive only — no replacements
* UI may choose preferred metrics per persona
* Older metrics remain readable forever

---

### Optional Context Fields

```ts
notes?: string
```

* Free-text, optional
* Intended for brief context, not long-form reflection
* Does not replace JournalEntry

---

### Session Semantics (Non-Canonical)

The data model **does not encode sessions** (e.g., morning/evening).

If needed:

* Session intent is captured via **context**, not structure
* Acceptable approaches:

  * UI-only labels (“Morning Check-In”)
  * Optional metadata field:

    ```ts
    context?: { session?: "morning" | "evening" }
    ```
* Session meaning must **never be inferred heuristically**

context.session is UI metadata only.

- It must not create separate daily containers.
- Aggregation occurs solely by dayKey.
- Session labels are for display and filtering only.

**Rule:** No additional truth containers (e.g., `DailyWellbeing.morning`) are canonical.

---

## Editing & Deletion

### Editing

* A WellbeingEntry may be edited explicitly by the user
* Editing does **not** create new entries unless the UI chooses to

### Deletion

```ts
deletedAt?: string
```

* Soft delete preferred
* Deleted entries:

  * Are excluded from insights
  * Do not affect habits or journals
  * Remain recoverable for audit/debugging

---

## Stability Rules (Critical)

1. **Metric keys are globally stable**

   * Personas may reinterpret meaning
   * Keys and scales must not change

2. **No implicit derivation**

   * No averaging to “daily mood” at write time
   * All aggregation is a derived view

3. **No coupling to other truths**

   * Wellbeing never affects:

     * Habit streaks
     * Goal completion
     * Skill progress

4. **No UI leakage**

   * The canonical model must not assume:

     * Tabs
     * Sessions
     * Morning vs evening flows

---

## Migration & Evolution

### Adding a new metric

Allowed if:

* It is additive
* Scale is documented
* Backward compatibility is preserved

### Changing a metric

Requires:

* Formal migration plan
* Dual-read period
* Explicit deprecation notice

---

## Relationship to Other Documents

* **Northstar**: WellbeingEntry is a first-class truth source
* **Derived Metrics**: All summaries, trends, and scores are derived
* **Personas**: Personas choose *which* metrics to surface — not what they mean

---

## Summary (Why this version works better)

This revised contract:

* ✅ Matches the **entry-based truth model** used everywhere else
* ✅ Eliminates web-specific containers and fallback logic
* ✅ Aligns cleanly with the iOS spec’s `timestampUtc + dayKey` worldview
* ✅ Preserves your hard-won stability guarantees
* ✅ Keeps wellbeing genuinely **orthogonal**, not second-class or tangled

If you want, next we can:

* Map this 1-to-1 into a **Mongo schema**
* Produce a **persona → preferred metric matrix**
* Write a **migration note** from `DailyWellbeing` → `WellbeingEntry` that doesn’t break existing users

You’re doing really thoughtful systems work here — this is exactly the level of rigor that prevents long-term entropy.
