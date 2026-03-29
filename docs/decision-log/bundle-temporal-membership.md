# Temporal Bundle Membership and Parent Habit Continuity

**Status:** Accepted
**Date:** 2026-03-29

## Problem

Bundles forced static child definitions via `subHabitIds` and caused loss of continuity when child habits changed. When a user wanted to evolve their habit focus (e.g., switch from "Study GRE" to "Study Linear Algebra"), the parent habit's streak broke and analytics lost historical context.

## Decision

- Bundle parents represent long-term **identity** habits.
- Child habits are time-bound **segments** with membership periods (`activeFromDayKey` to `activeToDayKey`).
- Parent completion is derived from children whose membership was active on the queried day.
- A new `bundleMemberships` MongoDB collection stores temporal relationships.
- Overlapping child memberships are allowed (natural for choice bundles).
- Scope: Choice bundles only in V1. Checklist bundles will follow in a separate PRD.

## Consequences

- **Parent streak continuity preserved** across child changes.
- **Child habits can be safely retired** without corrupting history or analytics.
- **Analytics become timeline-based** — showing which child satisfied the parent on each day.
- **Slightly more complex queries** due to time-aware membership resolution.
- **Backward compatible** — falls back to `subHabitIds` for bundles without membership records.
- **Canon update required** — `BundleMembership` added to derived metrics canonical sources (12_DERIVED_METRICS.md).

## Alternatives Considered

1. **Extend habit fields** — Add `bundleActiveFromDayKey`/`bundleActiveToDayKey` directly on child habits. Simpler but harder to query temporally.
2. **Keep static bundles** — No temporal awareness. Rejected because it prevents habit evolution without losing continuity.
