# HabitFlow Decision Log — Recent Decisions (2026-03-30)

## Decision 1: Remove `frequency` as a goal type

- **Date:** 2026-03-30
- **Status:** Accepted

### Decision
Goal taxonomy is now constrained to:
- `cumulative`
- `onetime`

The legacy `frequency` goal type is removed from create/update flows and core type checks.

### Reasoning
- `frequency` goals overlap conceptually with habit recurrence/scheduling.
- Habits already model recurring cadence (daily/weekly/scheduled days), while goals should represent outcomes/achievements.
- Simplifying goal types reduces UI confusion and avoids duplicated mental models.

### Implications
- Goal creation/edit UIs should only present cumulative vs one-time outcomes.
- Any recurring “do X N times/week” framing should be handled via habits, not goals.
- Legacy references to “frequency goals” in comments/copy should be cleaned up.

### Follow-up actions / open questions
- Sweep UI copy and comments for stale “frequency goal” wording.
- Confirm analytics/reporting UX still communicates recurring progress through habits rather than goals.

---

## Decision 2: Replace “Non-Negotiable” habit framing with explicit scheduling controls

- **Date:** 2026-03-30
- **Status:** Accepted

### Decision
Habit creation/edit now emphasizes:
- selected scheduled days,
- required days per week,
instead of a primary “non-negotiable” toggle.

### Reasoning
- “Non-negotiable” was value-loaded and less precise than explicit schedule requirements.
- Direct schedule controls are clearer and support more flexible, real-world planning.

### Implications
- Habit commitment is represented as measurable schedule/weekly requirement data.
- UX should continue to show schedule and grace/flex framing consistently.
- Backward-compatibility fields may still exist but should be treated as derived/legacy.

### Follow-up actions / open questions
- Verify all downstream UI surfaces use schedule language consistently.
- Consider eventual migration/deprecation strategy for legacy non-negotiable field semantics.

---

## Decision 3: Streaks for scheduled habits are week-satisfaction based; users can globally hide streak indicators

- **Date:** 2026-03-30
- **Status:** Accepted (with policy clarification pending)

### Decision
- Scheduled daily habit streaks are calculated by weekly satisfaction against `requiredDaysPerWeek`.
- A user-level dashboard preference (`hideStreaks`) controls whether streak indicators are shown across UI surfaces.

### Reasoning
- Weekly satisfaction provides flexibility and reduces punitive streak breaks.
- A hide-streaks preference supports users who find streak signals distracting or counterproductive.

### Implications
- Streak semantics for scheduled habits are less rigid than strict day-specific adherence.
- Multiple components must respect a single preference source of truth.
- Preference hydration/state sync quality becomes critical.

### Follow-up actions / open questions
- Clarify product policy: should off-schedule completions count toward weekly requirement in all cases?
- Add regression coverage for dashboard preference hydration and cross-surface consistency.

---

## Decision 4: Bundle completion remains child-entry driven, with stronger temporal membership handling

- **Date:** 2026-03-30
- **Status:** Accepted (ongoing hardening)

### Decision
- Bundle parent completion remains derived from child entries, not parent writes.
- Membership timeline operations are reinforced during bundle edit/link/unlink flows.
- Server derivation for summary/analytics paths is strengthened to reduce view-level divergence.

### Reasoning
- Child-entry canonicality avoids parent/child double-write drift.
- Temporal membership is required for historical correctness when bundle composition changes.

### Implications
- Grid/day/summary surfaces should converge on the same completion semantics.
- Membership operations become part of bundle-edit correctness requirements.
- Remaining fallback paths should be treated as migration compatibility, not target architecture.

### Follow-up actions / open questions
- Define sunset plan for legacy fallback behavior (static `subHabitIds` assumptions).
- Continue adding invariant tests around bundle editing and historical reads.

---

## Decision 5: Preserve visibility and integrity across archive/delete linkage operations

- **Date:** 2026-03-30
- **Status:** Accepted

### Decision
Linked-entity cleanup logic (especially goal-habit/category interactions) is being hardened so archived habits do not become unintentionally invisible or orphaned after delete/unlink operations.

### Reasoning
- Data integrity and user trust are harmed when archived records disappear from expected surfaces due to linkage side effects.
- Cleanup operations must protect both referential integrity and discoverability.

### Implications
- Delete/unlink handlers need explicit archive-safe behavior.
- Regression tests for deletion/cleanup scenarios are a long-term requirement.

### Follow-up actions / open questions
- Audit similar unlink/delete flows for routines and bundles to ensure parity.
- Add periodic integrity checks for orphaned or hidden historical entities.
