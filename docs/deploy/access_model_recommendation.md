# Access Model Recommendation — Private Beta Auth

This document describes the **final auth flow** implemented for HabitFlow AI’s invite-only private beta (server + DB sessions, no public signup).

## Overview

- **No public signup.** Users can only join by redeeming an **invite code** (created by an admin).
- **Session-based auth.** After login or invite redeem, the server issues an **HttpOnly session cookie** (`hf_session`). All authenticated API requests use this cookie; optional dev fallback uses `X-Household-Id` / `X-User-Id` headers.
- **Household-scoped identity.** Each user belongs to one `householdId`; data (habits, entries, goals, etc.) is scoped by `householdId` and `userId`.

## Auth Flow

1. **Bootstrap (first-run / non-prod only)**  
   - `POST /api/auth/bootstrap-admin` with `BOOTSTRAP_ADMIN_KEY` (body or `X-Bootstrap-Key`).  
   - Allowed when there are no users, or when `NODE_ENV !== 'production'`.  
   - Creates the first admin user (and optionally a household).  
   - Does **not** set a session; admin must log in afterward.

2. **Invite creation (admin only)**  
   - Admin logs in (or uses session from bootstrap + login).  
   - `POST /api/admin/invites` with `maxUses`, `expiresAt`, optional `role` (`admin` | `member`).  
   - Server generates a one-time **invite code** (shown once in the response).  
   - Invite codes are stored **hashed** only; raw code is never persisted.

3. **Signup (invite redeem)**  
   - User receives the invite code (e.g. out-of-band).  
   - `POST /api/auth/invite/redeem` with `{ inviteCode, email, password, displayName }`.  
   - Server validates: code exists, not expired, not revoked, `uses < maxUses`, email format, password length.  
   - On success: creates user in `users`, increments invite `uses`, creates a session, sets `hf_session` cookie, returns user payload.

4. **Login**  
   - `POST /api/auth/login` with `{ email, password }`.  
   - Server verifies credentials, creates a new session, sets `hf_session` cookie, returns user payload.

5. **Authenticated requests**  
   - **Session middleware** runs first: if `hf_session` cookie is present, its token is hashed and looked up in `sessions`; if valid and not expired, `req.householdId`, `req.userId`, and `req.authUser` (email, displayName, role) are set.  
   - **Identity middleware** runs next: if identity is already set (from session), it is kept; otherwise headers or dev bootstrap are used. In production, missing identity yields 401.  
   - All data APIs (habits, entries, goals, etc.) use this identity for scoping.

6. **Me**  
   - `GET /api/auth/me` returns `{ householdId, userId, email?, displayName?, role? }` when authenticated via session; otherwise `{ householdId, userId }` when from headers/bootstrap.

7. **Logout**  
   - `POST /api/auth/logout` invalidates the current session (if token sent in cookie) and clears the `hf_session` cookie.

## Security / Abuse Controls

- **Rate limiting:** Login, invite redeem, and bootstrap are rate-limited (e.g. 10 req/15 min per IP). Admin invite creation is rate-limited (e.g. 20/15 min).
- **Invite codes:** Stored as SHA-256 hash only; redemption uses constant-time comparison.
- **Validation:** Email format and password minimum length (e.g. 8 chars) enforced on redeem and login.
- **Session cookie:** `hf_session` is HttpOnly, Secure in production, SameSite=Lax, with a 14-day TTL.

## Database Collections

- **users:** `_id` (userId), `householdId`, `email`, `displayName`, `passwordHash`, `role` (`admin` | `member`), `createdAt`, `lastLoginAt`.
- **invites:** `_id`, `householdId`, `codeHash`, `role`, `maxUses`, `uses`, `expiresAt`, `revokedAt?`, `createdAt`, `createdByUserId`.
- **sessions:** `_id`, `householdId`, `userId`, `tokenHash`, `createdAt`, `expiresAt`, `ip?`, `userAgent?`. TTL index on `expiresAt` for automatic cleanup.

## Admin Endpoints

- `POST /api/admin/invites` — create invite (returns one-time code).  
- `GET /api/admin/invites` — list invites for the admin’s household.  
- `POST /api/admin/invites/:id/revoke` — revoke an invite.  

All require an authenticated session with `role === 'admin'` (403 otherwise).

## Recommendation

For private beta, this model is recommended: invite-only signup plus server-side sessions keeps control over who can access the app and avoids storing raw invite codes or JWTs in the client. Use bootstrap only in non-prod or true first-run; in production, create the first admin via a one-off script or a single bootstrap call with a strong `BOOTSTRAP_ADMIN_KEY` that is then removed from the environment.
