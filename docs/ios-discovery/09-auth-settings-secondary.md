# Task 9 — Authentication, Settings, Reminders, and Secondary Features

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Read-only end-to-end trace of auth/session/push plus secondary features,
spot-checked before acceptance (fixed session expiry, missing reset-token indexes,
SameSite posture, `dangerouslySetInnerHTML` renders — all re-verified at cited lines).

---

## 1. Authentication (verified end-to-end)

- **Login** `POST /api/auth/login {email, password}` — bcrypt cost 12; email looked up
  **across all households** (household comes from the user row); session = 32-byte hex
  token stored as SHA-256 only, doc `{householdId,userId,tokenHash,expiresAt,ip,ua}`,
  **fixed 14-day expiry, never renewed** (no writer of `expiresAt` besides create;
  Mongo TTL index cleans up). Cookie `hf_session`: httpOnly, secure(prod),
  **SameSite=None(prod)**/Lax(dev), 14 d, host-only, path=/.
- **Identity resolution order** (`app.ts:153-157`): session middleware (60 s in-memory
  cache) → public-demo identity (only with `X-Demo-Mode` and no session) → identity
  middleware. **A valid session always wins; headers can never override it.** Header
  identity (`X-User-Id`/`X-Household-Id`) works only outside production *and* with
  `DEMO_MODE_ENABLED`; otherwise no session ⇒ 401.
- **Invite redemption** `POST /api/auth/invite/redeem {inviteCode,email,password,
  displayName}` — 12-char code (no-confusables alphabet), stored hashed; checks
  revoked/expired/maxUses; user joins the **invite's** household with the invite's role;
  auto-login (201 + cookie). Invite codes are delivered out-of-band; **no invite email
  exists** (password reset is the only email in the system, via Resend, with a
  console-log dev fallback).
- **Password reset** — 15-min single-use token (atomic claim via `findOneAndUpdate`),
  all sessions killed + session cache purged on success; forgot-password always 200
  (except malformed email → 400).
- **Bootstrap admin** — guarded by `BOOTSTRAP_ADMIN_KEY` (body or `X-Bootstrap-Key`);
  allowed when zero users exist **or whenever `NODE_ENV !== 'production'`**; creates an
  admin but no session.
- **Admin** — `role` on the users doc; `requireAdmin` reads session-populated `authUser`
  only (dev header identity can never be admin). Applied to dedup/recover/remap +
  invites; **not** to `GET /api/admin/integrity-report`.

### iOS implications (the key answer)

**The `hf_session` cookie is the only production credential.** No bearer path exists —
`Authorization` is CORS-allowlisted but never read. The raw token appears only in
`Set-Cookie`. A native client should: hit the Render origin directly (bypasses CORS
entirely), let `URLSession`'s cookie store hold `hf_session` (SameSite/secure are
browser concepts, harmless natively), and expect a **hard logout every 14 days** (fixed
expiry, no refresh). Building a token/refresh endpoint is an API delta for the iOS plan,
not a blocker — cookie auth works natively today.

## 2. Push pipeline (completed picture)

- **Per-device subscriptions**: `{endpoint, keys, timeZone, userAgent}` upserted on
  every app open (heals timezone drift/endpoint rotation); unique
  `(householdId,userId,endpoint)`; `disabledAt` soft-disable with revive.
- **Scheduler** (in-process, 60 s tick, 5-min catch-up): reads **all** active
  subscriptions cross-scope, groups candidate minutes per distinct device timezone,
  fetches due habits/routines in one query per kind, filters habits by
  `isHabitScheduledOnDay` (routines fire **daily**), skips when the day is already
  complete (bundles evaluated via success rule / any-child), then claim-then-send
  against the dedup log (unique `{habitId,dayKey,endpoint}`, 48 h TTL; routine ids
  namespaced `routine:<id>` into the `habitId` field — a naming trap).
- Payloads deep-link only to `/?view=tracker` or `/?view=routines` (no per-item link);
  SW shows the notification and focuses/navigates on click; `pushsubscriptionchange`
  re-subscribes same-origin (broken under split Vercel/Render deploys — acknowledged in
  `sw.js:86-88`; page-load re-sync is the backstop).
- Gating: `PUSH_REMINDERS_ENABLED` + both VAPID keys; subscription/test routes 501 when
  off; `GET /api/push/public-key` always answers so the UI can hide itself. Production
  `render.yaml` ships the flag **off**.
- **iOS delta:** Web Push requires iOS 16.4+ Home-Screen install; there is no APNs
  path anywhere — a native app needs new server work (APNs sender + token storage), and
  the scheduler's single-process design is a known reliability limit
  (`reminderScheduler.ts:21-23`).

## 3. Settings surface (complete inventory)

Account name (read-only) · Reopen setup guide · "How HabitFlow works" (InfoModal) ·
View archived habits (+count) · Notifications (enable/test/turn-off; hidden in demo or
when server push disabled; iOS install guidance) · Apple Health link (allowlist-gated) ·
Gemini API key (BYOK, localStorage, save/remove) · Delete my data (two-step; incomplete
scope per Task 3 C9). No logout, theme, timezone, or admin surface in Settings.

## 4. Secondary features

- **Tasks**: `status ∈ active|completed|deleted` × `listPlacement ∈ inbox|today`;
  timestamps `createdAt/completedAt/movedToTodayAt`; **no due dates or reminders**;
  soft delete; userId-only scoping; optimistic UI with refetch rollback.
- **Journal**: 11 templates + free-write (structure: standard/deep prompt arrays, one
  template has deep); pinned templates (localStorage + dashboardPrefs write-through);
  AI weekly summary = last-7-days aggregate (UTC-windowed) → Gemini → saved as an
  `ai-weekly-summary` journal entry (one/day) + `aiReports` archive; banner never
  auto-generates and hides in demo/no-key.
- **Household users**: separate passwordless `householdUsers` registry for a
  switch-user UI that doesn't exist; `POST /api/household/users` lets any session
  insert arbitrary userIds (no admin gate, no dedupe).
- **Demo/tour**: fixed identity `demo_emotional_wellbeing`/`demo-household`; boot-only
  seeding (goes stale on long-lived instances — no reseed endpoint); read-only enforced
  client- and server-side; tour = 11 stops driving an embedded iframe by
  origin-checked postMessage with overlay-reset + `modal`/`focus`/`routineEditor`
  control params; `?embed=1` keeps demo mode in memory so the iframe can't flip the
  parent's localStorage.

## 5. Security posture notes (recorded for Task 12; discovery does not fix)

1. **No CSRF protection** + SameSite=None(prod) cookies + CSP disabled
   (`helmet({contentSecurityPolicy:false})`) — cross-site credentialed writes are
   possible by design tradeoff; CORS is either narrow-with-credentials or
   wide-without (misconfigured `FRONTEND_ORIGIN` breaks the browser app silently).
2. `GET /api/admin/integrity-report` lacks `requireAdmin` (re-confirmed).
3. **`passwordResetTokens` has zero indexes** despite its header comment claiming a TTL
   index — rows accumulate forever; hash lookups unindexed.
4. Invite `uses` check-then-increment is non-atomic (concurrent redemptions can exceed
   `maxUses`); `codeHash` index non-unique; the constant-time `verifyInviteCode` helper
   is dead code.
5. Reset URLs are logged to console whenever `RESEND_API_KEY` is unset — including a
   misconfigured production.
6. Same email in two households is storable but only one can ever log in (email-only
   login lookup vs `{email,householdId}` unique index).
7. Session cache can authenticate up to 60 s past expiry and is per-process.
8. `postLogout` hardcodes the cookie name literal.
9. Gemini output rendered via regex-markdown → `dangerouslySetInnerHTML`
   (`JournalSummaryBanner.tsx:178`, `JournalSummaryBody.tsx:16`) — model-controlled
   HTML injection surface.
10. Non-production bootstrap-admin is replayable to mint admins in arbitrary
    households (dev-only exposure).
11. Reminder deep-links are view-level only; routine reminders fire daily by design;
    `DELETE /api/push/subscriptions` skips the configured-check (asymmetric).

## 6. Feature classification updates

- Multi-user households: **API-only scaffold** (registry + invites exist; no UI, no
  switch-user surface) — unchanged from Task 3.
- Push reminders: **Implemented (web), off in prod config**, single-instance
  reliability caveat.
- Demo/tour: **Implemented, web-only mechanism** (iframe/postMessage does not port).
- Email: password reset only; no verification, no invite mail.
