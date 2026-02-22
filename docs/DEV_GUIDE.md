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

2. Create `.env` from `.env.example` and set values:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `USE_MONGO_PERSISTENCE` (server flag, default true unless set to `false`)
- `VITE_USE_MONGO_PERSISTENCE` (frontend flag, default true unless set to `false`)
- `VITE_API_BASE_URL` (optional)

## Run Locally

- Frontend only:

```bash
npm run dev
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
npm run build
npm run lint
npm run test
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

- If API calls fail, check `MONGODB_URI` and that Mongo is running.
- If frontend cannot reach backend, verify `VITE_API_BASE_URL` and CORS behavior in `src/server/index.ts`.
- If DayKey errors appear, validate timezone/dayKey inputs against `src/domain/time/dayKey.ts` and `src/server/domain/canonicalValidators.ts`.
