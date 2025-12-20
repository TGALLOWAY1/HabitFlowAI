# Milestone A Audit Map

## Header

**Milestone A purpose:**
Find every place history is stored, computed, cached, or merged from non-entry sources

**Current date:** 2025-12-20

**Current git branch:** 176-switch-to-canonical-vocabulary

**How to update this file:**
1. Add findings to the appropriate canonical object section
2. Document all read/write paths, collections, and risks
3. Accumulate raw grep findings in the Shadow Truth Ledger section
4. Keep this file as the single source of architectural truth during audit

---

## Authority Notice

**Canonical Vocabulary Reference:** [/reference/00_NORTHSTAR.md](./00_NORTHSTAR.md)

**Core Invariant:** HabitEntry is the only historical truth; everything else is derived.

All progress, history, and time-based data must ultimately trace back to HabitEntry records. Any stored caches, computed history, or merged data from non-entry sources represents shadow truth that must be identified and audited.

---

## Audit Map Entries

### HabitEntry

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Habit

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### RoutineExecution

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### HabitPotentialEvidence

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Goal

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### GoalLink

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Category

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Persona

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Identity

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### DerivedMetrics

**Note:** Explicitly call out stored caches here. DerivedMetrics should be computed on-demand from HabitEntry, not stored as historical truth.

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### JournalTemplate

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### JournalEntry

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### HabitEntryReflection

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

## Shadow Truth Ledger (Raw Findings)

This section accumulates raw grep findings, code snippets, and observations that may indicate shadow truth (history stored, computed, cached, or merged from non-entry sources).

**Reminder:** HabitEntry is the only historical truth; everything else is derived.

### Raw Findings

_(Findings will be added here during audit process)_

