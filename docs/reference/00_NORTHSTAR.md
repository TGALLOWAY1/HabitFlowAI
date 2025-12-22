# HabitFlow Canonical Vocabulary (v1)

## Northstar
HabitEntry is the only unit of historical truth for behavior and progress.
JournalEntry is the unit of historical truth for reflection and subjective state.

All behavioral progress is derived from HabitEntries.
Journals never mutate progress or completion.
Everything else is interpretation or context.


## Authority Notice
This document defines the canonical vocabulary.
If implementation or PRDs disagree, they are wrong.

## Canonical Stack (Top → Bottom)
Persona → focus        (lens)
Identity → meaning     (narrative)
Category → structure   (organization)
Goal → commitment      (aggregation intent)
Habit → action         (definition of valid behavior)
Routine → support      (structure & intent)
HabitEntry → truth     (facts)

HabitEntry → behavioral truth (facts)
JournalEntry → reflective truth (experience)

Derived Metrics → interpretation
Personas → visibility & framing

Key insights:
Nothing above HabitEntry owns time
HabitEntry owns behavioral history
JournalEntry owns reflective history
Both are removable only in the sense that personas/interpretations are removable — not that truth stores are removable
Everything above is removable

Interpretive layers:
- Skill
- Derived Metrics
- Journals

## Reference Documents

| Object | Source |
|------|-------|
| Habit | /reference/01_HABIT.md |
| HabitEntry | /reference/02_HABIT_ENTRY.md |
| RoutineExecution | /reference/03_ROUTINE_EXECUTION.md |
| HabitPotentialEvidence | /reference/04_HABIT_POTENTIAL_EVIDENCE.md |
| Goal | /reference/05_GOAL.md |
| GoalLink | /reference/06_GOAL_LINK.md |
| Identity | /reference/07_IDENTITY.md |
| Category | /reference/08_CATEGORY.md |
| Persona | /reference/09_PERSONA.md |
| Skill | /reference/10_SKILL.md |
| Time / DayKey | /reference/11_TIME_DAYKEY.md |
| Derived Metrics | /reference/12_DERIVED_METRICS.md |
| JournalTemplate | /reference/13_JOURNAL_TEMPLATE.md |
| JournalEntry | /reference/14_JOURNAL_ENTRY.md |
| HabitEntryReflection | /reference/15_HABIT_ENTRY_REFLECTION.md |

## Global Invariants (Apply Everywhere)

- Completion is derived, never stored  
- HabitEntry is the only unit of historical truth for behavior and progress.
- JournalEntry is the unit of historical truth for reflection and subjective state.
- DayKey is the aggregation boundary  
- No punitive mechanics by default  
- Interpretive layers must be deletable without data loss
- Removing any Persona must not remove or invalidate either HabitEntry or JournalEntry history.