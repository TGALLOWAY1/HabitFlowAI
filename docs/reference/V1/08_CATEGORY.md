# 08_CATEGORY.md

> **Canonical Object**
>
> This document is authoritative.  
> If implementation, PRDs, analytics, or UI logic disagree with this file, **they are wrong**.

---

## Definition (Locked)

A **Category** is an **operational, UI-first grouping label** used to organize and navigate the user’s content.

Categories exist for **structure and clarity**, not motivation, coaching, or meaning.

A Category answers:

> “Where does this belong in the app?”

It does **not** answer:

- Who am I becoming?
- Why does this matter?
- Am I failing?

Those belong to **Identity** and **Persona**.

---

## What Categories Group

Categories may group multiple first-class objects consistently:

- Habits
- Routines
- Goals
- JournalTemplates / JournalEntries (optional)

Categories are the backbone for:

- Habit list sections
- Day View grouping
- Routine browse grouping
- Goal grouping and filtering
- Dashboard sections

---

## Core Invariants (Must Never Be Violated)

### Category Is Structural, Not Interpretive

- Category is a stable organizational key
- It should be low-ambiguity and consistent over time

---

### Category Owns No Progress

Category must never:

- track completion
- store streaks
- store totals
- own metrics

Any “category momentum” or summary is **derived** from HabitEntries and must not be stored on Category.

---

### Category Must Not Become Identity or Persona

Category must never:

- contain motivational language
- encode values or aspirations
- imply obligation or priority

If removing Category changes meaning, it is misused.

---

## Canonical Data Shape (Semantic Minimum)

This defines the **conceptual contract**, not a storage schema.

```ts
Category {
  id: string

  name: string                // e.g. "Physical Health"

  sortOrder?: number          // user-defined ordering
  colorToken?: string         // theme token, not raw hex
  iconKey?: string            // optional icon identifier

  isArchived?: boolean

  createdAt: string
  updatedAt: string
}
````

### Notes

* Prefer `colorToken` / `iconKey` over raw values to keep theming consistent
* Archiving a category must not delete underlying data

---

## Category Relationships (Explicit)

### Habit → Category (Required)

* Every Habit must have **exactly one** `categoryId`
* This supports predictable navigation and layout

---

### Routine → Category (Recommended)

A Routine may have:

* an explicit `categoryId`, or
* an inferred category from linked habits

If linked habits span multiple categories, the user must select one “home category.”

---

### Goal → Category (Recommended)

Categorizing Goals enables:

* coherent Goal tabs
* Skill Tree grouping
* filtering and summaries

---

### Journal → Category (Optional)

Category may group journal templates and entries for browsing convenience only.

---

## Ordering & Customization Rules

### Category Ordering

* Categories must be user-orderable
* Default order may be seeded by Persona or onboarding
* Ordering changes must not affect data semantics

---

### Habit Ordering Within Category

* Habits are orderable within a Category
* Ordering is a presentation concern, not a logic rule
* Canonical ordering should be stable across views

---

## Category’s Role in Key Screens

### Habits Page

* Categories partition the habit list
* Daily and Weekly habits must be visually separated within a category

---

### Day View (Today Board)

* Categories render as collapsible sections
* Default expansion may depend on incomplete habits
* Behavior must remain **non-punitive**

---

### Routines Browse

* Routines are grouped by Category
* Category is a discovery surface, not a commitment

---

## Deletion & Archival Semantics

### Preferred: Archive

* Archiving hides the Category from navigation
* Underlying data remains intact

---

### If Deleting (Guardrails Required)

If deletion is allowed:

* Require reassignment of all attached objects
* Never allow `categoryId = null` for Habits
* Never cascade delete data

---

## What Category Must NOT Do (Anti-Patterns)

Category must never:

* ❌ store progress or metrics
* ❌ enforce schedules
* ❌ drive coaching tone
* ❌ imply obligation
* ❌ encode identity narratives

---

## LLM / Design Decision Checklist

Before implementing anything involving Category, the system must ask:

1. Is this purely organizational?
2. Would removing Category only affect navigation?
3. Am I accidentally adding meaning or motivation here?
4. Are all metrics derived elsewhere?

If any answer is **no**, Category is being misused.

---

## One-Sentence Summary

Category is a stable organizational label used to group and navigate habits, routines, goals, and journals without owning progress or psychological meaning.
