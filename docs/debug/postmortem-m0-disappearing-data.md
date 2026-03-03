# Postmortem: "My data disappeared after M0"

**Date investigated**: 2026-03-03
**DB**: `HabitFlowAI` on Atlas (`habitflowai.dgdrdui.mongodb.net`)
**Status**: Root cause identified, recovery pending

---

## Root Cause

**The data was never lost — it's all still in MongoDB. The UI shows empty because the frontend is querying with a different `userId` than the one used when the data was originally created.**

### Timeline of identity changes

1. **Early development**: The frontend auto-generated a UUID per browser session and stored it in `localStorage` under `habitflow_user_id`. If the header was missing or localStorage was cleared, the backend fell back to `anonymous-user`.

2. **UUID `32ba4231-79d9-4d07-8aa9-398aee800ce6`**: At some point, one browser session generated this UUID. **50 habits** and **8 categories** were created under it.

3. **`anonymous-user` fallback**: When the `X-User-Id` header was missing (e.g., during API testing, or when localStorage was cleared), data was created under `anonymous-user`. **99 habits** and **9 categories** accumulated under this identity.

4. **KNOWN_USER_ID fix**: The `getOrCreateUserId()` function was patched to hardcode `KNOWN_USER_ID = '8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb'` and force-restore it if different. This ensured identity stability going forward — but immediately orphaned all data belonging to `anonymous-user` and `32ba4231-...`.

5. **New data under known user**: After the fix, the known user accumulated 60 habits, 13 goals, 251 habitEntries, etc. — all visible in the UI.

### What appears "missing"

The habits/categories/goals created before the `KNOWN_USER_ID` fix are invisible to the UI because they belong to `anonymous-user` or `32ba4231-...`, not `8013bd6a-...`.

## Evidence: userId Distribution

| Collection | `anonymous-user` | `32ba4231-...` | `8013bd6a-...` (known) | `test-user-*` | `demo_*` |
|------------|-------------------|----------------|------------------------|---------------|----------|
| habits | 99 | 50 | 60 | ~8 | 10 |
| categories | 9 | 8 | 6 | ~4 | 4 |
| goals | 2 | 0 | 13 | 0 | 1 |
| habitEntries | 3 | 0 | 251 | ~7 | 201 |
| dayLogs | 3 | 0 | 185 | ~5 | 200 |
| tasks | 4 | 0 | 0 | 0 | 0 |

**Total documents in DB**: 1,730 (all key collections combined)

## Secondary Issue: Test Data Leaked into Production

Integration tests set `process.env.MONGODB_DB_NAME` to test-specific names (e.g., `habitflowai_test`) but the `getDb()` singleton can return a cached connection to the real DB if already connected. Multiple `test-user-*` identities appear in the production Atlas database:

- `test-user-123`, `test-user-validation`, `test-user-delete-by-key`
- `test-user-routines-validation`, `test-user-daykey`, `test-user-numeric-*`

This means tests successfully wrote to — and possibly dropped/cleared data in — the production database at some point.

## Recovery Plan

### Step 1: Decide which orphaned data to reclaim

Before running any migration, manually review the orphaned habits:

```bash
# Preview orphaned data counts
npx tsx scripts/debug/userIdDistribution.ts
```

Determine whether data under `anonymous-user` and/or `32ba4231-...` should be migrated to the known user `8013bd6a-...`.

### Step 2: Migrate orphaned data (when ready)

Use the migration script (see `docs/migrations/README.md` for full details):

```bash
# Dry-run first
npx tsx scripts/migrations/migrateUserData.ts \
  --from anonymous-user \
  --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
  --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
  --dry-run

# Apply after reviewing the dry-run report
npx tsx scripts/migrations/migrateUserData.ts \
  --from anonymous-user \
  --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
  --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
  --apply

# Verify
npx tsx scripts/migrations/verifyUserMigration.ts \
  --from anonymous-user \
  --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
  --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
  --allow-leftovers
```

### Step 3: Clean up test data from production

```bash
npx tsx scripts/migrations/cleanupTestUsers.ts --dry-run
npx tsx scripts/migrations/cleanupTestUsers.ts --apply
```

### Step 4: Prevent recurrence

- [x] Hard guard in `mongoClient.ts`: rejects non-test DB names when `NODE_ENV=test`, `VITEST`, or `JEST_WORKER_ID` detected
- [x] Vitest setup sets `NODE_ENV=test`
- [x] `assertTestDb.ts` helper for explicit test guards
- [x] All 18 integration tests converted to `mongodb-memory-server` via shared `mongoTestHelper.ts`
- [x] `ALLOW_LIVE_DB_TESTS=true` required for live-DB integration tests (must use `_test` DB name)
- [x] Removed hardcoded `KNOWN_USER_ID` — replaced with stable first-run default
- [x] Added `DevIdentityPanel` for dev-mode userId switching
- [ ] Add a pre-commit hook or CI check that ensures tests never reference production DB names

---

## Prevention Checklist

| # | Control | Status |
|---|---------|--------|
| 1 | `getDb()` rejects non-test DB (NODE_ENV, VITEST, JEST) | ✅ Added |
| 2 | Vitest setup sets `NODE_ENV=test` | ✅ Added |
| 3 | Startup log prints host + dbName + NODE_ENV | ✅ Added |
| 4 | `assertTestDb.ts` guard available for tests | ✅ Created |
| 5 | `/api/debug/whoami` endpoint for identity debugging | ✅ Added |
| 6 | `inspectMongo.ts` read-only diagnostic script | ✅ Created |
| 7 | `docs/debug/db-config.md` documents env resolution | ✅ Created |
| 8 | Frontend uses stable userId (no hardcoded override) | ✅ Refactored |
| 9 | In-memory MongoDB for all tests | ✅ Implemented |
| 10 | Dev identity panel for userId switching | ✅ Added |
| 11 | Migration + verification + cleanup scripts | ✅ Created |
| 12 | CI check for test DB isolation | ⬜ Recommended |
