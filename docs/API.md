# API

Base URL: `/api`

## Auth / Context

- User identity is passed via `X-User-Id` header (middleware in `src/server/middleware/auth.ts`).
- CORS is configured in `src/server/index.ts`.

## Categories

- `GET /categories`
- `POST /categories`
- `PATCH /categories/reorder`
- `GET /categories/:id`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

## Habits

- `GET /habits`
- `POST /habits`
- `PATCH /habits/reorder`
- `GET /habits/:id`
- `PATCH /habits/:id`
- `DELETE /habits/:id`

## Habit Entries (Canonical Behavioral Truth)

- `GET /entries`
- `POST /entries`
- `PUT /entries`
- `PATCH /entries/:id`
- `DELETE /entries/:id`
- `DELETE /entries`
- `DELETE /entries/key`

## Day View / Progress

- `GET /dayView`
- `GET /progress/overview`

## Day Logs (Legacy/Derived Compatibility)

- `GET /dayLogs`
- `POST /dayLogs`
- `PUT /dayLogs`
- `GET /dayLogs/:habitId/:date`
- `DELETE /dayLogs/:habitId/:date`

## Routines

- `GET /routines`
- `POST /routines`
- `GET /routines/:id`
- `PATCH /routines/:id`
- `DELETE /routines/:id`
- `POST /routines/:id/submit`
- `POST /routines/:routineId/image`
- `GET /routines/:routineId/image`
- `DELETE /routines/:routineId/image`

## Routine Logs

- `GET /routineLogs`

## Goals

- `GET /goals`
- `GET /goals/completed`
- `GET /goals-with-progress`
- `POST /goals`
- `PATCH /goals/reorder`
- `GET /goals/:id/progress`
- `GET /goals/:id/detail`
- `POST /goals/:id/manual-logs`
- `GET /goals/:id/manual-logs`
- `POST /goals/:id/badge`
- `GET /goals/:id`
- `PUT /goals/:id`
- `DELETE /goals/:id`

## Journal

- `GET /journal`
- `POST /journal`
- `PUT /journal/byKey`
- `GET /journal/:id`
- `PATCH /journal/:id`
- `DELETE /journal/:id`

## Wellbeing

- `GET /wellbeingEntries`
- `POST /wellbeingEntries`
- `DELETE /wellbeingEntries/:id`
- `GET /wellbeingLogs`
- `POST /wellbeingLogs`
- `PUT /wellbeingLogs`
- `GET /wellbeingLogs/:date`
- `DELETE /wellbeingLogs/:date`

## Dashboard Preferences (View-only User Prefs)

- `GET /dashboardPrefs`
- `PUT /dashboardPrefs`

## Tasks

- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`

## Skill Tree

- Routes mounted at `GET/POST ... /skill-tree` via `src/server/routes/skillTree.ts`.

## Dev / Admin

- `POST /dev/seedDemoEmotionalWellbeing`
- `POST /dev/resetDemoEmotionalWellbeing`
- `POST /admin/migrations/backfill-daylogs`
- `GET /health`
