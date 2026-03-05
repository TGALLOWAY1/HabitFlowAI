# Branch changes: `ux/cleanup-pages-and-habits-gestures`

This document summarizes **all changes implemented on this branch** relative to `main`, and calls out **follow-up actions** required before or after merge.

---

## 1. Branch overview

| Item | Detail |
|------|--------|
| **Branch name** | `ux/cleanup-pages-and-habits-gestures` |
| **Base** | Built on top of merged M1–M5 work (canonical truth, dayKey, identity, routines, mobile/PWA). |
| **Scope** | UX cleanup (goals, habits, categories, personas removal), legacy removal (M6), production hardening (rate limits, helmet, request logging, Mongo safety), and documentation. |

The branch incorporates multiple milestones and cleanup passes. Below they are grouped by **theme** rather than strict commit order.

---

## 2. Data model & canonical truth (M1 / M2)

### 2.1 DayKey and timezone

- **Canonical day identifier:** `dayKey` = `YYYY-MM-DD` in a fixed timezone. Server uses client timezone when valid; otherwise **America/New_York** (no UTC fallback for day boundaries).
- **Files:** `src/server/utils/dayKey.ts`, `src/server/utils/dayKeyNormalization.ts`, `src/server/domain/canonicalValidators.ts`.
- **Writes:** All habit entry and date-range reads use server-side dayKey; client can send `timezone` (e.g. `America/Los_Angeles`).
- **Migration:** `scripts/migrations/backfillDayKey.ts` (dry-run by default; `--apply` + `--i-understand-this-will-modify-data` to write). Report: `docs/migrations/backfill-dayKey-<timestamp>.json`.

### 2.2 Entries-only truth

- **Single source of truth:** Habit completion is **only** in the `habitEntries` collection. Day view, day summary, streaks, and goal progress are **derived at read time** from entries.
- **Unique index:** `(householdId, userId, habitId, dayKey)` in `src/server/lib/mongoClient.ts`. Index creation failures are **non-fatal** (warn and continue so production does not crash).
- **Dedupe / verification:** `scripts/migrations/dedupeHabitEntries.ts`, `scripts/migrations/verifyNoDuplicateHabitEntries.ts`; reports under `docs/migrations/`.
- **Atomic upsert:** Habit entry writes use atomic upsert; no stored completion fields from client (server forbids and derives).

### 2.3 Removed / deprecated

- **DayLogs:** Routes, repository, and legacy merge removed. No `/api/dayLogs`; frontend uses `/api/daySummary` only.
- **Manual goal logs:** Routes and `goalManualLogRepository` removed. Goal progress is entries-derived only.
- **LEGACY_DAYLOG_READS:** Flag and legacy merge code removed.

---

## 3. Identity & household scoping (M5)

### 3.1 Server

- **Middleware:** `src/server/middleware/identity.ts` sets `req.householdId` and `req.userId` from headers `X-Household-Id` and `X-User-Id`.
  - **Production:** Missing either header → **401**.
  - **Dev/test:** Bootstrap identity (`default-household`, `default-user`) when headers missing.
- **Auth:** `src/server/routes/auth.ts` — invite redeem, login, logout, bootstrap-admin; session cookies; `GET /api/auth/me` returns `{ householdId, userId }`.
- **Scoping:** `src/server/lib/scoping.ts`; all repositories (habits, categories, goals, habitEntries, routines, evidence, etc.) filter by `householdId` and `userId`.
- **Household users:** `src/server/routes/householdUsers.ts` — list/create users in household; admin invite create/list/revoke.

### 3.2 Client

- **Headers:** Every API request sends `X-Household-Id` and `X-User-Id` via `src/lib/persistenceClient.ts` (`getIdentityHeaders()`).
- **Storage:** `habitflow_household_id`, `habitflow_user_id`, `habitflow_known_user_ids` (localStorage).
- **Settings modal:** Identity section — household ID, switch user, create new user (household registry API or client UUID fallback).

### 3.3 Migration

- **Backfill householdId:** `scripts/migrations/backfillHouseholdId.ts` (default dry-run; `--apply` + `--i-understand-this-will-modify-data`). Sets missing `householdId` to `default-household` on habits, categories, goals, habitEntries, routines, habitPotentialEvidence. Report: `docs/migrations/backfill-householdId-<timestamp>.json`.

---

## 4. Routine execution & batch entries (M3)

- **Per-step state:** `RoutineContext` tracks `stepStates` (done/skipped/neutral); no habit logging until user confirms.
- **Completed Habits modal:** After "Complete Routine", user selects which habits to log; "Log selected habits" calls batch API.
- **POST /api/entries/batch:** Body `{ timezone?, dayKey?, entries: [{ habitId, source?, routineId? }] }`; atomic upsert per entry; uses canonical dayKey.
- **Guardrail:** Routine completion alone does **not** create HabitEntries; only explicit confirmation does. Test: `routines.completion-guardrail.test.ts`.

---

## 5. Mobile / PWA & API consistency (M4)

- **Touch:** Double-click delete removed; clear entry via kebab menu. Category edit via explicit "Edit" control. Pointer-safe events; duplicate-event guard retained.
- **Modals:** `.modal-scroll` / `.modal-overlay` for scroll and Safari; tap targets and layout improvements.
- **API client:** All evidence, tasks, goals (badge upload), routines (image delete) go through `persistenceClient` with identity headers.
- **Payload alignment:** Habit entry mutation payloads aligned with server schema; no client-only completion fields.

---

## 6. Legacy removal & UX cleanup (M6 and later)

### 6.1 Removed code

- **DayLogs:** Routes, `dayLogRepository`, DayLog writes in `recomputeUtils`, `migrationUtils` backfill, `fetchDayLogs` client helper.
- **Manual goal logs:** Routes, `goalManualLogRepository`, `GoalManualProgressModal`, manual progress UI.
- **Personas / mode:** Persona switcher, Emotional Wellbeing dashboard, Fitness persona (ActionCards, FitnessDashboard, QuickLog, etc.) removed from Dashboard and codebase.
- **Streaks page:** Standalone Streaks page and route removed.
- **Goals page:** Progress tab and Skill Tree removed; Overview | Win Archive | Create Goal only. "Goals at a glance" fix when goals exist.
- **Unused client:** `freezeHabit`, `fetchDayLogs`; unused V1 goal progress modules.

### 6.2 UX and validation

- **Habits:** Double-click (desktop) / long-press (mobile) open actions menu; habit row icons no longer overlap (stable layout, truncating title).
- **Categories:** Duplicate category names prevented (warn + block).
- **Goals:** "Goals at a glance" fixed when goals exist; TypeScript/lint cleanup.
- **Import:** "Import default habits" button removed from UI.
- **Timezone:** Invalid timezone error handling (e.g. day view) fixed.

### 6.3 Dev / debug

- **Dev-only routes:** `/api/debug/*` and `/api/dev/*` are **only registered when `NODE_ENV !== 'production'`**. In production they are not mounted (404). No code change required for gating; documented in `app.ts` and `docs/ARCHITECTURE.md`.

---

## 7. Production hardening (security)

### 7.1 Rate limiting

- **Auth:** `authRateLimiter` — 10 requests per 15 minutes per IP on:
  - `POST /api/auth/invite/redeem`
  - `POST /api/auth/login`
  - `POST /api/auth/bootstrap-admin`
- **Invite management:** `adminInviteRateLimiter` — 20 per 15 minutes per IP on:
  - `POST /api/admin/invites`
  - `GET /api/admin/invites`
  - `POST /api/admin/invites/:id/revoke`
- **Entry writes:** `entriesWriteRateLimiter` — 100 per 15 minutes per IP on:
  - `POST /api/entries/batch`, `POST /api/entries`, `PUT /api/entries`
  - `DELETE /api/entries/key`, `DELETE /api/entries`, `DELETE /api/entries/:id`
  - `PATCH /api/entries/:id`

Defined in `src/server/middleware/rateLimitAuth.ts`; applied in `src/server/app.ts`.

### 7.2 Helmet

- **Helmet** is used with `contentSecurityPolicy: false` (API-only; no HTML so CSP not needed). Applied after `trust proxy`, before `express.json()`.

### 7.3 Request logging

- **Request context:** `src/server/middleware/requestContext.ts` — per-request `requestId` (UUID) in AsyncLocalStorage; `getRequestId()` / `getRequestContext()`.
- **Request logging middleware:** `src/server/middleware/requestLogging.ts` — on response finish, logs timestamp, requestId, method, path, status. **Does not log request body or secrets** (e.g. auth bodies are never logged). In production, 2xx requests are logged; 4xx/5xx always.

### 7.4 Mongo

- **Index/connection warnings** are intentional and **non-fatal**. `ensureHabitEntriesUniqueIndex` catches index creation errors, logs with `console.warn`, and does not rethrow so production never crashes. Comment added in `mongoClient.ts`.

---

## 8. Documentation and tooling

- **Architecture:** `docs/ARCHITECTURE.md` — behavioral truth (entries-only), identity model, dayKey policy, dev-only routes.
- **Audits:** `docs/audits/` — M2 (dayKey, writepaths), M3 (routines), M4 (mobile friction), M5 (identity), M6 (legacy removal, verification).
- **Migrations:** `docs/migrations/README.md` — how to run backfill/dedupe/verify scripts; report locations.
- **Deploy:** `docs/deploy/release_checklist.md` (beta gate: build, test:beta, lint:beta), `docs/deploy/runbook_private_beta.md` (env, smoke tests).
- **CI:** `.github/workflows/ci-beta.yml` — build, `npm run test:beta`, `npm run lint:beta` on push/PR to main.
- **Verification:** `scripts/verify.sh`, `scripts/migrations/verifyNoDuplicateHabitEntries.ts`, etc.

---

## 9. Key file summary

| Area | Added / changed | Removed |
|------|------------------|--------|
| **Server app** | `app.ts`: helmet, requestContext, requestLogging, rate limiters, identity, session, auth routes, household users, entry batch, daySummary | DayLogs mounts, manual goal log mounts |
| **Middleware** | `identity.ts`, `session.ts`, `requestContext.ts`, `requestLogging.ts`, `rateLimitAuth.ts`, `requireAdmin.ts`, `noPersonaInHabitEntryRequests` | — |
| **Auth** | `auth.ts`, `authCrypto.ts`, `authValidation.ts`, `sessionCookie.ts`, invite/session/user repos | — |
| **Repos** | householdUserRepository, routineImageRepository; scoping + householdId in all relevant repos | dayLogRepository, goalManualLogRepository |
| **Routes** | auth, adminInvites, householdUsers, daySummary, habitEntries (batch); admin integrity report | dayLogs, skillTree; manual goal log routes |
| **Services** | daySummary, streakService, freezeService (scoping); truthQuery simplified | skillTreeService; goalProgressUtils (V1); legacy DayLog merge |
| **Client** | persistenceClient (identity headers, all API paths), SettingsModal, DevIdentityPanel, CategoryPickerModal, CompletedHabitsModal, RoutineRunnerModal updates | PersonaSwitcher, EmotionalWellbeingDashboard, Fitness persona, Streaks page, GoalManualProgressModal, SkillTree components |
| **Utils** | dayKey, dayKeyNormalization, goalProgressUtilsV2 (entries-derived) | goalProgressUtils (V1), migrationUtils (DayLog backfill) |

---

## 10. Follow-up actions

### 10.1 Before first production deploy

1. **Environment variables (backend)**  
   Set per `docs/deploy/runbook_private_beta.md`:
   - `NODE_ENV=production`
   - `MONGODB_URI`, `MONGODB_DB_NAME`
   - `FRONTEND_ORIGIN` (Vercel frontend URL for CORS)
   - Session/invite secrets and bootstrap key as applicable.

2. **Migrations (if existing data)**  
   - **householdId:** If DB has documents without `householdId`, run `backfillHouseholdId.ts` with `--apply` and `--i-understand-this-will-modify-data` after backing up.  
   - **dayKey:** If habit entries use legacy `date`, run `backfillDayKey.ts` (and optionally dedupe + verify).  
   - **Dedupe:** If duplicate (householdId, userId, habitId, dayKey) entries exist, run `dedupeHabitEntries.ts` per `docs/migrations/README.md`.

3. **CI**  
   Ensure **CI Beta** is green (build, `test:beta`, `lint:beta`) on the release branch.

### 10.2 After merge / deploy

1. **Smoke tests**  
   Run health, login, protected route, logout per runbook.

2. **Monitoring**  
   Confirm request logs show requestId and no secrets; rate limit responses (429) if you want to tune limits.

### 10.3 Optional cleanup (non-blocking)

- **scripts/compare-legacy-vs-canonical.ts** — Obsolete (LEGACY_DAYLOG_READS removed); remove or repurpose.
- **src/utils/legacyReadWarning.ts** — `warnLegacyDayLogRead` / `warnLegacyGoalProgressRead` redundant; `warnLegacyCompletionRead` still used by DayCategorySection — keep or simplify.
- **Duplicate PersistenceSchema** — Noted in audit; left for a dedicated refactor.
- **npm audit** — Address reported vulnerabilities when convenient (`npm audit`, `npm audit fix`).

---

## 11. References

- **PR descriptions:** `PR_DESCRIPTION_M3.md`, `PR_DESCRIPTION_M4.md`, `PR_DESCRIPTION_M5.md` (milestone scope).
- **Architecture:** `docs/ARCHITECTURE.md`, `docs/audits/m5_identity_map.md`, `docs/semantics/daykey.md`.
- **Deploy:** `docs/deploy/release_checklist.md`, `docs/deploy/runbook_private_beta.md`.
- **Migrations:** `docs/migrations/README.md`.
