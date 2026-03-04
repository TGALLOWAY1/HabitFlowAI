# Identity and Test Safety

Rules and practices to prevent identity chaos and production/test contamination.

## Identity

### Single source of truth

- **Server:** `identityMiddleware` in `src/server/middleware/identity.ts` is the only middleware that sets `req.householdId` and `req.userId`.
- **Headers:** `X-Household-Id` and `X-User-Id` must be sent on every API request in production.
- **Production:** If either header is missing, the middleware returns **401** and does not call `next()`. No default or anonymous identity is ever used in production.
- **Dev/test only:** When `NODE_ENV !== 'production'`, missing headers cause the middleware to set **bootstrap identity** (`default-household`, `default-user`). This path must never run in production; the middleware checks `NODE_ENV === 'production'` before the bootstrap branch.

### No anonymous fallback

- Route handlers must use `getRequestIdentity(req)` to obtain `householdId` and `userId`. They must not default to `anonymous-user` or any other placeholder.
- If identity was not set (e.g. middleware misconfiguration), `getRequestIdentity` throws. In production, identity is always set when the request reaches the route, or the client already received 401.

### Legacy auth middleware

- `src/server/middleware/auth.ts` (`userIdMiddleware`) is **deprecated**. It is not used in the app. Do not mount it in production. It previously defaulted to `anonymous-user`; the app uses `identityMiddleware` only.

## Database and test safety

### Test environment guard

- When the process is in a **test context** (`NODE_ENV === 'test'` or `VITEST` or `JEST_WORKER_ID`), the MongoDB client **refuses** to connect to a database whose name does not contain `_test` or `test_`.
- This is enforced in `src/server/lib/mongoClient.ts` inside `connectToMongo()`. If you run tests with a real URI and a DB name like `habitflowai` (no `_test`), the client throws and aborts.

### Integration tests and Atlas

- **Default:** Integration tests that use `setupTestMongo()` from `src/test/mongoTestHelper.ts` use **in-memory MongoDB** (mongodb-memory-server). They do not connect to Atlas.
- **Opt-in live DB:** To run integration tests against a real database (e.g. a dedicated test DB in Atlas), set:
  - `ALLOW_LIVE_DB_TESTS=true`
  - `MONGODB_DB_NAME` (or the name passed to `setupTestMongo`) must contain `_test` or `test_` (e.g. `habitflowai_test`).
- Never set `ALLOW_LIVE_DB_TESTS=true` with a production DB name.

### How to run tests safely

- **Unit tests (no DB):** `npx vitest run src/server/middleware/` (and other unit test paths). No MongoDB is required.
- **Integration tests (in-memory DB):** Tests that call `setupTestMongo()` in `beforeAll` get an in-memory MongoDB. Example: `npx vitest run src/server/routes/__tests__/householdUsers.test.ts`.
- **Integration tests (live test DB):** Only if you need a real DB: set `ALLOW_LIVE_DB_TESTS=true` and `MONGODB_DB_NAME=habitflowai_test` (or similar), then run the same test command. Ensure the DB name contains `_test`.

## Checklist

- [ ] No route uses `(req as any).userId || 'anonymous-user'`; all use `getRequestIdentity(req)`.
- [ ] Production deploys use `NODE_ENV=production` so bootstrap identity is never used.
- [ ] Clients send `X-Household-Id` and `X-User-Id` on every request in production.
- [ ] When running tests, either use in-memory DB (default) or `ALLOW_LIVE_DB_TESTS=true` with a `_test` DB name only.
