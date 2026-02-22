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

## 2) Main Dashboard Accuracy

Validate `GET /api/dashboard` with controlled fixture data.

### Minimal Fixture Plan

Create a test user with:
- 2 daily boolean habits
- 1 weekly habit (`goal.frequency='weekly'`, target > 1)
- entries across one month including missed days and a soft-deleted entry

Expected checks:

1. `dailyCounts[dayKey]`
- increments only for days with non-deleted entries.

2. `dailyPercent[dayKey]`
- computed from selected habits for that day and consistent with denominator.

3. `monthlySummary`
- `goal` matches defined monthly opportunity model.
- `percent === completed / goal * 100` (rounded rules documented in code).

4. `weeklySummary`
- week window boundaries are DayKey-based and deterministic.

5. `heatmap`
- habit rows align to day keys in selected month.
- deleted entries are absent.

6. `categoryRollup`
- sums align with per-habit contributions and selected filters.

### Edge Cases

- timezone/dayKey boundary around UTC offsets
- deleted entries (`deletedAt`) excluded
- weekly habit semantics (distinct-day vs quantity target)
- bundle parents excluded from direct completion truth

## 3) Regression Safety

- Existing dashboard and existing pages still render and navigate.
- Logging actions still occur on existing surfaces (no behavior moved to Main Dashboard).
