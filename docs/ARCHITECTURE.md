# Architecture

## System Overview

HabitFlow is a TypeScript monorepo-style app with:

- **Frontend:** React + Vite (`src/`)
- **Backend API:** Express (`src/server/`)
- **Persistence:** MongoDB

The frontend and API are run separately in development (`npm run dev` + `npm run dev:server`).

## Current Architecture (Post–M6)

### Behavioral truth: HabitEntries only

- **Canonical truth** for habit completion is the **`habitEntries`** collection only. Day view, day summary, streaks, and goal progress are **derived at read time** from entries.
- **DayLogs have been removed.** There is no DayLog collection, no `/api/dayLogs` routes, and no derived DayLog cache. Do not reference DayLogs in new code or docs.
- **Manual goal logs have been removed.** Goal progress is entries-derived only.

### Identity model (householdId / userId scoping)

- **Headers:** `X-Household-Id` and `X-User-Id` identify the request. Set by the client on every API request.
- **Middleware:** `identityMiddleware` (`src/server/middleware/identity.ts`) attaches `req.householdId` and `req.userId`. In **production**, both headers are required; missing headers yield **401**. In **development/test**, bootstrap defaults are used when headers are missing.
- **Scoping:** All data access (categories, habits, entries, goals, routines, journal, etc.) is scoped by this identity. Repositories and services filter by `userId` (and where implemented, `householdId`).
- **Details:** See `docs/audits/m5_identity_map.md` for a full map of routes and repos.

### DayKey policy (timezone-aware)

- **DayKey** is the canonical calendar-day identifier: `YYYY-MM-DD`. It is computed in a **timezone**; the same UTC instant can yield different dayKeys in different zones.
- **Server authority:** `src/server/utils/dayKey.ts` and `src/server/utils/dayKeyNormalization.ts`. All HabitEntry write and date-range read endpoints use these so day boundaries are consistent.
- **Timezone:** If the client sends a valid IANA timezone (e.g. `America/Los_Angeles`, `UTC`), the server uses it. If the client **omits** or sends an **invalid** timezone, the server uses **America/New_York** (no UTC fallback for day boundaries).
- **Details:** See `docs/semantics/daykey.md`.

## Frontend

Key areas:

- App shell and custom view router: `src/App.tsx`
- Global layout/header: `src/components/Layout.tsx`
- Core state for habits/categories/logs: `src/store/HabitContext.tsx`
- Feature pages: `src/pages/**`
- Domain utilities: `src/domain/**`, `src/utils/**`
- API client: `src/lib/persistenceClient.ts`

Routing is query-string based (`?view=...`) plus path-based routes for dedicated pages.

## Backend

- **Entry point:** `src/server/index.ts` (uses `createApp()` from `src/server/app.ts`).
- **Layers:**
  - Routes: `src/server/routes/**`
  - Repositories (Mongo data access): `src/server/repositories/**`
  - Services (derived read logic): `src/server/services/**`
  - Domain validators/contracts: `src/server/domain/**`
  - Shared time/dayKey: `src/domain/time/dayKey.ts`, `src/server/utils/dayKey.ts`

## Persistence

MongoDB collections are defined in `src/models/persistenceTypes.ts` (`MONGO_COLLECTIONS`). Behavioral truth is **only** in `habitEntries`; day summary, day view, and progress are derived from entries at read time.

## Canonical Data Flow

1. User logs behavior via frontend action.
2. Frontend writes `HabitEntry` through `/api/entries` (or batch/upsert/delete endpoints).
3. Backend validates dayKey/timezone and forbids stored-completion fields.
4. Derived views (day view, progress, dashboard) are computed from entries at read time.

## Reliability Notes

- Soft-delete patterns are used on truth records (`deletedAt`).
- DayKey is the aggregation boundary; timezone normalization is applied at the write boundary.
- Feature flags and environment are loaded early via `src/server/config/env.ts` and `src/server/config/index.ts`.
- Dev-only routes (`/api/debug/*`, `/api/dev/*`) are not registered when `NODE_ENV=production`.
