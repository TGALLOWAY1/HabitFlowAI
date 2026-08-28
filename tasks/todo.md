# Remove One-Time Migration Bloat

Remove code and tests that existed only for completed one-time data migrations
(startup migrations, incident-remediation scripts, archived one-offs).

- [x] 1. Remove completed startup migrations (`src/server/migrations/` 001–003 + runner)
      and the `runStartupMigrations` call in `src/server/index.ts` (commit 1)
- [x] 2. Drop the migration-era startup duplicate-key preflight scan in
      `src/server/lib/mongoClient.ts` (+ its test); handle E11000 in the createIndex
      catch instead (commit 2)
- [x] 3. Remove one-time migration/incident scripts: `scripts/migrations/` (incl. its
      test), `scripts/debug/`, `docs/migrations/`, stale `.gitignore` entries (commit 3)
- [x] 4. Delete `archive/old-scripts/` (already-retired one-offs) and drop the
      `archive` ESLint ignore (commit 4)
- [x] 5. Update living docs: `docs/DOC_INDEX.md`, `docs/maintenance/verification.md`
      (commit 5)
- [x] 6. Verify: `npm run build`, `npm run lint:beta`, `npm run test:beta`; push + PR

Design decisions:
- Startup migrations 002/003 are recorded complete in the `_migrations` collection in
  any environment that has run this code; a fresh DB has no legacy data to migrate, so
  the runner is a no-op everywhere and safe to delete.
- The per-startup duplicate-key aggregation existed only to guard the one-time
  dedupe/unique-index transition. If a legacy DB with duplicates ever appears,
  `createIndex` fails with E11000 and is logged non-fatally — same net behavior
  (index skipped, warning logged) without a full-collection scan on every boot.
- `noDayLogImports.test.ts` is kept: it enforces the documented "removed collections"
  invariant from CLAUDE.md and is part of the CI beta suite.
- Historical snapshot docs (postmortem, repo-cleanup-audit, archives, ios-discovery)
  keep their stale path references; only living docs are updated.
