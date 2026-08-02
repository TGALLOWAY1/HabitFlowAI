# Habit Tracking Mobile Regression Follow-up — 2026-08-02

## Plan and scope

- Reproduce the five reported regressions at a 390 × 844 mobile viewport.
- Trace each symptom back through UI state, canonical completion, schedule mode, and persistence-derived progress.
- Add deterministic regression coverage before/with focused fixes.
- Verify the real mobile UI, focused tests, full tests, lint/typecheck/build, and final diff.

## Confirmed defects and decisions

| Severity | Defect | Root cause | Final behavior |
|---|---|---|---|
| High | Every Today/Schedule entry mutation replaced the habit list with “Loading…”. | The authoritative refetch set a blocking loading flag even when valid local/server data was already rendered. | Initial loads and date changes block; mutation revalidation keeps current content visible and rolls in the authoritative response in the background. |
| High | Numeric entry appeared not to show the typed value on mobile. | The fixed-width flex input consumed the full row and the unbounded popover opened past the right viewport edge, pushing the value/save controls off-screen. | The popover is clamped to the visual viewport; the input can shrink; value, unit, save, and clear controls remain inside the row. |
| High | Activity heatmaps showed activity on dates without entries. | The heatmaps reused week-level quota satisfaction, which returns true for every queried date in a satisfied week. | Heatmaps count only a completed occurrence on that exact DayKey. Weekly quota status remains available to Today/ring surfaces. |
| Low | Tiny trash overlays appeared on completed All-grid cells. | A direct per-cell clear button was added to every stored entry. | The overlays are removed. Existing delete mode, long press, numeric clear, and history controls remain available. |
| High | Ten consecutive daily completions displayed as a streak of one. | Default daily habits carry all seven `assignedDays` and `requiredDaysPerWeek: 7`; the service treated every such strict schedule as a week streak. | Strict schedules count scheduled occurrences (ten days = streak 10). Only explicit/flexible quotas count satisfied weeks. |

## Regression matrix

- Day-view initial load, same-day background refresh, date change, and failed background refresh.
- Numeric draft value, new/existing value, right/left/bottom mobile viewport clamping, negative/zero behavior, and submit.
- Weekly quota satisfied by three actual days: quota status true for the week, day activity true only on those three dates.
- Strict seven-of-seven ten-day history and strict custom weekdays; flexible weekly histories retain week semantics.
- All-grid completed entry has no inline trash overlay; delete mode still clears with a canonical DayKey.

## Persistence and migration impact

No schema or data migration is required. Completion and streaks remain derived from canonical habit entries. Deploying the service changes interpretation of strict schedule streaks on the next uncached read; habit-entry mutations already invalidate progress caches.

## Verification

- Focused completion, schedule, streak, progress-route, refresh-hook, numeric-popover, heatmap-semantic, and All-grid suites pass.
- Production Vite build passes (2,823 modules; existing large-chunk warning).
- TypeScript passes with the repository's known `Wellbeing`/`wellbeing` casing conflict temporarily disabled; the normal project-reference command remains blocked by that pre-existing conflict.
- Full Vitest run: 961/969 passed. The eight failures are the existing goal forecast/category filtering, dashboard preferences, goal-track nullability, goal extension lineage, and password-reset rate-limit failures documented by the parent audit; no habit regression failed.
- ESLint passes for every changed code and test file. Repository-wide lint remains blocked by the existing 310-error baseline.
- Actual 390 × 844 browser verification confirmed: typed quantity and save control remain on-screen, mutation refresh never displays “Loading…”, partial `7/10` persists, inline cell trash is absent, and the 30-day activity grid reports zero completions for all dates when only partial progress exists. The temporary entry was cleared afterward.

## Remaining risk

- Target and schedule changes still reinterpret historical entries because habit definitions are not effective-dated.
- Pause/archive intervals are not modeled, so restored-habit historical streak policy remains limited.
- Cross-tab synchronization is refresh/visibility based rather than realtime.
- Hardware-only iOS keyboard behavior still requires device confirmation, although the reported layout failure is reproduced and corrected at the matching viewport.
