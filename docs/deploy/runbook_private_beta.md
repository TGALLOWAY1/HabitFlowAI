# Runbook — Private Beta Deployment (Option B)

Deploy HabitFlow AI with **Vercel (frontend)** and **Render or Railway (backend)**. The browser talks only to Vercel; Vercel rewrites `/api/*` to the backend so requests stay same-origin and session cookies work without cross-origin issues.

## Architecture

- **Frontend:** Vite/React on Vercel. Build sets `VITE_API_BASE_URL=/api` so all API calls go to the same origin (e.g. `https://your-app.vercel.app/api`).
- **Vercel rewrites:** `vercel.json` rewrites `/api/:path*` → `https://YOUR_BACKEND_ORIGIN/api/:path*`. Replace `YOUR_BACKEND_ORIGIN` with your backend URL (see below).
- **Backend:** Express on Render or Railway. Serves `/api/*`. Session cookie is HttpOnly, Secure, SameSite=Lax in production. Health check at `GET /api/health` (no auth).

---

## 1. Deploy backend (Render or Railway)

### 1.1 Create the backend service

- **Render:** New → Web Service. Connect repo, set root to repo root. Build: `npm install` (do not use `--omit=dev` so `tsx` is available for the start command). Start: `npm start` (runs `tsx src/server/index.ts`).
- **Railway:** New Project → Deploy from repo. Build: `npm install`. Start: `npm start`.

Ensure the service listens on `PORT` (Render/Railway set this).

### 1.2 Backend environment variables

Set these in the Render/Railway dashboard (Production):

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | Yes | Database name (e.g. `habitflowai`) |
| `FRONTEND_ORIGIN` | Recommended | Vercel frontend URL (e.g. `https://your-app.vercel.app`) for CORS |
| `BOOTSTRAP_ADMIN_KEY` | First-run only | Strong secret for one-time admin creation via `POST /api/auth/bootstrap-admin` |
| `PORT` | Usually auto | Provided by Render/Railway |

Do **not** expose `BOOTSTRAP_ADMIN_KEY` in client or logs. Remove or rotate after creating the first admin if desired.

### 1.3 Health check

- **Render:** In the service, set Health Check Path to `/api/health`.
- **Railway:** Use `GET /api/health` as the health endpoint if the platform allows.

Confirm the backend is live: open `https://YOUR_BACKEND_URL/api/health` and expect `200` with `{ "status": "ok", "timestamp": "...", "env": "production" }`.

---

## 2. Deploy frontend (Vercel)

### 2.1 Connect repo and build

- Import the repo in Vercel. Framework: Vite. Build command: `npm run build`. Output directory: `dist` (Vite default).
- Root directory: repo root.

### 2.2 Vercel environment variables (Production)

| Variable | Value | Notes |
|----------|--------|--------|
| `VITE_API_BASE_URL` | `/api` | Same-origin; requests go to Vercel and are rewritten to the backend. |

If unset, the app defaults to `/api` (see `src/lib/persistenceConfig.ts`), but setting it explicitly in production is recommended.

### 2.3 Set backend URL in rewrites

`vercel.json` rewrites `/api/:path*` to the backend. **You must replace the placeholder with your real backend origin.**

1. Open `vercel.json` in the repo.
2. Replace `https://YOUR_BACKEND_ORIGIN` with your backend URL **without** a trailing slash (e.g. `https://habitflow-api.onrender.com`).
3. Commit and push so Vercel redeploys with the correct rewrite.

Example after edit:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://habitflow-api.onrender.com/api/:path*"
    }
  ]
}
```

Vercel does not expand environment variables in `vercel.json`; the destination is static in the file.

### 2.4 Deploy

Push to the connected branch or trigger a deploy from the Vercel dashboard. After deploy, the frontend URL is your Vercel URL (e.g. `https://your-app.vercel.app`).

---

## 3. Post-deploy: backend CORS (optional)

If you set `FRONTEND_ORIGIN` on the backend to your Vercel URL (e.g. `https://your-app.vercel.app`), the API will send `Access-Control-Allow-Origin: <that origin>` and `Access-Control-Allow-Credentials: true` in production. With the same-origin proxy, the browser only talks to Vercel, but this keeps CORS safe if the backend is ever called from other origins.

---

## 4. Smoke tests checklist

After both deployments:

1. **Backend health (direct)**  
   `curl -s https://YOUR_BACKEND_URL/api/health`  
   Expect: `200` and JSON with `status: "ok"`.

2. **Frontend loads**  
   Open `https://YOUR_VERCEL_URL` in a browser. App loads without errors.

3. **API via same origin (rewrite)**  
   From the browser or same-origin curl:  
   `curl -s https://YOUR_VERCEL_URL/api/health`  
   Expect: same JSON as step 1 (Vercel rewrote to backend).

4. **Login flow**  
   - Use an invite code (create one via bootstrap admin + login + `POST /api/admin/invites` if needed).  
   - Redeem invite or log in via the app.  
   - Confirm session cookie is set (e.g. in DevTools → Application → Cookies for your Vercel domain) and that `GET /api/auth/me` returns your user (e.g. from Network tab after login).

5. **Protected route**  
   While logged in, open a page that loads habits/goals/entries. Expect data or empty lists, not 401.

6. **Logout**  
   Log out and confirm the session cookie is cleared and that protected routes return 401 or redirect to login as designed.

---

## 5. Local development

- **Frontend:** `npm run dev` (Vite). Uses `vite.config.ts` proxy: `/api` → `http://localhost:3000`. Set `VITE_API_BASE_URL=/api` in `.env` or leave default so the proxy is used.
- **Backend:** `npm run dev:server` (or `npx tsx src/server/index.ts`) so the API runs on port 3000.
- **Full stack:** `npm run dev:all` if configured to run both.

No rewrite or CORS changes are required for local dev; the Vite proxy keeps requests same-origin to the dev server.

---

## 6. Troubleshooting

- **401 on all API calls from the app:** Session cookie may not be sent (wrong domain/path) or backend is not receiving the cookie. Confirm rewrites: browser URL must be the Vercel origin and path `/api/...`; cookie domain must match the Vercel domain (no cross-origin).
- **CORS errors:** With Option B, the browser should never see the backend origin; all requests go to Vercel. If you see CORS errors, the frontend may be using an absolute backend URL instead of `/api`. Ensure `VITE_API_BASE_URL=/api` in production.
- **Health check fails on Render/Railway:** Ensure `GET /api/health` is registered **before** any auth/identity middleware (it is in `app.ts`) and that the service is listening on `PORT`.
