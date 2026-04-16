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

### Theming

Semantic-token design system in `src/theme/`:

- `palette.ts` — Single source of truth for light/dark color palettes (hex). Both themes share the same token keys.
- `cssVars.ts` — Emits CSS variables (as space-separated RGB triplets) from the palette at runtime. The Tailwind config consumes these via `rgb(var(--token) / <alpha-value>)` aliases (`bg-surface-1`, `text-content-muted`, `border-line-subtle`, `bg-accent`, etc.), so opacity modifiers keep working (`bg-surface-1/80`).
- `ThemeContext.tsx` — Provides `mode` (`'light' | 'dark' | 'system'`), `resolvedMode` (`'light' | 'dark'`), and `setMode`. Listens to `prefers-color-scheme` when `mode === 'system'`, applies `class="dark"` / `class="light"` to `<html>`, and updates `color-scheme`.
- `useThemeColors.ts` — Hook returning the active palette as hex; used by chart/SVG consumers (recharts, gradients) that need hex rather than Tailwind classes.
- `heatmap.ts` — Theme-aware `getHeatmapColor(intensity, mode)` replaces the old dark-only class-returning form.

A pre-hydration script in `index.html` applies the correct theme class to `<html>` before React boots, reading `localStorage['hf_theme_mode']` and falling back to `prefers-color-scheme` if the stored value is `'system'` (or to dark on any failure). The user's choice also persists on the server in `DashboardPrefs.themeMode` so it syncs across devices.

`scripts/check-theme-tokens.sh` is a lint guard that fails if raw `bg-neutral-600/700/800/900`, `bg-white/*`, or `border-white/*` classes appear in an allowlisted set of migrated directories. Expand the allowlist as more surfaces migrate.

Category colors (`bg-emerald-500`, `bg-blue-500`, ...) in `src/utils/categoryColors.ts` are data-encoding colors, NOT theme tokens — they stay visually distinct across modes.

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
