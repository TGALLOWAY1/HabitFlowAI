# DB & Environment Configuration — Resolution Trace

## How the server loads its environment

1. **Entry point**: `src/server/index.ts`
   - Line 9: `import './config/env'` — this is the **first** import, ensuring env is loaded before any other module.

2. **Env loading**: `src/server/config/env.ts`
   - Uses `dotenv.config({ path: resolve(process.cwd(), '.env') })`.
   - Loads **only** `.env` from the project root (`process.cwd()`).
   - No `.env.local`, `.env.development`, `.env.production`, or `.env.test` files are loaded.
   - No PM2 config exists — env vars come solely from the shell or `.env`.

3. **Exported getters** (read dynamically from `process.env`):
   - `getMongoDbUri()` → `process.env.MONGODB_URI || ''`
   - `getMongoDbName()` → `process.env.MONGODB_DB_NAME || ''`

4. **Also exported as constants** (evaluated once at import time):
   - `MONGODB_URI` — snapshot at import time
   - `MONGODB_DB_NAME` — snapshot at import time
   - ⚠️ Tests that change `process.env.MONGODB_DB_NAME` **after** import get stale constants but fresh getters.

## Which env vars determine the DB

| Env Var | Used By | Default | Purpose |
|---------|---------|---------|---------|
| `MONGODB_URI` | `getMongoDbUri()` | `''` (empty → throws) | Full connection string |
| `MONGODB_DB_NAME` | `getMongoDbName()` | `''` (empty → throws) | Database name |
| `USE_MONGO_PERSISTENCE` | `getMongoEnabled()` | `true` (unless `'false'`) | Feature gate |
| `LEGACY_DAYLOG_READS` | `isLegacyDaylogReadsEnabled()` | `false` | Legacy fallback reads |
| `NODE_ENV` | various guards | `undefined` | Environment mode |

## Default fallback logic

- If `MONGODB_DB_NAME` is missing or empty, `getMongoDbName()` returns `''`, and `connectToMongo()` throws: *"MONGODB_DB_NAME environment variable is not set."*
- There is **no implicit default** like `habitflowai` — the `.env.example` suggests it, but the code requires explicit configuration.
- If `USE_MONGO_PERSISTENCE` is missing or any value other than `'false'`, Mongo is considered **enabled**.

## Frontend env vars

| Env Var | Used By | Default | Purpose |
|---------|---------|---------|---------|
| `VITE_USE_MONGO_PERSISTENCE` | `persistenceConfig.ts` | `true` (unless `'false'`) | Enable Mongo mode in UI |
| `VITE_API_BASE_URL` | `persistenceConfig.ts` | `'/api'` | API base URL |

- In dev, Vite proxies `/api` → `http://localhost:3000` (see `vite.config.ts`).

## Identity resolution

- Frontend generates a UUID stored in `localStorage` under `habitflow_user_id`.
- **Hardcoded known user**: `8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb` — force-restored if different (data-loss fix).
- Sent as `X-User-Id` header on every API request.
- Backend middleware (`auth.ts`) reads `X-User-Id`; falls back to `'anonymous-user'` if missing.
- Demo mode uses separate `DEMO_USER_ID = 'demo_emotional_wellbeing'`.

## Test DB configuration

- Tests swap `process.env.MONGODB_DB_NAME` to a test-specific name (e.g. `habitflowai_test`) in `beforeAll`.
- Tests call `dropDatabase()` in `afterAll` on the test DB.
- **Risk**: No hard guard prevents tests from accidentally running against the real DB if env swap fails or is missing.
- The `getDb()` singleton caches the `db` object — if already connected, changing the env var has no effect until `closeConnection()` is called.

## .env files present

| File | Exists | Gitignored |
|------|--------|------------|
| `.env` | Yes | Yes |
| `.env.example` | Yes | Yes |
| `.env.local` | No | Would be gitignored |
| `.env.test` | No | — |
| `.env.production` | No | — |
