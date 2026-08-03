# Mobile E2E Screenshot Harness

Generates a complete, iPhone-sized screenshot reference of HabitFlow — every page,
tab, modal, habit type (boolean, numeric, weekly-frequency, checklist bundle, choice
bundle), and major flow — intended as the visual spec for the native iPhone app.

The captured set lives in [`e2e/screenshots/`](screenshots/README.md) together with a
generated gallery README and `manifest.json` (section / title / description per shot).

## How to run

```bash
npm run screenshots:mobile
```

That single command:

1. **Starts a throwaway MongoDB** — `e2e/.cache/mongod` if present, otherwise
   `mongodb-memory-server` (which downloads a binary from fastdl.mongodb.org).
2. **Starts the Express API** on port 3001 with `PUBLIC_DEMO_ENABLED=true` and seeds
   the public showcase dataset (`src/server/demo/seedShowcase.ts`) — ~10 weeks of
   realistic habits, entries, goals, routines, journal, wellbeing, and sample AI
   reports — plus screenshot-only extras (`e2e/seedExtras.ts`, a choice bundle).
3. **Builds the frontend and serves it** (`vite build` + `vite preview`) on port 5176.
   A production build is used so dev-only chrome (identity panel, demo seed buttons)
   doesn't appear in the screenshots. Set `SKIP_BUILD=1` to reuse an existing `dist/`
   while iterating on the spec.
4. **Runs Playwright** (`e2e/mobile-screenshots.spec.ts`) in a mobile Chromium context —
   390×844 viewport, 2× scale, touch enabled, iPhone user agent — walking the app in
   read-only demo mode (`/?demo=1&embed=1`) and writing PNGs to `e2e/screenshots/`.

The environment can also be started on its own (e.g. for manual poking or running the
spec against a live server): `npm run screenshots:serve`, then
`npx playwright test --config playwright.config.ts` in another terminal
(`reuseExistingServer` picks it up).

## Sandboxed / offline environments

If `fastdl.mongodb.org` is blocked (as in some sandboxed CI/agent environments), fetch
a real `mongod` once via the official `mongo:8.0` container image — no Docker needed,
just the OCI registry HTTP API:

```bash
node e2e/fetch-mongod.mjs   # caches the binary at e2e/.cache/mongod
```

`e2e/serve.ts` prefers that cached binary automatically (override with `MONGOD_BIN`).
The binary targets Ubuntu 24.04 x86_64 (matches the image base).

If the Playwright-pinned Chromium can't be downloaded, the config automatically uses a
pre-installed browser at `/opt/pw-browsers/chromium` when one exists.

## Design notes

- **Demo mode is the backbone.** The suite browses the same read-only public demo the
  tour uses (`/?demo=1`): real screens, server-derived data, writes blocked
  client- and server-side. `embed=1` keeps demo mode in memory (nothing persisted to
  localStorage) and hides the demo banner so shots show clean app chrome.
- **Readiness contract.** `e2e/serve.ts` only opens port 5176 after the API is up and
  the seed completed, so Playwright's single `webServer.url` check is sufficient.
- **Tests are independent.** Each test navigates fresh via URL params and reaches
  modals with real taps; a failed shot never blocks the rest of the suite.
- **Screenshots are the artifact, not assertions.** This is not a regression suite —
  a test "passes" when its screenshot is captured. Keep it that way; add visual
  assertions elsewhere if needed.
- `e2e/probe.mjs` is a scratch utility that dumps the ARIA snapshot of any app state —
  useful for finding accessible names when extending the spec.

## Updating the set

After UI changes, re-run `npm run screenshots:mobile` and commit the refreshed
`e2e/screenshots/` output. When adding screens to the app, add a matching test to
`e2e/mobile-screenshots.spec.ts` (see the section conventions at the top of that file).
