# Demo Architecture

How the public, no-login demo and the interactive product tour work. Related:
[`FEATURE_AUDIT.md`](../FEATURE_AUDIT.md) (what the demo is allowed to claim),
[`ROADMAP.md`](../ROADMAP.md) (what it must not claim).

## Design goals

1. **Real screens, not copies.** The demo renders the exact same pages, components, and
   API responses as the real app — there are no demo-only screen implementations to drift
   out of date. The only demo-specific UI is chrome: the banner, badge, and toasts.
2. **Server-derived truth.** Streaks, goal progress, correlations, and sleep analytics in
   the demo are computed by the same services as production, from seeded entries. If a
   number appears in the demo, the engine genuinely derived it.
3. **Read-only, defense in depth.** Writes are blocked in the client *and* rejected by the
   server. A visitor can never mutate demo data or reach any other user's data.
4. **Honest by construction.** Roadmap items are confined to the Roadmap page; sample AI
   reports are composed from the seeded dataset's actual numbers and labeled as samples.

## The three pieces

### 1. Public demo identity (server)

```
Browser ──X-Demo-Mode: true──▶ publicDemoIdentity ──▶ identityMiddleware ──▶ publicDemoReadOnlyGuard ──▶ routes
```

- `src/server/middleware/publicDemo.ts`, gated by the `PUBLIC_DEMO_ENABLED=true` env var
  (off by default; safe to enable in production — that is its purpose).
- A request carrying `X-Demo-Mode: true` **and no session** is assigned the fixed identity
  `{ householdId: 'demo-household', userId: DEMO_USER_ID }` with
  `identitySource: 'public_demo'`. The header is a boolean opt-in — it can never select an
  arbitrary user, and a real session cookie always wins.
- `publicDemoReadOnlyGuard` rejects every non-GET/HEAD/OPTIONS request for that identity
  with `403 { demoReadOnly: true }`. This also blocks the AI generation endpoints (POST),
  which is correct: live generation requires a user's own Gemini key.
- Distinct from the **dev-only** `DEMO_MODE_ENABLED` flag (header-based identity for local
  debugging, writable, never active in production). If both flags are set in dev, requests
  with the demo header get the read-only public path.

### 2. Seeded showcase data (server)

- `src/server/demo/seedShowcase.ts`, invoked at server startup when `PUBLIC_DEMO_ENABLED=true`,
  or manually via `npm run seed:showcase [-- --force]`.
- Generates ~10 weeks of deterministic (seeded PRNG), realistically imperfect data across
  every implemented domain: habits of all types (boolean, numeric, weekly, a checklist
  bundle), goals (cumulative with milestones, a completed one-time goal, a goal track whose
  stage windows are aligned with the generated run mileage), tasks, journal entries,
  morning/evening wellbeing check-ins, sleep entries with behavioral factors, medications /
  supplements / symptoms with logs, routines with variants and completion logs, dashboard
  pins, and two archived AI reports.
- The seeded sleep data contains a **real correlation** (wind-down nights score higher than
  phone-in-bed nights) so the correlation engine has something genuine to find.
- The archived AI reports are composed **from aggregates collected while seeding** — every
  number they cite is true of the dataset. The tour explicitly labels them as samples.
- **Freshness:** entries are generated relative to "today". On startup, if the newest demo
  entry is older than yesterday, the demo user's data is wiped and reseeded, so the demo
  always looks actively used. The reset is hard-guarded to the demo userId.

### 3. Demo mode (client)

- `src/lib/demoMode.ts` + `src/lib/persistenceClient.ts`.
- Active mode (`real` | `demo`) lives in `localStorage`. In demo mode the API client sends
  `X-Demo-Mode: true` and **blocks mutating requests before they leave the browser**,
  dispatching an event that surfaces a "Demo mode is read-only" toast (`Layout.tsx`).
- `AuthContext` treats demo mode as a session (no cookie needed); "Sign out" becomes
  "Exit demo". A persistent banner states the read-only contract and offers exit.
- Entry points: **"Explore the live demo"** on the login screen, `/?demo=1` links, and the
  tour's embedded preview. `/?demo=0` (or Exit demo) leaves.
- The beta-gated pages (Analytics, Insights) are viewable by the demo via
  `src/lib/betaAccess.ts`, always labeled Beta.

## The interactive tour

- `src/pages/TourPage.tsx` (`?view=tour`; also pre-login via the auth gate). Thirteen stops,
  each pairing a narrative panel with a **live preview**: one persistent `<iframe>` loading
  the app at `/?demo=1&embed=1&view=…`.
- `embed=1` marks the window as an embedded preview:
  - Demo mode is held **in memory** instead of localStorage, so the iframe can't flip the
    parent window into demo mode (`applyDemoBootParams` / `getBootModeOverride`).
  - In-app navigation uses `history.replaceState` instead of `pushState` — iframes share
    the parent's browser history, and pushing would break the tour page's Back button.
  - The app listens for same-origin `{ type: 'habitflow-demo-navigate', route, params }`
    postMessages, which is how the tour drives the preview between stops **without
    reloading it** (the iframe `src` never changes after initial load).
  - The in-app demo banner is hidden (`Layout.tsx`) — the tour provides its own framing.
- **Mobile/Desktop toggle:** the toggle resizes the iframe container (full-width vs a 390px
  phone frame). Because an iframe is a true viewport, Tailwind breakpoints, the bottom tab
  bar, and touch-target sizing all render exactly as they would on a real device — this is
  actual responsive layout, not a scaled screenshot.

## Deployment checklist

1. Set `PUBLIC_DEMO_ENABLED=true` on the backend (Render). Startup seeds/refreshes the data.
2. No frontend config needed — the login screen's demo CTA and the tour work as soon as the
   backend flag is on. (Without the flag, demo requests 401 and the demo appears empty.)
3. `/api/health` reports `publicDemo: true|false` for smoke-testing the flag.

## Threat model notes

- The demo identity is fixed server-side; `X-User-Id` / `X-Household-Id` headers are ignored
  in production regardless of the demo header.
- Demo requests are session-less GETs scoped to one userId; existing rate limiting applies.
- The read-only guard runs after identity resolution and before all data routes, so new
  routes are covered by default.
- Nothing in the demo dataset is real user data — it is generated by the seed module.
