# Migration Scripts

Tools for safe, auditable data migrations on the HabitFlowAI MongoDB database.

## Safe-run rules

- **Never point migrations at production by default.** Use a dedicated DB or URI (e.g. `MONGODB_URI` and `MONGODB_DB_NAME`) that you explicitly set for the migration target.
- **Always dry-run first.** Scripts that modify data support `--dry-run` (or similar); run them and review the report before using `--apply` or `--i-understand-this-will-modify-data`.
- **Confirm the target.** Before `--apply`, verify `MONGODB_URI` and `MONGODB_DB_NAME` (or script args) point at the intended database, not production, unless you intend a production migration with proper backups and approval.
- **Reports.** Migration reports are written under `docs/migrations/` with timestamps; keep them for audit.

## Scripts

### `scripts/migrations/migrateUserData.ts`

Reassigns documents from one or more source userIds to a target userId.

**Flags:**
- `--from <userId>` — source userId (repeatable)
- `--to <userId>` — target userId (required)
- `--dry-run` — report only, no writes (default)
- `--apply` — execute the migration
- `--since YYYY-MM-DD` — only migrate docs created after this date
- `--collections habits,categories,...` — limit to specific collections

**Example (dry-run):**

```bash
npx tsx scripts/migrations/migrateUserData.ts \
  --from anonymous-user \
  --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
  --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
  --dry-run
```

**Example (apply):**

```bash
npx tsx scripts/migrations/migrateUserData.ts \
  --from anonymous-user \
  --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
  --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
  --apply
```

Reports are saved to `docs/migrations/user-migration-<timestamp>.json`.

---

### `scripts/migrations/verifyUserMigration.ts`

Post-migration verification: counts, leftover detection, referential integrity.

```bash
npx tsx scripts/migrations/verifyUserMigration.ts \
  --from anonymous-user \
  --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
  --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb
```

Use `--allow-leftovers` if conflicts were expected.

---

### `scripts/migrations/cleanupTestUsers.ts`

Removes documents belonging to test/debug userIds from the database.

**Dry-run:**

```bash
npx tsx scripts/migrations/cleanupTestUsers.ts --dry-run
```

**Apply:**

```bash
npx tsx scripts/migrations/cleanupTestUsers.ts --apply
```

Use `--include-demo` to also clean up `demo_*` users.

---

## Recommended sequence for the M0 incident

1. **Dry-run migration** — review what would be reassigned:

   ```bash
   npx tsx scripts/migrations/migrateUserData.ts \
     --from anonymous-user \
     --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
     --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
     --dry-run
   ```

2. **Review the report** in `docs/migrations/user-migration-*.json`.

3. **Apply migration** (after reviewing):

   ```bash
   npx tsx scripts/migrations/migrateUserData.ts \
     --from anonymous-user \
     --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
     --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
     --apply
   ```

4. **Verify**:

   ```bash
   npx tsx scripts/migrations/verifyUserMigration.ts \
     --from anonymous-user \
     --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
     --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
     --allow-leftovers
   ```

5. **Clean up test users** (dry-run first):

   ```bash
   npx tsx scripts/migrations/cleanupTestUsers.ts --dry-run
   npx tsx scripts/migrations/cleanupTestUsers.ts --apply
   ```

6. **Re-verify** user distribution:

   ```bash
   npx tsx scripts/debug/userIdDistribution.ts
   ```

---

### HabitEntries: backfill dayKey (fix index E11000 dup key dayKey: null)

If the server logs show **E11000 duplicate key** on `idx_habitEntries_user_habit_dayKey_active_unique` with `dayKey: null`, you have entries that still use the legacy `date` field and no `dayKey`. The unique index cannot be built while multiple documents share `(userId, habitId, null)`.

**1. Backfill dayKey from date/dateKey (dry-run then apply):**

```bash
npx tsx scripts/migrations/backfillDayKey.ts --dry-run
npx tsx scripts/migrations/backfillDayKey.ts --apply --i-understand-this-will-modify-data
```

Reports are saved to `docs/migrations/backfill-dayKey-<timestamp>.json`.

**2. Then run dedupe** (below) if multiple entries end up with the same (userId, habitId, dayKey).

**3. Restart the server** so index assurance runs again; the unique index should then be created.

---

### HabitEntries deduplication (before enabling unique index)

Before enabling the unique index on `(userId, habitId, dayKey)` in production, duplicate active entries must be removed. Use the dedupe script (soft-deletes losers) and then the verify script.

**Dedupe — dry-run (read-only, writes report only):**

```bash
npx tsx scripts/migrations/dedupeHabitEntries.ts --dry-run
```

**Dedupe — apply (modifies data; requires confirmation flag):**

```bash
npx tsx scripts/migrations/dedupeHabitEntries.ts --apply --i-understand-this-will-modify-data
```

Reports are saved to `docs/migrations/dedupe-habitEntries-<timestamp>.json`.

**Verify no duplicate active entries remain (read-only):**

```bash
npx tsx scripts/migrations/verifyNoDuplicateHabitEntries.ts
```

Exits 0 if no duplicates, 1 if any duplicate groups exist.

---

### Console noise: legacy "date" and dayKey

If you see many **`[DayKey] Entry ... using legacy "date" field as dayKey. Prefer "dayKey".`** or **`[truthQuery] HabitEntry ... using legacy "date" as dayKey`** in the server log, the app is still reading entries that have `date` but no `dayKey`. Run the **backfill dayKey** script above to set `dayKey` from `date` (or `dateKey`/`timestamp`). After backfill and restart, new writes use `dayKey` and those warnings go away.
