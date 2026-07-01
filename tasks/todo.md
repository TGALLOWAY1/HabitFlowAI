# Interactive Product Tour + Public Demo Mode

Goal: replace the static Take a Tour feature list with an interactive guided tour,
add a production-safe read-only Demo Mode with seeded showcase data, a
mobile/desktop preview toggle, and a dedicated Roadmap page. Portfolio-first:
a visitor should understand HabitFlow in under 3 minutes without an account.

Architecture decisions (locked):
- Demo Mode is **server-backed**: real screens, real API, real derived views,
  scoped to seeded demo data. No fixture drift, no fake copies of screens.
- Public demo identity: persistenceClient attaches `X-Demo-Mode: true` when the
  active user mode is `demo`; server maps it to a fixed demo household/user when
  `PUBLIC_DEMO_ENABLED=true`. Works in production (unlike dev-only
  DEMO_MODE_ENABLED path, which stays unchanged).
- Read-only enforcement in BOTH layers: server middleware rejects mutating
  methods for the public demo identity (403), client intercepts writes in
  `apiRequest` and shows a friendly toast instead of firing the request.
- Tour previews the REAL app via an iframe (`?demo=1&embed=1`): the
  mobile/desktop toggle changes the iframe viewport (390px vs full), so actual
  Tailwind breakpoints and the real mobile nav render — not a scaled screenshot.
  `embed=1` → replaceState instead of pushState so iframe navigation doesn't
  pollute parent history; the tour drives the iframe via postMessage.
- Beta pages (Analytics, Insights) become viewable by the demo identity, always
  labeled Beta. Apple Health stays allowlisted (described honestly, not shown).
- Honesty rules: roadmap items never mixed into implemented features; the seeded
  sample AI report is labeled as an illustrative example of the report format,
  never claimed to be a live Gemini generation.

## Commits

- [x] 1. FEATURE_AUDIT.md — honest audit: Implemented / Partial / Roadmap
       (verified against code by 4 exploration passes).
- [x] 2. Backend: public demo identity + read-only guard middleware
       (src/shared/demo.ts additions, src/server/middleware/publicDemo.ts,
       app.ts wiring, tests).
- [x] 3. Backend: comprehensive demo showcase seed (categories, habits incl.
       numeric/weekly/bundles, ~10 weeks of entries, goals + milestones + a
       track, tasks, journal, wellbeing/sleep, medications, routines + logs,
       pinned prefs, sample AI report) — idempotent, startup-invoked when
       PUBLIC_DEMO_ENABLED, plus npm run seed:showcase.
- [x] 4. Frontend: demo mode entry/exit + read-only UX (persistenceClient header
       + write guard, AuthContext demo session, Layout demo banner + exit,
       LoginPage "Explore the demo" CTA, ?demo=1 / embed=1 boot params, demo
       access to beta pages).
- [x] 5. Frontend: interactive TourPage rewrite — step-based guided walkthrough
       (Welcome → Dashboard → Habits → Goals → Tasks → Journal → Routines →
       Weekly AI Review → Journal Intelligence → Insights/Analytics → Sleep →
       Settings → Roadmap/CTA) with live embedded demo preview and
       mobile/desktop toggle + contextual honesty callouts.
- [x] 6. Frontend: dedicated Roadmap page (?view=roadmap), reachable from tour,
       login screen, and app; content mirrors ROADMAP.md with status chips.
- [x] 7. Docs: docs/DEMO_ARCHITECTURE.md (how demo works), FEATURES.md,
       HABITFLOW_UI_ARCHITECTURE.md, README pointer.

## Verification
- [x] npm run build (tsc -b + vite build): GREEN
- [x] npm run lint:beta: 0 errors (pre-existing `any` warnings only)
- [x] npm run test:beta: 4 suites / 20 tests pass; 5 suites fail ONLY because
      mongodb-memory-server cannot download its binary in this sandbox
      (HTTP 403 via proxy — environmental, same as previous sessions)
- [x] publicDemo middleware tests: 17/17 pass
- [x] Frontend component tests: pass except TrackerGrid.clearEntry (3 tests),
      which fails identically on main — pre-existing, unrelated
- [x] Playwright smoke test (vite dev server): login CTAs render, tour renders
      13 step chips, postMessage step navigation drives the embedded preview,
      Desktop/Mobile toggle renders a real 390px viewport, Roadmap page renders
- [ ] NOT verifiable in this sandbox (MongoDB binaries blocked by proxy):
      live demo seeding + read/write enforcement against a running DB.
      Verify after deploy: set PUBLIC_DEMO_ENABLED=true on the backend, check
      /api/health reports publicDemo:true, click "Explore the live demo".
