# HabitFlowAI

Canonical project docs live in **`docs/DOC_INDEX.md`**.

## Quick start

```bash
npm install
npm run dev
```

This starts **both** the API server and the frontend:

- **API:** `http://localhost:3001` (handles all `/api/*` routes; set `PORT` in env to use a different port)
- **App:** `http://localhost:5176` (Vite proxies `/api` to the server)

**If you see 404 on `/api/*`**, the API may have failed to start (e.g. MongoDB not running or missing `MONGODB_URI`). Check the terminal where you ran `npm run dev`. To run only the frontend (when the API is already running elsewhere): `npm run dev:vite`.

## Core invariants

- **Behavioral truth** is `HabitEntry` only (MongoDB `habitEntries`). Day view, day summary, and goal progress are derived at read time; there are no DayLogs or manual goal logs.
- **DayKey** (`YYYY-MM-DD`) is the aggregation boundary; timezone is applied at the server (default America/New_York when client omits or sends invalid timezone).
- **Identity:** Requests are scoped by `X-Household-Id` and `X-User-Id`; in production both headers are required.

See `docs/ARCHITECTURE.md` and `docs/DOMAIN_CANON.md` for details.

## Safe testing

- The test suite uses **in-memory MongoDB** by default (`mongodb-memory-server`). Running `npm run test` or `npm run test:run` does **not** connect to your production or development database.
- To use a real MongoDB for integration tests you must set `ALLOW_LIVE_DB_TESTS=true` and use a DB name that contains `_test` (e.g. `MONGODB_DB_NAME=habitflowai_test`). The helper refuses to run against a non-test DB name in that mode.

Historical root-level implementation notes are in `docs/archive/root/`.
