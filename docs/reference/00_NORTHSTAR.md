# HabitFlow Canonical Vocabulary (v1)

## Northstar
HabitEntry is the only unit of historical truth.
All progress is derived from HabitEntries.
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

Key insights:
Nothing above HabitEntry owns time
Nothing above HabitEntry owns history
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
- HabitEntry is the only historical truth  
- DayKey is the aggregation boundary  
- No punitive mechanics by default  
- Interpretive layers must be deletable without data loss
