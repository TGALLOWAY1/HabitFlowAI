# PR: M0 “Data Disappeared” — Investigation, Migration, Test Isolation & Identity Cleanup

## Summary

This PR addresses the “my data disappeared after M0” issue by (1) diagnosing root cause, (2) adding safe migration and cleanup tooling, (3) hardening test isolation so tests never touch production MongoDB, and (4) removing hardcoded identity and adding a minimal dev identity selector.

**Root cause:** Data was never lost. A **userId scoping mismatch** meant the UI queried with a fixed known user ID while older data lived under `anonymous-user` and an auto-generated UUID. Migration and cleanup scripts have been run: orphaned data is now under the primary user, and test-user documents have been removed from production.

---

## What changed

### 1. Debug & observability

- **Mongo startup logs** (`src/server/lib/mongoClient.ts`): On connect, logs `host`, `db`, `NODE_ENV`, and presence of `MONGODB_URI` / `MONGODB_DB_NAME` so the active DB is unambiguous.
- **`GET /api/debug/whoami`** (dev-only): Returns `userId`, `userIdSource`, `dbName`, `nodeEnv`, `mongoUriPresent`. Returns 404 in production.
- **Read-only scripts:**
  - `scripts/debug/inspectMongo.ts` — Lists collections, document counts for key collections, optional sample IDs; writes `docs/debug/mongo-inspection.json`.
  - `scripts/debug/userIdDistribution.ts` — Aggregates `userId` per collection for scoping diagnosis.
- **Docs:** `docs/debug/db-config.md` (env resolution, which env file is loaded, identity resolution), `docs/debug/postmortem-m0-disappearing-data.md` (root cause, evidence, recovery plan, prevention checklist).

### 2. Test DB safety guard

- **`src/server/lib/mongoClient.ts`:** When `NODE_ENV=test`, `VITEST`, or `JEST_WORKER_ID` is set, `connectToMongo()` refuses to connect unless `MONGODB_DB_NAME` contains `_test` or `test_`. Prevents tests from ever writing to production.
- **`src/test/setup.ts`:** Sets `process.env.NODE_ENV = 'test'` so the guard applies to all Vitest runs.
- **`src/test/assertTestDb.ts`:** Reusable guard that throws if `MONGODB_DB_NAME` is not test-safe.

### 3. Migration & cleanup tooling

- **`scripts/migrations/migrateUserData.ts`**  
  Reassigns documents from one or more source `userId`s to a target `userId`.  
  - Flags: `--from` (repeatable), `--to`, `--dry-run` (default), `--apply`, `--since YYYY-MM-DD`, `--collections`.  
  - Conflict detection: skips docs where the same logical key already exists for the target user.  
  - Writes a JSON report to `docs/migrations/user-migration-<timestamp>.json`.

- **`scripts/migrations/verifyUserMigration.ts`**  
  Post-migration checks: target user doc counts, leftover docs for source users, referential integrity (habitEntry → habit, dayLog → habit, goalManualLog → goal).  
  - Flags: `--from`, `--to`, `--allow-leftovers`.

- **`scripts/migrations/cleanupTestUsers.ts`**  
  Finds and optionally deletes documents for `test-user-*`, `test-*`, `vitest-*`, `jest-*`, `debug-user-*`.  
  - Dry-run by default; `--apply` to delete. Never touches the known real user or `anonymous-user`.  
  - Writes `docs/migrations/test-user-cleanup-<timestamp>.json`.

- **`docs/migrations/README.md`:** How to run dry-run, apply, verify, and cleanup; recommended sequence for this incident.

### 4. Test isolation with mongodb-memory-server

- **New dev dependency:** `mongodb-memory-server`.
- **`src/test/mongoTestHelper.ts`:** Shared helper that starts an in-memory MongoDB, sets env so the app’s `getDb()` uses it, and restores env on teardown. Optional `ALLOW_LIVE_DB_TESTS=true` plus a `_test` DB name for rare live-DB runs.
- **18 integration test files** now use `setupTestMongo()` / `teardownTestMongo()` / `getTestDb()` instead of manual env swapping and real MongoDB. No test touches Atlas by default.
- **Guardrails test** updated to call `setupTestMongo()` so it runs against in-memory DB.

### 5. Identity: remove hardcoded KNOWN_USER_ID

- **`src/lib/persistenceClient.ts`:**
  - Removed force-restore of a single hardcoded user ID. First visit uses `DEFAULT_USER_ID` and persists it; thereafter the value in `localStorage` is stable.
  - Added `setActiveRealUserId(newUserId)` and `getActiveRealUserId()` for programmatic switching.
- **`src/components/RoutineEditorModal.tsx`:** Uses `getActiveUserId()` from the persistence client instead of reading `localStorage` directly (audit SDI-02).
- **`src/components/DevIdentityPanel.tsx`:** Dev-only floating panel (bottom-right key icon) showing current userId and quick-switch to primary, `anonymous-user`, `32ba4231…`, or a custom ID. Hidden in production (`import.meta.env.PROD`).
- **`src/App.tsx`:** Renders `DevIdentityPanel` inside the app shell.

### 6. Postmortem and prevention

- **`docs/debug/postmortem-m0-disappearing-data.md`** updated with:
  - Actual migration/verification/cleanup commands.
  - Prevention checklist reflecting all implemented controls (test guard, in-memory tests, identity panel, migration scripts).

---

## Commits (11)

| Commit | Description |
|--------|-------------|
| `chore(debug): add mongo startup logs + test db guard` | Connect logging + NODE_ENV/VITEST guard in mongoClient |
| `tools(debug): add mongo inspection and userId distribution scripts` | inspectMongo.ts, userIdDistribution.ts |
| `chore(debug): add dev-only whoami endpoint` | GET /api/debug/whoami |
| `test(safety): add test db guard + set NODE_ENV=test in vitest setup` | assertTestDb.ts, vitest setup |
| `docs(debug): add db-config docs, inspection report, and postmortem` | db-config.md, postmortem |
| `tools(migrations): add userId migration script (dry-run + report)` | migrateUserData.ts |
| `tools(migrations): add migration verification script` | verifyUserMigration.ts |
| `tools(migrations): add cleanup script for test-user data` | cleanupTestUsers.ts |
| `test: isolate tests with mongodb-memory-server + live-db guardrails` | mongoTestHelper, 18 test files converted |
| `feat(identity): remove hardcoded KNOWN_USER_ID, add dev identity panel` | persistenceClient + DevIdentityPanel |
| `docs: add migration README and update postmortem with script references` | docs/migrations/README.md, postmortem update |

---

## Migration applied

- **UserId migration:** 179 documents reassigned from `anonymous-user` and `32ba4231-79d9-4d07-8aa9-398aee800ce6` to `8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb` (1 conflict skipped in wellbeingLogs).
- **Test-user cleanup:** 25 documents removed (7 test userIds). No real user data modified.
- **Verification:** Post-migration script run; target user now has 209 habits, 23 categories, 15 goals, 254 habitEntries, etc. One expected leftover (wellbeingLog conflict).

---

## How to verify

- **Backend:** Start server, confirm console shows `Connected Mongo: host=... db=... NODE_ENV=...`.
- **Whoami:** `curl http://localhost:3000/api/debug/whoami` (dev only).
- **Inspection:** `npx tsx scripts/debug/inspectMongo.ts --show-sample`.
- **Tests:** `npm test` — integration tests use in-memory MongoDB; 33 files pass (some pre-existing failures in recomputeUtils and TrackerGrid).
- **Dev identity:** In dev, use the key icon (bottom-right) to switch userId and confirm data visibility.

---

## Files to review

- `src/server/lib/mongoClient.ts` — logging + test guard
- `src/server/index.ts` — whoami route
- `src/lib/persistenceClient.ts` — identity API
- `src/test/mongoTestHelper.ts` — in-memory test DB
- `scripts/migrations/*.ts` — migration, verify, cleanup
- `docs/debug/postmortem-m0-disappearing-data.md` — root cause and prevention
- `docs/migrations/README.md` — how to run migrations
