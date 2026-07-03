# Security and Data Integrity Audit

## Posture Snapshot
- Current security posture is development-grade (header-based identity, permissive CORS, no hardened admin protection).
- Data integrity is mixed: some domains are strongly constrained (`wellbeingEntries`, `routineImages`), while core V1 domains (`habits`, `categories`, `goals`, `habitEntries` per-day uniqueness) still rely on application logic instead of DB guarantees.
- Canonical risk and security risk overlap at the same fault lines: duplicate truths, weak identity boundaries, and non-atomic writes.

## Findings
| ID | Severity | Area | Evidence | Risk | Surgical fix |
| --- | --- | --- | --- | --- | --- |
| SDI-01 | Critical | Auth / tenancy isolation | `src/server/middleware/auth.ts:19-34`, `:38-41` | Any caller can impersonate any user by setting `X-User-Id`; missing header silently downgrades to `anonymous-user`. | Require authenticated identity in prod (session/JWT or signed token), reject missing/invalid identity with `401`. Keep anonymous fallback dev-only. |
| SDI-02 | High | Client identity correctness | `src/lib/persistenceClient.ts:33-41` hardcodes `KNOWN_USER_ID`; `src/context/TaskContext.tsx:32-33`, `:50-53`; `src/store/RoutineContext.tsx:219-227` bypass shared client | Inconsistent or spoofable identity behavior across feature surfaces; cross-feature data drift. | Remove hardcoded user restoration. Route all HTTP calls through one API client that injects identity consistently. |
| SDI-03 | High | CORS policy | `src/server/index.ts:47-52` | `Access-Control-Allow-Origin: *` plus custom identity header allows broad cross-origin invocation risk in deployed environments. | Restrict allowed origins by environment variable; deny wildcard in production. |
| SDI-04 | High | Admin endpoint exposure | `src/server/index.ts:197-205`, `:207` | Migration/integrity endpoints are mounted without admin auth guard; any caller with spoofed `X-User-Id` can run migration for that scope. | Add explicit admin middleware (`X-Admin-Token` or proper auth role), and disable migration routes in production unless enabled. |
| SDI-05 | High | Evidence tenancy + API contract | `src/server/routes/habitPotentialEvidence.ts:19`, `:38`, `:45`, `:95-97`, `src/lib/persistenceClient.ts:1090-1092` | Route ignores request user (`USER_ID` constant), and response shape mismatches client expectation (`res.json(evidence)` vs `{ evidence }`). | Use `(req as any).userId`; standardize response envelope and add contract tests. |
| SDI-06 | High | HabitEntry update integrity | `src/server/routes/habitEntries.ts:270`, `:318-320`; `src/server/repositories/habitEntryRepository.ts:232-241` | `PATCH /api/entries/:id` applies near-arbitrary patch keys (except completion guards). Mutable fields can violate canonical expectations (`habitId`, `source`, etc.) without full validation. | Enforce strict allowlist for update payload fields + habit-type validation on update path. |
| SDI-07 | High | Entry uniqueness / concurrency | `src/server/lib/mongoClient.ts:37-39`; `src/server/repositories/habitEntryRepository.ts:370-425` | No unique active constraint for `(userId, habitId, dayKey)`; read-then-insert upsert can race into duplicates. | Add unique index for active entries and atomic upsert keyed on canonical tuple. |
| SDI-08 | Medium | Core collection indexing gaps | `src/server/repositories/goalRepository.ts:22-47`, `habitRepository.ts:20-64`, `categoryRepository.ts:22-57` (no per-user unique id indexes) | App assumes UUID uniqueness and duplicate-precheck; DB does not enforce for core collections. Integrity issues become hard to repair at scale/migrations. | Add unique indexes on `(userId,id)` for `habits`, `goals`, `categories`, `tasks`, `routines`, `journalEntries`. |
| SDI-09 | Medium | Non-transactional destructive reorder | `src/server/repositories/categoryRepository.ts:174-185` | Reorder deletes all categories then reinserts. Mid-operation failure can drop category set and break foreign references. | Replace with bulk ordered `updateOne` on `order` field or wrap delete/insert in transaction. |
| SDI-10 | Medium | Upload/content validation | `src/server/routes/goals.ts:33-38`, `src/server/index.ts:45`, `src/server/utils/fileStorage.ts:47-55` | Goal badge upload accepts any `image/*` MIME and serves from static `/uploads`; MIME trust-only validation can allow unsafe formats. | Restrict to JPEG/PNG/WebP, verify magic bytes server-side, keep upload size limits, and set safer content headers for static files. |
| SDI-11 | Medium | Missing runtime hardening middleware | `src/server/index.ts` (no `helmet`, rate limiting, request ID middleware) | Easier abuse and harder incident diagnosis under load/errors. | Add baseline middleware: security headers, rate limiting for mutation endpoints, request-id structured logs. |
| SDI-12 | Medium | Migration safety | `src/server/utils/migrationUtils.ts:21-75` | Backfill uses looped read-then-create logic without concurrency guards; duplicate creation risk increases if called concurrently with active writes. | Wrap in idempotent upsert strategy and guard migration route with single-flight lock. |

## Data Integrity Constraints Matrix
| Domain | Constraint status | Evidence | Gap |
| --- | --- | --- | --- |
| HabitEntry `id` per user | Enforced | `src/server/lib/mongoClient.ts:37` unique index | Good. |
| HabitEntry one active entry per `(userId,habitId,dayKey)` | **Not enforced** | `src/server/lib/mongoClient.ts:38` non-unique index | Critical canonical integrity gap. |
| DayLog composite uniqueness | Enforced | `src/server/lib/mongoClient.ts:40` | Good for legacy cache. |
| WellbeingEntry idempotency key | Enforced | `src/server/repositories/wellbeingEntryRepository.ts:29-35` | Good. |
| Routine image one-per-routine | Enforced | `src/server/repositories/routineImageRepository.ts:27-30` | Good. |
| Journal upsert key uniqueness | Partially enforced by code, not DB | `src/server/repositories/journal.ts:85-99`, index at `:20` is not unique | Race can create duplicates. |
| Category/habit duplicate prevention | App-level precheck only | `categoryRepository.ts:30-40`, `habitRepository.ts:28-39` | Read-then-insert race possible without unique indexes. |

## Injection / Input Validation Assessment
- No obvious direct query-string-to-operator Mongo injection was found in audited routes; most filters are explicit key/value.
- Validation quality is uneven:
  - Stronger: HabitEntry create path (`src/server/routes/habitEntries.ts:101-147`), DayKey/timeZone validation.
  - Weaker: HabitEntry patch path lacks strict schema allowlist (`src/server/routes/habitEntries.ts:270+`).
  - Many routes still use ad-hoc manual validation patterns instead of centralized schema enforcement.

## Migration Safety Concerns
1. Canonical cutover is incomplete while migration routes remain public.
2. Legacy-compatible fallbacks (`dayKey || date`) hide malformed data and reduce confidence in integrity checks.
3. No explicit migration run-lock/marker around backfill endpoint execution.

## Recommended Hardening Order (V1 Practical)
1. Lock identity and admin surfaces (`auth.ts`, CORS, admin route guards).
2. Enforce DB-level invariants for core keys and atomic upserts.
3. Fix evidence route scoping/contract and patch allowlists.
4. Add baseline runtime protections and structured observability.
