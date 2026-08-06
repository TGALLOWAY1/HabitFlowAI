# API

Base URL: `/api`

## Auth / Context

- User identity is passed via `X-User-Id` header (middleware in `src/server/middleware/auth.ts`).
- CORS is configured in `src/server/index.ts`.

### Auth Endpoints

All under `/api/auth`. Public endpoints (login, invite redeem, forgot-password,
reset-password, bootstrap-admin) are rate-limited via `authRateLimiter`.

- `POST /auth/invite/redeem` — `{ inviteCode, email, password, displayName }` → creates user + session, sets `hf_session` cookie.
- `POST /auth/login` — `{ email, password }` → sets `hf_session` cookie.
- `POST /auth/logout` — clears the session cookie and invalidates the server session.
- `GET  /auth/me` — current user `{ householdId, userId, email, displayName, role }`; 401 without a session.
- `POST /auth/bootstrap-admin` — one-time admin bootstrap behind `BOOTSTRAP_ADMIN_KEY`.
- `POST /auth/forgot-password` — `{ email }` → always returns `{ ok: true }`. If the email matches a user, emails a single-use reset link valid for 15 minutes.
- `POST /auth/reset-password` — `{ token, newPassword }` → updates the user's password, marks the token used, and invalidates all active sessions for that user.

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

Habit create/PATCH accept `reminderTime` (24h `"HH:mm"`; `null` clears) and `reminderEnabled` (boolean; absent = enabled when a time is set) for Web Push reminders.

## Push Notifications (Web Push Reminders)

- `GET /push/public-key` — `{ enabled, publicKey }`; `enabled: false` when `PUSH_REMINDERS_ENABLED`/VAPID keys are not configured (clients hide push UI)
- `POST /push/subscriptions` — body `{ subscription: { endpoint, keys: { p256dh, auth } }, timeZone, userAgent? }`; idempotent per-device upsert (refreshes keys/timezone/lastSeenAt, revives disabled endpoints); `501 PUSH_DISABLED` when unconfigured
- `DELETE /push/subscriptions` — body `{ endpoint }` → `{ deleted }`
- `POST /push/test` — sends a test notification to the caller's active devices → `{ sent, gone, errors }`; endpoints reported gone (404/410) are disabled

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
- `POST /goals/:id/badge`
- `GET /goals/:id`
- `PUT /goals/:id`
- `DELETE /goals/:id`
- `POST /goals/:id/milestones/:milestoneId/acknowledge`

### Lifecycle Status

POST/PUT bodies accept an optional `status` (`'active' | 'scheduled' | 'backlog'`; absent/null = active) and, only when `status === 'scheduled'`, an optional `startDate` (`YYYY-MM-DD`). Sending `startDate` with any other status is a 400. Moving a goal out of `scheduled` clears its `startDate` server-side. Tracked goals (with `trackId`) reject status changes — their lifecycle is governed by `trackStatus` — though re-sending the unchanged value is tolerated (edit-modal round-trips).

Auto-activation happens at read time: `GET /goals` and `GET /goals-with-progress` promote any standalone scheduled goal whose `startDate` has arrived (per the request's `timeZone` query param, falling back to the server default) to `status: 'active'` and persist the change before responding.

### Milestones

Cumulative goals may declare intermediate stages via the optional `milestones` field on POST/PUT bodies. Each entry: `{ value: number }` (server assigns `id`). Constraints: positive number, unique, strictly less than `targetValue`, max 20 entries, only valid when `type === 'cumulative'`. Server normalizes to ascending order by `value`. PUT-replace preserves `acknowledgedAt` from existing milestones matched by `id`.

`GoalProgress` responses include a parallel `milestoneStates: MilestoneState[]` whose `completed` flag is derived from HabitEntries. The full-progress path also populates `completedAtDayKey` (the first dayKey at which the running cumulative crossed the milestone value).

`POST /goals/:id/milestones/:milestoneId/acknowledge` sets `acknowledgedAt = now` on the matching milestone. Idempotent: a second call preserves the original timestamp. Returns the updated goal. The frontend invokes this after the user dismisses a milestone celebration screen so the celebration does not replay.

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

## Apple Health Integration (Feature-Gated)

All endpoints require `requireHealthFeature` middleware (email whitelist).

### Health Data Sync

- `POST /health/apple/sync` — Sync daily health metrics (steps, calories, sleep, workouts, weight). Idempotent upsert. Triggers auto-log/suggest rule evaluation.

### Habit Health Rules

- `POST /habits/:habitId/health-rule` — Create health rule for a habit (one per habit)
- `GET /habits/:habitId/health-rule` — Get the active rule
- `PATCH /habits/:habitId/health-rule` — Update rule fields
- `DELETE /habits/:habitId/health-rule` — Deactivate rule (past entries preserved)
- `POST /habits/:habitId/health-rule/backfill` — Run backfill for qualifying days

### Health Suggestions

- `GET /health/suggestions` — Get pending suggestions
- `POST /health/suggestions/:id/accept` — Accept suggestion (creates HabitEntry)
- `POST /health/suggestions/:id/dismiss` — Dismiss suggestion

## Dev / Admin

- `POST /dev/seedDemoEmotionalWellbeing`
- `POST /dev/resetDemoEmotionalWellbeing`
- `POST /admin/migrations/backfill-daylogs`
- `GET /health`
