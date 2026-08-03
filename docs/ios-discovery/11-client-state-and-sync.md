# Task 11 — Client State, Optimistic Updates, Offline Behavior, and Synchronization

**Date:** 2026-08-03 · **Status:** Complete
**Method:** Read-only investigation of all stores, hooks, and client plumbing, building on
Tasks 3/5/9 (optimistic patterns, SW behavior, demo block). Four headline claims
spot-checked before acceptance (dead demo event, orphan wellbeing event, zero goal-cache
invalidation on entry writes, first-goal-only celebration — all confirmed at cited lines).

---

## 1. API client plumbing (`persistenceClient.apiRequest`)

- Base URL: `VITE_API_BASE_URL || '/api'`. Every request: `credentials:'include'` +
  identity headers (`X-Household-Id` from localStorage or `'default-household'`,
  `X-User-Id` from a locally-minted sticky UUID, `X-Demo-Mode` when demo). Demo mode
  blocks non-GET before fetch. 401 ⇒ dispatch `habitflow:session-expired` (consumed only
  by AuthContext).
- **Error contract to callers: a plain `Error(string)`** — no status, no class; offline
  surfaces as raw `TypeError: Failed to fetch`; the 409 fallback message is hardcoded to
  a category-specific string. **No retry, timeout, or abort anywhere.**
- Three sibling clients bypass `apiRequest` entirely (analytics, insights, aiReports)
  plus all six AuthContext calls — so no demo write-block, no 401 event, no error
  unwrapping on those paths.

## 2. Store inventory and sync classification

| Store / state | Fetch lifecycle | Write style | Convergence |
|---|---|---|---|
| `AuthContext` | `GET /auth/me` once at boot (demo short-circuits; network error ⇒ treated as logged-out) | n/a | `habitflow:session-expired` only |
| `HabitContext` (habits, categories, `logs` 90-day map, wellbeing aggregate, evidence) | 4-branch `Promise.allSettled` on mount | optimistic snapshot/rollback (whole-map flaw, Task 5) | 30 s debounced daySummary refetch + visibilitychange refetch; `extendLogWindow` merges with **existing-state-wins** (can never correct a loaded day) |
| `RoutineContext` (routines, routineLogs, execution state) | `Promise.all` on mount (no StrictMode guard — dev double-fetch) | **pessimistic** (await-then-set; closes over stale array — concurrent mutations lose one) | `routineLogs` never refetched after mount except manual refresh |
| `TaskContext` | fetch on mount | optimistic + refetch rollback | manual |
| `GoalCompletionContext` | n/a (event-driven) | server `completedGoalIds` → **first ID only** → full-screen celebration; milestone watcher is an effect over `useGoalsWithProgress` data (no polling) | see §4 |
| `DashboardPrefsContext` | `GET /dashboardPrefs` on mount | optimistic toggle w/ rollback | **carries only `hideStreaks`**; the other prefs live in 3 duplicated hook copies |
| Goal data (`goalDataCache` + 7 hooks) | shared module `Map`, TTL 30 s, stale-while-revalidate | n/a | version+listener invalidation — with holes (§4) |

## 3. Preferences: a quadruple source of truth

`pinnedRoutineIds` / `pinnedGoalIds` / `pinnedJournalTemplateIds` each live in a
module-level cache + a localStorage mirror + the server doc, reconciled with a guard that
**never lets an empty server list clear a non-empty local one** — "unpin everything" can
never propagate across devices. A dashboard render fires **four** independent
`GET /dashboardPrefs`. Writes are `.catch(() => {})` (silent divergence).
`hideStreaks`/`sleepTargets` are server-only (flash defaults on cold load);
`checkinExtraMetricKeys` has no client reader (dead, per Task 3).

## 4. Cross-store consistency — the load-bearing gaps

1. **Entry writes never invalidate the goal cache.** None of the six entry mutation
   functions call `invalidate*` (verified: zero hits), even though their responses carry
   `completedGoalIds`. Effect: toggling a habit that advances a goal leaves the Goals
   list/overview/detail stale for up to 30 s (or until remount for the two hooks that
   don't subscribe to invalidation: `useGoalDetail`, `useProgressOverview`).
2. **Milestone celebrations can't fire from a toggle** — the watcher re-runs only when
   `useGoalsWithProgress` data changes, which requires a goal-cache invalidation that
   entry writes never issue. Milestones surface on the next Goals navigation.
3. **Only `completedGoalIds[0]` celebrates** (`HabitContext.tsx:111-116`, acknowledged
   in-comment) — a single entry completing two goals drops the second celebration.
4. **`habitflow:demo-data-changed` is dead on both ends** — producers dispatch a bare
   `Event` while both consumers require `detail.reason ∈ {seed,reset}`; demo seed/reset
   never refreshes wellbeing. **`habitflow:wellbeing-entry-upsert` has a listener with
   ~50 lines of merge logic and no producer anywhere.**
5. **Cache-invalidation holes:** `createGoalTrack`/`updateGoalTrack` don't invalidate (new
   track invisible ≤30 s); `useGoalTrackDetail` subscribes but ignores freshness
   (refetches on every invalidation); `setCachedProgressOverview` cross-populates the
   `goals-with-progress` key (shape depends on page-visit order).
6. **Nothing resets on logout/user-switch** — all stores, the goal cache, pinned-pref
   module caches, and `hf_*` localStorage keys survive; the previous user's data stays
   rendered until reload.
7. `potentialEvidence` is fetched once per app load, keyed on **UTC** date (everything
   else uses local dayKey) — stale after any log, wrong day in evening US timezones.
8. Routine evidence batch is fire-and-forget with the ref cleared before the promise
   settles — the only write in the app with no error surface and no retry possibility;
   `stepStates`/`stepTrackingData`/`stepTimingData` are collected and never persisted.

## 5. localStorage census (complete)

`habitflow_user_id` (sticky identity UUID) · `habitflow_household_id` ·
`habitflow_known_user_ids` (switch-user list, max 10) · `habitflow_active_user_mode`
(real/demo) · `habitflow_gemini_api_key` (**plaintext BYOK key**) ·
`habitflow_routine_categories_expanded` · `hf_pinned_routines` ·
`hf_pinned_dashboard_goals` · `hf_pinned_journal_templates` ·
`hf_setup_guide_dismissed` · `hf_summary_banner_dismissed` (stores the summary date).
sessionStorage: two one-shot stale-chunk reload guards. No IndexedDB; session cookie is
HttpOnly/server-set.

## 6. Offline reality

**None.** No `navigator.onLine` handling, no queue/outbox/replay, no timeout/backoff;
SW caches shell only. A write while offline: HabitContext paths roll back with an error
banner (data lost); RoutineContext rethrows pre-optimistically; pref writes and evidence
batches are silently lost; **an offline app reload lands on the login screen** (network
error is treated as logged-out in `checkSession`).

## 7. iOS-relevant conclusions

- The web client is **online-only with optimistic veneer**. iOS should not port this
  architecture; it should design real client-side persistence (the API's idempotent
  upsert-by-key writes make an outbox/replay design straightforward — Task 10 §2).
- The invalidation graph is the web app's weakest part; an iOS client with a single
  normalized store (entries → derived views computed locally per Task 6's portable spec,
  or refetched per screen) avoids the entire class of stale-goal-cache bugs.
- Port decisions to copy: 90-day summary window + lazy year extension; per-device
  identity headers are legacy (session is the credential); celebration queue semantics
  (dedupe by milestoneId, acknowledge on dismiss) are worth keeping — but fix the
  first-goal-only and toggle-can't-celebrate gaps.
- Keychain replaces the plaintext localStorage Gemini key.

## 8. Items for the quality register (→ Task 12)

Dead event pair (§4.4) · zero goal-cache invalidation on entry writes + first-goal-only
celebration · logout/user-switch state leak · potentialEvidence UTC + fetch-once ·
routine evidence silent loss + unpersisted step telemetry · RoutineContext stale-closure
mutations + missing StrictMode guard · pinned-prefs quadruple source of truth +
un-syncable unpin-all + 4× prefs fetch · `useGoalDetail`/`useProgressOverview` ignore
invalidation; `useGoalTrackDetail` ignores freshness · track create/update invalidation
hole · hardcoded 409 category message · error contract is stringly-typed everywhere.
