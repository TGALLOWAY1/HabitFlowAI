# Archived One-Off Scripts

ARCHIVED: historical one-off data migrations and comparison tools, kept for the audit
trail. They are excluded from TypeScript compilation and ESLint, are not wired to any
npm script, and may no longer run against the current codebase.

| Script | What it did |
|---|---|
| `migrateBundleMemberships.ts` | Backfilled habit bundle membership records |
| `migrateChecklistBundleMemberships.ts` | Backfilled checklist-bundle membership records |
| `migrateChoiceBundles.ts` | Migrated choice-bundle data shape |
| `migrateRoutineImagesFromDisk.ts` | Moved routine images from `public/uploads/` disk storage into MongoDB |
| `compare-legacy-vs-canonical.ts` | Compared legacy DayLog-based reads against canonical entries-derived reads during the M6 migration (the legacy read path no longer exists) |
| `remap-orphaned-categories.ts` | One-off orphaned-category remap; superseded by the mounted admin route `remapOrphanedCategories` in `src/server/routes/admin.ts` |

Operational (still-supported) migration tooling lives in `scripts/migrations/` and is
documented in `docs/migrations/README.md`.
