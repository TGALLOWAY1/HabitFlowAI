# Documentation Audit Report

Generated: 2026-02-22

## 1) Repo Snapshot

- Stack: `React 19 + Vite + TypeScript` frontend, `Express 5 + MongoDB` backend.
- Routing: custom client-side router in `src/App.tsx` using query params (`?view=...`), no `react-router`.
- Canonical behavior path in code: `HabitEntry` writes/reads + DayKey normalization (`src/server/routes/habitEntries.ts`, `src/domain/time/dayKey.ts`, `src/server/domain/canonicalValidators.ts`).
- Legacy compatibility still exists via `dayLogs` routes/repositories as derived cache surface.

## 2) Documentation Inventory

| Path | Purpose | Freshness Guess | Action |
| --- | --- | --- | --- |
| `README.md` | Root project landing page | stale for engineering docs (mostly screenshots) | keep, rewrite as docs entrypoint |
| `AUDIT_REPORT.md` | This audit | current | keep |
| `docs/reference/V2 (Current - iOS focus)/00_Northstar.md` | iOS-first northstar + invariants | current canonical reference | keep (reference source) |
| `docs/reference/V1/00_NORTHSTAR.md` | HabitFlow canonical vocabulary (v1) | canonical reference; overlaps with V2 northstar | keep (reference source) |
| `docs/reference/iOS release V1/Feature_Prioritization.md` | iOS v1 feature spec + launch invariants | canonical reference for v1 constraints | keep (reference source) |
| `docs/reference/iOS release V1/Product_Vision.md` | iOS vision statement (psychological safety heavy) | useful historical direction; not current v1 direction | archive-signaled in index |
| `docs/reference/V1/*.md` | Object-level contracts (Habit, HabitEntry, DayKey, etc.) | mixed; mostly current and aligned with code intent | keep as reference library |
| `docs/reference/V1/Depreciated/*` | deprecated identity/skill/reflection docs | stale/deprecated by name and content | keep in place but mark as historical in new index |
| `docs/reference/V1/personas/*` | persona behavior and tone specs | mixed; partially implemented | keep as reference, not v1 core |
| `docs/reference/V2 (Current - iOS focus)/*.md` | current iOS-focused object semantics | mostly current, high-authority prose | keep as reference library |
| `docs/reference/V0/*` | historical PRDs and migration planning | explicitly historical (`v0`) | keep as archived reference source |
| `docs/archive/root/GOALS_FEATURE_SUMMARY.md` | goals implementation history | stale for current architecture | moved to archive |
| `docs/archive/root/PR_DESCRIPTION.md` | emotional dashboard PR summary | stale as source-of-truth doc | moved to archive |
| `docs/archive/root/ROUTINE_IMAGE_ANALYSIS_FINDINGS.md` | routine image technical notes | historical implementation snapshot | moved to archive |
| `docs/archive/root/ROUTINE_IMAGE_MONGODB_MIGRATION_PLAN.md` | migration plan snapshot | historical planning artifact | moved to archive |
| `docs/archive/root/V1_FEATURE_CHECKLIST.md` | v1 checklist snapshot | historical milestone doc | moved to archive |
| `src/server/lib/README.md` | local module notes for Mongo client | current but narrow | keep local + reference from docs |
| `src/server/repositories/README.md` | repository layer notes | partially current | keep local + reference from docs |

## 3) Duplicate Concepts / Conflicts Found

1. Northstar duplication:
- `docs/reference/V1/00_NORTHSTAR.md` and `docs/reference/V2 (Current - iOS focus)/00_Northstar.md` both define canon with overlapping but not identical wording.

2. Source-of-truth tension in runtime surface:
- Canon says HabitEntry is sole behavioral truth.
- Code still exposes `dayLogs` CRUD routes (`/api/dayLogs`) while also labeling DayLog as legacy/derived. This is a legacy compatibility surface and should be treated as non-canonical.

3. Route naming/documentation drift:
- Historical docs refer to old names (e.g., activities/history-specific planning), while code now centers on habits/routines/goals/journal/tasks/day view.

4. Folder naming hygiene issues:
- `Depreciated` misspelling in `docs/reference/V1/Depreciated`.
- Non-standard folders/files like `docs/reference/V1/personas_TODO.md/fitness.md` and extensionless files in `docs/reference/V0`.

5. Root-doc sprawl:
- Multiple root markdown files were implementation snapshots; these are now archived under `docs/archive/root/`.

## 4) Proposed Canonical Docs IA

- `docs/README.md` — docs navigation quickstart.
- `docs/DOC_INDEX.md` — single entrypoint index.
- `docs/ARCHITECTURE.md` — system overview (frontend/backend/data flow).
- `docs/DOMAIN_CANON.md` — minimal invariants + links to canonical references.
- `docs/DEV_GUIDE.md` — local setup, env, scripts, tests.
- `docs/API.md` — backend route inventory and contracts.
- `docs/DATA_MODEL.md` — implemented schema and collection ownership.
- `docs/UI.md` — page inventory and route map (includes new Main Dashboard page).
- `docs/V1_PRODUCT_DIRECTION.md` — practical/personal-use-first direction.
- `docs/VERIFICATION.md` — docs and dashboard verification checklist.
- `docs/archive/` — historical/stale material, explicitly marked archived.
- `docs/reference/` — authoritative source library (kept intact, linked from index).

## 5) Decisions Implemented in This Pass

- Root implementation snapshot docs moved to `docs/archive/root/` and stamped as archived.
- New canonical docs hub under `docs/` created.
- Root README repointed to `docs/DOC_INDEX.md`.
- Canonical reference docs retained in-place under `docs/reference/`.

