# iOS parity status

The native iOS client lives in the
[`TGALLOWAY1/iOS-HabitFlow`](https://github.com/TGALLOWAY1/iOS-HabitFlow) repository. The full
gap analysis and phased parity plan is maintained there:
[`docs/ios-implementation/FEATURE_PARITY_PLAN.md`](https://github.com/TGALLOWAY1/iOS-HabitFlow/blob/main/docs/ios-implementation/FEATURE_PARITY_PLAN.md).
This page is only a summary pointer — [`FEATURES.md`](FEATURES.md) remains the canonical
inventory of what the web app ships, and the iOS repo's plan keys off it.

## Snapshot (2026-08-29)

The iOS app currently has **foundation and authentication only** (Swift core package with
DayKey + auth contracts, Keychain session store, login/restore/logout UI, CI lane). No product
domain exists on iOS yet.

| Web feature area (status per `FEATURES.md`) | On iOS today | Parity vehicle (iOS repo) |
|---|---|---|
| Auth / session | Partial (M1 in progress) | M1 |
| Habits: Today view, boolean/numeric completion, offline sync, create/edit/archive, history/streaks | Missing | M2–M6, M8 (initial release) |
| Habit bundles (checklist/choice) | Missing | M7 |
| Push reminders | Missing | M9 (APNs; backend work) |
| Tracker grid, schedule view, categories, reordering, pinned habits, settings | Missing | P1 |
| Goals, milestones, tracks, achievements | Missing | P2 |
| Routines (variants, timers, images, runner, logs) | Missing | P3 |
| Journal + Wellbeing (check-ins, meds, health hub) | Missing | P4 |
| Analytics, Sleep, Insights, Tasks | Missing | P5 |
| AI features (Gemini BYOK hub, report archive) | Missing | P6 |
| Apple Health | Missing (native HealthKit will replace the web's external bridge) | P7 |
| Demo, interactive tour, roadmap page | Not planned | N/A (web-only) |

Dashboard cards are assembled incrementally as their domains land (P1–P5).

## Keeping this in sync

- Shipping or significantly changing a web feature → `FEATURES.md` (per `CLAUDE.md`), which the
  iOS parity plan consumes; large changes deserve a note in the iOS repo's plan too.
- iOS phase/milestone status changes are recorded in the iOS repo
  (`STATUS.md` / `FEATURE_PARITY_PLAN.md`), not here. Update the snapshot table above only when
  a whole area's status changes (e.g. Habits becomes "Shipped on iOS").
