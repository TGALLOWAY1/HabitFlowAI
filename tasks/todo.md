# Routine Push Reminders

Bring habit-style push reminders (`reminderTime` / `reminderEnabled`) to routines.

- [ ] 1. Model + API: add `reminderTime`/`reminderEnabled` to `Routine`, validate on POST/PATCH `/api/routines` (commit 1)
- [ ] 2. Scheduler: `findReminderRoutinesForScopes`, routine-log completion skip, send-log dedup namespacing, routine send loop in `reminderScheduler` (commit 2)
- [ ] 3. UI: reminder time + enable controls in `RoutineEditorModal` (commit 3)
- [ ] 4. Tests: `routines.reminder.test.ts` + scheduler routine cases (commit 4)
- [ ] 5. Docs: FEATURES.md, HABITFLOW_UI_ARCHITECTURE.md, InfoModal Reminders blurb (commit 5)
- [ ] 6. `npm run build` + relevant test runs, push, open PR

Design decisions:
- Routines have no schedule concept (no assignedDays) → reminders fire every day, skipped when the routine already has a log for that local dayKey (any variant).
- Dedup ledger keeps the existing `{habitId, dayKey, endpoint}` unique index; routine sends namespace the id as `routine:<id>` (no migration, no collision — habit ids are UUIDs).
- Notification deep-link: `/?view=routines`, tag `routine-<id>-<dayKey>`.
