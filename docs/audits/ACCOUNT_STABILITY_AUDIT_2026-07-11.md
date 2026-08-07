# HabitFlow — Account Creation & Stability Audit

**Date:** 2026-07-11
**Scope:** Account creation, authentication, session handling, per-user data ownership, persistence, database integrity, reliability, and deployment readiness.
**Method:** Direct code inspection (backend + frontend), index/migration review, and logic-level test execution. Live deployed-environment testing and DB-backed integration tests could **not** be run from the audit environment (see [§4 verification gaps](#4-end-to-end-test-results)). All findings are cited to `file:line` and marked **Confirmed** (verified in code) or **Suspected** (inferred; needs runtime confirmation).

---

## 1. Executive assessment

**HabitFlow has a real, server-backed account system — not a simulation.** Authentication is a genuine custom implementation: bcrypt-hashed passwords (cost 12), server-side session records with hashed tokens in an `httpOnly` cookie, session restoration via `GET /api/auth/me`, and **per-user data isolation that is enforced on the server for every user-owned query**. The most dangerous failure modes for a multi-tenant app — trusting a client-supplied user ID, or a query that forgets its ownership filter — are **not** present in production paths. That is the single most important finding: the foundation is sound and does **not** require a rebuild.

However, HabitFlow is **not ready for public, self-service accounts**, for these reasons:

1. **There is no open sign-up.** Account creation is invite-only (`POST /api/auth/invite/redeem`). A real user cannot create their own account without an admin minting an invite code. This is by design today, but it is a hard blocker against the audit's goal of "real users create new accounts."
2. **There is no email verification anywhere in the codebase.** Users redeem an invite with any email string and are logged in immediately. Fine for a trusted invite list; unacceptable for public registration.
3. **A live MongoDB Atlas credential is committed to the repository** (`archive/old-scripts/migrateDayLogsToEntries.ts:11`). This is a release-blocking security issue independent of everything else.
4. **Password-reset links are vulnerable to host-header injection** when `APP_BASE_URL` is unset (which it is in `render.yaml`), and reset tokens are written to server logs when `RESEND_API_KEY` is unset.
5. **Reliability gaps:** sign-up is non-transactional, there is no CSRF protection while using `SameSite=None` cookies, session/reset-token TTL cleanup is broken, and several "pinned" features persist to `localStorage` with fire-and-forget server sync (so they silently fail to sync across devices).

**Suitability verdict:**

| Audience | Ready? | Rationale |
|---|---|---|
| **Private testing (you + a few trusted invitees)** | ✅ Yes, after Phase 0 | Works today; must first rotate the leaked credential and confirm prod env vars. |
| **Invited closed beta (dozens of users)** | ⚠️ After Phase 0–1 | Needs the reset host-header fix, CSRF, transactional signup, and TTL cleanup. |
| **Public self-service registration** | ❌ No | Requires building an open sign-up flow *and* email verification, which do not exist. |

**Scope of work:** **Moderate stabilization**, not a major rebuild. The core auth/ownership architecture is correct and should be retained. The work is (a) one urgent security cleanup, (b) closing reliability/hardening gaps on the existing design, and (c) *net-new* feature work (open registration + email verification) only if public signup is a goal.

---

## 2. Current account-system map

```mermaid
flowchart TB
    subgraph Browser["Browser (React 19 + Vite)"]
        UI["AuthGate → LoginPage / InviteRedeemPage / ForgotPasswordPage"]
        AC["AuthContext<br/>(canonical user from /me)"]
        PC["persistenceClient<br/>credentials: 'include'<br/>+ vestigial X-User-Id/X-Household-Id<br/>from localStorage (ignored in prod)"]
        LS[("localStorage<br/>Gemini API key, pinned items,<br/>UI prefs, demo mode")]
    end

    subgraph Vercel["Vercel (frontend host)"]
        RW["vercel.json rewrite<br/>/api/* → onrender.com<br/>(server-side proxy ⇒ same-origin cookie)"]
    end

    subgraph Render["Render (Express 5 API)"]
        MW["Middleware chain:<br/>helmet → cookieParser → CORS →<br/>sessionMiddleware → publicDemoIdentity →<br/>identityMiddleware → readOnlyGuard"]
        AUTH["/api/auth/*<br/>invite/redeem · login · logout ·<br/>forgot/reset-password · bootstrap-admin"]
        API["/api/* domain routes<br/>(scoped by householdId+userId)"]
        SC["sessionCache<br/>(60s in-memory TTL)"]
    end

    subgraph Mongo[("MongoDB Atlas")]
        Users["users (unique {email,householdId})"]
        Sessions["sessions (hashed token, expiresAt)"]
        Invites["invites (codeHash)"]
        Reset["passwordResetTokens"]
        Data["habits · habitEntries · goals ·<br/>routines · journal · tasks · wellbeing · …<br/>(every doc carries userId)"]
    end

    Email["Resend (password-reset email only)<br/>⚠ falls back to console log if key unset"]

    UI --> AC --> PC --> RW --> MW
    MW --> AUTH --> Users & Sessions & Invites & Reset
    MW --> API --> Data
    MW <--> SC
    AUTH --> Email
    AC -. "GET /api/auth/me on mount" .-> MW
    PC -. "hf_session cookie" .-> MW
    LS -. "not synced cross-device" .- PC

    classDef warn fill:#4a2,stroke:#fa0,color:#fff
```

**Lifecycle (as built today):**

```
Admin mints invite  →  user redeems invite (email+password, NO verification)
  →  createUser + createSession + setCookie (3 non-transactional writes)
  →  account is EMPTY (no household row, no default categories/prefs/onboarding)
  →  first page load: AuthGate calls /me, cookie restores session
  →  user creates data → POST /api/* → scoped write with server-set userId → MongoDB
  →  refresh: /me re-reads cookie → data reloaded from server
  →  logout: server session row deleted + cache evicted + cookie cleared
  →  login again: bcrypt.compare → new session → data restored (server-backed)
```

---

## 3. Evidence-backed findings

Severity: **Blocker** (cannot reliably create/use accounts, or credible cross-user data risk) · **Critical** (data loss, auth bypass, broken prod config) · **High** (major workflow unreliable/incomplete) · **Medium** (recoverable failure / poor handling) · **Low** (polish).

### Blockers

#### F-01 — Live MongoDB Atlas credential committed to the repo
| | |
|---|---|
| **Evidence** | `archive/old-scripts/migrateDayLogsToEntries.ts:11` — hardcoded `mongodb+srv://` URI with embedded username/password and the real cluster host as a fallback default. Git-tracked (committed `73cec81`, 2026-07-02). |
| **User impact** | None visible to users, but anyone with repo access (or a leak) has direct read/write to the production database — full account and data compromise. |
| **Severity / Confidence** | Blocker / **Confirmed** |
| **Scope** | Security |
| **Root cause** | A one-off migration script hardcoded a working connection string instead of reading `process.env`. |
| **Fix** | **Rotate the Atlas credential immediately.** Remove the hardcoded fallback (read from env only). Purge the value from git history (`git filter-repo`/BFG) or accept rotation as the mitigation. Delete the archived script if unused. |
| **Dependencies** | Access to the Atlas console to rotate. |
| **Effort / Regression risk** | S / Low |

#### F-02 — No self-service sign-up exists (invite-only)
| | |
|---|---|
| **Evidence** | Only creation paths are `postInviteRedeem` (`src/server/routes/auth.ts:75`) and `postBootstrapAdmin` (`auth.ts:243`). Frontend has `InviteRedeemPage`, `LoginPage`, `ForgotPasswordPage` but **no register page**. `README`/`userRepository.ts:1` comment: "Invite-only signup." |
| **User impact** | A prospective user landing on the app cannot create an account. They need an admin to generate and hand them an invite code. |
| **Severity / Confidence** | Blocker (for the stated goal) / **Confirmed** |
| **Scope** | Auth, UX |
| **Root cause** | Product decision for private beta; no public registration endpoint/flow was ever built. |
| **Fix** | Decide the model. Either (a) keep invite-only and treat this as "working as intended" for closed beta, or (b) build an open `POST /api/auth/register` + register UI. Option (b) **requires F-03**. |
| **Dependencies** | Product decision (invite-only vs open). |
| **Effort / Regression risk** | Open registration: L / Medium |

#### F-03 — No email verification of any kind
| | |
|---|---|
| **Evidence** | Grep for `verify/verification/isVerified/emailVerified` across `src/**` → no matches. User doc (`userRepository.ts:46-55`) has no `emailVerifiedAt` field. The only email sent is password reset (`lib/email.ts:27`). |
| **User impact** | With open registration, anyone can register **any** email (including someone else's) and use the account. No proof of email ownership; no way to trust the email for recovery. |
| **Severity / Confidence** | Blocker for public registration (Medium for invite-only) / **Confirmed** |
| **Scope** | Auth, Security |
| **Root cause** | Not built; invite list was the trust boundary. |
| **Fix** | Add a `emailVerifiedAt` field, a verification-token collection (hashed, TTL, single-use — mirror the reset-token pattern), a verification email, and a `GET/POST /api/auth/verify-email` endpoint. Gate sensitive actions on verification for open signups. |
| **Dependencies** | F-11 (Resend configured), F-03 shares infra with reset tokens. |
| **Effort / Regression risk** | M / Low |

### Critical

#### F-04 — Password-reset host-header injection (token exfiltration)
| | |
|---|---|
| **Evidence** | `getAppBaseUrl` (`auth.ts:300-307`) uses `process.env.APP_BASE_URL` if set, else falls back to `req.headers['x-forwarded-proto']` + `req.get('host')`. Reset link built at `auth.ts:342-344`. **`APP_BASE_URL` is not declared in `render.yaml`** → unset in prod → base URL comes from the attacker-controllable `Host` header. |
| **User impact** | An attacker submits `forgot-password` for a victim with a forged `Host`; the victim receives a legitimate-looking email whose link points at the attacker's domain. Clicking leaks the single-use reset token → account takeover. |
| **Severity / Confidence** | Critical / **Confirmed** (code); Suspected (exploitability depends on Render/Vercel `Host` passthrough) |
| **Scope** | Security |
| **Root cause** | Convenience fallback to request host; prod env var never set. |
| **Fix** | Set `APP_BASE_URL` in Render. Additionally, validate the `Host`/base URL against an allowlist and remove the header fallback in production. |
| **Dependencies** | None |
| **Effort / Regression risk** | XS / Low |

#### F-05 — Auth hardening depends entirely on `NODE_ENV === 'production'`
| | |
|---|---|
| **Evidence** | `identityMiddleware` (`middleware/identity.ts:71-95`): in production, identity is derived **only** from the session; headers ignored. In non-production with `DEMO_MODE_ENABLED`, `X-User-Id`/`X-Household-Id` headers are trusted and a `default-user`/`default-household` bootstrap identity is used. Cookie `secure`/`sameSite` also flip on `NODE_ENV` (`lib/sessionCookie.ts:14-15`). |
| **User impact** | If the production deploy ever runs without `NODE_ENV=production` (or with `DEMO_MODE_ENABLED` set), **any request can impersonate any user by setting a header**, and cookies stop being `Secure`. Total compromise. |
| **Severity / Confidence** | Critical / **Confirmed** (logic); Suspected (deploy risk) |
| **Scope** | Security, Deployment |
| **Root cause** | Single env var is the sole switch between "trust headers" and "trust session." |
| **Fix** | `render.yaml:9-10` sets `NODE_ENV=production` — verify it is actually applied. Add a boot-time assertion that refuses to start if `NODE_ENV!=='production'` on the prod host, and that `DEMO_MODE_ENABLED` is never set in prod. Consider deleting the header-identity path entirely and using a dedicated test-only seam. |
| **Dependencies** | None |
| **Effort / Regression risk** | S / Low |

#### F-06 — Reset tokens logged to server console when `RESEND_API_KEY` unset
| | |
|---|---|
| **Evidence** | `.env.example:40-42` documents: when `RESEND_API_KEY` is unset, reset links are logged to the console instead of emailed. `RESEND_API_KEY` is **not** in `render.yaml`. |
| **User impact** | If unset in prod, every password-reset raw token lands in Render logs — anyone with log access can reset any account whose owner requested a reset. Also: password reset simply won't reach users. |
| **Severity / Confidence** | Critical (if unset) / **Confirmed** |
| **Scope** | Security, Deployment, Observability |
| **Root cause** | Dev-friendly fallback with no prod guard. |
| **Fix** | Set `RESEND_API_KEY`/`EMAIL_FROM` in Render. In production, **fail** (or refuse to issue the token) rather than logging the raw token if the mailer is unconfigured. |
| **Dependencies** | Resend account. |
| **Effort / Regression risk** | XS / Low |

#### F-07 — Sign-up is non-transactional; invite `maxUses` check is racy
| | |
|---|---|
| **Evidence** | `postInviteRedeem` (`auth.ts:130-152`) does three independent awaited writes: `createUser` → `incrementInviteUses` → `createSession`, no Mongo transaction. `uses >= maxUses` checked at `auth.ts:118`, incremented at `auth.ts:139` with no atomic guard. Duplicate-user prevention is check-then-insert (`auth.ts:124`) backed by the `{email,householdId}` unique index. |
| **User impact** | A crash between writes leaves a user row with an un-consumed invite (recoverable — they can still log in). Two concurrent redemptions of a single-use invite can both succeed (over-provisioning). A retried redemption surfaces a raw `11000` duplicate-key error as a generic 500 rather than a friendly message. |
| **Severity / Confidence** | Critical / **Confirmed** (non-transactional, race Suspected) |
| **Scope** | Auth, Database, Reliability |
| **Root cause** | Sequential writes without a transaction; non-atomic invite accounting. |
| **Fix** | Wrap creation in a Mongo transaction (`getClient()` already exists, `mongoClient.ts:411`), or make it idempotent and self-healing. Use an atomic `findOneAndUpdate` with `uses < maxUses` guard to consume the invite. Catch `11000` and return the friendly 400. |
| **Dependencies** | Atlas replica set (transactions require it — Atlas provides one). |
| **Effort / Regression risk** | M / Medium |

### High

#### F-08 — No CSRF protection with `SameSite=None` cookies
| | |
|---|---|
| **Evidence** | No CSRF token/double-submit anywhere (grep `csrf` → none). Cookie is `SameSite=None; Secure` in prod (`lib/sessionCookie.ts:15`), so it **is** sent on cross-site requests. All state-changing routes authorize solely on the ambient cookie. |
| **User impact** | A malicious page could issue authenticated state-changing requests on a logged-in user's behalf. Partial mitigation: mutations require `Content-Type: application/json` (via `express.json`), which forces a CORS preflight that the CORS policy would reject cross-origin — but this is incidental, not a designed defense. |
| **Severity / Confidence** | High / **Confirmed** (no CSRF); Suspected (exploitability, given JSON+CORS) |
| **Scope** | Security |
| **Root cause** | Cookie auth without anti-CSRF. `SameSite=None` is stricter than needed given the same-origin proxy. |
| **Fix** | Simplest: set `SameSite=Lax` (the Vercel rewrite makes API calls same-origin, so `Lax` works and blocks cross-site sends). Belt-and-suspenders: add a double-submit CSRF token or an `Origin`/`Sec-Fetch-Site` check on mutations. |
| **Dependencies** | Confirm the same-origin proxy is the only access path (F-05 note about `VITE_API_BASE_URL`). |
| **Effort / Regression risk** | S / Low |

#### F-09 — Login timing enables account enumeration
| | |
|---|---|
| **Evidence** | `postLogin` (`auth.ts:186-195`): unknown email returns **immediately** without running bcrypt; known email runs `bcrypt.compare` (cost 12, tens of ms). Error text is uniform ("Invalid email or password") but the timing differs measurably. |
| **User impact** | An attacker can distinguish registered from unregistered emails by response latency, defeating the uniform error message. |
| **Severity / Confidence** | High / **Confirmed** |
| **Scope** | Security |
| **Root cause** | No dummy-hash comparison on the not-found branch. |
| **Fix** | On unknown user, compare against a fixed dummy bcrypt hash to equalize timing before returning the generic error. |
| **Dependencies** | None |
| **Effort / Regression risk** | XS / Low |

#### F-10 — Ambiguous cross-household login for a shared email
| | |
|---|---|
| **Evidence** | Email uniqueness is `{email, householdId}` (`mongoClient.ts:204`) — the same email can exist in multiple households. Login uses `findUserByEmail` (`userRepository.ts:24`) which returns the **first** match with no ordering; `auth.ts:185`. |
| **User impact** | If a user's email is registered in two households, login is non-deterministic about which account they enter — they may be unable to reach their real data or land in the wrong household. |
| **Severity / Confidence** | High (latent; low likelihood in current single-household beta) / **Confirmed** logic, **Suspected** trigger |
| **Scope** | Auth, Database |
| **Root cause** | Multi-household data model with per-household email uniqueness, but a global login lookup. |
| **Fix** | Decide: make email globally unique (add a unique index on `email` alone, migrate any dupes), or make login household-aware. Global uniqueness is simplest for a habit app. |
| **Dependencies** | Data audit for existing duplicate emails before adding a global unique index. |
| **Effort / Regression risk** | M / Medium |

#### F-11 — No account deletion; `deleteUserData` orphans many collections
| | |
|---|---|
| **Evidence** | Only deletion route is `DELETE /api/user/data` → `deleteUserData` (`routes/userData.ts:30`), which wipes a fixed list (`userData.ts:11-28`) but **preserves the `users` row and `sessions`** by design (docstring `userData.ts:3`) and **omits** several user-scoped collections (e.g. `aiReports`, `bundleMemberships`, `healthMetricsDaily`, `habitHealthRules`, `healthSuggestions`, `medications`/`supplements`/`symptoms` + logs). No route deletes the `users` account doc. |
| **User impact** | A user cannot delete their account. "Delete my data" leaves orphaned records keyed to their `userId`. This is a privacy/GDPR gap and a data-hygiene problem. |
| **Severity / Confidence** | High / **Confirmed** |
| **Scope** | Database, Privacy |
| **Root cause** | Deletion list is a hand-maintained allowlist that drifted behind schema growth; no account-delete flow. |
| **Fix** | Add a real account-deletion endpoint that removes the `users` doc, all sessions, reset tokens, invites/roster rows, and **all** user-scoped collections (derive the list programmatically or centralize it). Keep the soft-delete option separate. |
| **Dependencies** | Confirm the full set of user-scoped collections. |
| **Effort / Regression risk** | M / Medium |

#### F-12 — Session/reset-token TTL cleanup is ineffective (unbounded growth)
| | |
|---|---|
| **Evidence** | Sessions have a TTL index `{expiresAt:1}, expireAfterSeconds:0` (`mongoClient.ts:206`), but `expiresAt` is stored as an **ISO string** (`sessionRepository.ts:36`, `.toISOString()`). MongoDB TTL indexes act only on BSON `Date` fields, so string values are never expired. `passwordResetTokens` has **no** TTL index at all (despite the docstring `passwordResetTokenRepository.ts:5-6`) and no index on `tokenHash`/`userId` → full collection scans on every claim. |
| **User impact** | No security bypass (expiry is enforced logically via `expiresAt > now` string comparison, which works). But `sessions` and `passwordResetTokens` grow forever, degrading query/storage over time; reset-token claims scan the whole collection. |
| **Severity / Confidence** | High (operational) / **Confirmed** |
| **Scope** | Database, Reliability, Observability |
| **Root cause** | TTL index created against a string field; missing indexes on the reset-token collection. |
| **Fix** | Store `expiresAt` as a `Date` for TTL to work (or add a separate `Date` field for the TTL index). Add the reset-token TTL index and a `tokenHash` index. |
| **Dependencies** | Migration to convert existing string `expiresAt` values (or dual-write). |
| **Effort / Regression risk** | S / Medium |

### Medium

#### F-13 — "Pinned" items are localStorage-primary with fire-and-forget server sync
| | |
|---|---|
| **Evidence** | Pinned routines (`components/dashboard/PinnedRoutinesCard.tsx:60-118`), pinned goals (`components/ProgressDashboard.tsx:28-82`), pinned journal templates (`components/Journal/usePinnedJournalTemplates.ts:10-55`): write localStorage + state, then `updateDashboardPrefs(...).catch(() => {})`. Backend field exists but localStorage is the read path and the failure fallback. |
| **User impact** | Pinned selections **do not reliably sync across devices/browsers** and silently diverge on a failed write — with no error shown and no rollback. A user's pins vanish on a new device. |
| **Severity / Confidence** | Medium / **Confirmed** |
| **Scope** | Persistence, UX |
| **Root cause** | Optimistic local write with swallowed backend errors, server treated as secondary. |
| **Fix** | Make the server the source of truth (read from `dashboardPrefs`), keep localStorage only as a cache, and surface/rollback on write failure. |
| **Dependencies** | None |
| **Effort / Regression risk** | M / Low |

#### F-14 — Gemini API key stored unencrypted in localStorage, non-portable
| | |
|---|---|
| **Evidence** | `lib/geminiClient.ts:15-30` reads/writes `habitflow_gemini_api_key` in localStorage in plaintext and POSTs it to `/api/ai/*`. `.env.example:52` confirms BYOK-in-localStorage. |
| **User impact** | Key does not follow the user across devices; readable by any XSS on the origin. |
| **Severity / Confidence** | Medium / **Confirmed** |
| **Scope** | Security, Persistence |
| **Root cause** | BYOK design choice storing the secret client-side. |
| **Fix** | If cross-device AI is desired, store the key server-side encrypted per user. Otherwise document the single-device limitation explicitly. |
| **Dependencies** | Encryption-at-rest decision. |
| **Effort / Regression risk** | M / Medium |

#### F-15 — Startup migration 001 is never applied
| | |
|---|---|
| **Evidence** | `runStartupMigrations` (`migrations/startup.ts:29,39`) registers only `002` and `003`. `001_add_routine_variants` runs only manually (`001_add_routine_variants.ts:173`). Migrations run **after** `app.listen`, non-blocking, swallowing errors (`index.ts:21-31`). |
| **User impact** | A fresh DB relying on startup migrations never gets the routine→variants schema change → possible schema drift for routines missing `variants`. |
| **Severity / Confidence** | Medium / **Confirmed** (Suspected whether read-path code defends against it) |
| **Scope** | Database |
| **Root cause** | 001 omitted from the startup registry. |
| **Fix** | Register 001 (idempotent + `_migrations`-guarded) or confirm read code tolerates missing `variants`. Consider running migrations before serving traffic. |
| **Dependencies** | None |
| **Effort / Regression risk** | S / Low |

#### F-16 — `householdUsers` roster not populated on signup; no unique constraint
| | |
|---|---|
| **Evidence** | `createHouseholdUser` (`householdUserRepository.ts:28-53`) is only called from `routes/householdUsers.ts:30`, never on redeem. No index/unique on `{householdId,userId}`; `insertOne` with no dedupe. Can fabricate a `userId` not tied to a real user (`:36`). |
| **User impact** | New users don't appear in the household "Switch User" roster; duplicate roster rows possible. |
| **Severity / Confidence** | Medium / **Confirmed** |
| **Scope** | Database, UX |
| **Root cause** | Roster maintained by a separate endpoint, not the signup path. |
| **Fix** | Upsert a roster row on signup; add a unique `{householdId,userId}` index. |
| **Dependencies** | None |
| **Effort / Regression risk** | S / Low |

#### F-17 — Rate limiting is IP-only; `trust proxy` hop count may be wrong
| | |
|---|---|
| **Evidence** | `authRateLimiter` = 10/15min/IP (`middleware/rateLimitAuth.ts:8-14`), applied to login/redeem/reset/bootstrap (`app.ts:140-144`). `app.set('trust proxy', 1)` (`app.ts:102`). No per-account lockout. |
| **User impact** | Behind Vercel→Render (potentially two hops), `req.ip` may resolve to a proxy IP, weakening per-IP limits. No account-level lockout against distributed credential stuffing. |
| **Severity / Confidence** | Medium / **Confirmed** (IP-only); Suspected (hop count) |
| **Scope** | Security |
| **Root cause** | Single-hop trust assumption; no per-account throttle. |
| **Fix** | Verify actual `X-Forwarded-For` depth on Render and set `trust proxy` accordingly. Add per-account failed-login backoff/lockout. |
| **Dependencies** | Runtime inspection of XFF on Render. |
| **Effort / Regression risk** | S / Medium |

#### F-18 — Silent error swallowing logs users out / hides failures
| | |
|---|---|
| **Evidence** | `AuthContext.checkSession` catch treats any network error as "not authenticated" (`store/AuthContext.tsx:84-87`) → a transient blip on boot drops the user to the login screen. Pinned hooks `.catch(() => {})` (F-13). `SettingsModal.tsx:28` swallows localStorage errors. |
| **User impact** | Flaky network on load appears as a forced logout; failed writes vanish silently. |
| **Severity / Confidence** | Medium / **Confirmed** |
| **Scope** | UX, Reliability |
| **Root cause** | Broad catch blocks conflating network failure with unauthenticated. |
| **Fix** | Distinguish 401 (unauthenticated) from network errors; retry `/me` with backoff and show a reconnect state instead of logging out. |
| **Dependencies** | None |
| **Effort / Regression risk** | S / Low |

#### F-19 — `habitEntries` uniqueness index skipped when duplicates pre-exist
| | |
|---|---|
| **Evidence** | `ensureHabitEntriesUniqueIndex` (`mongoClient.ts:57-63`) scans for duplicates first and **returns without creating the unique index** if any exist, only logging a warning. |
| **User impact** | On a DB that already has duplicate active entries, the integrity guarantee (one entry per user/habit/day) is silently absent until a manual dedupe is run — enabling further duplication. |
| **Severity / Confidence** | Medium / **Confirmed** |
| **Scope** | Database |
| **Root cause** | Defensive skip to avoid boot failure, but leaves the invariant unenforced. |
| **Fix** | Run/verify the dedupe, then ensure the unique index is present in prod. Add an integrity check to alerting. |
| **Dependencies** | Dedupe of any existing duplicates. |
| **Effort / Regression risk** | S / Medium |

#### F-20 — `reorderCategories` inserts client data without `requireScope`
| | |
|---|---|
| **Evidence** | `categoryRepository.ts:130-151` does `deleteMany(scope)` then `insertMany` of client-supplied categories spread with `householdId,userId`, without `requireScope` and without validating/stripping incoming `id`. |
| **User impact** | Owner is set from params so it is not a cross-user leak, but empty-string identity would be written verbatim and unvalidated client fields are persisted. |
| **Severity / Confidence** | Medium / **Suspected** |
| **Scope** | Database, Security (defense-in-depth) |
| **Root cause** | Bulk replace path bypasses the shared scope guard. |
| **Fix** | Route through `requireScope`; validate/whitelist fields; assert non-empty identity. |
| **Dependencies** | None |
| **Effort / Regression risk** | S / Low |

### Low

- **F-21** — `GET /api/admin/integrity-report` lacks `requireAdmin` (`app.ts:297`), unlike its siblings. Scoped to the caller's own `userId` (`admin.ts:30`), so it exposes only their own data — consistency issue, not escalation. *(Low / Confirmed)*
- **F-22** — CORS `Access-Control-Allow-Methods` omits `PUT` (`app.ts:117`) though routes use `PUT`; no `Vary: Origin`; CSP disabled (`app.ts:104`). Latent behind the same-origin proxy. *(Low / Confirmed)*
- **F-23** — `bootstrap-admin` accepts a caller-supplied `userId`/`householdId` (`auth.ts:271,286`) and uses non-constant-time key comparison (`auth.ts:247`); requires the secret key and (in prod) zero existing users. *(Low / Confirmed)*
- **F-24** — Routine-images collection has no owner column (`routineImageRepository.ts`); protected only by upstream `getRoutine` gating. Add a `userId` column for defense-in-depth. *(Low / Confirmed)*
- **F-25** — 60s `sessionCache` (`middleware/session.ts:37`) serves a session for up to 60s after natural DB expiry (logout/reset explicitly evict; natural expiry does not). *(Low / Confirmed)*

**Well-implemented (retain as-is):** per-user scoping on every query with server-set ownership (no client-trusted IDs in prod); session tokens and reset tokens are 256-bit and stored SHA-256-hashed; bcrypt cost 12; reset tokens single-use via atomic `findOneAndUpdate` with 15-min TTL; password reset revokes all sessions and evicts cache; logout deletes the server session; uniform login error text; anti-enumeration 200 on forgot-password; session restore via `/me` (not localStorage); AuthGate gates without flashing content; demo identity isolated and read-only.

---

## 4. End-to-end test results

**Verification gaps (environment-imposed):**
- The **deployed API** (`habitflowai.onrender.com`) is unreachable from the audit sandbox — the network policy denies outbound `CONNECT` with 403. No live production/preview testing was possible.
- **DB-backed integration tests** could not run: `mongodb-memory-server` cannot download the `mongod` binary (`fastdl.mongodb.org` is also network-blocked, 403).
- Therefore the matrix below reflects **code-verified behavior** and **logic-level tests that ran**, not live end-to-end runs. Items needing a live environment are marked **NEEDS-LIVE**.

| Workflow | Method | Expected | Result | Evidence |
|---|---|---|---|---|
| Identity middleware: prod ignores headers, 401 without session | Unit test (ran) | 401 in prod when no session | ✅ PASS | `middleware/identity.test.ts`, 14 logic tests passed |
| Invite redeem / login / logout / me / forgot / reset — handler logic | Code review | Correct validation, hashing, cookie, session | ✅ PASS (code) | `routes/auth.ts` (see §3) |
| Sign-up creates account transactionally | Code review | Atomic | ❌ FAIL | Non-transactional (F-07) |
| Email verification on new account | Code review | Verification required | ❌ FAIL | Absent (F-03) |
| Open self-service sign-up | Code review | Register endpoint/UI exists | ❌ FAIL | Invite-only (F-02) |
| Session persists across refresh / restart / new tab | Code review | `/me` restores from cookie | ✅ PASS (code) | `AuthContext.tsx:63-92` |
| Sign-out invalidates server session | Code review | Row deleted + cache evicted | ✅ PASS (code) | `auth.ts:226-235` |
| Password reset revokes all sessions | Code review | All sessions deleted | ✅ PASS (code) | `auth.ts:385-389` |
| Cross-user data isolation (foreign ID) | Code review | 404, no access | ✅ PASS (code) | ownership audit, §3 well-implemented |
| Data survives second browser/device | Code review | Server-backed | ✅ PASS for core data; ❌ for pinned items / API key | F-13, F-14 |
| Reset link points to correct host | Code review | Trusted base URL | ⚠️ RISK | Host-header fallback (F-04) — **NEEDS-LIVE** to confirm exploitability |
| Rate limiting per real client IP | Code review | Per-client throttle | ⚠️ RISK | trust-proxy hop count (F-17) — **NEEDS-LIVE** |
| Prod env vars set (`NODE_ENV`, `FRONTEND_ORIGIN`, `APP_BASE_URL`, `RESEND_API_KEY`) | Config review | All set | ⚠️ UNKNOWN | Not in `render.yaml` (F-04/05/06) — **NEEDS-LIVE** |
| Duplicate email / interrupted sign-up / concurrent invite redeem | Code review | Graceful | ⚠️ PARTIAL | 11000 surfaces as 500; race possible (F-07) — **NEEDS-LIVE** |
| Mobile / multi-tab / back-button after logout | — | — | ⚠️ NOT TESTED | **NEEDS-LIVE** |

> No workflow below is marked "passing" on the basis of a UI success message; all PASS marks are code-level confirmations of the server/DB behavior. Live confirmation of the **NEEDS-LIVE** rows is required before a go decision.

---

## 5. Recommended target architecture

**Keep the existing architecture — it is fundamentally correct.** The recommendation is incremental stabilization, not a rewrite.

- **Retain:** session-cookie auth with hashed tokens; bcrypt(12); `sessionMiddleware → identityMiddleware` chain deriving identity from the cookie only; per-user `scopeFilter`/`requireScope` ownership model with server-set `userId`; reset-token pattern (hashed, single-use, TTL, session-revoke); the Vercel-rewrite same-origin proxy.
- **Repair:** transactional/idempotent signup (F-07); TTL as `Date` + missing indexes (F-12); host-header-safe reset URL (F-04); timing-safe login (F-09); CSRF posture via `SameSite=Lax` + optional token (F-08); server-authoritative pinned items (F-13); account deletion covering all collections (F-11); startup migration completeness (F-15); roster population (F-16).
- **Replace / add (only if public signup is a goal):** an open `POST /api/auth/register` flow **and** an email-verification subsystem (F-02, F-03). Reuse the reset-token infrastructure for verification tokens.
- **Identity enforcement:** already server-side and correct; add a boot assertion binding `NODE_ENV=production` + no `DEMO_MODE_ENABLED` in prod (F-05), and consider removing the header-identity path in favor of a test-only seam.
- **Profile / default-data init:** decide whether new accounts should get seed categories/onboarding. Today they start empty and create categories lazily. If seeding is added, make it **idempotent** and part of the same transaction as user creation.
- **Cross-device sync:** already correct for core data (all Mongo-backed). Fix pinned items and (optionally) the BYOK key to complete it.
- **Demo isolation:** already isolated and read-only; keep.
- **Observability:** add structured logging + alerts for auth failures, migration/index failures, and mailer failures; stop logging raw reset tokens (F-06).

---

## 6. Phased implementation plan

> Effort: XS<½d · S≈½–1d · M≈2–4d · L≈1–2wk · XL>2wk. Risk reflects blast radius.

### Phase 0 — Immediate containment *(before inviting anyone else)*
**Objective:** Remove the standing security risk and confirm the prod config is safe.
- Rotate the Atlas credential; remove the hardcoded URI and purge from history (F-01).
- Set/verify prod env in Render: `NODE_ENV=production`, `FRONTEND_ORIGIN`, `APP_BASE_URL`, `RESEND_API_KEY`/`EMAIL_FROM` (F-04, F-05, F-06). Add a boot assertion that refuses prod start without them and with `DEMO_MODE_ENABLED` unset.
- Make the reset-URL host-safe (drop the `Host` fallback in prod, allowlist) (F-04).
- **Files:** `archive/old-scripts/migrateDayLogsToEntries.ts`, `render.yaml`, `src/server/routes/auth.ts`, `src/server/index.ts`.
- **Testing:** confirm reset email link host; confirm app refuses to boot with bad env; smoke login/reset on a preview.
- **Completion:** credential rotated; all four env vars present; reset link uses `APP_BASE_URL`; no raw token in logs.
- **Effort:** S · **Risk:** Low · **Commits:** (1) remove+rotate credential, (2) env assertions, (3) reset-URL hardening.

### Phase 1 — Authentication foundation
**Objective:** Make the existing auth flows robust and safe.
- Timing-safe login (dummy-hash on unknown user) (F-09).
- CSRF posture: switch cookie to `SameSite=Lax`; optionally add a mutation `Origin`/token check (F-08).
- Transactional + idempotent invite redeem; atomic invite consumption; friendly duplicate handling (F-07).
- Session/reset TTL as `Date`; add reset-token TTL + `tokenHash` index (F-12).
- Distinguish 401 vs network error in `checkSession`; retry with backoff (F-18).
- Per-account login backoff; verify `trust proxy` depth (F-17).
- **Files:** `routes/auth.ts`, `lib/sessionCookie.ts`, `repositories/sessionRepository.ts`, `repositories/passwordResetTokenRepository.ts`, `lib/mongoClient.ts`, `store/AuthContext.tsx`, `middleware/rateLimitAuth.ts`.
- **Testing:** integration tests for concurrent redeem, duplicate email, reset-all-sessions, TTL expiry, timing parity.
- **Completion:** redeem is atomic; TTL actually purges; login timing constant; Lax cookie verified same-origin.
- **Effort:** M · **Risk:** Medium · **Commits:** one per bullet.

### Phase 2 — Ownership, persistence & (optional) open registration
**Objective:** Close persistence gaps; enable public accounts if desired.
- Server-authoritative pinned items with rollback (F-13).
- Populate `householdUsers` on signup + unique index (F-16).
- Register migration 001 at startup; run migrations before serving (F-15).
- `reorderCategories` through `requireScope` + validation (F-20).
- Decide global vs per-household email uniqueness; migrate + index (F-10).
- **If public signup:** build `POST /api/auth/register` + register UI **and** email verification (tokens, email, verify endpoint, `emailVerifiedAt`, gating) (F-02, F-03).
- **Files:** dashboard-prefs client hooks, `householdUserRepository.ts`, `migrations/startup.ts`, `categoryRepository.ts`, `userRepository.ts`, `routes/auth.ts`, new `verify-email` route + email template, register UI.
- **Testing:** cross-device pin sync; roster on signup; verification happy/expired/reused paths; dup-email migration dry-run.
- **Completion:** pins sync; roster correct; (if in scope) a fresh user registers, verifies, and uses the app.
- **Effort:** L (M without open registration) · **Risk:** Medium.

### Phase 3 — Reliability
**Objective:** Graceful failure and retry semantics.
- Idempotency keys / safe-retry on entry writes; surface (not swallow) write failures with rollback.
- Multi-tab session consistency (broadcast logout/expiry across tabs).
- Session-expiry-during-save handling (re-auth prompt, preserve unsaved input).
- `habitEntries` dedupe + enforce the unique index in prod (F-19).
- **Testing:** simulate DB timeout, expired session mid-save, double submit, two tabs.
- **Effort:** M · **Risk:** Medium.

### Phase 4 — Complete HabitFlow integration
**Objective:** Ensure every feature is correctly account-bound and portable.
- Audit each domain (habits, routines, bundles, goals, completions, analytics, settings, journals, health) for server-persistence + scoping (largely already true).
- BYOK key: server-side encrypted storage or documented single-device limit (F-14).
- Account deletion covering **all** user-scoped collections (F-11).
- **Testing:** create representative data in each domain, verify on a second device; verify deletion leaves no orphans.
- **Effort:** M–L · **Risk:** Medium.

### Phase 5 — Production hardening
**Objective:** Operability and safety at scale.
- Add `requireAdmin` to integrity-report; fix CORS methods; consider CSP (F-21, F-22).
- Structured logging + alerts (auth failures, migration/index/mailer failures); scrub secrets from logs.
- Verify Atlas backups + define restore/rollback runbook.
- Load/limit review; finalize rate-limit tuning.
- **Effort:** M · **Risk:** Low.

### Phase 6 — Beta validation
**Objective:** Prove it with real, fresh accounts.
- Fresh-account E2E from redeem/register → data → refresh → logout → login → second device.
- Migration validation on a prod-like dataset; monitored limited release.
- **Effort:** M · **Risk:** Low.

---

## 7. Prioritized action list (implementation order)

**Before inviting even one more user:**
1. Rotate the Atlas credential + remove from repo (F-01).
2. Set & assert prod env vars: `NODE_ENV`, `FRONTEND_ORIGIN`, `APP_BASE_URL`, `RESEND_API_KEY` (F-04, F-05, F-06).
3. Harden the reset-URL against host-header injection (F-04).

**Before a closed/invited beta:**
4. Transactional + idempotent invite redeem; atomic invite consumption (F-07).
5. Timing-safe login (F-09).
6. CSRF posture — `SameSite=Lax` (F-08).
7. Fix TTL (`Date`) + reset-token indexes (F-12).
8. Distinguish 401 vs network in session check (F-18).
9. Account deletion covering all collections (F-11).

**Before public self-service registration:**
10. Build open registration flow (F-02).
11. Build email verification (F-03).
12. Resolve email-uniqueness model (F-10).
13. Per-account login lockout + verify trust-proxy (F-17).

**Can safely wait:**
14. Server-authoritative pinned items (F-13), roster on signup (F-16), migration 001 (F-15), `reorderCategories` guard (F-20), BYOK server storage (F-14), integrity-report guard/CORS/CSP (F-21, F-22), routine-image owner column (F-24), session-cache expiry window (F-25).

---

## 8. Work estimate and uncertainty

| Scenario | Scope | Rough size |
|---|---|---|
| **Best case** — stay invite-only, do Phase 0–1 + account deletion | Containment + auth hardening, no new signup/verification | **~1.5–2.5 weeks** |
| **Most likely** — invite-only beta, Phase 0–3 + partial Phase 4/5 | Above + reliability + persistence fixes + hardening | **~3–5 weeks** |
| **Worst case** — public registration + verification + full hardening | All phases incl. open signup, email verification, email-uniqueness migration, BYOK server storage | **~6–9 weeks** |

**Major unknowns that could expand scope:**
- Whether the deployed prod env vars are already set correctly (needs Render access) — could make several Critical items no-ops or confirm active exposure.
- Whether existing production data has duplicate emails (blocks the global-uniqueness migration) or duplicate `habitEntries` (blocks the unique index).
- Whether Atlas transactions are available/enabled (they are on any replica set, which Atlas provides) — needed for F-07.
- Exploitability of the reset host-header issue depends on Render/Vercel `Host` passthrough (needs live test).

**Requires production credentials / DB access to verify:** env-var presence (F-04/05/06), trust-proxy hop depth (F-17), duplicate-data audits (F-10, F-19), and all **NEEDS-LIVE** rows in §4.

**Parallelizable:** frontend fixes (F-13, F-18) vs backend auth (F-07, F-09, F-12); email verification (F-03) vs account deletion (F-11).
**Sequential:** Phase 0 before all else; email-uniqueness decision (F-10) before the register flow; TTL `Date` migration (F-12) before enforcing new indexes.

---

## 9. Go/No-Go checklist

Release-blocking items (must be **live-verified**, not code-only) marked 🔴.

- [ ] 🔴 New account creation works end-to-end (redeem or register) with a **fresh** identity, verified in the DB
- [ ] 🔴 Email verification enforced *(required only for public registration)*
- [ ] 🔴 Sign-in / sign-out reliable; logout deletes the server session (verified)
- [ ] 🔴 Password recovery works via real email; link host is trusted (F-04 fixed)
- [ ] 🔴 Session persists across refresh, restart, and new tab (cookie-based)
- [ ] 🔴 Protected routes gate without flashing content
- [ ] 🔴 Server-side authorization on every mutation (no client-trusted identity) — confirmed in code; re-confirm prod `NODE_ENV`
- [ ] 🔴 Cross-user isolation verified with two real accounts (foreign-ID probes 404)
- [ ] 🔴 Atlas credential rotated and removed from the repo (F-01)
- [ ] 🔴 Prod env vars set: `NODE_ENV`, `FRONTEND_ORIGIN`, `APP_BASE_URL`, `RESEND_API_KEY`
- [ ] Cross-device persistence for **all** user data incl. pinned items (F-13)
- [ ] Complete data ownership across every domain (habits…health)
- [ ] Migration integrity: 001 applied, no schema drift, indexes present (F-12, F-15, F-19)
- [ ] Error recovery: expired session mid-save, network blip, retry — graceful (F-18)
- [ ] CSRF posture resolved (`SameSite=Lax` or token) (F-08)
- [ ] Rate limiting effective on the real client IP; per-account lockout (F-17)
- [ ] Logging/alerts for auth, migration, and mailer failures; no secrets in logs (F-06)
- [ ] Atlas backups confirmed + restore runbook
- [ ] Mobile testing (redeem/register, login, data entry)
- [ ] Account deletion removes all user-scoped data (F-11); privacy behavior documented
- [ ] Deployment config validated on preview + prod

**HabitFlow must not be considered ready for new, stable accounts until every 🔴 item is verified with a real end-to-end test.**

---

## Appendix — Recommended next implementation prompt (Phase 0 + Phase 1)

> Use this as the follow-up task for a coding agent. It is scoped for small, reviewable commits and assumes the findings above; no re-investigation needed.

**Context:** HabitFlow uses custom MongoDB-backed session auth (Express 5 + React). The account audit (`docs/audits/ACCOUNT_STABILITY_AUDIT_2026-07-11.md`) found the architecture sound but flagged containment and hardening work. Implement Phase 0 and Phase 1 below. Do **not** build open registration or email verification in this task. Commit one focused change at a time; run `npm run build` and the auth tests before pushing.

**Phase 0 — containment (each its own commit):**
1. **Remove the committed Atlas credential.** In `archive/old-scripts/migrateDayLogsToEntries.ts`, delete the hardcoded `mongodb+srv://…` fallback (line ~11); read strictly from `process.env.MONGODB_URI` and throw if unset. If the script is dead, delete it. (Note in the PR body that the credential must be rotated in Atlas — do not put any secret in the PR.)
2. **Boot-time prod assertions.** In `src/server/index.ts`, before `app.listen`, if `NODE_ENV==='production'`: assert `FRONTEND_ORIGIN`, `APP_BASE_URL`, and `RESEND_API_KEY` are set and that `DEMO_MODE_ENABLED` is **not** set; refuse to start otherwise with a clear message. Add `APP_BASE_URL`, `FRONTEND_ORIGIN`, `RESEND_API_KEY`, `EMAIL_FROM` to `render.yaml` (as `sync: false` placeholders).
3. **Host-safe reset URL.** In `src/server/routes/auth.ts` `getAppBaseUrl`, in production use `APP_BASE_URL` only and never fall back to the request `Host`; keep the request-host fallback for non-prod. In production, if the mailer is unconfigured, do **not** log the raw reset token — log only that a reset was requested.

**Phase 1 — auth hardening (each its own commit):**
4. **Timing-safe login.** In `postLogin`, when the user is not found, run `bcrypt.compare` against a constant dummy hash before returning the generic 401, so found/not-found take similar time.
5. **`SameSite=Lax` cookie.** In `src/server/lib/sessionCookie.ts`, set `sameSite: 'lax'` in production (keep `secure: true`). Verify the Vercel-rewrite same-origin flow still authenticates.
6. **Transactional, idempotent invite redeem.** In `postInviteRedeem`, wrap user+session creation in a Mongo transaction via `getClient()`. Consume the invite atomically with a `findOneAndUpdate` guarded by `uses < maxUses` instead of check-then-increment. Catch duplicate-key (`11000`) and return the existing friendly 400.
7. **Working TTL + reset-token indexes.** Store session and reset-token `expiresAt` as BSON `Date` (add a `Date` field the TTL index points at if you must keep the string for API compatibility). In `src/server/lib/mongoClient.ts`, add a TTL index and a `tokenHash` index on `passwordResetTokens`. Provide a small idempotent migration to convert existing string `expiresAt` values.
8. **Session-check resilience.** In `src/store/AuthContext.tsx` `checkSession`, treat only an explicit 401 as unauthenticated; on network error, retry `/me` with backoff and show a reconnect state instead of logging the user out.

**Tests:** add/extend integration tests for concurrent single-use invite redemption, duplicate-email redeem, login timing parity, reset-all-sessions on password change, and TTL expiry. **Definition of done:** `npm run build` green; new tests pass; `render.yaml` documents the required env vars; PR body lists the manual rotation/env steps for the operator.
