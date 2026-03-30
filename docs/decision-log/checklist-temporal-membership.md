# Temporal Checklist Membership, Scheduling, Strictness, and Graduation

**Status:** Accepted
**Date:** 2026-03-29

## Problem

Checklist bundles previously used the current child list (`subHabitIds`) to compute historical completion ratios, causing historical completion to change when checklist items were added or removed. There was also no support for:
- Day-of-week scheduling for individual checklist items
- Configurable success thresholds (always required 100% completion)
- Habit graduation (marking a habit as mastered without deletion)

Additionally, `deriveBundleCompletion` in `dayViewService.ts` used OR logic (`completedCount > 0`) for all bundle types, including checklists — a discrepancy with the frontend which correctly used AND logic.

## Decision

Checklist bundles now use time-bound membership records (`BundleMembership`) with day-of-week scheduling. Daily completion ratios are computed only from checklist items active and scheduled on that day. Bundles include configurable success rules and support habit graduation.

### Key Changes

1. **Extended `BundleMembershipRecord`** with `daysOfWeek` (schedule) and `graduatedAt` (graduation timestamp)
2. **Unified membership model** — both choice and checklist bundles now use `bundleMemberships` collection
3. **Added `ChecklistSuccessRule`** — configurable success criteria (any, threshold, percent, full)
4. **Added graduation endpoint** — `PATCH /api/bundle-memberships/:id/graduate`
5. **Fixed server-side completion logic** — checklist bundles now evaluate success rule instead of OR logic
6. **Per-bundle `streakType`** with user-level default fallback

### Key Principles

- Historical denominators must remain historically accurate
- Removing a checklist item must not change past completion ratios
- Graduation represents behavior change success and must be tracked
- Streaks are based on success rule, not raw ratio
- Completion is always derived at read time, never stored

## Consequences

- More complex completion derivation (per-day membership resolution with schedule filtering)
- Backward compatible via fallback to `subHabitIds` for pre-migration bundles
- Migration script required for existing checklist bundles
- Frontend remains largely unaware — server handles temporal logic transparently

## Alternatives Considered

1. **Store computed completion** — Rejected: violates "entries are truth" invariant
2. **Separate collection for checklist memberships** — Rejected: unified model is simpler
3. **Monthly scheduling** — Deferred: weekly scheduling covers common use cases
