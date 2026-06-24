# HabitFlowAI

> A full-stack habit, routine, goal, and journal tracker with a strict "entries are truth" data model and optional Gemini-powered AI summaries.

<!-- TODO: add hero screenshot or animated GIF of the dashboard here.
     Suggested: `docs/assets/hero.gif` showing the tracker grid + a habit being
     toggled, plus the daily completion ring updating. -->

![Hero placeholder](public/icon-512.png)

## Why this project exists

Most habit trackers either oversimplify (a single "did you do it?" toggle) or drown the user in disconnected screens for goals, routines, journals, and wellbeing. HabitFlowAI is a personal project to build one cohesive system where **every derived view — streaks, goal progress, weekly summaries, analytics — is computed from a single source of truth** (habit entries), so the numbers always reconcile and the data model stays simple as the feature surface grows.

## What it does

HabitFlowAI lets you:

- Track **habits** (boolean or quantity) on a tracker grid, day view, or weekly schedule.
- Build and run multi-step **routines** with timers, images, and AI-generated variant suggestions.
- Set **goals** (cumulative or one-time), link them to habits, and group them into ordered **goal tracks**.
- Keep a **journal** with 11 persona-driven templates plus free-write, with optional AI weekly summaries.
- Log **wellbeing** check-ins (anxiety, mood, energy, stress) and view them as heatmaps or weekly summaries.
- Sync selected **Apple Health** metrics to auto-log habits based on rules (beta).
- Get **AI weekly recaps** via your own Gemini API key (BYOK, stored client-side only).
- Generate a **Weekly AI Review** — a grounded, structured review (Summary / Wins / Struggles / Patterns with confidence / Recommendations / Data Limitations) built from your real habit, sleep, mood, journal, and goal data.

Full feature inventory: [`docs/FEATURES.md`](docs/FEATURES.md).

## Why it is technically interesting

- **Single source of truth:** The `habitEntries` collection is the only behavioral truth. Day view, day summary, streaks, analytics, and goal progress are **derived at read time** — there are no DayLogs, no manual goal logs, no completion caches. New metrics = new derivation, not new storage.
- **Timezone-aware DayKey:** Day boundaries are computed in the client's IANA timezone (server falls back to `America/New_York`), not UTC. All date-range reads use a shared `dayKey` authority so "today" means the same thing in every view.
- **Identity-scoped multi-tenant from day one:** Every API request carries `X-Household-Id` and `X-User-Id` headers; all repositories filter by userId. Production refuses unauthenticated requests.
- **CI-enforced beta gate:** A narrower lint + test suite runs against `src/server`, `src/shared`, and `src/domain` to keep the canonical layers clean without blocking the fast-moving UI code.
- **Tests never touch a real DB:** The default Vitest config uses `mongodb-memory-server`; opting into a live DB requires `ALLOW_LIVE_DB_TESTS=true` **and** a DB name containing `_test`.

## Applied AI

AI features are **BYOK Gemini** (the user supplies their own key; it is stored client-side only
and never persisted server-side) and generated on demand with no extra dependencies. Two are
worth calling out as applied-LLM engineering:

- **Weekly AI Review** — turns a week of habit, sleep, mood, journal, and goal data into a grounded,
  schema-constrained review (Summary · Wins · Struggles · Patterns w/ confidence · Recommendations ·
  Data Limitations). The server owns the week boundaries and sends only DB-derived facts, never raw
  collections.
- **AI Journal Review** — turns journal entries over a chosen date range into a structured, explicitly
  non-clinical reflection aid (themes, stressors, wins, self-talk, reflection questions, next steps),
  grounded only in the user's own writing with confidence calibration and crisis-safe handling.

Both deliberately separate **observed facts → inferred patterns → recommendations** so the model
coaches without hallucinating. Design, data flow, grounding strategy, and the routes/contracts are
documented in [`docs/ai-features.md`](docs/ai-features.md).

## Architecture overview

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

- **Frontend** (`src/`): React 19 + Vite, Tailwind CSS 3, Context-based state (`HabitContext`, `AuthContext`, `RoutineContext`, `TaskContext`), query-string routing.
- **Backend** (`src/server/`): Express 5 as an ESM TypeScript app, split into `routes/`, `services/` (derived reads), `repositories/` (Mongo access), `domain/` (validators), and `middleware/`.
- **Shared** (`src/shared/`, `src/domain/`): Code used by both sides — persona definitions, DayKey utilities, invariants.
- **Persistence:** MongoDB collections defined in `src/models/persistenceTypes.ts`. Soft deletes via `deletedAt`.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/DOMAIN_CANON.md`](docs/DOMAIN_CANON.md).

The full, status-tagged feature inventory is in [`docs/FEATURES.md`](docs/FEATURES.md).

## Demo / live link

- **Frontend:** <!-- TODO: add live Vercel URL here (vercel.json points the API at habitflowai.onrender.com) -->
- **API health check:** <https://habitflowai.onrender.com/api/health>

## Local setup

Prerequisites: **Node 20+** and a MongoDB instance (local or Atlas).

```bash
git clone https://github.com/tgalloway1/habitflowai.git
cd habitflowai
npm install

# Create .env (see "Environment variables" below)
cp .env.example .env   # TODO: add a .env.example to the repo if one doesn't exist

npm run dev            # Starts API (:3001) + frontend (:5176) concurrently
```

Then open <http://localhost:5176>. The Vite dev server proxies `/api` to `http://localhost:3001`.

Other useful commands:

```bash
npm run dev:vite       # Frontend only (if the API is running elsewhere)
npm run dev:server     # Backend only
npm run build          # tsc -b + vite build (the exact gate Vercel uses)
npm run test:run       # Full Vitest run (in-memory MongoDB)
npm run test:beta      # CI beta subset
npm run lint           # Full ESLint
npm run lint:beta      # CI beta lint scope
npm run verify         # Full validation script
```

**Troubleshooting:** If `/api/*` returns 404, the API likely failed to start — check the terminal for missing `MONGODB_URI` or a MongoDB connection error.

## Environment variables

Create a `.env` in the project root. Only the Mongo variables are required for local dev.

| Variable                | Required          | Purpose                                                                                          |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`           | **yes**           | MongoDB connection string (local or Atlas).                                                      |
| `MONGODB_DB_NAME`       | **yes**           | Database name. Use something containing `_test` when running live integration tests.            |
| `PORT`                  | no (default 3001) | API server port.                                                                                 |
| `NODE_ENV`              | no                | `development` \| `production`. Production enforces auth headers and restricts CORS.              |
| `FRONTEND_ORIGIN`       | prod only         | Allowed CORS origin for the deployed frontend. Also used as the host for password-reset links when `APP_BASE_URL` is unset. |
| `BOOTSTRAP_ADMIN_KEY`   | prod only         | Shared secret for the bootstrap admin endpoint.                                                  |
| `RESEND_API_KEY`        | prod (email)      | [Resend](https://resend.com) API key. **Without it no password-reset email is sent** — the link is only logged to the server console. |
| `EMAIL_FROM`            | no                | Sender for transactional email (default `HabitFlow <noreply@habitflow.ai>`). Must be a Resend-verified domain. |
| `APP_BASE_URL`          | no                | Explicit public origin for password-reset links (e.g. `https://app.example.com`). Overrides `FRONTEND_ORIGIN`; falls back to the request origin in local dev. |
| `ALLOW_LIVE_DB_TESTS`   | no                | Set to `true` **and** use a DB name containing `_test` to run tests against a real MongoDB.     |

The **Gemini API key** for AI features is **not** an env var — it is entered in Settings and stored in `localStorage` only (BYOK, never persisted server-side).

## Deployment overview

- **Backend → Render** (see `render.yaml`): Node web service, `npm install` build, `npm start`, health check `/api/health`. Requires `MONGODB_URI`, `MONGODB_DB_NAME`, `FRONTEND_ORIGIN`, `BOOTSTRAP_ADMIN_KEY` as env vars. Set `RESEND_API_KEY` (and optionally `EMAIL_FROM`) to enable password-reset emails.
- **Frontend → Vercel** (see `vercel.json`): Static build via `npm run build`, with `/api/*` rewritten to `https://habitflowai.onrender.com/api/*`. All other paths fall back to `index.html` so deep links like `/reset-password` load the SPA.
- **CI → GitHub Actions** (`.github/workflows/ci-beta.yml`): on push/PR to `main`, runs `npm ci`, `npm run build`, `npm run test:beta`, `npm run lint:beta` on Node 20.

## Screenshots

<!-- TODO: replace these placeholders with current screenshots. Suggested shots:
     1. Dashboard with daily ring + pinned goals + AI weekly card
     2. Tracker grid showing categories and bundles
     3. Goal detail with cumulative chart and trend line
     4. Routine runner mid-step with timer
     5. Wellbeing heatmap
     6. Journal template in "Deep" mode
-->

| Dashboard | Tracker Grid | Goal Detail |
| --- | --- | --- |
| _TODO_ | _TODO_ | _TODO_ |

| Routine Runner | Wellbeing Heatmap | Journal Template |
| --- | --- | --- |
| _TODO_ | _TODO_ | _TODO_ |

## Limitations

- **Single-user focus in practice.** The identity model supports households + multiple users, but there is no account invite/sharing UI yet.
- **AI features are BYOK Gemini only.** No server-side key, no OpenAI/Anthropic provider support.
- **Apple Health is beta and allowlisted** — available only to email-allowlisted users and requires an external sync bridge.
- **No native mobile app.** Responsive web only (bottom tab bar on small screens).
- **Query-string routing** on the frontend means some pages don't have clean shareable URLs yet.
- **Historical linkage/archive remediation is still open** — see [`docs/audits/historical-linkage-archive-audit-2026-03-30.md`](docs/audits/historical-linkage-archive-audit-2026-03-30.md).

## Future work

Prioritized upcoming work lives in [`ROADMAP.md`](ROADMAP.md) (near-term, later, and backlog).

## Project docs

- [`docs/FEATURES.md`](docs/FEATURES.md) — canonical feature inventory with status
- [`ROADMAP.md`](ROADMAP.md) — prioritized upcoming work
- [`CHANGELOG.md`](CHANGELOG.md) — core milestones over time
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, identity, DayKey, truth ownership
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — collections and ownership boundaries
- [`docs/ai-features.md`](docs/ai-features.md) — applied-AI design and data flow
- [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md) — full documentation map and standards

---

Canonical project docs live in [`docs/DOC_INDEX.md`](docs/DOC_INDEX.md). Contributions and issues welcome.
