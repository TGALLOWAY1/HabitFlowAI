ARCHIVED: kept for historical context; may not match current code.

# Psychological Safety v0 (Preserved)

This document preserves the prior safety-first direction and tone system.
It is not the active v1 product direction.

## Intent & Principles

Historical intent emphasized an emotionally protective product stance:

- calm, non-punitive daily companion
- missed days treated as neutral (not failure)
- shame-minimization as an explicit design objective
- editing history as dignity-preserving and safe
- no urgency/deadline/failure-state framing in core surfaces

Recovered principles:

- `Entry > Everything` and `Derived, Never Stored` were paired with explicit emotional safety language.
- Reflection/coaching layers were intended to reduce disengagement after inconsistency.
- Several PRDs explicitly framed visibility as non-obligatory and completion as non-moral.

Primary historical sources:

- `docs/reference/iOS release V1/Product_Vision.md`
- `docs/reference/V1/personas/01_PERSONA_EMOTIONAL_REGULATION.md`
- `docs/reference/V0/📘 HabitFlowAI PRD - Daily Habit View.md`
- `docs/reference/V0/📘 HabitFlowAI PRD - Journal.md`
- `docs/reference/V0/📘 HabitFlowAI PRD - Non-NegotiableHabits.md`

## UX Copy Patterns

Historical copy rules favored:

- validation before suggestion
- language that normalizes inconsistency
- invitation framing instead of commands
- process framing over outcome framing

Historical “avoid” set (from persona/coaching specs):

- deficit language (`behind`, `not enough`)
- moralized language (`should`, `failure`, `discipline` as judgment)
- urgency escalation (`act now`, pressure ramps)
- comparison framing (`others`, ranking)

Historical “allowed” pattern hierarchy:

1. validate
2. normalize
3. gentle reflection
4. optional suggestion

Historical in-product examples still present in code:

- `src/App.tsx` (goals/routines helper copy)
- `src/data/journalTemplates.ts` (non-judgmental/gentle prompts)

## Visual Design Do/Don’t (Historical)

Do:

- use calm, low-threat visual affordances
- provide subtle emphasis rather than alarm states
- prefer gentle signals for prioritization (e.g., “priority ring” pattern)
- keep dense data views from becoming punitive scoreboards via tone/context

Don’t:

- use red/overdue/failure-state framing as primary feedback
- encode “late”, “missed”, or moralized status markers as behavior truth
- couple urgency visuals to identity or worth framing

Historical source references:

- `docs/reference/V0/📘 HabitFlowAI PRD - Daily Habit View.md`
- `docs/reference/V0/📘 HabitFlowAI PRD - Non-NegotiableHabits.md`
- `docs/reference/V1/01_HABIT.md`

## Coaching Layer Ideas (Historical)

Preserved coaching concepts:

- persona-specific coaching lenses (emotional regulation, fitness, creative, growth/learning)
- capacity modes (`crawl`, `walk`, `run`) for tone adaptation
- coaching intent declaration (`validate|reflect|suggest|summarize` etc.)
- pressure-level constraint (`none|optional`) in generated coaching responses
- adaptive reduction of pressure when risk signals are detected (derived-only, never trait storage)

Important historical invariant kept across these ideas:

- coaching and persona layers must not mutate HabitEntry truth or completion semantics.

Source references:

- `docs/reference/V1/personas/01_PERSONA_EMOTIONAL_REGULATION.md`
- `docs/reference/V1/personas/02_PERSONA_FITNESS_FOCUSED.md`
- `docs/reference/V1/personas/03_PERSONA_CREATIVE.md`
- `docs/reference/V1/personas/04_PERSONA_GROWTH_LEARNING.md`

## Deferred Features / Future Re-introduction Plan

If this direction is reintroduced in a future version, scope it as an explicit layer:

1. Keep truth boundary unchanged
- no new behavioral truth stores
- no stored completion/progress flags

2. Reintroduce safety as configurable presentation policy
- optional safety mode profile(s)
- user-selectable coaching strictness and pressure cap

3. Reintroduce copy/visual guardrails with explicit lintable rules
- banned phrase set
- urgency/failure-state policy by screen type

4. Validate via measurable outcomes
- re-engagement after missed days
- reduced abandonment after lapses
- no regression in logging speed or data correctness

5. Maintain reversibility
- removing safety mode must not alter stored truth
- derived layers remain recomputable and discardable

## Preservation Notes

This archive consolidates prior psychological-safety direction for reference only.
Current active direction is in:

- `docs/V1_PRODUCT_DIRECTION.md`
