# iOS Discovery — Curated Source Index

High-value files only — this is a curated index, not a dump. Add files as tasks confirm
their importance; annotate why each matters.

## Application entry points

- `src/main.tsx` — React root; service-worker registration (prod only) + push re-sync.
- `src/App.tsx` — the entire frontend router (`AppRoute` union, `?view=` query routing),
  provider stack, lazy-loaded pages.
- `src/server/index.ts` — backend entry point.
- `src/server/app.ts` — Express app factory; **the authoritative API surface** (151 route
  registrations) and middleware order.

## Routes and screens

- `src/components/AuthGate.tsx` — pre-auth state machine (login / invite / forgot / reset
  / tour / roadmap); handles the `/reset-password` path route.
- `src/pages/` — lazy pages: goals (6 files), insights tabs (7), Journal, Tasks, Analytics,
  AppleHealth, WellbeingHistory (= Insights page), Tour, Roadmap, DebugEntries.
- `src/components/BottomTabBar.tsx` — 4 tabs (Dashboard, Habits, Routines, Goals).
- `src/components/Layout.tsx` — header chrome: AI hub, Settings, user menu, demo banner;
  window-event modal openers (`habitflow:open-settings` / `open-ai` / `close-overlays`).
- `src/components/ProgressDashboard.tsx` — dashboard composition; mounts all wellbeing
  modals and dashboard cards.
- `src/components/TrackerGrid.tsx` — tracker "All" mode; mounts habit context-menu modals.
- Full screen/modal inventory: `docs/ios-discovery/02-screens-and-navigation.md`.

## Feature verification (Task 3 additions)

- `src/server/services/badgeGenerationService.ts` — AI goal-badge images (HF, `HF_TOKEN`).
- `src/utils/momentum.ts` + `src/components/CategoryMomentumBanner.tsx` — live momentum
  banner (undocumented); `src/server/services/momentumService.ts` is the dead server twin.
- `src/server/services/freezeService.ts` — dormant streak-freeze write path.
- `src/lib/demoRoutineSuggestions.ts` — demo-mode AI variant drafts.
- `src/lib/betaAccess.ts` — client beta email gate (one of three allowlist copies).
- `src/server/routes/userData.ts` — delete-all-data collection list (incomplete).
- `src/data/journalTemplates.ts` — 11 templates + separate free-write.

## Habit domain

- `src/domain/habits/` — completion, schedule, weeklyProgress, trackingHistory,
  definitionValidation (shared client/server logic with tests).
- `src/server/routes/habits.ts`, `src/server/repositories/habitRepository.ts`.
- `src/types/index.ts` — frontend domain types.
- `src/server/domain/canonicalTypes.ts`, `canonicalValidators.ts` — server-side contracts.

## Completion and quantities

- `src/domain/habits/completion.ts` — **the** canonical completion rule
  (`deriveDailyHabitCompletion`, `getCompletionEntryValue`).
- `src/domain/habits/trackingHistory.ts` — per-day historical target/type resolution
  (`resolveHabitTrackingForDay` over `trackingRevisions`).
- `src/domain/habits/weeklyProgress.ts` — weekly quota = distinct completed scheduled days.
- `src/server/routes/habitEntries.ts` — entry CRUD + upsert-by-key + batch + rate limiting.
- `src/server/utils/habitValidation.ts` — per-habit payload rules (numeric requires value;
  both choice-bundle generations).
- `src/server/utils/dayKeyNormalization.ts` — dayKey > date > timestamp priority, NY fallback.
- `src/server/repositories/habitEntryRepository.ts` (+ `__tests__/…guardrails.test.ts`).
- `src/lib/habitEntryPayload.ts` — client payload allowlist (guards PUT only; tested).
- `src/store/HabitContext.tsx` — toggle/upsert/delete flows, optimistic model, 30 s sync.
- `src/server/routes/__tests__/entriesOnly.invariants.test.ts` — CI-enforced truth invariants.
- Full UI payload matrix: `05-completion-and-quantities.md` §3.

## Scheduling and streaks

- `src/server/utils/dayKey.ts`, `dayKeyNormalization.ts` — server DayKey authority.
- `src/domain/time/dayKey.ts` — shared DayKey utilities.
- `src/domain/habits/schedule.ts` — shared schedule domain (assignedDays /
  requiredDaysPerWeek quota rules, creation boundary, expected opportunities);
  `src/server/services/scheduleEngine.ts` is just a re-export shim.
- `src/server/services/streakService.ts` — canonical streak engine (opportunity-based
  daily + satisfied-week modes); `freezeService.ts` (dormant), `momentumService.ts`
  (dead server twin of `src/utils/momentum.ts`).
- `docs/semantics/daykey.md` — policy doc (America/New_York fallback; two stale claims —
  see `06-scheduling-time-and-streaks.md` §1).

## Bundles

- `src/server/routes/bundleMemberships.ts` + `bundleMembershipRepository.ts` — membership
  lifecycle; temporal read rule at repo:182-211.
- `src/shared/checklistSuccessRule.ts` — the one success-rule evaluator
  (`checklistSuccessService.ts` is a re-export shim).
- `src/server/services/habitConversionService.ts` — history-preserving conversion
  (**dead path from UI** — AddHabitModal uses plain updateHabit).
- `src/utils/habitUtils.ts` — client bundle status/stats (subHabitIds-based).
- `docs/decision-log/bundle-temporal-membership.md`, `checklist-temporal-membership.md` —
  both verified to match code.
- Full semantics + risk list: `07-bundles.md`.

## History

- `src/server/services/dayViewService.ts`, `truthQuery.ts` — derived day view from entries.
- `src/server/routes/dayView.ts`, `daySummary.ts`, `progress.ts`.

## Authentication

- `src/server/routes/auth.ts` — login, invite redeem, bootstrap admin, forgot/reset.
- `src/server/middleware/identity.ts` (+ test), `session.ts`, `publicDemo.ts`.
- `src/server/lib/authCrypto.ts`, `sessionCookie.ts`.
- `src/store/AuthContext.tsx` — client-side auth state.

## API and backend

- `src/server/app.ts` — route inventory (see Entry points).
- `src/lib/persistenceClient.ts` — the frontend API client (all fetch call sites, headers).
- `src/server/middleware/rateLimitAuth.ts` — rate limiters (auth, invites, entry writes).
- `src/server/lib/gemini.ts`, `src/lib/geminiClient.ts` — Gemini BYOK AI plumbing.
- `src/server/services/reminderScheduler.ts`, `src/server/lib/webPush.ts`,
  `public/sw.js` — Web Push reminder pipeline.

## Database

- `src/models/persistenceTypes.ts` — **the real type authority** (MONGO_COLLECTIONS at
  :1499-1534; HabitEntry :1583-1697; Goal :1067-1203; Routine :527-598;
  WellbeingEntry :985-1016). Generate iOS models from this, not canonicalTypes.
- `src/server/domain/canonicalTypes.ts` — misleadingly named; stale HabitEntry shape
  (`date` instead of `dayKey`, no `freezeType`).
- `src/server/lib/mongoClient.ts` — connection + central `ensureCoreIndexes`
  (:127-192); conditional habitEntries unique index (:57-89).
- `src/server/lib/scoping.ts` — `scopeFilter` (household+user), not uniformly used.
- `src/server/repositories/` — 29 repositories ≈ collection inventory (native MongoDB
  driver v7, no ODM). Full map: `04-domain-model-and-persistence.md` §1-3.
- `src/server/migrations/startup.ts` — only migrations 002/003 wired; 001 orphaned.

## Tests

- `vitest.config.ts`, `src/test/mongoTestHelper.ts`, `src/test/setup.ts`,
  `src/test/assertTestDb.ts` — mongodb-memory-server harness.
- `package.json` `test:beta` script — the CI-gated critical suite (9 files).
- 117 test files total (Task 1 count); heaviest: `src/server/routes/__tests__` (48).

## Existing documentation

- `docs/DOC_INDEX.md` — documentation map + standards (which doc owns what).
- `docs/FEATURES.md` — canonical feature inventory w/ status (updated 2026-08-03).
- `docs/product/HABITFLOW_UI_ARCHITECTURE.md` — canonical UI/screen/flow reference
  (updated 2026-08-02).
- `FEATURE_AUDIT.md` — code-verified feature audit dated 2026-07-01.
- `docs/API.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN_CANON.md`.
- `docs/system-model/` — entity model, relationships, system rules, bug analysis
  (2026-04-04 era — verify before trusting).
- `docs/reference/V2 (Current - iOS focus)/`, `docs/reference/iOS release V1/` — prior
  iOS-facing product intent (aspirational; not implementation evidence).
- `.claude/CLAUDE.md`, `tasks/lessons.md`, `tasks/todo.md` — agent instructions and
  history affecting repo work.

## Screenshots

- **None in the repository** (see DECISIONS.md 2026-08-03). Only app icons under `public/`
  and two runtime-uploaded routine images under `public/uploads/routine-images/`.
