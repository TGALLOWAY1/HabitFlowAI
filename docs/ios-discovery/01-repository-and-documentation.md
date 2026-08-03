# Task 1 — Repository and Documentation Orientation

**Date:** 2026-08-03 · **Status:** Complete
**Scope:** Orientation only. Feature-level verification belongs to Tasks 2–12; discoveries
made here that belong to later tasks are recorded in `TASKS.md` Notes, not expanded below.

---

## 1. Architecture overview

HabitFlowAI is a **single-package full-stack TypeScript web app** (ESM, `"type": "module"`)
— one `package.json`, no workspaces — containing:

- **Frontend:** React 19 + Vite 7 SPA (`src/` root, entry `src/main.tsx`), Tailwind CSS 3,
  hand-rolled query-string routing in `src/App.tsx` (`?view=tracker|dashboard|routines|goals|
  wins|journal|tasks|day|debug-entries|wellbeing-history|analytics|health|tour|roadmap`),
  React Context for state (no Redux/react-query), fetch-based API client
  (`src/lib/persistenceClient.ts`).
- **Backend:** Express 5 app factory (`src/server/app.ts`, 151 route registrations) in the
  same repo, layered as routes → services → repositories over the **native MongoDB driver
  v7 (no ODM)**.
- **Shared layers:** `src/domain/` (habit completion/schedule math, DayKey utilities) and
  `src/shared/` (personas, invariants, tracking contracts) are imported by both sides.

The core domain invariant (asserted in `.claude/CLAUDE.md`, `docs/ARCHITECTURE.md`, and
CI-enforced by `src/server/routes/__tests__/entriesOnly.invariants.test.ts` and
`src/server/__tests__/noDayLogImports.test.ts`): **`habitEntries` is the single source of
truth**; day views, progress, streaks, and goal progress are derived at read time, never
stored. Soft-delete via `deletedAt` throughout.

Note: `.claude/CLAUDE.md` calls this a "monorepo"; structurally it is a single npm package
with co-located frontend and backend (`package.json` has no `workspaces` field).

## 2. Repository map

| Path | Role |
|---|---|
| `src/App.tsx`, `src/main.tsx` | Frontend entry + router |
| `src/pages/` | Lazy-loaded pages (goals ×6, insights tabs ×7, Journal, Tasks, Analytics, AppleHealth, WellbeingHistory, Tour, Roadmap, auth pages, DebugEntries) |
| `src/components/` | ~60 root components (grids, modals, editors) + subdirs: `day-view/`, `dashboard/`, `goals/`, `insights/`, `wellbeing/`, `tasks/`, `Journal/`, `analytics/` |
| `src/store/` | `AuthContext`, `HabitContext`, `RoutineContext`, `DashboardPrefsContext`, `GoalCompletionContext` |
| `src/context/` | `TaskContext` only (CLAUDE.md's claim that contexts live here is mostly stale) |
| `src/lib/` | API clients (`persistenceClient`, `analyticsClient`, `insightsClient`, `aiReportsClient`, `geminiClient`, `pushClient`), caches, hooks |
| `src/domain/` | Shared domain logic: `habits/` (completion, schedule, weeklyProgress), `time/dayKey` |
| `src/shared/` | Personas, invariants, `habitTracking`, `checklistSuccessRule`, AI report contracts, demo config |
| `src/server/routes/` | 38 route files |
| `src/server/services/` | 18 services (scheduleEngine, streakService, freezeService, momentumService, dayViewService, analyticsService, insightsService, correlationEngine, reminderScheduler, health* services, …) |
| `src/server/repositories/` | 29 repositories ≈ collection inventory |
| `src/server/middleware/` | identity, session, publicDemo, rate limiting, requireAdmin, requireHealthFeature |
| `src/server/lib/` | mongoClient, authCrypto, sessionCookie, gemini, webPush, email (Resend), cache |
| `src/server/migrations/` | Startup migrations (routine variants, weekly frequency, goal dedupe) |
| `src/server/demo/` | Public-demo seeding (`seedShowcase.ts`) |
| `src/data/` | `journalTemplates.ts`, `predefinedHabits.ts` |
| `src/test/` | mongodb-memory-server harness |
| `docs/` | Extensive docs (see §7) |
| `scripts/` | verify.sh, invariant checks, seeders, debug tools |
| `archive/old-scripts/` | Completed one-off migration scripts (legacy) |
| `public/` | PWA manifest, `sw.js` service worker, icons, `uploads/routine-images/` |

## 3. Application entry points

- **Frontend:** `src/main.tsx` → `src/App.tsx`. Registers `/sw.js` in production builds and
  re-syncs the push subscription (`src/main.tsx:17-26`). Demo boot params (`?demo=1`)
  applied before render.
- **Backend:** `src/server/index.ts` → `createApp()` in `src/server/app.ts`.
- **Unauthenticated UI:** `src/components/AuthGate.tsx` renders login / invite-redeem /
  forgot-password views and handles the one true path route, `/reset-password`
  (`AuthGate.tsx:26`). Everything else is `?view=` query routing.

## 4. Technology stack (verified in `package.json`)

- TypeScript ~5.9 strict (`noUnusedLocals`/`noUnusedParameters` in `tsconfig.app.json:20-22`)
- React 19.2, Vite 7, Tailwind 3.4, lucide-react icons, Recharts 3.5 (charts), @dnd-kit
  (drag-and-drop), date-fns 4
- Express 5.2, helmet, cookie-parser, express-rate-limit, multer (routine image upload)
- MongoDB driver 7 (native; **no mongoose**), mongodb-memory-server 11 for tests
- bcrypt (passwords), uuid, web-push (VAPID), resend (email)
- Vitest 4 + Testing Library + Supertest + JSDOM; ESLint 9 flat config
- **No** react-router, react-query/SWR, Redux, zod/yup (validation is hand-rolled — see
  `src/server/domain/canonicalValidators.ts`, route-level checks), and no form library.

## 5. Backend, database, and authentication boundaries

- **API surface:** all routes under `/api/*`, registered flat in `src/server/app.ts`.
  Domains: categories, habits (+archive/convert/unlink), entries (`/api/entries*`, rate
  limited), bundle-memberships, routines (+image upload, submit, logs), goals (+progress,
  detail, milestones), goal-tracks, tasks, journal, dashboardPrefs, wellbeingLogs *and*
  wellbeingEntries, medications/symptoms/supplements (+logs), daySummary, dayView,
  progress/overview, analytics (9 endpoints), insights (5), AI (`/api/ai/*`, 8), push
  (`/api/push/*`), health (Apple Health, feature-gated), evidence, admin
  (integrity/dedup/recover/invites), auth, user-data delete, household users.
- **Identity:** every request carries `X-Household-Id` + `X-User-Id`
  (`src/server/middleware/identity.ts`); dev/test bootstrap defaults, production 401.
  Session cookie middleware (`middleware/session.ts`, `lib/sessionCookie.ts`) resolves
  identity for browser clients; CORS allowlists the custom headers (`app.ts:124`).
- **Auth:** invite-based registration (`/api/auth/invite/redeem`), login/logout, bootstrap
  admin (shared secret), forgot/reset password (Resend email, console fallback in dev).
  bcrypt via `lib/authCrypto.ts`. Admin-only surface behind `requireAdmin`.
- **Public demo:** `PUBLIC_DEMO_ENABLED` seeds a showcase dataset; `X-Demo-Mode` maps to a
  fixed read-only identity (`middleware/publicDemo.ts`, `docs/DEMO_ARCHITECTURE.md`).
- **Database:** MongoDB (Atlas in prod per `render.yaml` env); ~29 collections inferred
  from `src/server/repositories/`. Startup migrations in `src/server/migrations/startup.ts`.
- **AI:** Gemini (`gemini-3.5-flash` per `CHANGELOG.md` Unreleased) — **BYOK**: the key is
  entered in Settings and stored in browser localStorage, not server env
  (`.env.example` final note). Server routes (`/api/ai/*`) do the calls via
  `src/server/lib/gemini.ts`; reports archived in `aiReports` collection.
- **Push reminders:** Web Push + VAPID, in-process 60 s scheduler
  (`services/reminderScheduler.ts`); `render.yaml` ships `PUSH_REMINDERS_ENABLED: "false"`.

## 6. Test and deployment setup

- **Tests:** 117 `*.test.ts(x)` files (counted 2026-08-03); heaviest concentration in
  `src/server/routes/__tests__` (48) and services (13+). mongodb-memory-server by default;
  live-DB tests only with `ALLOW_LIVE_DB_TESTS=true` + `_test` DB name
  (`src/test/assertTestDb.ts`).
- **CI:** `.github/workflows/ci-beta.yml` on push/PR to main: `npm ci` (Node 20) →
  `npm run build` (tsc -b + vite build) → `npm run test:beta` (9 critical files) →
  `npm run lint:beta` (server/shared/domain scope). Full test suite is **not** run in CI.
- **Deployment:** Backend on Render (`render.yaml`, health check `/api/health`); frontend
  on Vercel with `/api/:path*` rewritten to `https://habitflowai.onrender.com`
  (`vercel.json`). Dev: Vite on 5176 proxies `/api` + `/uploads` to Express on 3001.

## 7. Documentation inventory and trust assessment

Trust = how safely later tasks can lean on the doc before re-verification.
(High ≠ skip verification; it means spot-check. Low = treat as hypothesis only.)

| Source | Trust | Rationale (evidence checked) |
|---|---|---|
| `docs/DOC_INDEX.md` | High | Accurately indexes files that all exist (verified by directory listing); defines doc-ownership rules that the repo largely follows. |
| `docs/FEATURES.md` (2026-08-03) | High | Freshest doc in repo; spot-checks pass (bundle routes exist `app.ts:279-284`; push reminders match `render.yaml` + `reminderScheduler.ts`; Apple Health marked Beta matches `requireHealthFeature` gating). Full verification is Task 3. |
| `docs/product/HABITFLOW_UI_ARCHITECTURE.md` (2026-08-02) | High | Fresh; declares "code wins on disagreement"; structure matches `App.tsx` routes and component tree at spot-check level. Task 2 verifies fully. |
| `FEATURE_AUDIT.md` (2026-07-01, root) | Medium-High | Explicitly code-verified at audit date, but a month of commits since (e.g. routine push reminders landed after it). |
| `docs/API.md` (2026-07-16, 175 lines) | Medium | Too short to cover 151 registered API paths; `app.ts` is the real inventory. Use as narrative only (Task 10 verifies). |
| `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DOMAIN_CANON.md` | Medium | Core invariants match code (entries-only truth is test-enforced), but wellbeing story contradicts live code (see §9) and medications/symptoms/supplements are under-documented. |
| `.claude/CLAUDE.md` (2026-05-01) | Medium | Commands/architecture accurate; stale details: contexts live in `src/store/` not `src/context/`; "monorepo" is loose; wellbeingLogs "replaced" claim contradicted by live routes. |
| `docs/system-model/*` (2026-04-04 era) | Medium | Deliberate, exhaustive snapshot (entity model, 30 system rules, bug analysis) but 4 months old; `HABITFLOW_BUG_ANALYSIS.md` items may be fixed (cf. `tasks/lessons.md` fixes dated 2026-04-10). |
| `docs/audits/*` (dated 2026-03..08) | Medium | Point-in-time; the 2026-08-01/02 habit-tracking audits are recent and likely valuable for Tasks 5–6. |
| `docs/decision-log/*` | Medium | Rationale records (bundle/checklist temporal membership) — good intent evidence, verify against code in Task 7. |
| `ROADMAP.md`, `docs/V1_PRODUCT_DIRECTION.md` | High *as intent* | Future work only — by definition not implementation evidence. |
| `docs/reference/V2 (Current - iOS focus)/`, `docs/reference/iOS release V1/` | Low *as implementation evidence* | Aspirational iOS-era product specs; valuable for Task 13 intent-mapping, must never be cited as "implemented". |
| `docs/reference/V0/`, `docs/reference/V1/`, `docs/archive/**` | Low | Historical PRDs/audits, explicitly archived; superseded (e.g. dayLogs removal). |
| `tasks/todo.md`, `tasks/lessons.md` | High *as history* | Recent, concrete, referenced fixes match commits (e.g. routine push reminders todo ↔ commits `a7775f6..95cc0f3`). |
| `CHANGELOG.md` | Medium-High | Milestone-level; "Unreleased" section documents current Gemini 3.5 Flash + AI report history, consistent with `src/server/lib/gemini.ts` existing. |

**Agent instruction files affecting repo work:** `.claude/CLAUDE.md` (project rules: docs
sync requirements, commit cadence, pre-push `npm run build`), `.claude/launch.json`
(dev launch config), `tasks/lessons.md` (correction patterns). No `.cursorrules`,
`AGENTS.md`, or PR template found (`.github/` contains only `workflows/`).

## 8. Screenshot inventory

**None.** Verified 2026-08-03 by filesystem search: no `*screenshot*` paths; the only
raster images are `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and two
user-uploaded images in `public/uploads/routine-images/`; no Markdown file embeds an image
(`grep '!['` over `docs/` — zero hits). Recorded in `DECISIONS.md`. Consequence: Task 2's
visual inventory must come from code + `HABITFLOW_UI_ARCHITECTURE.md`, or the user can
supply screenshots out-of-band.

## 9. Initial risks, contradictions, and unknowns

1. **Wellbeing dual-path contradiction (highest-confidence contradiction found).** Docs say
   `wellbeingEntries` replaced `wellbeingLogs`; code registers both APIs
   (`app.ts:190-197`) and the frontend still *writes* via POST `/wellbeingLogs`
   (`persistenceClient.ts:865-867`) while *reading* from `wellbeingEntries`
   (comment `persistenceClient.ts:328`). Topology unresolved → Task 4.
2. **Docs lag code by feature-sized gaps.** `docs/API.md` (175 lines) cannot describe ~140
   endpoints; medications/symptoms/supplements have full CRUD but thin docs. Endpoint truth
   must be derived from `app.ts` → Task 10.
3. **Push reminders' production status unclear.** Full pipeline exists but `render.yaml`
   sets `PUSH_REMINDERS_ENABLED: "false"`, and the in-process scheduler needs an always-on
   instance. Live-or-not is unknown from the repo → Task 9. (iOS would need APNs
   regardless.)
4. **Apple Health is Beta and inverted for iOS.** Web app ingests Apple Health data via an
   email-allowlisted, feature-gated API fed by an **external sync bridge** (not in this
   repo). A native app could read HealthKit directly — big architectural delta → Tasks 9/13.
5. **BYOK Gemini key in localStorage.** iOS needs a Keychain-equivalent strategy; also
   confirms there is no server-held AI credential → Task 10/13.
6. **Auth for native clients unknown.** Session cookies + custom identity headers + CORS
   are browser-shaped; whether the API supports header-only (cookie-less) auth cleanly is
   unverified → Tasks 9/10.
7. **Query-string routing** (`?view=`) means no stable deep-link scheme to mirror in iOS;
   `ROADMAP.md` plans path-based URLs but it is unshipped.
8. **Demo/tour and admin surfaces** may or may not belong in an iOS v1 — scope question
   for Task 13, not a technical unknown.
9. **CI runs only a 9-file beta suite** — green CI is weaker evidence than it appears;
   full-suite health unknown until run → Task 12.
10. **Legacy candidates to confirm dead:** `archive/old-scripts/`, `DebugEntriesPage`,
    dev-only routes (`/api/dev/*`, `/api/debug/*`), `wellbeingLogs` (per #1) → Task 12.

## 10. Most important files to inspect next (Task 2)

1. `src/App.tsx` in full — `AppRoute` union, view switch (lines ~386-715), URL sync,
   modal orchestration.
2. `src/components/AuthGate.tsx` — auth view state machine.
3. `src/components/Layout.tsx` + `BottomTabBar.tsx` — chrome and primary nav.
4. `docs/product/HABITFLOW_UI_ARCHITECTURE.md` in full (584 lines) — then diff against code.
5. `src/pages/` all files — page-level inventory.
6. Modal components in `src/components/` root (AddHabitModal, RoutineEditorModal,
   RoutineRunnerModal, SettingsModal, InfoModal, HabitHistoryModal, HabitLogModal, …).
7. `src/components/day-view/DayView.tsx` + `ScheduleView.tsx` — the two calendar-style views.
8. `src/store/HabitContext.tsx` — what state feeds the screens (preview for Task 11).
