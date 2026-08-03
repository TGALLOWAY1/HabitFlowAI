# Task 10 — API Surface and Backend Suitability for a Native Client

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Complete endpoint inventory transcribed from the full read of
`src/server/app.ts` (151 registrations + mounted routers), error-shape census by grep,
`docs/API.md` compared line-by-line. Auth/credential analysis is in `09-…` §1; entry
payloads in `05-…` §2-3; derived-read payloads and caching in `08-…`.

---

## 1. Complete endpoint inventory (by domain)

Auth column: **P** = public (pre-identity, rate-limited), **I** = identity required
(session in production), **A** = admin, **H** = health-feature allowlist, **D** =
dev-only (`NODE_ENV !== 'production'`). All paths under `/api`.

| Domain | Endpoints | Auth |
|---|---|---|
| Health check | `GET /health` | none |
| Auth | `POST /auth/{invite/redeem, login, bootstrap-admin, forgot-password, reset-password}` (rate-limited 10/15 min); `POST /auth/logout`; `GET /auth/me` | P / P / I |
| User data | `DELETE /user/data` | I |
| Household | `GET/POST /household/users` | I (no admin gate) |
| Categories | `GET/POST /categories`, `PATCH /categories/reorder`, `GET/PATCH/DELETE /categories/:id` | I |
| Habits | `GET/POST /habits`, `PATCH /habits/reorder`, `GET/PATCH/DELETE /habits/:id`, `POST /habits/:id/{unlink-child, convert-to-bundle, archive, unarchive}` | I |
| Push | `GET /push/public-key`, `POST/DELETE /push/subscriptions`, `POST /push/test` | I |
| Apple Health | `POST /health/apple/sync` (router), `GET+POST /health/suggestions/:id/{accept,dismiss}` (router), `GET/POST/PATCH/DELETE /habits/:habitId/health-rule` + `/backfill` (router) | I+H |
| Day reads | `GET /daySummary`, `GET /dayView`, `GET /progress/overview` | I |
| Wellbeing (canonical) | `GET/POST /wellbeingEntries`, `DELETE /wellbeingEntries/:id` | I |
| Wellbeing (legacy, dead-but-live) | `GET/POST/PUT /wellbeingLogs`, `GET/DELETE /wellbeingLogs/:date` | I |
| Medications | `GET/POST /medications`, `PUT/DELETE /medications/:id`, `GET/POST /medicationLogs` | I |
| Symptoms / Supplements | same 6-route pattern each (`/symptoms`, `/symptomLogs`, `/supplements`, `/supplementLogs`) | I |
| Routines | `GET/POST /routines`, `GET/PATCH/DELETE /routines/:id`, `POST /routines/:id/submit`, `POST/GET/DELETE /routines/:routineId/image`, `GET /routineLogs` | I |
| Journal | `GET/POST /journal`, `PUT /journal/byKey`, `GET/PATCH/DELETE /journal/:id` | I |
| Dashboard prefs | `GET/PUT /dashboardPrefs` | I |
| Goals | `GET/POST /goals`, `GET /goals/completed`, `GET /goals-with-progress`, `PATCH /goals/reorder`, `GET /goals/:id{,/progress,/detail}`, `PUT/DELETE /goals/:id`, `POST /goals/:id/milestones/:milestoneId/acknowledge` | I |
| Goal tracks | `GET/POST /goal-tracks`, `PATCH /goal-tracks/reorder`, `GET/PUT/DELETE /goal-tracks/:id`, `POST /goal-tracks/:id/goals`, `DELETE /goal-tracks/:id/goals/:goalId`, `PATCH /goal-tracks/:id/goals/reorder` | I |
| Tasks | `GET/POST /tasks`, `PATCH/DELETE /tasks/:id` | I |
| Entries (truth) | `GET /entries`, `POST /entries`, `POST /entries/batch`, `PUT /entries`, `PATCH/DELETE /entries/:id`, `DELETE /entries/key`, `DELETE /entries` — all writes rate-limited 100/15 min | I |
| Bundle memberships | `GET/POST /bundle-memberships`, `PATCH /bundle-memberships/:id/{end,archive,graduate}`, `DELETE /bundle-memberships/:id` | I |
| Evidence | `POST /evidence/step-reached`, `POST /evidence/steps-reached-batch`, `GET /evidence` (router) | I |
| AI | `POST /ai/{weekly-review, suggest-variants, journal-summary, journal-review, insights-review}`, `GET /ai/reports`, `GET/DELETE /ai/reports/:id` | I (BYOK key in body) |
| Analytics | `GET /analytics/habits/{all,summary,heatmap,trends,category-breakdown,insights}`, `GET /analytics/{routines,goals,sleep}/summary` | I |
| Insights | `GET /insights/{overview,correlations,habits,medications,predictions}` | I |
| Admin | `GET /admin/integrity-report` (**no admin gate**); `POST /admin/{dedup-habits,recover-habits,remap-categories}`; `POST/GET /admin/invites`, `POST /admin/invites/:id/revoke` (invite routes rate-limited 20/15 min) | I / A |
| Dev | `POST /dev/{seedDemoEmotionalWellbeing,resetDemoEmotionalWellbeing}`, `GET /debug/whoami` | D |
| Static | `/uploads/*` (express.static) | none |

Classification notes: the wellbeingLogs group is dead-but-registered (Task 4);
4 analytics habit sub-routes have no client callers (Task 8); membership
archive/graduate/delete + `daysOfWeek`, `unlink-child`, `convert-to-bundle`, and
`PUT /journal/byKey` are API-only (no UI callers); household users has no UI.

## 2. Cross-cutting contract facts

- **Transport/auth:** cookie `hf_session` only (see 09 §1); CORS allowlists headers
  `Content-Type, Authorization, X-User-Id, X-Household-Id, X-Bootstrap-Key,
  X-Demo-Mode` but `Authorization` is never read. Native clients should call the Render
  origin directly (`https://habitflowai.onrender.com` per `vercel.json`) — no CORS in
  play.
- **Error contract is split, not uniform:** ~94 4xx sites use
  `{error: {code, message, details?}}`, ~69 use bare `{error: "string"}`; the global
  handler returns `500 {error: message}` (`app.ts:336-340`). An iOS client must parse
  both shapes. Codes (`VALIDATION_ERROR`, `NOT_FOUND`, `PUSH_DISABLED`,
  `GEMINI_AUTH_ERROR`, `demoReadOnly` 403, …) are ad-hoc per route.
- **Idempotency:** the reliable write idiom is `PUT /entries` (upsert by
  habitId+dateKey) and `DELETE /entries/key`; POST create is not idempotent.
  Journal upsert-by-key exists server-side. Wellbeing POST is a batch upsert keyed
  `(dayKey,timeOfDay,metricKey)`. Med/supp/symptom logs upsert by `(entityId,dayKey)`.
- **Uploads:** one binary endpoint — routine cover image (`multer` memory, 5 MB,
  JPEG/PNG/WebP, stored as Mongo Binary, served with `Cache-Control: public,
  max-age=86400`).
- **Rate limits:** auth 10, admin invites 20, entry writes 100 per 15 min/IP.
- **Consistency:** progress overview cached 30 s, analytics/insights 60 s, per-process
  (Task 8); everything else fresh. Read-your-write holds for daySummary/dayView but not
  for cached endpoints within their TTL.
- **Timezones:** every dayKey-sensitive call accepts `timeZone`; missing/invalid ⇒
  America/New_York (never UTC). iOS must always send the device IANA zone.
- **Versioning:** none — no `/v1`, no version headers. The SPA reloads on stale chunks;
  a native client has no equivalent, so any breaking change lands immediately.
  Legacy-field tolerance (`date`/`dateKey`) is dev-gated, not a compatibility layer.

## 3. `docs/API.md` verification — trust downgraded to **Low**

Wrong or dead content:
1. Claims identity is `X-User-Id` header "middleware in `src/server/middleware/auth.ts`"
   — no such file; production identity is the session cookie (headers dev-only).
2. "CORS configured in `src/server/index.ts`" — it's in `app.ts`.
3. Entire **Day Logs** section (`/dayLogs` ×5) — none of these routes exist.
4. `POST /goals/:id/badge` — does not exist.
5. **Skill Tree** section (`routes/skillTree.ts`) — file and routes do not exist.
6. `POST /admin/migrations/backfill-daylogs` — does not exist.
7. Omits ~90 real endpoints: all of goal-tracks, bundle-memberships, daySummary,
   medications/symptoms/supplements, AI, analytics, insights, evidence, admin
   (integrity/dedup/recover/remap/invites), household users, user-data delete, habit
   archive/convert/unlink.
Accurate parts: auth endpoint list, push section (precise), entries route list,
milestone semantics (detailed and correct).

## 4. Native-client gap assessment (evidence-backed)

| Concern | Status today | iOS-plan implication |
|---|---|---|
| Credential | Cookie only, fixed 14-day expiry, no refresh | Works with URLSession cookie store; plan a token/refresh endpoint if silent re-auth is wanted |
| Push | Web Push only; prod flag off; in-process scheduler | New server work required: APNs sender + device-token storage; scheduler reliability needs an always-on or external scheduler |
| AI key | BYOK Gemini key sent in request **body** from localStorage | iOS: Keychain storage; same body contract works unchanged |
| Health data | Inbound-sync API fed by external bridge | Native HealthKit can call `POST /health/apple/sync` directly — the endpoint contract already fits (dayKey + 5 nullable metrics); allowlist gate must be widened |
| Offline | None (SW caches shell only; no queue) | Any offline support is net-new client work; upsert-by-key endpoints make replay feasible |
| Contract types | No OpenAPI; types live in `persistenceTypes.ts` | Generate Swift models from `persistenceTypes.ts`; treat `app.ts` as the route manifest |
| Error handling | Two error shapes + ad-hoc codes | Wrap in a tolerant decoder; don't rely on codes |
| Deep links | Query-string URLs only | iOS defines its own scheme; push `data.url` values are view-level only |
| Demo mode | `X-Demo-Mode` header gives read-only seeded identity | Useful for App Review / screenshots without accounts |

## 5. Items for the quality register (→ Task 12)

1. `docs/API.md` documents three nonexistent route groups and misses ~90 endpoints.
2. Split error contract (94 vs 69 shape census).
3. No API versioning story for non-reloadable clients.
4. Ungated integrity report (re-listed).
5. Dead-but-registered legacy: wellbeingLogs group; uncalled analytics sub-routes;
   API-only orphans (journal byKey, unlink-child, convert-to-bundle, membership
   archive/graduate/delete).
