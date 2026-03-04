# Migration Scripts

Tools for safe, auditable data migrations on the HabitFlowAI MongoDB database.

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
