# HabitFlowAI

[![CI Beta](https://github.com/TGALLOWAY1/HabitFlowAI/actions/workflows/ci-beta.yml/badge.svg)](https://github.com/TGALLOWAY1/HabitFlowAI/actions/workflows/ci-beta.yml)

> A full-stack habit, routine, goal, and journal tracker with a strict "entries are truth" data model and optional Gemini-powered AI reviews.

## Overview

HabitFlowAI is a personal habit-tracking system that unifies habits, multi-step routines, goals, journaling, and wellbeing check-ins in one app, with AI features (weekly reviews, journal reflections) grounded in the user's own data. It is a solo-built portfolio project: React 19 + Vite frontend, Express 5 + MongoDB backend, all TypeScript.

## Why I built this

Most habit trackers either oversimplify (a single "did you do it?" toggle) or drown the user in disconnected screens for goals, routines, journals, and wellbeing. HabitFlowAI is an exercise in building one cohesive system where **every derived view — streaks, goal progress, weekly summaries, analytics — is computed from a single source of truth** (habit entries), so the numbers always reconcile and the data model stays simple as the feature surface grows.

## Key features

- Track **habits** (boolean or quantity) on a tracker grid, day view, or weekly schedule — with bundles, categories, streaks, and heatmaps.
- Build and run multi-step **routines** with timers, images, and AI-generated variant suggestions.
- Set **goals** (cumulative or one-time), link them to habits, and group them into ordered **goal tracks**.
- Keep a **journal** with 11 persona-driven templates plus free-write.
- Log **wellbeing** check-ins (anxiety, mood, energy, stress) and view them as heatmaps or weekly summaries.
- Sync selected **Apple Health** metrics to auto-log habits based on rules (beta, allowlisted).

Full feature inventory: [`docs/FEATURES.md`](docs/FEATURES.md). What's verified-real vs. planned: [`FEATURE_AUDIT.md`](FEATURE_AUDIT.md).

## AI features

AI features are **BYOK Gemini** (the user supplies their own key; it is stored client-side only and never persisted server-side) and generated on demand with no extra dependencies. Two are worth calling out as applied-LLM engineering:

- **Weekly AI Review** — turns a week of habit, sleep, mood, journal, and goal data into a grounded, schema-constrained review (Summary · Wins · Struggles · Patterns w/ confidence · Recommendations · Data Limitations). The server owns the week boundaries and sends only DB-derived facts, never raw collections.
- **AI Journal Review** — turns journal entries over a chosen date range into a structured, explicitly non-clinical reflection aid (themes, stressors, wins, self-talk, reflection questions, next steps), grounded only in the user's own writing with confidence calibration and crisis-safe handling.

Both deliberately separate **observed facts → inferred patterns → recommendations** so the model coaches without hallucinating. Design, data flow, grounding strategy, and the routes/contracts are documented in [`docs/ai-features.md`](docs/ai-features.md).

## Tech stack

- **Frontend:** React 19, Vite 7, TypeScript (strict), Tailwind CSS 3, Recharts, dnd-kit
- **Backend:** Express 5 (ESM TypeScript via tsx), MongoDB 7 driver, Helmet, express-rate-limit
- **AI:** Google Gemini (BYOK, client-supplied key)
- **Testing:** Vitest, Testing Library, Supertest, mongodb-memory-server
- **CI/CD:** GitHub Actions; Render (API) + Vercel (frontend)

## Architecture

```
┌─────────────────────┐        ┌───────────────────────┐        ┌──────────────┐
│  React 19 + Vite    │  /api  │  Express 5 (ESM TS)   │  mongo │   MongoDB    │
│  Tailwind, Contexts │ ─────▶ │  routes → services →  │ ─────▶ │ habitEntries │
│  persistenceClient  │        │  repositories          │        │ (truth only) │
└─────────────────────┘        └───────────────────────┘        └──────────────┘
         ▲                                │
         │                                ▼
    Vite proxy /api              Identity middleware
     → localhost:3001            (X-Household-Id, X-User-Id)
```

- **Single source of truth:** the `habitEntries` collection is the only behavioral truth. Day view, day summary, streaks, analytics, and goal progress are **derived at read time** — no completion caches, no manual goal logs. New metrics = new derivation, not new storage.
- **Timezone-aware DayKey:** day boundaries are computed in the client's IANA timezone (server falls back to `America/New_York`), not UTC, via a shared `dayKey` authority.
- **Identity-scoped from day one:** every API request carries `X-Household-Id` and `X-User-Id` headers; all repositories filter by userId. Production refuses unauthenticated requests.
- **CI-enforced beta gate:** a stricter lint + test subset runs against `src/server`, `src/shared`, and `src/domain` to keep the canonical layers clean without blocking fast-moving UI code.
- **Tests never touch a real DB:** the default Vitest config uses `mongodb-memory-server`; opting into a live DB requires `ALLOW_LIVE_DB_TESTS=true` **and** a DB name containing `_test`.

Layout: frontend in `src/` (Context state, query-string routing), backend in `src/server/` (`routes/` → `services/` → `repositories/`, `domain/` validators, `middleware/`), shared code in `src/shared/` and `src/domain/`. More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/DOMAIN_CANON.md`](docs/DOMAIN_CANON.md).

## Demo / review path

The fastest way to evaluate the project, no account needed:

1. **Take the interactive tour** — login screen → "Take the tour" (or `?view=tour`): a guided walkthrough of the live app with a Desktop/Mobile preview toggle, including the AI features.
2. **Explore the live demo** — the full app, read-only, on ~10 weeks of seeded realistic data (`/?demo=1`; requires `PUBLIC_DEMO_ENABLED=true` on the backend — see [`docs/DEMO_ARCHITECTURE.md`](docs/DEMO_ARCHITECTURE.md)).
3. **Review the main workflow** — tracker grid → day view → dashboard, watching streaks/progress derive from entries.
4. **Inspect the AI features** — Weekly AI Review and AI Journal Review design in [`docs/ai-features.md`](docs/ai-features.md); implementation in `src/server/routes/aiWeeklyReview.ts` and `aiJournalReview.ts`.
5. **Run the quality checks** — see [Quality checks](#quality-checks) below.
6. **Check honesty** — [`FEATURE_AUDIT.md`](FEATURE_AUDIT.md) is a code-verified list of what's implemented vs. partial vs. roadmap, so the tour and demo never overclaim.

API health check for the deployed backend: <https://habitflowai.onrender.com/api/health>

## Local setup

Prerequisites: **Node 20+** and a MongoDB instance (local or Atlas).

```bash
git clone https://github.com/tgalloway1/habitflowai.git
cd habitflowai
npm install

cp .env.example .env   # then set MONGODB_URI and MONGODB_DB_NAME

npm run dev            # Starts API (:3001) + frontend (:5176) concurrently
```

Then open <http://localhost:5176>. The Vite dev server proxies `/api` to `http://localhost:3001`.

**Troubleshooting:** if `/api/*` returns 404, the API likely failed to start — check the terminal for a missing `MONGODB_URI` or a MongoDB connection error. More in [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md).

## Environment variables

Copy [`.env.example`](.env.example) to `.env`. Only the Mongo variables are required for local dev.

| Variable                | Required          | Purpose                                                                                          |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`           | **yes**           | MongoDB connection string (local or Atlas).                                                      |
| `MONGODB_DB_NAME`       | **yes**           | Database name. Use something containing `_test` when running live integration tests.            |
| `PORT`                  | no (default 3001) | API server port.                                                                                 |
| `NODE_ENV`              | no                | `development` \| `production`. Production enforces auth headers and restricts CORS.              |
| `FRONTEND_ORIGIN`       | prod only         | Allowed CORS origin for the deployed frontend.                                                   |
| `BOOTSTRAP_ADMIN_KEY`   | prod only         | Shared secret for the bootstrap admin endpoint.                                                  |
| `PUBLIC_DEMO_ENABLED`   | no                | Set to `true` to enable the public read-only demo (`/?demo=1`).                                 |
| `DEMO_MODE_ENABLED`     | no                | Dev-only demo seeding mode; see `docs/DEMO_ARCHITECTURE.md`.                                     |
| `ALLOW_LIVE_DB_TESTS`   | no                | Set to `true` **and** use a DB name containing `_test` to run tests against a real MongoDB.     |

The **Gemini API key** for AI features is **not** an env var — it is entered in Settings and stored in `localStorage` only (BYOK, never persisted server-side).

## Quality checks

```bash
npm run check          # typecheck + lint + tests + build (the full gate)
npm run build          # tsc -b + vite build — the exact gate Vercel uses
npm run typecheck      # tsc -b only
npm run lint           # Full ESLint
npm run test:run       # Full Vitest run (in-memory MongoDB)
npm run verify         # typecheck + lint + full test suite (CI-like shell script)
npm run test:beta      # CI beta test subset
npm run lint:beta      # CI beta lint scope (server/shared/domain)
```

There is no `format` script — the repo does not use Prettier; formatting is enforced only
through ESLint rules.

CI (`.github/workflows/ci-beta.yml`) runs `build`, `test:beta`, and `lint:beta` on every push/PR to `main`.

## Deployment overview

- **Backend → Render** (see `render.yaml`): Node web service, health check `/api/health`. Requires `MONGODB_URI`, `MONGODB_DB_NAME`, `FRONTEND_ORIGIN`, `BOOTSTRAP_ADMIN_KEY`.
- **Frontend → Vercel** (see `vercel.json`): static build via `npm run build`, with `/api/*` rewritten to the Render backend.

## Known limitations

- **Single-user focus in practice.** The identity model supports households + multiple users, but there is no account invite/sharing UI yet.
- **AI features are BYOK Gemini only.** No server-side key, no OpenAI/Anthropic provider support yet.
- **Apple Health is beta and allowlisted** — available only to email-allowlisted users and requires an external sync bridge.
- **No native mobile app.** Responsive web only (bottom tab bar on small screens).
- **Query-string routing** on the frontend means some pages don't have clean shareable URLs yet.
- **Historical linkage/archive remediation is still open** — see [`docs/audits/historical-linkage-archive-audit-2026-03-30.md`](docs/audits/historical-linkage-archive-audit-2026-03-30.md).

## Roadmap

Prioritized upcoming work lives in [`ROADMAP.md`](ROADMAP.md) — near-term: analytics page migration, historical-linkage remediation, path-based URLs; later: multi-user household UI, pluggable AI providers.

## Project docs

- [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md) — full documentation map and standards
- [`docs/FEATURES.md`](docs/FEATURES.md) — canonical feature inventory with status
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, identity, DayKey, truth ownership
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — collections and ownership boundaries
- [`docs/ai-features.md`](docs/ai-features.md) — applied-AI design and data flow
- [`docs/repo-cleanup-audit.md`](docs/repo-cleanup-audit.md) — repository cleanup audit trail
- [`ROADMAP.md`](ROADMAP.md) / [`CHANGELOG.md`](CHANGELOG.md) — future work / milestones
