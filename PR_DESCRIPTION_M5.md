# M5: Household identity + scoping (V1 pragmatic)

Branch: `223-milestone-m5-shared-household-auth-v1-pragmatic`

## Summary

This branch introduces **household-scoped identity** and **user scoping** across the data layer and client so multiple users can share a household without cross-user data leakage. It does **not** add passwords or auth providers—identity is passed via headers (`X-Household-Id`, `X-User-Id`). All changes are backward-compatible with a single-household default and include migrations, tests, and safety guards.

---

## 1. Identity middleware and auth contract

- **`src/server/middleware/identity.ts`**
  - **Single source of truth:** Sets `req.householdId` and `req.userId` from headers `X-Household-Id` and `X-User-Id`.
  - **Production:** Missing either header → **401**; no default or anonymous identity.
  - **Dev/test only:** When `NODE_ENV !== 'production'`, missing headers use **bootstrap identity** (`default-household`, `default-user`). This branch is unreachable in production.
  - **`getRequestIdentity(req)`:** Returns `{ householdId, userId }`; throws if identity was not set (used by all route handlers).

- **`GET /api/auth/me`**
  - Returns `{ householdId, userId }` for the current request (echoes identity set by middleware). Used by clients to confirm identity.

- **Legacy `auth.ts` (userIdMiddleware)**
  - **Deprecated.** Not mounted in the app. Documented as deprecated; in production it would not default to `anonymous-user`. Use `identityMiddleware` only.

---

## 2. Data layer: householdId + scoping

- **`src/server/lib/scoping.ts`**
  - **`scopeFilter(householdId, userId, extra?)`:** Builds MongoDB filter `{ householdId, userId, ...extra }`.
  - **`requireScope(householdId, userId)`:** Validates non-empty IDs; in non-production throws if missing (defensive).

- **Repositories updated** (habits, categories, goals, habitEntries, routines, habitPotentialEvidence):
  - All documents **include `householdId`** on write.
  - All **reads/updates/deletes** filter by `householdId` and `userId` via `scopeFilter` / `requireScope`.
  - Scoping is centralized in repository helpers; routes pass `(householdId, userId)` from `getRequestIdentity(req)`.
  - Returned entities strip `householdId`/`userId` where appropriate so API response shapes stay unchanged.

- **Unique index (habitEntries)**
  - Changed from `(userId, habitId, dayKey)` to **`(householdId, userId, habitId, dayKey)`** in `src/server/lib/mongoClient.ts` so upserts and uniqueness are household-scoped.

- **Routes and services**
  - All relevant routes (categories, habits, goals, habitEntries, routines, evidence, dashboard, progress, daySummary, dayView, skillTree, dashboardPrefs, migration backfill) use `getRequestIdentity(req)` and pass `householdId` and `userId` into repositories and services.
  - **goalProgressUtilsV2**, **dayViewService**, **skillTreeService**, **truthQuery**, **recomputeUtils**, **freezeService**, **migrationUtils** accept and pass through `householdId` (and `userId` where applicable).

- **dayLogRepository / goalManualLogRepository**
  - Left unchanged (out of scope for this milestone).

---

## 3. Migration: backfill householdId

- **`scripts/migrations/backfillHouseholdId.ts`**
  - **Default: `--dry-run`.** Use `--apply` plus `--i-understand-this-will-modify-data` to write.
  - For collections: habits, categories, goals, habitEntries, routines, habitPotentialEvidence — if a document is missing `householdId`, sets it to **`default-household`**.
  - Writes a report to **`docs/migrations/backfill-householdId-<timestamp>.json`** with counts per collection.

- **Dedupe and related scripts**
  - **dedupeHabitEntries.ts:** Groups by `(householdId, userId, habitId, dayKey)`; never dedupes across households. Report and sample keys include `householdId`.
  - **verifyNoDuplicateHabitEntries.ts:** Uniqueness check uses `(householdId, userId, habitId, dayKey)`.
  - **backfillDayKey.ts:** Report sample includes `householdId` for auditing.

---

## 4. Client: identity selection and headers

- **Local storage**
  - **`habitflow_household_id`** — default `default-household`.
  - **`habitflow_user_id`** — on first visit a new **UUID** is generated (no shared hardcoded user).
  - **`habitflow_known_user_ids`** — list of userIds for the “Switch user” UI (max 10).

- **`src/lib/persistenceClient.ts`**
  - **`getIdentityHeaders()`** returns `{ 'X-Household-Id': …, 'X-User-Id': … }`.
  - **Every API request** (including `apiRequest`, `uploadRoutineImage`, `uploadGoalBadge`) sends both headers.
  - **`getActiveHouseholdId()` / `setActiveHouseholdId()`**, **`getKnownUserIds()` / `addKnownUserId()`** for UI and registry.
  - **Journal API** (`src/api/journal.ts`) also uses `getIdentityHeaders()`.

- **Settings modal**
  - **Settings** (gear) opens a modal with:
    - **Identity:** Household ID (editable), current user, **Switch user** (list from household registry API + local known IDs), custom ID input, **Create new user** (calls household registry API or falls back to client UUID).
  - “Create new user” uses **POST /api/household/users** when available so new users are registered and avoid UUID drift.

- **DevIdentityPanel**
  - Shows household ID and uses `getKnownUserIds()` for the switch list (no hardcoded user list).

---

## 5. Household user registry

- **Collection:** `householdUsers` — fields: `householdId`, `userId`, `displayName?`, `createdAt`.
- **GET /api/household/users** — list users for the current household (scoped by identity middleware).
- **POST /api/household/users** — create user in household; body optional `displayName`, `userId` (generated if omitted).
- **Repository:** `householdUserRepository.ts`; **routes:** `householdUsers.ts` mounted at `/api/household`.
- **Client:** `fetchHouseholdUsers()`, `createHouseholdUser()`; Settings “Switch user” and “Create new user” use the registry when available.

---

## 6. Safety: no anonymous fallback + test guards

- **No anonymous-user in production paths**
  - All route handlers that previously used `(req as any).userId || 'anonymous-user'` now use **`getRequestIdentity(req)`** (dashboardPrefs, admin, wellbeingLogs, tasks, dayLogs, journal, wellbeingEntries, devDemoEmotionalWellbeing). Missing identity causes a throw (or 401 before the route).
  - **Client:** `useWellbeingEntriesRange` uses `getActiveUserId()` instead of `'anonymous-user'` for optimistic entries.

- **Dev bootstrap**
  - Identity middleware comment clarifies that the bootstrap branch is **DEV/TEST ONLY** and cannot run in production.

- **DB test guard (existing, documented)**
  - When `NODE_ENV === 'test'` (or VITEST / JEST_WORKER_ID), **mongoClient** refuses to connect if the DB name does not contain `_test` or `test_`.
  - **mongoTestHelper** uses in-memory MongoDB by default; real Atlas only when **`ALLOW_LIVE_DB_TESTS=true`** and DB name contains `_test`/`test_`.

- **`docs/debug/identity_safety.md`**
  - Rules for identity (single source of truth, no anonymous fallback, legacy auth deprecated).
  - DB/test guards and how to run tests safely (in-memory vs live test DB).

- **Tests**
  - **identity.test.ts:** Explicit test that **production requires identity headers (401 when headers missing)**.
  - **persistenceClient.identityHeaders.test.ts:** Asserts both **X-Household-Id** and **X-User-Id** are sent on requests.

---

## 7. Commits on this branch

| Commit     | Description |
|-----------|-------------|
| `674f6e8` | docs(identity): map identity + scoping for M5 |
| `cf54889` | feat(identity): add householdId/userId request identity middleware + /api/auth/me |
| `2cea5a2` | refactor(data): add householdId field + enforce household/user scoping in repositories |
| `d650ad6` | tools(migration): backfill householdId for existing documents |
| `725b7b9` | feat(identity): client-side active user/household selection; remove KNOWN_USER_ID hardcode |
| `dac5f08` | feat(household): add household user registry + list/create endpoints |
| `700ab6c` | test(safety): enforce identity + db guards to prevent prod contamination |

---

## Verification

- **Identity middleware:** `npx vitest run src/server/middleware/`
- **Household registry:** `npx vitest run src/server/routes/__tests__/householdUsers.test.ts`
- **Entries-only invariants + evidence scoping:** `npx vitest run src/server/routes/__tests__/entriesOnly.invariants.test.ts src/server/routes/__tests__/evidence.userScoping.test.ts`
- **Backfill (dry-run):** `npx tsx scripts/migrations/backfillHouseholdId.ts --dry-run`

---

## Deployment notes

- **Production:** Set `NODE_ENV=production`. Clients **must** send `X-Household-Id` and `X-User-Id` on every request (e.g. from persistenceClient using stored household/user).
- **Existing data:** Run the householdId backfill migration (with `--apply` and confirmation) so existing documents have `householdId` before or after deploy. The unique index on habitEntries now includes `householdId`; ensure migration/backfill is run if you had the old index.
- **Atlas:** Do not run integration tests against production DB; use in-memory or a dedicated test DB with `_test` in the name and `ALLOW_LIVE_DB_TESTS=true` when needed.
