# HabitFlowAI — CLAUDE.md

## Project Overview

HabitFlowAI is a full-stack habit-tracking web application built as a TypeScript monorepo with a React frontend and Express backend, backed by MongoDB. It tracks habits, routines, goals, journal entries, wellbeing, and tasks — all derived from canonical entry data.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript 5.9, Tailwind CSS 3 |
| Backend | Express 5, TypeScript 5.9 |
| Database | MongoDB 7 (driver), mongodb-memory-server (tests) |
| Testing | Vitest, Testing Library, Supertest |
| Linting | ESLint 9 (flat config) + TypeScript ESLint |
| Icons | Lucide React |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Date Utils | date-fns |
| Auth | bcrypt, cookie-parser |
| Security | Helmet, express-rate-limit |

## Repository Structure

```
src/
├── server/              # Express API backend
│   ├── index.ts         # Entry point (uses createApp from app.ts)
│   ├── app.ts           # Express app factory
│   ├── routes/          # API route handlers (22 files)
│   ├── repositories/    # MongoDB data access layer
│   ├── services/        # Derived read logic / business rules
│   ├── domain/          # Canonical validators
│   ├── middleware/       # Identity, auth, rate limiting
│   ├── config/          # Env loading, feature flags
│   └── utils/           # Server utilities (dayKey, normalization)
├── components/          # React components
├── pages/               # Page-level React components
├── store/               # React context (HabitContext, AuthContext, RoutineContext)
├── context/             # Additional context providers (TaskContext)
├── hooks/               # Custom React hooks
├── api/                 # Frontend API client
├── lib/                 # Frontend libraries & persistence client
├── domain/              # Shared domain utilities (time, dayKey)
├── shared/              # Shared types/personas
├── models/              # Persistence type definitions (persistenceTypes.ts)
├── types/               # Frontend type definitions
├── utils/               # Frontend utilities
├── test/                # Test setup, mongo helpers
└── assets/              # Static assets
docs/                    # Comprehensive documentation (see docs/DOC_INDEX.md)
scripts/                 # Utility & seeding scripts
public/                  # Static assets, PWA manifest, service worker
tasks/                   # Task tracking (todo.md, lessons.md)
.github/workflows/       # CI/CD (ci-beta.yml)
```

## Quick Reference Commands

```bash
npm run dev          # Start frontend + backend concurrently
npm run dev:vite     # Frontend only (Vite on port 5176)
npm run dev:server   # Backend only (Express on port 3001)
npm run build        # TypeScript typecheck (tsc -b) + Vite build
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
npm run test:beta    # CI beta test suite (specific critical tests)
npm run lint         # ESLint full project
npm run lint:beta    # ESLint server/shared/domain only (CI scope)
npm run verify       # Run verification script
npm run check:invariants  # Validate data integrity invariants
npm run seed:emotion      # Seed emotion regulation demo data
npm run seed:fitness      # Seed fitness demo data
```

## CI/CD Pipeline

**GitHub Actions** (`ci-beta.yml`) runs on push/PR to main/master:
1. `npm ci` (Node 20)
2. `npm run build` (typecheck + vite build)
3. `npm run test:beta` (critical test subset)
4. `npm run lint:beta` (server/shared/domain linting)

**Deployment:** Render (backend via `render.yaml`) + Vercel (frontend via `vercel.json`).

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Data Integrity Invariant

**Habit entries are the single source of truth.** If everything else got deleted, the system must be fully reproducible from habit entries alone. This means:
- NEVER introduce caching that could cause displayed data to conflict with actual habit entries
- NEVER store derived/computed data that could drift from the entries
- All progress, streaks, goals, and completion states must be computable from entries on demand
- When optimizing DB calls: reduce redundant *reads* of the same data within a request, but never skip reading entries when freshness matters for the UI
- Frontend caches are acceptable only for reducing network calls, not as a substitute source of truth — always prefer a fresh read over a stale cache when data accuracy matters

### Truth Ownership

| Domain | Collection | Role |
|--------|-----------|------|
| Behavioral | `habitEntries` | **Canonical truth** — all derived views computed from this |
| Reflective | `journalEntries` | Journal entries |
| Wellbeing | `wellbeingEntries` | Canonical wellbeing truth (replaces legacy `wellbeingLogs`) |
| Derived (not stored) | — | Day view, day summary, progress, streaks, goal progress |

**Removed collections** (do NOT reference in new code): `dayLogs`, `goalManualLogs`.

## Architecture

### Identity Model

- **Headers:** `X-Household-Id` and `X-User-Id` on every API request
- **Middleware:** `identityMiddleware` (`src/server/middleware/identity.ts`) attaches `req.householdId` and `req.userId`
- **Production:** Both headers required; missing = 401
- **Dev/Test:** Bootstrap defaults used when headers missing
- All data access is scoped by userId (and householdId where applicable)

### DayKey Policy (Timezone-Aware)

- **DayKey** = `YYYY-MM-DD`, computed in a timezone
- Server authority: `src/server/utils/dayKey.ts` and `src/server/utils/dayKeyNormalization.ts`
- If client sends valid IANA timezone, server uses it; otherwise falls back to **America/New_York** (not UTC)
- DayKey is the aggregation boundary for all date-based queries
- See `docs/semantics/daykey.md` for details

### Backend Layers

1. **Routes** (`src/server/routes/`) — HTTP handlers, input validation
2. **Services** (`src/server/services/`) — Derived read logic, business rules
3. **Repositories** (`src/server/repositories/`) — MongoDB data access
4. **Domain** (`src/server/domain/`) — Canonical validators, contracts
5. **Middleware** (`src/server/middleware/`) — Identity, auth

### Frontend Architecture

- **Routing:** Query-string based (`?view=...`) via `src/App.tsx`, plus path-based for dedicated pages
- **State:** React Context (`HabitContext`, `AuthContext`, `RoutineContext`, `TaskContext`)
- **API Client:** `src/lib/persistenceClient.ts`
- **Domain Utils:** `src/domain/`, `src/utils/`

### Canonical Data Flow

1. User logs behavior via frontend action
2. Frontend writes `HabitEntry` through `/api/entries`
3. Backend validates dayKey/timezone, forbids stored-completion fields
4. Derived views (day view, progress, dashboard) computed from entries at read time

## MongoDB Collections

Defined in `src/models/persistenceTypes.ts` (`MONGO_COLLECTIONS`):

`categories`, `habits`, `habitEntries`, `goals`, `routines`, `routineLogs`, `routineImages`, `journalEntries`, `wellbeingEntries`, `wellbeingLogs` (legacy), `dashboardPrefs`, `tasks`, `habitPotentialEvidence`

## API Routes

22 route files in `src/server/routes/`. Key endpoints:

- `GET /api/health` — Health check
- `POST /api/auth/login`, `/logout`, `/invite/redeem`, `/bootstrap-admin`
- `GET/POST/PATCH/DELETE /api/categories`, `/habits`, `/entries`, `/goals`, `/routines`, `/tasks`
- `GET /api/dayView` — Derived day data
- `GET /api/progress/overview` — Derived progress/streaks
- `POST /api/routines/:id/submit` — Routine completion
- `GET/POST /api/journal` — Journal entries
- Soft-delete pattern: `deletedAt` timestamp on truth records

## Testing

- **Framework:** Vitest + JSDOM (frontend), Supertest (API)
- **DB:** mongodb-memory-server by default; live DB with `ALLOW_LIVE_DB_TESTS=true` (requires `_test` in DB name)
- **Test helpers:** `src/test/mongoTestHelper.ts`, `src/test/assertTestDb.ts`
- **Key test files** (CI beta suite):
  - `entriesOnly.invariants.test.ts` — Canonical truth validation
  - `auth.identity.test.ts` — Identity/auth scoping
  - `goals.entriesDerived.test.ts` — Goal progress derivation
  - `routines.completion-guardrail.test.ts` — Routine submission validation
  - `habitEntryRepository.guardrails.test.ts` — Repository-level guardrails
  - `progress.overview.test.ts` — Progress endpoint
  - `noDayLogImports.test.ts` — Ensures DayLog references are gone

## Environment Variables

| Variable | Description | Required |
|----------|-----------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `MONGODB_DB_NAME` | Database name | Yes |
| `NODE_ENV` | `development`, `production`, `test` | No (defaults to dev) |
| `PORT` | API server port | No (default 3001) |
| `USE_MONGO_PERSISTENCE` | Enable MongoDB | No (default true) |
| `VITE_USE_MONGO_PERSISTENCE` | Frontend MongoDB flag | No (default true) |
| `VITE_API_BASE_URL` | API endpoint override | No |
| `FRONTEND_ORIGIN` | CORS origin (production) | Production only |
| `BOOTSTRAP_ADMIN_KEY` | Admin bootstrap key | Production only |
| `ALLOW_LIVE_DB_TESTS` | Enable live DB tests | No |

## Code Style & Conventions

- **TypeScript strict mode** throughout
- **ESLint flat config** with React Hooks and React Refresh plugins
- **Beta gate** (CI-enforced): `src/server/`, `src/shared/`, `src/domain/` have stricter rules
  - `@typescript-eslint/no-unused-vars`: error (except `_`-prefixed)
  - `@typescript-eslint/no-explicit-any`: warning
- **Soft deletes** via `deletedAt` field on canonical truth records
- **No stored derived data** — progress, streaks, completion are always computed from entries
- Unused variables/parameters: prefix with `_`
- Tailwind CSS for styling with dynamic color safe-list

## Documentation

Start with `docs/DOC_INDEX.md` for a full map. Key docs:

- `docs/ARCHITECTURE.md` — System design, identity, DayKey, truth ownership
- `docs/DOMAIN_CANON.md` — Minimal invariants & canonical references
- `docs/API.md` — REST endpoint inventory
- `docs/DATA_MODEL.md` — Collections & ownership boundaries
- `docs/DEV_GUIDE.md` — Setup, scripts, troubleshooting
- `docs/VERIFICATION.md` — Consistency/dashboard validation
- `docs/semantics/daykey.md` — DayKey & timezone policy

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections
