# iOS Discovery — Task List

Ordered checklist for the discovery effort. Statuses: **Not started** · **In progress** ·
**Blocked** · **Complete**. A task is marked Complete only after its completion criteria
have been verified against the repository (see `INSTRUCTIONS.md` §11).

---

## Task 1 — Repository and documentation orientation

- **Status:** Complete (2026-08-03)
- **Deliverable:** `01-repository-and-documentation.md` — architecture overview, repository
  map, entry points, tech stack, backend/database/auth boundaries, test & deployment setup,
  documentation inventory with trust ratings, screenshot inventory, initial risks/unknowns,
  and a shortlist of next files to inspect.
- **Completion criteria:** All important repository roots inspected; all discoverable
  documentation locations searched; screenshot locations identified (or their absence
  confirmed); every substantive claim in the output cites repository evidence; `SOURCES.md`
  updated with the most important files; next task selected.
- **Dependencies:** None.
- **Output document:** `01-repository-and-documentation.md`
- **Notes:** Criteria verified 2026-08-03: all `src/` subtrees, `docs/` (recursive),
  `scripts/`, `archive/`, `public/`, `.github/`, `.claude/`, and `tasks/` inspected;
  screenshot absence confirmed and logged in `DECISIONS.md`; `SOURCES.md` populated.
  Next task selected: **Task 2** (screens/navigation), because the freshest trustworthy
  doc (`HABITFLOW_UI_ARCHITECTURE.md`) needs code-diffing before feature verification.

## Task 2 — Route, screen, modal, and screenshot inventory

- **Status:** Complete (2026-08-03)
- **Deliverable:** `02-screens-and-navigation.md` — complete inventory of frontend routes
  (`?view=` values in `src/App.tsx` + the path-based auth/reset flows), pages, modals, tab
  bars, and navigation flows, cross-checked against
  `docs/product/HABITFLOW_UI_ARCHITECTURE.md`.
- **Completion criteria:** Every `AppRoute` value, page component in `src/pages/`, and modal
  component in `src/components/` is accounted for; discrepancies between the UI architecture
  doc and code are listed; each screen has an evidence citation.
- **Dependencies:** Task 1.
- **Output document:** `02-screens-and-navigation.md`
- **Notes (from Task 1):** No screenshots exist anywhere in the repository (verified — see
  01 doc §8), so this task's visual reference is `docs/product/HABITFLOW_UI_ARCHITECTURE.md`
  (584 lines, updated 2026-08-02) plus the code itself. Unauthenticated flows (login, invite
  redeem, forgot/reset password) are rendered via `src/components/AuthGate.tsx`;
  `/reset-password` is the only true path route found so far. ~60 component files in
  `src/components/` root; sub-areas: `day-view/`, `dashboard/`, `goals/`, `insights/`,
  `wellbeing/`, `tasks/`, `Journal/`, `analytics/`.
- **Completion note (2026-08-03):** Criteria verified — every `AppRoute` value (14 + 6
  legacy aliases), all 21 page components, and all 30 modal components inventoried with
  mount-point evidence; 6 doc-vs-code discrepancies listed in the output doc §5. One
  suspected bug found (stale `trackId` URL param — see Task 12 notes).

## Task 3 — Implemented feature inventory

- **Status:** Complete (2026-08-03)
- **Deliverable:** `03-feature-inventory.md` — feature list with per-feature status
  (Implemented / Partially implemented / Documented-only / Likely unused / Suspected bug),
  built by verifying `docs/FEATURES.md` and `FEATURE_AUDIT.md` claims against routes,
  services, and UI call sites.
- **Completion criteria:** Every feature in `docs/FEATURES.md` status table has a verified
  status and evidence; features found in code but absent from docs are added.
- **Dependencies:** Tasks 1–2.
- **Output document:** `03-feature-inventory.md`
- **Notes (from Task 1):** AI features are Gemini BYOK — the API key lives in browser
  localStorage, not server env (`.env.example` note; `src/lib/geminiClient.ts`,
  `src/server/lib/gemini.ts`). Apple Health integration is Beta, email-allowlisted, and
  depends on an external sync bridge (`docs/FEATURES.md` status table;
  `requireHealthFeature` middleware). Both materially affect iOS planning.
- **Completion note (2026-08-03):** Criteria verified — every FEATURES.md status-table area
  and every FEATURE_AUDIT.md claim has a verified status with evidence in the output doc
  (12 corrections, 4 undocumented implemented features, 9 dead/legacy items, 11 suspected
  bugs). Verification ran as four parallel read-only investigations whose surprising
  findings were each re-confirmed by direct spot-checks before acceptance.

## Task 4 — Domain model and persistence

- **Status:** Complete (2026-08-03)
- **Deliverable:** `04-domain-model-and-persistence.md` — collections, schemas, ownership,
  soft-delete semantics, identity scoping, derived-vs-stored boundaries.
- **Completion criteria:** Every repository in `src/server/repositories/` (29 files) is
  mapped to its collection and owner; `docs/DATA_MODEL.md` claims verified; the
  "entries are truth" invariant checked against write paths.
- **Dependencies:** Task 1.
- **Output document:** `04-domain-model-and-persistence.md`
- **Notes (from Task 1):** Contradiction to resolve: `.claude/CLAUDE.md` and
  `docs/ARCHITECTURE.md` say `wellbeingEntries` replaces legacy `wellbeingLogs`, but
  `/api/wellbeingLogs` routes are still registered (`src/server/app.ts:190-194`) and the
  frontend still writes through `saveWellbeingLog` → POST `/wellbeingLogs`
  (`src/lib/persistenceClient.ts:865-867`) while reads come from `wellbeingEntries`
  (comment at `persistenceClient.ts:328`). Determine the actual read/write topology and
  whether a dual-write exists. Also: `medications`, `symptoms`, `supplements` collections
  have full CRUD but are barely mentioned in the architecture docs.
- **Completion note (2026-08-03):** Criteria verified — all 29 repositories mapped
  (collection, scoping, delete semantics, indexes) in the output doc; DATA_MODEL.md
  verified with 8+ wrong/stale claims recorded (trust downgraded to Low-Medium);
  entries-are-truth checked against write paths (allowlist + `assertNoStoredCompletion` +
  CI tests) with one caveat: the entries unique index is created conditionally and may be
  absent if duplicates exist (`mongoClient.ts:57-89`). Wellbeing contradiction resolved:
  `wellbeingEntries` is the only live path; legacy `wellbeingLogs` is dead-but-registered
  (DECISIONS.md corrected). New risks carried to Task 12 (§9 of the output doc).

## Task 5 — Completion and numeric-habit behavior

- **Status:** Complete (2026-08-03)
- **Deliverable:** `05-completion-and-quantities.md` — how boolean vs quantity habits are
  logged, edited, and evaluated; entry payload shapes; per-day upsert/delete semantics.
- **Completion criteria:** `src/domain/habits/completion.ts`, `src/lib/habitEntryPayload.ts`,
  `src/server/routes/habitEntries.ts`, and their tests are read and reconciled; UI logging
  paths (TrackerGrid, NumericInputPopover, HabitLogModal, day view) documented.
- **Dependencies:** Task 4.
- **Output document:** `05-completion-and-quantities.md`
- **Notes (from Task 3):** Freeze entries exist as a special HabitEntry shape
  (`freezeType`, zero value, `note: 'freeze:auto'` — `freezeService.ts:40-127`) that the
  read path renders but nothing produces in production. Legacy `timesPerWeek` habits have
  a latent 400-on-edit bug (`definitionValidation.ts:85-87` + `AddHabitModal.tsx:293`).
  Cover entry semantics for `source` values ('routine', 'apple_health') and provenance
  fields (`routineId`, `sourceRuleId`, `importedMetricValue/Type`).
- **Completion note (2026-08-03):** Criteria verified — completion.ts, habitEntryPayload.ts
  (+ tests), habitEntries.ts, and all four UI logging surfaces documented with a full
  payload matrix in the output doc. 8 new inconsistencies/suspected bugs recorded (value
  1-vs-target divergence, zero-stores-value-0 asymmetry, swallowed errors, future-date
  gap, dead HabitLogModal/updateLog). Dead-code and error-path claims spot-checked
  directly before acceptance.

## Task 6 — Scheduling, dates, time zones, and streaks

- **Status:** Complete (2026-08-03)
- **Deliverable:** `06-scheduling-time-and-streaks.md` — DayKey policy, timezone handling,
  schedule types (assigned days, times-per-week, required-days), streaks, freezes, momentum.
- **Completion criteria:** `src/server/utils/dayKey.ts`, `src/domain/time/dayKey.ts`,
  `src/server/services/scheduleEngine.ts`, `streakService.ts`, `freezeService.ts`,
  `momentumService.ts` read with tests; `docs/semantics/daykey.md` verified against code.
- **Dependencies:** Task 4.
- **Output document:** `06-scheduling-time-and-streaks.md`
- **Notes (from Task 1):** Server falls back to America/New_York when client timezone is
  invalid — critical to verify exact behavior for an iOS client that will always send a
  real device timezone.
- **Completion note (2026-08-03):** Criteria verified — both dayKey modules, the shared
  schedule domain, and streak/freeze/momentum services read in full with tests noted;
  `docs/semantics/daykey.md` verified (accurate minus a nonexistent
  `/api/dashboard/streaks` reference and an overstated unique-index guarantee).
  Streak semantics documented as the portable spec (opportunity counting, open-day grace,
  freeze protection, weekly excusal, mode segmentation). Freeze service confirmed dormant
  with two additional shipping blockers (server-local dates; legacy-only weekly
  detection). New items carried to Task 12.

## Task 7 — Habit bundles

- **Status:** Complete (2026-08-03)
- **Deliverable:** `07-bundles.md` — checklist vs choice bundles, membership lifecycle
  (create/end/archive/graduate), success rules, conversion, temporal membership semantics.
- **Completion criteria:** `src/server/routes/bundleMemberships.ts`,
  `src/shared/checklistSuccessRule.ts`, `checklistSuccessService.ts`,
  `habitConversionService.ts` reconciled with `docs/decision-log/bundle-temporal-membership.md`
  and the bundle PRD/audits.
- **Dependencies:** Tasks 4–5.
- **Output document:** `07-bundles.md`
- **Notes (from Task 3):** Membership `daysOfWeek` windows are validated, stored, and
  honored at read time (`bundleMemberships.ts:70,107-111`, `daySummary.ts:232-237`,
  `progress.ts:258`) but no UI sets them — cover both the used and unused halves.
- **Completion note (2026-08-03):** Criteria verified — membership routes, success rule,
  conversion service, and all four temporal-read implementations documented and reconciled
  with both decision-log docs (they match code) and the 2026-03-30 audit (P7 half-done).
  Major finds: the history-preserving convert-to-bundle endpoint is a **dead path from the
  UI** (plain `updateHabit` is used instead), client-driven membership sync swallows
  errors creating a permanent client/server denominator cliff, and daySummary vs progress
  disagree on legacy choice parents. One subagent claim refuted by spot-check (PATCH does
  validate merged definitions, `habits.ts:433`). 9 items carried to Task 12.

## Task 8 — History, progress, and analytics

- **Status:** Complete (2026-08-03)
- **Deliverable:** `08-history-progress-analytics.md` — day view/day summary derivation,
  progress overview, heatmaps, analytics endpoints (habits/routines/goals/sleep), insights
  (correlations, predictions), goal progress math.
- **Completion criteria:** `dayViewService.ts`, `analyticsService.ts`, `insightsService.ts`,
  `truthQuery.ts`, goal progress services and the 9 `/api/analytics/*` + 5 `/api/insights/*`
  endpoints documented with derivation rules.
- **Dependencies:** Tasks 4–6.
- **Output document:** `08-history-progress-analytics.md`
- **Completion note (2026-08-03):** Criteria verified — all 9 analytics + 5 insights
  endpoints, progress overview, daySummary, dayView, truthQuery, and both goal-progress
  paths documented with derivation rules, windows, and caching. Headline finds (all
  spot-checked): a second, divergent goal-progress engine on the Analytics Goals tab
  (wrong default aggregation, no bundle resolution, ignores activeWindow); the server
  365-day heatmap computed on every /habits/all call and never rendered; 4 dead analytics
  routes; goals summary ignores its `days` param; divergent freeze detection; client
  heatmaps derive from daySummary, not analytics. 10 items carried to Task 12.

## Task 9 — Authentication, settings, reminders, and secondary features

- **Status:** Complete (2026-08-03)
- **Deliverable:** `09-auth-settings-secondary.md` — invite-based auth, sessions, admin
  surface, password reset, push reminders, wellbeing/medications/symptoms/supplements,
  journal, tasks, demo mode & tour, user-data deletion.
- **Completion criteria:** Auth flow traced end-to-end (`src/server/routes/auth.ts`,
  `middleware/session.ts`, `middleware/identity.ts`, `lib/sessionCookie.ts`); push pipeline
  (`reminderScheduler.ts`, `pushSubscriptions.ts`, `public/sw.js`) documented; each
  secondary feature classified.
- **Dependencies:** Task 4.
- **Output document:** `09-auth-settings-secondary.md`
- **Notes (from Task 3):** Delete-all-data omits 8+ collections (`userData.ts:11-28`);
  beta/health email allowlist is hardcoded in three files, two client-side
  (`requireHealthFeature.ts:9`, `persistenceClient.ts:1764`, `betaAccess.ts:12`); journal
  upsert-by-key endpoint is orphaned client-side; push send-dedup uses a claim-by-insert
  unique index with 48h TTL (`pushSendLogRepository.ts:22-59`); scheduler has a 5-min
  catch-up window and dies with the process (documented in file header).
- **Completion note (2026-08-03):** Criteria verified — auth traced end-to-end (fixed
  14-day session cookie is the ONLY production credential; headers never override a
  session; no bearer path), push pipeline fully documented (per-device timezones,
  claim-then-send dedup, daily routine reminders), Settings inventory complete, and each
  secondary feature classified. 11 security-posture notes recorded for Task 12 (no CSRF +
  SameSite=None + CSP off; zero indexes on passwordResetTokens; non-atomic invite uses;
  reset URLs logged without RESEND key; Gemini output via dangerouslySetInnerHTML).
  All headline claims spot-checked at cited lines.
- **Notes (from Task 1):** Push reminders use Web Push (VAPID) with an in-process 60-second
  scheduler and `PUSH_REMINDERS_ENABLED` is `"false"` in `render.yaml` — verify whether the
  feature is actually live in production. iOS will need APNs instead of Web Push. Session
  cookie + `X-Household-Id`/`X-User-Id` header identity model needs exact precedence rules
  documented for a native client.

## Task 10 — API and backend suitability for a native client

- **Status:** Complete (2026-08-03)
- **Deliverable:** `10-api-surface-for-ios.md` — complete endpoint inventory (method, path,
  auth, request/response shapes), CORS/headers, rate limits, upload handling, error
  contract, and an assessment of gaps for a native client (auth without cookies?, BYOK AI
  key storage, image upload, push).
- **Completion criteria:** Every route registered in `src/server/app.ts` (151 registrations)
  is listed and classified; `docs/API.md` discrepancies noted; native-client gaps have
  evidence-backed assessments.
- **Dependencies:** Tasks 4, 9.
- **Output document:** `10-api-surface-for-ios.md`
- **Notes (from Task 1):** CORS allowlist includes custom headers `X-User-Id`,
  `X-Household-Id`, `X-Bootstrap-Key`, `X-Demo-Mode` (`src/server/app.ts:124`). Production
  frontend is Vercel-static with `/api/*` rewritten to Render
  (`vercel.json` → `habitflowai.onrender.com`) — an iOS client would presumably hit the
  Render origin directly; confirm auth cookie behavior cross-origin.
- **Notes (from Task 3):** Gemini BYOK key travels in the request **body** (`geminiApiKey`
  field read from `req.body` in all five AI routes), never a header. Badge generation needs
  server env `HF_TOKEN` (absent from `.env.example`). `/api/admin/integrity-report` lacks
  `requireAdmin` (`app.ts:309`). `GET /api/health` healthcheck shadows the gated health
  router mount (`app.ts:136` vs `:186`).
- **Completion note (2026-08-03):** Criteria verified — all 151 registrations (plus
  mounted routers) inventoried and classified by domain/auth in the output doc;
  docs/API.md verified with 7 wrong/dead claims (three nonexistent route groups) and
  ~90 undocumented endpoints — trust downgraded to Low; error-shape census (94 structured
  vs 69 bare); native-client gap table (cookie-only credential, no APNs, BYOK-in-body,
  HealthKit-direct opportunity, no versioning, no offline).

## Task 11 — Client state, optimistic updates, offline behavior, and synchronization

- **Status:** Not started
- **Deliverable:** `11-client-state-and-sync.md` — context/store architecture, caching,
  optimistic update patterns, error/rollback handling, offline capability (service worker
  scope), refetch strategy.
- **Completion criteria:** `src/store/*` (HabitContext, AuthContext, RoutineContext,
  DashboardPrefsContext, GoalCompletionContext), `src/context/TaskContext.tsx`,
  `src/lib/persistenceClient.ts`, `goalDataCache.ts`, and `public/sw.js` read and
  documented; each state domain's sync behavior classified.
- **Dependencies:** Tasks 2, 10.
- **Output document:** `11-client-state-and-sync.md`
- **Notes (from Task 1):** No react-query/SWR/Redux — hand-rolled React Context + fetch
  client. `.claude/CLAUDE.md` says contexts live in `src/context/` but most live in
  `src/store/` (only `TaskContext` is in `src/context/`).

## Task 12 — Test coverage, dead code, contradictions, and suspected defects

- **Status:** Not started
- **Deliverable:** `12-quality-and-contradictions.md` — test inventory (117 test files
  counted in Task 1), coverage gaps by domain, legacy/dead code list, documented-vs-actual
  contradictions, suspected bugs (recorded, not fixed).
- **Completion criteria:** Test distribution mapped to domains; every contradiction found in
  Tasks 1–11 consolidated with evidence; `docs/system-model/HABITFLOW_BUG_ANALYSIS.md` and
  `tasks/lessons.md` reconciled against current code.
- **Dependencies:** Tasks 1–11.
- **Output document:** `12-quality-and-contradictions.md`
- **Notes (from Task 1):** Known legacy candidates: `wellbeingLogs` (see Task 4 note),
  `archive/old-scripts/` migration scripts, `docs/archive/**`, `DebugEntriesPage`,
  dev-only routes (`/api/dev/*`, `/api/debug/*`).
- **Notes (from Task 2):** Suspected bug — `buildUrlForRoute` never clears `trackId`
  (`src/App.tsx:130-132`) while `selectedTrackId` hydrates from the URL (`App.tsx:199-202`)
  and outranks `view` in render order (`App.tsx:604`): after visiting a track detail page,
  a reload on any other tab re-opens the track detail. Code-path evidence only, not yet
  reproduced at runtime. Also confirmed: `?view=debug-entries` has no production gate
  (`App.tsx:693`), matching UI-architecture doc known-issue #13. Legacy route aliases
  kept alive: `progress`, `streak-dashboard`, `streaks`, `daily`, `day`, `wins`
  (`App.tsx:82-102`).
- **Notes (from Task 3):** Suspected-bug list (11 items) and dead/legacy list (9 items)
  consolidated in `03-feature-inventory.md` §4-5 — carry all of them into this task's
  final contradiction register. Headliners: step-image blob-URL stub, journal
  same-day duplicates, latent `timesPerWeek` 400, incomplete delete-all-data, ungated
  integrity report, `predefinedHabits.ts` orphan, freeze write path dead, server momentum
  never read, non-negotiable zombie fields.

## Task 13 — Cross-reference matrix and iOS-planning handoff

- **Status:** Not started
- **Deliverable:** `13-ios-handoff.md` — matrix of feature × screen × API × data model ×
  status; open questions; prioritized risk list; explicit inputs for the iOS build plan
  (including deltas required: APNs, auth, key storage, HealthKit-native opportunity).
- **Completion criteria:** Every feature from Task 3 appears in the matrix with links to the
  documents that describe it; all unresolved questions from Tasks 1–12 carried forward or
  closed; consistent with `docs/reference/V2 (Current - iOS focus)/` and
  `docs/reference/iOS release V1/` product intent (differences flagged, not adopted).
- **Dependencies:** Tasks 1–12.
- **Output document:** `13-ios-handoff.md`
- **Notes:** —

## Task 14 — Final independent verification

- **Status:** Not started
- **Deliverable:** Verification report appended to `13-ios-handoff.md` (or standalone
  `14-verification.md`) — an independent pass (fresh eyes / subagents) sampling claims from
  each discovery document against the repository.
- **Completion criteria:** A random-but-representative sample of claims per document is
  re-verified; all failures corrected in place; DECISIONS.md updated with any overturned
  interpretations.
- **Dependencies:** Task 13.
- **Output document:** `14-verification.md`
- **Notes:** —
