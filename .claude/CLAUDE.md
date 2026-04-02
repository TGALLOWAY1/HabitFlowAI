# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HabitFlowAI is a full-stack habit-tracking web app — TypeScript monorepo (ESM, `"type": "module"`) with React 19 + Vite frontend and Express 5 backend, backed by MongoDB. Tracks habits, routines, goals, journal entries, wellbeing, and tasks.

## Commands

```bash
npm run dev            # Start frontend (port 5176) + backend (port 3001) concurrently
npm run dev:vite       # Frontend only
npm run dev:server     # Backend only
npm run build          # TypeScript typecheck (tsc -b) + Vite build
npm run lint           # ESLint full project
npm run lint:beta      # ESLint server/shared/domain only (CI scope)
npm run test           # Vitest in watch mode
npm run test:run       # Vitest single run (all tests)
npm run test:beta      # CI beta test suite (critical subset)
npm run verify         # Full validation script
```

### Running a single test

```bash
npx vitest run path/to/file.test.ts          # Run one test file
npx vitest run --testNamePattern "pattern"    # Run tests matching name pattern
npx vitest run src/server/routes/__tests__/   # Run all tests in a directory
```

## Architecture

### Key Invariant: Entries Are Truth

**`habitEntries` is the single source of truth.** All derived views (day view, progress, streaks, goal progress) are computed from entries at read time — never stored. If you need to add a new metric or view, derive it from entries, don't create a new collection.

**Removed collections** (do NOT reference): `dayLogs`, `goalManualLogs`.

| Domain | Collection | Role |
|--------|-----------|------|
| Behavioral | `habitEntries` | **Canonical truth** — all derived views computed from this |
| Reflective | `journalEntries` | Journal entries |
| Wellbeing | `wellbeingEntries` | Canonical wellbeing truth (replaces legacy `wellbeingLogs`) |
| Derived (not stored) | — | Day view, day summary, progress, streaks, goal progress |

### Backend Layers

```
src/server/
├── routes/          # HTTP handlers + input validation (22 files)
├── services/        # Derived read logic, business rules
├── repositories/    # MongoDB data access
├── domain/          # Canonical validators, contracts
├── middleware/       # Identity, auth, rate limiting
├── config/          # Env loading, feature flags
├── utils/           # dayKey, normalization utilities
├── app.ts           # Express app factory (createApp)
└── index.ts         # Entry point
```

### Frontend Architecture

- **Routing:** Query-string based (`?view=...`) via `src/App.tsx`, plus path-based for dedicated pages
- **State:** React Context — `HabitContext`, `AuthContext`, `RoutineContext`, `TaskContext`
- **API Client:** `src/lib/persistenceClient.ts`
- **Styling:** Tailwind CSS 3 with dynamic color safe-list
- **Dev proxy:** Vite forwards `/api` requests to `http://localhost:3001`

### Shared & Domain Layers

- **`src/shared/`** — Code used by both frontend and backend: persona definitions, persona invariants, demo config
- **`src/domain/`** — Domain primitives (e.g., `domain/time/` for timezone/DayKey utilities)

### Identity Model

Every API request requires `X-Household-Id` and `X-User-Id` headers. In dev/test, bootstrap defaults are used when headers are missing. In production, missing headers = 401. All data access is scoped by userId.

Middleware: `src/server/middleware/identity.ts`

### DayKey Policy

DayKey = `YYYY-MM-DD`, computed in a timezone (not UTC). Server uses client's IANA timezone if valid, falls back to **America/New_York**. DayKey is the aggregation boundary for all date-based queries.

Server authority: `src/server/utils/dayKey.ts` and `src/server/utils/dayKeyNormalization.ts`

### Canonical Data Flow

1. User action -> Frontend writes `HabitEntry` via `/api/entries`
2. Backend validates dayKey/timezone, forbids stored-completion fields
3. Derived views computed from entries at read time
4. Soft-delete pattern: `deletedAt` timestamp (not hard delete)

## CI/CD

GitHub Actions (`ci-beta.yml`) on push/PR to main:
1. `npm ci` (Node 20)
2. `npm run build`
3. `npm run test:beta`
4. `npm run lint:beta`

Deployment: Render (backend via `render.yaml`) + Vercel (frontend via `vercel.json`).

## Testing

- **Vitest** + JSDOM (frontend) + Supertest (API)
- **mongodb-memory-server** by default — tests don't touch real DB
- Live DB testing: set `ALLOW_LIVE_DB_TESTS=true` with DB name containing `_test`
- Test helpers: `src/test/mongoTestHelper.ts`, `src/test/assertTestDb.ts`
- Setup file: `src/test/setup.ts`

## Code Style

- TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters` enabled), ESLint 9 flat config
- **Beta gate** (CI-enforced on `src/server/`, `src/shared/`, `src/domain/`, excludes `__tests__/`): `no-unused-vars` is error (except `_`-prefixed), `no-explicit-any` is warning
- Unused variables/parameters: prefix with `_`
- Soft deletes via `deletedAt` field — never hard delete truth records

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes.
- **Minimal Impact**: Changes should only touch what's necessary.
- **Concrete Impact Examples**: When describing bugs, fixes, or behavioral changes, include a concrete example showing the before/after impact with real numbers. Example: "A weekly habit previously showed ~14% completion rate (1/7 days). Now correctly shows 100% (1/1 week)." This makes the impact immediately understandable and helps reviewers assess severity.

## Documentation

Full documentation index at `docs/DOC_INDEX.md`. Key references:
- `docs/ARCHITECTURE.md` — System design, identity, DayKey, truth ownership
- `docs/DOMAIN_CANON.md` — Minimal invariants & canonical references
- `docs/API.md` — REST endpoint inventory
- `docs/DATA_MODEL.md` — Collections & ownership boundaries
- `docs/product/HABITFLOW_UI_ARCHITECTURE.md` — UI screens, navigation, and user flows

Any PR that changes screens, navigation, modals, or major user flows must update `docs/product/HABITFLOW_UI_ARCHITECTURE.md`.
UI changes are not complete until the UI architecture document is updated.

Any change to features, goal types, bundle behavior, AI capabilities, Apple Health integration, or habit tracking types must also update the "How HabitFlow Works" modal (`src/components/InfoModal.tsx`). This modal is the user-facing reference for how the app works — it must stay in sync with actual functionality. Specifically:
- Adding/removing a goal type → update the Goal Types section in the Advanced tab
- Adding/removing AI features → update the AI tab
- Changing bundle behavior (membership rules, conversion rules) → update the Habit Bundles section
- Adding/removing Apple Health metrics or rules → update the Health tab
- Adding/removing habit tracking types → update the Basics tab

## Workflow

- Enter plan mode for non-trivial tasks (3+ steps or architectural decisions)
- Use subagents for research, exploration, and parallel analysis
- After corrections from user: update `tasks/lessons.md` with the pattern
- Track work in `tasks/todo.md` with checkable items
- Never mark a task complete without verifying it works (run tests, check logs)
