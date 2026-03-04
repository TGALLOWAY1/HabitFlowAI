# Verification and Maintenance

Commands and checklists for routine verification. See also `docs/migrations/README.md` for migration scripts and safe-run rules.

## Test suite

Run the full test suite (default: in-memory MongoDB, no production DB):

```bash
npm run test:run
```

Watch mode (re-run on file changes):

```bash
npm run test
```

Run a specific test file:

```bash
npm run test:run -- src/server/__tests__/debug.routes.test.ts
npm run test:run -- src/server/routes/__tests__/habitEntries.dayKey.test.ts
```

Integration tests that need MongoDB use `src/test/mongoTestHelper.ts`: they start an in-memory MongoDB instance and do **not** connect to production unless `ALLOW_LIVE_DB_TESTS=true` and the DB name contains `_test`.

## Smoke test checklist

After changes to server routes, identity, or entry logic:

1. **Test suite**
   - `npm run test:run` — all tests pass.

2. **Dev server**
   - `npm run dev:all` — frontend and API start; no startup errors.
   - Open app in browser; ensure identity headers are sent (e.g. dev panel or network tab).

3. **Core read paths**
   - Day view: `GET /api/dayView?dayKey=YYYY-MM-DD&timeZone=America/New_York`
   - Day summary: `GET /api/daySummary?startDayKey=...&endDayKey=...&timeZone=...`
   - Progress: `GET /api/progress/overview?timeZone=...`
   - Entries: `GET /api/entries?dayKey=...&timeZone=...`

4. **Core write path**
   - Create or update an entry via UI or `POST /api/entries` / `PUT /api/entries`; confirm day view / summary reflect it.

5. **Production-mode guard**
   - Debug routes not registered when `NODE_ENV=production`: run `npm run test:run -- src/server/__tests__/debug.routes.test.ts`.

## Links

- **Architecture:** `docs/ARCHITECTURE.md`
- **Data model:** `docs/DATA_MODEL.md`
- **DayKey semantics:** `docs/semantics/daykey.md`
- **Migrations and safe-run:** `docs/migrations/README.md`
- **Dev guide:** `docs/DEV_GUIDE.md`
