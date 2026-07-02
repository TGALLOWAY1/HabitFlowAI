# Developer Guide

## Prerequisites

- Node.js 20+
- npm
- MongoDB reachable by `MONGODB_URI`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from [`.env.example`](../.env.example) (the example file documents every
   supported variable with safe placeholders). Required for local dev:

- `MONGODB_URI`
- `MONGODB_DB_NAME`

The full env contract (demo flags, production CORS/admin/email vars, live-DB test opt-in)
is documented in `.env.example` and the README's "Environment variables" table.

## Run Locally

- Frontend only:

```bash
npm run dev:vite
```

- API server only:

```bash
npm run dev:server
```

- Frontend + API together:

```bash
npm run dev:all
```

## Build / Lint / Test

```bash
npm run check       # typecheck + lint + tests + build
npm run build
npm run typecheck
npm run lint
npm run test        # watch mode
npm run test:run
```

## Utility Scripts

```bash
npm run check:invariants
npm run seed:emotion
npm run seed:fitness
```

## Server Notes

- Server entry: `src/server/index.ts`
- Env loader: `src/server/config/env.ts`
- Mongo feature assertion: `src/server/config/index.ts`

## Troubleshooting

### 500 errors on API endpoints (categories, habits, routines, etc.)

These usually indicate the backend cannot connect to MongoDB. Common causes:

1. **SSL/TLS "tlsv1 alert internal error" with MongoDB Atlas**  
   Node.js 24+ uses newer OpenSSL that can fail with Atlas. **Use Node.js 20 LTS**:
   ```bash
   nvm use 20   # or: brew install node@20
   ```

2. **MongoDB not reachable**  
   - Ensure `MONGODB_URI` and `MONGODB_DB_NAME` are set in `.env`
   - For Atlas: whitelist your IP in Network Access (or use `0.0.0.0/0` for local dev)
   - Get the connection string from Atlas: Connect → Drivers → Node.js

3. **Backend not running**  
   Run both frontend and backend: `npm run dev:all`

### Other issues

- If frontend cannot reach backend, verify `VITE_API_BASE_URL` and CORS in `src/server/index.ts`
- If DayKey errors appear, validate against `src/domain/time/dayKey.ts` and `src/server/domain/canonicalValidators.ts`
