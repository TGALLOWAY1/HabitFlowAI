# Architecture

## System Overview

HabitFlow is a TypeScript monorepo-style app with:

- Frontend: `React + Vite` (`src/`)
- Backend API: `Express` (`src/server/`)
- Persistence: `MongoDB`

The frontend and API are run separately in development (`npm run dev` + `npm run dev:server`).

## Frontend

Key areas:

- App shell and custom view router: `src/App.tsx`
- Global layout/header: `src/components/Layout.tsx`
- Core state for habits/categories/logs: `src/store/HabitContext.tsx`
- Feature pages: `src/pages/**`
- Domain utilities: `src/domain/**`, `src/utils/**`
- API client: `src/lib/persistenceClient.ts`

Routing model is query-string based (`?view=...`) plus additive path handling for dedicated pages.

## Backend

Entry point:

- `src/server/index.ts`

Layers:

- Routes: `src/server/routes/**`
- Repositories (Mongo data access): `src/server/repositories/**`
- Services (derived read logic): `src/server/services/**`
- Domain validators/contracts: `src/server/domain/**`
- Shared time/dayKey utilities: `src/domain/time/dayKey.ts`

## Persistence

MongoDB collections are defined in `src/models/persistenceTypes.ts` (`MONGO_COLLECTIONS`).

Behavioral truth boundary:

- Canonical truth object: `HabitEntry` in `habitEntries` collection.
- Derived/compatibility surface: `dayLogs` still exists but is non-canonical.

## Canonical Data Flow (Behavior)

1. User logs behavior via frontend action.
2. Frontend writes `HabitEntry` through `/api/entries`.
3. Backend validates dayKey/timezone and forbidden stored-completion fields.
4. Derived views (day view/progress/dashboard) are computed from entries at read time.

## Reliability Notes

- Soft-delete patterns are used on truth records (`deletedAt`).
- DayKey is treated as the aggregation boundary; timezone normalization is applied at write boundary.
- Feature flags/environment are loaded early via `src/server/config/env.ts` and `src/server/config/index.ts`.
