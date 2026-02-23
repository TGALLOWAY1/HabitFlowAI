# Verification Checklist

## 1) Documentation Consistency

1. Ensure root entrypoint points to docs:
- `README.md` links to `docs/DOC_INDEX.md`.

2. Ensure index coverage:
- every canonical docs file listed in `docs/DOC_INDEX.md`.

3. Ensure canonical references are linked:
- `docs/reference/V1/00_NORTHSTAR.md`
- `docs/reference/iOS release V1/Feature_Prioritization.md`

4. Ensure historical material is clearly marked:
- files in `docs/archive/` begin with archive notice.

## 2) Progress Accuracy

Validate derived progress from canonical habit entries using existing read paths:

- `GET /api/progress/overview`
- `GET /api/dayView?dayKey=...&timeZone=...`

### Minimal Fixture Plan

Create a test user with:
- 2 daily boolean habits
- 1 weekly habit (`goal.frequency='weekly'`, target > 1)
- entries across one month including missed days and a soft-deleted entry

Expected checks:

1. Day completion
- reflects existence of non-deleted `HabitEntry` records for the day.

2. Weekly semantics
- weekly habit completion/progress is DayKey-window based and deterministic.

3. Derived-only guarantees
- completion/progress are not stored as truth fields on habit entries.

### Edge Cases

- timezone/dayKey boundary around UTC offsets
- deleted entries (`deletedAt`) excluded
- weekly habit semantics (distinct-day vs quantity target)
- bundle parents excluded from direct completion truth

## 3) Regression Safety

- Existing dashboard and existing pages still render and navigate.
- Logging actions still occur on existing surfaces.
