# Repo Cleanup Audit

**Date:** 2026-07-02 · **Branch:** `claude/portfolio-repo-cleanup-y4x98i`
**Purpose:** Written audit trail for a portfolio-readiness cleanup pass — what exists, what
is safe to remove or archive, and why. No product or architecture changes.

## Project Summary

HabitFlowAI is a full-stack habit-tracking web app: TypeScript ESM monorepo with a React 19 +
Vite frontend, an Express 5 backend, and MongoDB persistence. Core invariant: `habitEntries`
is the single behavioral source of truth; all derived views (day view, streaks, progress,
goal progress) are computed at read time. AI features (Weekly Review, Journal Review/Summary,
routine variant suggestions) are BYOK Gemini.

- **Build system:** Vite 7 + `tsc -b` (project references: `tsconfig.app.json`, `tsconfig.node.json`)
- **Entry points:** frontend `index.html` → `src/main.tsx` → `src/App.tsx`; backend `src/server/index.ts` → `src/server/app.ts` (`createApp`)
- **Routing:** query-string based (`?view=...`) in `src/App.tsx`, plus a few path-based pages; Vite dev proxy forwards `/api` → `localhost:3001`
- **Tests:** Vitest + JSDOM + Supertest; `mongodb-memory-server` by default (no real DB)
- **CI:** `.github/workflows/ci-beta.yml` — `npm ci`, `npm run build`, `npm run test:beta`, `npm run lint:beta` on Node 20
- **Deploy:** Render (backend, `render.yaml`) + Vercel (frontend, `vercel.json`)

## Current Structure

```
├── README.md, CHANGELOG.md, ROADMAP.md, FEATURE_AUDIT.md   # root docs
├── docs/            # ~140 markdown files (see Documentation Inventory)
├── tasks/           # todo.md, lessons.md (CLAUDE.md-mandated working files)
├── scripts/         # verify.sh, seeds, invariant checks, migrations/, debug/
├── public/          # PWA icons, manifest, sw.js, uploads/routine-images/
└── src/
    ├── App.tsx, main.tsx, pages/, components/, context/, store/, hooks/
    ├── lib/, utils/, api/, data/, models/, types/, assets/
    ├── server/      # routes/ services/ repositories/ domain/ middleware/ config/
    ├── shared/, domain/   # code shared by both sides (CI beta-gated)
    ├── scripts/     # one-off data migration scripts (tsx)
    └── test/        # mongoTestHelper, assertTestDb, setup
```

## Important Runtime Paths

Do **not** move or delete without updating the referencing code:

| File | Referenced from |
|---|---|
| `FEATURE_AUDIT.md` (root) | `src/pages/TourPage.tsx` — including a **hardcoded GitHub blob URL** at line ~518 (user-facing tour link). Must stay at repo root with this exact name. |
| `docs/audits/m2_writepaths_daykey_map.md`, `docs/debug/db-config.md` | Runtime error string in `src/server/lib/mongoClient.ts:20` |
| `docs/reference/V1/00_DATA_CONTRACT_WELLBEING_KEYS.md` | Comments in `src/components/analytics/sleep/sleepFormat.ts`, `src/models/persistenceTypes.ts`, `src/server/repositories/wellbeingEntryRepository.ts` — the latter two use a **broken path** (missing `V1/`), fixed in this cleanup |
| `docs/DEMO_ARCHITECTURE.md` | Comment in `src/lib/demoMode.ts` |
| `docs/migrations/` (directory) | Output target of `scripts/migrations/migrateUserData.ts`, `cleanupTestUsers.ts`, `backfillHouseholdId.ts` |
| `docs/debug/` (directory) | Output target of `scripts/debug/inspectMongo.ts` (writes `mongo-inspection.json`) |
| `public/uploads/routine-images/*` | Served statically by `src/server/app.ts:109` (`/uploads`); legacy routine documents in a live DB may still reference these URLs — **keep** |

## Important AI/API/Prompt Files

All AI logic is server-side route + shared lib code (no prompt-pack files to preserve):

- `src/server/routes/aiWeeklyReview.ts` — Weekly AI Review (grounded, schema-constrained)
- `src/server/routes/aiJournalReview.ts` — AI Journal Review (non-clinical reflection aid)
- `src/server/routes/aiJournalSummary.ts` — journal AI summaries
- `src/server/lib/gemini.ts` — shared Gemini model id / URL / response helpers
- `docs/ai-features.md` — design, data flow, grounding strategy, contracts
- Gemini key is BYOK, client-side only (localStorage) — no server env var

## Documentation Inventory

~140 markdown files. The repo already has a self-declared documentation standard
(`docs/DOC_INDEX.md`) and an archive convention (`docs/archive/`, `docs/archive/root/`).
This cleanup **extends the existing convention** rather than inventing a new tree.

**Canonical, current (keep in place):** `README.md`, `CHANGELOG.md`, `ROADMAP.md`,
`FEATURE_AUDIT.md`, `docs/DOC_INDEX.md`, `docs/FEATURES.md`, `docs/ARCHITECTURE.md`,
`docs/DATA_MODEL.md`, `docs/API.md`, `docs/DOMAIN_CANON.md`, `docs/ai-features.md`,
`docs/DEMO_ARCHITECTURE.md`, `docs/DEV_GUIDE.md`, `docs/V1_PRODUCT_DIRECTION.md`,
`docs/product/HABITFLOW_UI_ARCHITECTURE.md`, `docs/semantics/daykey.md`,
`docs/maintenance/verification.md`, `docs/migrations/README.md`, `docs/deploy/*`,
`docs/system-model/*`, `docs/decision-log/*`, `docs/debug/*.md`,
`docs/reference/V1|V2|iOS release V1` (canonical specs), `tasks/todo.md`, `tasks/lessons.md`.

**Current audits (indexed or linked from ROADMAP/README — keep):**
`docs/audits/HABITFLOW_PERFORMANCE_ASSESSMENT.md`, `redundant-db-calls-audit.md`,
`m5_identity_map.md` (linked from ARCHITECTURE), `m2_writepaths_daykey_map.md` (runtime string),
`analytics_page_implementation_audit_2026-03-29.md` (ROADMAP), 
`historical-linkage-archive-audit-2026-03-30.md` (README + ROADMAP).

## Potential Dead Code

Method: two independent passes — (1) basename grep across `src/`, `scripts/`, `index.html`,
Vite/Vitest configs, `package.json`, `render.yaml`, `vercel.json`; (2) full import-graph
reachability (static + literal dynamic `import()`) from the entry points `src/main.tsx`,
`src/server/index.ts`, and every package.json-wired script. No path aliases exist and no
non-literal dynamic imports exist, so the graph is trustworthy. Every page in `src/pages/`
is lazily routed from `App.tsx`; all 38 server route files are mounted in `app.ts`.

**Dead frontend components** (zero references anywhere; several form a dead chain):
`AccomplishmentsLog.tsx`, `BundleComponents.tsx`, `CalendarView.tsx` →
`WeeklyHabitEditModal.tsx` (chain), `WeeklyHabitCard.tsx`, `EmptyState.tsx`,
`MomentumHeader.tsx`, `ProgressRings.tsx`, `day-view/DayHabitRow.tsx`,
`analytics/AnalyticsHeatmap.tsx`, `goals/GoalCardStack.tsx` → `goals/GoalCard.tsx` →
`goals/InactivityCoachingPopup.tsx` (chain), `goals/GoalSparkline.tsx`,
`Journal/JournalSummaryCard.tsx`, `icons/GratitudeJarIcon.tsx`

**Dead utilities:** `src/utils/pace.ts` (consumes legacy DayLog types),
`src/utils/legacyReadWarning.ts` (dev warnings for the removed DayLogs read path),
`src/utils/entryMigration.ts` (one-time DayLogs→HabitEntries migration for a removed collection)

**Dead server code:** `src/server/middleware/auth.ts` — its own header says
"DEPRECATED — Do not use… use identityMiddleware (identity.ts)"; zero importers

**Scaffold leftovers:** `src/assets/react.svg`, `public/vite.svg` (icons in use are `icon-*.png`)

**Commented-out block:** `src/components/TrackerGrid.tsx` ~lines 666–779 — a ~113-line
commented-out `SortableWeeklyHabitRow` component ("replaced by WeeklyHabitCard", which is
itself dead)

**Obsolete one-off scripts:**
- `src/scripts/*.ts` — 5 manual data migrations (bundle memberships ×2, choice bundles,
  dayLogs→entries, routine-images→MongoDB) + `debug_delete_error.ts` scratch file; none wired
  to package.json, none imported; several reference the removed `dayLogs` collection
- `scripts/compare-legacy-vs-canonical.ts` (+ `compare:legacy-reads` npm script) — toggles
  `LEGACY_DAYLOG_READS`, which no runtime code reads anymore
- `scripts/remap-orphaned-categories.ts` — one-off; same functionality exists as the mounted
  admin route `remapOrphanedCategories` in `src/server/routes/admin.ts`

## Potential Obsolete Docs

Working-session artifacts sitting at `docs/` root or in `docs/audits/` that are
point-in-time snapshots, not living documentation:

- `docs/BRANCH_CHANGES.md` — change summary for a long-merged branch (M1–M6 era)
- `docs/PR_DESCRIPTION_218.md` — PR text for the M0 incident; durable knowledge already lives in `docs/debug/postmortem-m0-disappearing-data.md`
- `docs/AllHabitsViewDesign.md` — one-off design/session note (superseded by `docs/product/HABITFLOW_UI_ARCHITECTURE.md`)
- `docs/SCHEDULE_VIEW_BACKLOG.md` — future-work list that violates the repo's own rule that `ROADMAP.md` owns future work (link added to ROADMAP backlog instead)
- `docs/UI.md` — thin page inventory superseded by `docs/product/HABITFLOW_UI_ARCHITECTURE.md`
- `docs/VERIFICATION.md` — one-time docs-consistency checklist; routine verification lives in `docs/maintenance/verification.md`
- `docs/BUNDLE_AUDIT_2026-03-30.md` — dated audit at docs root (belongs with the other audits)
- `docs/audits/` milestone-era artifacts: `m2_cleanup.md`, `m3_routines_map.md`,
  `m3_routines_semantics.md`, `m4_mobile_web_friction_map.md`, `m6_dead_code_removed.md`,
  `m6_verification.md`, `m6_legacy_removal_map.md`, `AUDIT_REPORT.md`,
  `audit-followup-action-plan-2026-04-02.md`, `HABITFLOW_ROUTINES_FEATURE_AUDIT.md`,
  `HABIT_SCHEDULING_REFACTOR_ANALYSIS.md`, `iphone_usability_audit_2026-03-28.md`,
  `pr-audit-last-24h-2026-03-30.md`, `audit_v1/` (12-file point-in-time audit set)
- `docs/qa/routine-log-habits-qa.md` — one-off manual QA checklist for a specific change

## Files Safe to Delete

Verified unused via the two-pass sweep above; the `tsc -b` + Vite build and test suite are
re-run after removal as a final guard:

- The 16 dead frontend components, 3 dead utilities, `src/server/middleware/auth.ts`, and
  the two scaffold SVGs listed under "Potential Dead Code"
- The commented-out `SortableWeeklyHabitRow` block in `TrackerGrid.tsx`
- `src/scripts/debug_delete_error.ts` — debug scratch file
- `docs/debug/mongo-inspection.json` — regenerable output of `scripts/debug/inspectMongo.ts`;
  nothing reads it (also added to `.gitignore` so future runs stay uncommitted)

## Files Safer to Archive

Docs — all "Potential Obsolete Docs" above → `docs/archive/` (extending the existing convention):

- PR/branch artifacts (`BRANCH_CHANGES.md`, `PR_DESCRIPTION_218.md`) → `docs/archive/root/`
  (where `PR_DESCRIPTION_M*.md` already live)
- Superseded docs (`UI.md`, `VERIFICATION.md`, `AllHabitsViewDesign.md`,
  `SCHEDULE_VIEW_BACKLOG.md`) → `docs/archive/root/`
- Historical audits (13 files + `audit_v1/` + `BUNDLE_AUDIT_2026-03-30.md`) → `docs/archive/audits/`
- `docs/qa/routine-log-habits-qa.md` → `docs/archive/qa/`

Scripts — one-off data migrations with historical value → `archive/old-scripts/` (root),
added to ESLint's global ignores so archived code is never linted or type-checked:

- `src/scripts/migrate*.ts` (5 files — bundle memberships ×2, choice bundles,
  dayLogs→entries, routine images from disk)
- `scripts/compare-legacy-vs-canonical.ts` (npm script `compare:legacy-reads` removed with it)
- `scripts/remap-orphaned-categories.ts` (superseded by the admin route)

## Files Requiring Manual Review

Left untouched by this cleanup:

- `public/uploads/routine-images/*.{jpeg,png}` — two committed images. Server still serves
  `/uploads` statically and old routine documents in the production DB may reference them.
  `src/scripts/migrateRoutineImagesFromDisk.ts` exists to move disk images into MongoDB, but
  whether it ran against production is not verifiable from the repo.
- `src/server/migrations/001_add_routine_variants.ts` — the startup migration runner imports
  only `002` and `003`; `001` was presumably applied manually before the runner existed.
  Never imported, but migrations stay untouched on principle.
- `src/shared/personas/` (4 files) — an orphan island (only import each other; nothing outside
  imports them), but `.claude/CLAUDE.md` documents `src/shared/` as owning persona definitions
  and the live `src/shared/invariants/personaInvariants.ts` (which IS used) is adjacent.
- `src/data/predefinedHabits.ts` — zero imports (only a scan-skip string in
  `scripts/check-invariants.ts`), but sits in caution territory (sibling `journalTemplates.ts`
  is live seed data).
- `src/server/services/freezeService.ts` (+ test) — `processAutoFreezes` is called nowhere,
  but the freeze concept is live across daySummary/progress/analytics; likely a planned
  auto-freeze feature.
- `src/utils/habitAggregation.ts` (+ test) — only its own test imports it, but
  `src/shared/checklistSuccessRule.ts` claims it as the intended frontend consumer; possible
  unfinished wiring rather than dead code.
- `src/server/middleware/devUserIdOverride.ts` — zero importers, but demo-related (caution area).
- `src/server/routes/wellbeingLogs.ts` + `wellbeingLogRepository.ts` — **not dead** (mounted
  and still called by `persistenceClient.ts`), but serves the documented-legacy `wellbeingLogs`
  collection; deprecation candidate for a future product decision.
- `scripts/migrations/*.ts` and `scripts/debug/*.ts` — operational tooling documented in
  `docs/migrations/README.md`; kept in place.
- `docs/migrations/backfill-householdId-2026-03-04*.json` — `docs/migrations/README.md`
  explicitly says migration reports are kept for audit.
- `scripts/generate-goal-badges.py` — HF-token image-generation experiment for goal badges;
  `src/server/services/badgeGenerationService.ts` is real runtime code, so the experiment may
  still be a useful reference. `scripts/generate-icons.mjs` regenerates the live PWA icons; kept.
- `docs/reference/V1/personas_TODO.md/` (a *directory* with a `.md` name) and
  `docs/reference/V1/personas_specs/02_FITNESS_PERSONA_SPEC` (no extension) — naming oddities
  in the canonical reference tree; renaming risks breaking outside references.

## Verification Commands

| Command | Purpose | Baseline (before cleanup) |
|---|---|---|
| `npm run build` | `tsc -b` + Vite build — the Vercel deploy gate | ✅ passes |
| `npm run lint` / `lint:beta` | ESLint (full / CI scope) | ✅ 0 errors (111 warnings, pre-existing) |
| `npm run test:beta` | CI test subset | ⚠️ in this sandbox, 5 Mongo-backed test files fail because `mongodb-memory-server` cannot download the MongoDB binary (network-restricted); 20 non-Mongo tests pass. Passes in GitHub CI. |
| `npm run test:run` | Full Vitest suite | Same sandbox limitation |
| `npm run verify` | typecheck + lint + full tests | Same sandbox limitation |
