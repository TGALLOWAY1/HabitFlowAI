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
| High | Activity heatmaps showed activity on dates without entries and could omit a legitimate first/backdated day. | The heatmaps reused week-level quota satisfaction, which returns true for every queried date in a satisfied week, then filtered actual activity by comparing a habit timestamp with local midnight. | Heatmaps count only a completed occurrence on that exact DayKey. A real creation-day/backdated completion is retained; adjacent dates remain empty. Weekly quota status remains available to Today/ring surfaces. |
| Low | Trash controls appeared in the All grid, including the “Daily Habits” header shown in the report. | A direct per-cell clear control and a second global delete mode had both been added. The first follow-up removed only the per-cell control. | Both added trash surfaces are removed. Boolean toggle-off, numeric Clear, history editing, and long press retain entry removal without a persistent destructive mode. |
| High | Ten consecutive daily completions displayed as a streak of one. | Strict seven-day schedules were first misclassified as week streaks. After that correction, the live history still lost the first of ten records because its DayKey predates the habit document’s `createdAt` by one day. | Strict schedules count scheduled occurrences. A real backdated/imported entry may start history before `createdAt`, while no missed opportunities are invented before the first record. The actual “Rogain AM” history now derives current and best streaks of 10. |
| Medium | The history editor could show two entries after “Add Entry” and allowed a redundant zero document. | Its local list appended the upsert response even though persistence permits one document per habit/day; zero handling differed from the tracker. | Existing dates expose Edit rather than Add. An upsert replaces stale same-day UI state, zero clears, and decimal drafts remain visible on mobile. |

## Regression matrix

- Day-view initial load, same-day background refresh, date change, and failed background refresh.
- Numeric draft value, new/existing value, right/left/bottom mobile viewport clamping, negative/zero behavior, and submit.
- Weekly quota satisfied by three actual days: quota status true for the week, day activity true only on those three dates; creation-day/backdated activity remains on its exact date.
- Strict seven-of-seven ten-day history, an evidenced backdated first day, and strict custom weekdays; flexible weekly histories retain week semantics.
- All-grid completed entry has no inline trash overlay or global delete-mode icon; ordinary toggling still uses a canonical DayKey.
- Historical edit draft visibility, decimal save, zero-as-clear, and one-entry-per-habit/day UI behavior.

## Persistence and migration impact

Completion and streaks remain derived from canonical habit entries. Lightweight rule revisions and inactive periods are added lazily to the existing habit document; no HabitEntry backfill is required. A separate history-preservation follow-up repaired only already-deleted duplicate collisions after archiving every original and activated the canonical unique index.

## Verification

- Focused completion, schedule, streak, progress-route, refresh-hook, numeric-popover, heatmap-semantic, and All-grid suites pass.
- Production Vite build passes (2,824 modules; existing large-chunk warning).
- TypeScript passes with the repository's known `Wellbeing`/`wellbeing` casing conflict temporarily disabled; the normal project-reference command remains blocked by that pre-existing conflict.
- Final focused regression run: 152/152 passed across 15 files. Full Vitest run before the final malformed-input regression was added: 999/1007 passed; that added test also passes in the final focused run. The eight failures are the existing goal forecast/category filtering, dashboard preferences, goal-track nullability, goal extension lineage, and password-reset rate-limit failures documented by the parent audit; no habit regression failed.
- Focused ESLint over the newly added and tightly changed habit implementation/regression files passes. Repository-wide lint remains blocked by the existing 300-error/114-warning baseline, including unrelated findings in several broadly touched legacy files.
- Actual 390 × 844 browser verification confirmed: typed quantity and save control remain on-screen, mutation refresh never displays “Loading…”, partial `7/10` persists, inline cell trash is absent, and the 30-day activity grid reports zero completions for all dates when only partial progress exists. A later code check removed the remaining header delete-mode icon, and a read-only calculation over the real Rogaine history confirmed `10` current / `10` best. The temporary browser entry was cleared afterward.

## Remaining risk

- Pre-change target/schedule edits and completed archive cycles cannot be reconstructed where no historical metadata exists.
- Cross-tab synchronization remains refresh/visibility based by design for the single-user deployment.
- Hardware-only iOS keyboard behavior still requires device confirmation, although the reported layout failure is reproduced and corrected at the matching viewport.
