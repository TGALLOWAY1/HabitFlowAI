# HabitFlowAI — Active TODO

Consolidated, prioritized backlog of *actionable* tasks. This is the working task list
(checkable items, per `.claude/CLAUDE.md`). Strategic/future direction lives in
[`../ROADMAP.md`](../ROADMAP.md); shipped functionality lives in
[`../docs/FEATURES.md`](../docs/FEATURES.md).

**Legend:** 🧑 **Manual** (owner — needs a human: assets, accounts, product calls) ·
🤖 **Agent** (codeable — can be done by Claude Code). Priorities: **P0** (do next) ·
**P1** (soon) · **P2** (later).

---

## P0 — Do next

| ✓ | Owner | Task | Notes |
|---|---|---|---|
| [ ] | 🤖 | Add a committed `.env.example` | README already says `cp .env.example .env`, but the file is gitignored and absent. Un-ignore it (remove `.env.example` from `.gitignore`) and commit a secrets-free template covering `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT`, `NODE_ENV`, `FRONTEND_ORIGIN`, `BOOTSTRAP_ADMIN_KEY`, `ALLOW_LIVE_DB_TESTS`. |
| [ ] | 🧑 | Add the live Vercel URL to README | README "Demo / live link" has a TODO; only the owner knows/controls the deployment URL. |

## P1 — Soon

| ✓ | Owner | Task | Notes |
|---|---|---|---|
| [ ] | 🧑 | Capture current screenshots | README has 6 screenshot placeholders (dashboard, tracker grid, goal detail, routine runner, wellbeing heatmap, journal template). Needs a human with seeded data. Suggested home: `docs/assets/`. |
| [ ] | 🧑 | Record hero GIF | README hero is a placeholder (`public/icon-512.png`). Suggested: tracker grid + habit toggle + completion ring. |
| [ ] | 🤖 | Analytics page migration | Promote Analytics into primary nav (replacing Tasks). See [`../docs/audits/analytics_page_implementation_audit_2026-03-29.md`](../docs/audits/analytics_page_implementation_audit_2026-03-29.md). Tracked in ROADMAP (In Progress). |
| [ ] | 🤖 | Historical linkage / archive remediation | Ensure deletion/unlink flows can't erase archived meaning. See [`../docs/audits/historical-linkage-archive-audit-2026-03-30.md`](../docs/audits/historical-linkage-archive-audit-2026-03-30.md). |

## P2 — Later

| ✓ | Owner | Task | Notes |
|---|---|---|---|
| [ ] | 🤖 | Lazy-load context providers by route | Deferred M1 from the redundant-DB-calls audit (high-risk, standalone). See [`../docs/audits/redundant-db-calls-audit.md`](../docs/audits/redundant-db-calls-audit.md). |
| [ ] | 🤖 | Path-based shareable URLs | Move pages off `?view=...` query-string routing. Tracked in ROADMAP. |
| [ ] | 🧑 | Prioritize ROADMAP "Later/Backlog" | Product calls on multi-user UI, pluggable AI providers, journal questionnaires, dictation mode, native wrappers. See [`../ROADMAP.md`](../ROADMAP.md). |

---

## Done / archived

- ✅ Repo documentation standardization (README slimmed, `FEATURES.md` made canonical with status, `ROADMAP.md` + `docs/ai-features.md` added, Documentation Standards in `DOC_INDEX.md`).
- ✅ Repo-root declutter (audits → `docs/audits/`, plans/PR descriptions → `docs/archive/root/`, scratch scripts removed).
- ✅ Redundant DB-calls performance audit — Phases 1–3 mostly complete; full record preserved in [`../docs/audits/redundant-db-calls-audit.md`](../docs/audits/redundant-db-calls-audit.md) (only the lazy-load context refactor remains; see P2 above).
