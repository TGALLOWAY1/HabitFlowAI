# Daily Check-in (guided habit reflection flow)

Additive, optional 5-step flow reachable from the Dashboard (`?view=check-in&step=N`).
Nothing existing is removed or replaced; Today/All/Schedule, Dashboard, Routines and
Goals keep working unchanged.

## Findings (repo inspection)

- React 19 + Vite, query-string routing in `src/App.tsx` (`?view=`), React Context stores.
- Persistence is server-first (Express + MongoDB via `src/lib/persistenceClient.ts`);
  no local-first store. `habitEntries` is canonical behavioral truth — one active entry
  per (user, habit, dayKey); completion is always derived.
- "Today's habits" = `getTodayHabitStats(...).scheduledHabitsForToday` (shared by Today
  view + dashboard ring). Numeric habits already have a native partial state
  (value below target); boolean habits are complete/incomplete only.
- Streaks/momentum come from `useProgressOverview()` (`habitsToday[].currentStreak`,
  `momentum.global`); `hideStreaks` pref must be respected.

## Design decisions

- **Completion stays in `habitEntries`.** Done = derived from entries. Selecting Done
  writes a completion through the same store calls the Today view uses
  (`upsertHabitEntry` / checklist `toggleHabit` / choice child pick). Partial/Skip on a
  habit that is currently complete un-complete it exactly like unchecking in Today
  (soft delete via `deleteHabitEntryByKey`); otherwise entries are never touched.
  Numeric Partial offers an amount input (below-target value = native partial).
- **New reflective collection `dailyCheckIns`** — one doc per (household, user, dayKey):
  `status` (in_progress | complete; not_started = no doc), `currentStep`, `startedAt`,
  `completedAt`, and per-habit `{ completionStatus: partial|skipped|null, moodScore,
  moodTags, effortScore, journalEntry }`. Never stores "done". `complete` is sticky.
- **Drafts:** hook keeps an on-device mirror (localStorage, keyed by session userId +
  dayKey, skipped in read-only demo) + debounced server sync, so refresh/exit never
  loses input; a dirty local mirror wins on reload and is re-synced.
- Steps 3/4 cycle through Done/Partial habits inside the page (global page stays 3/5 or
  4/5). Skipped/unmarked habits need no reflection.

## Plan (one commit per item)

- [ ] 1. Plan (this file)
- [ ] 2. Server: `dailyCheckIns` types + repository + `GET/PUT /api/dailyCheckIns/:dayKey`
      + user-data deletion + repository/route tests
- [ ] 3. Client: API functions, pure helpers (status resolution, step navigation, time
      estimate, summary) and `useDailyCheckIn` draft/sync hook + unit tests
- [ ] 4. Wizard UI: `CheckInPage` (5 steps) + components, `?view=check-in&step=N`
      routing with history/back support, a11y + reduced motion + component tests
- [ ] 5. Dashboard entry point: `DailyCheckInCard` (not started / in progress / complete)
      + tests
- [ ] 6. Docs: FEATURES.md, HABITFLOW_UI_ARCHITECTURE.md, API.md, DATA_MODEL.md,
      "How HabitFlow Works" modal
- [ ] 7. Verify: `npm run build`, lint, full test suite, mobile visual pass vs mockups;
      push + PR

## Review

(filled in at the end)
