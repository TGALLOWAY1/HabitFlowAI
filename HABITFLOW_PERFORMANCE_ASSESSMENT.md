# HabitFlowAI Performance Assessment

**Date:** 2026-04-07
**Scope:** Full-stack performance audit — frontend, backend, network, mobile
**Methodology:** Static code analysis of actual codebase, architecture review, inferred runtime behavior

---

## 1. Executive Summary

HabitFlowAI has **targeted performance problems** that compound into a noticeably sluggish experience, particularly on initial load, the dashboard, and analytics pages. The app is not fundamentally broken, but it ships as a monolithic single-chunk bundle, performs redundant/unfiltered database queries, lacks caching at every layer, and suffers from unnecessary React re-renders due to unmemoized context providers.

### Verdict: **Needs Targeted Optimization**

The app is usable but will feel increasingly slow as users accumulate data. With 50+ habits and months of entries, several pages will degrade noticeably — especially on mobile devices.

### Top 5 Most Important Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **No code splitting** — entire app in single bundle | `src/App.tsx:14-42` | Every page load downloads all pages (~200KB+ gzipped) |
| 2 | **Unmemoized HabitContext provider value** | `src/store/HabitContext.tsx:879-907` | Any state change re-renders entire app tree below providers |
| 3 | **N+1 bundle membership queries** on dashboard | `src/server/routes/progress.ts:85-86` | Sequential DB queries per bundle parent, adding 50-200ms |
| 4 | **All habit entries loaded without date filtering** | `src/server/repositories/habitEntryRepository.ts` | Analytics/progress endpoints load entire user history every request |
| 5 | **Zero caching at any layer** (except 30s goal cache) | Server + client | Every navigation re-fetches everything from scratch |

---

## 2. Page-by-Page Performance Review

### Overview Table

| Page/View | Likely Slowness | Primary Bottleneck | Severity |
|-----------|----------------|-------------------|----------|
| **Initial App Load** | High | Single bundle + 4 parallel API calls + auth check | **Critical** |
| **Dashboard** (`ProgressDashboard`) | Medium-High | `progress/overview` endpoint (loads all entries, N+1 bundles, streak calc) | **High** |
| **Today / Day View** | Medium | `dayView` endpoint + per-habit weekly progress derivation | **Medium** |
| **Tracker Grid** (Habits) | Medium-High | 1500+ DOM nodes (habits × days), no virtualization, full re-render on toggle | **High** |
| **Goals Page** | Medium | Sequential bundle resolution per goal in `goalProgressUtilsV2.ts:44-66` | **Medium** |
| **Goal Detail Page** | Medium | Largest page component (638 lines) + multiple chart components | **Medium** |
| **Analytics Page** | High | 4+ parallel API calls, each loading ALL entries without date filtering | **High** |
| **Routines** | Low-Medium | Routine list is typically small; execution state changes are frequent but scoped | **Low** |
| **Journal** | Low | Simple list, no heavy computation | **Low** |
| **Tasks** | Low | Simple CRUD, small dataset | **Low** |
| **Wellbeing History** | Medium | 391-line component, date range queries | **Medium** |
| **Apple Health** | Low-Medium | 422 lines but rarely visited, isolated data | **Low** |

### Detailed Page Analysis

#### Initial App Load
- **What happens:** Browser downloads single JS bundle containing ALL pages (~200KB+ gzipped). React mounts with 6 nested providers (`AuthProvider` → `HabitProvider` → `RoutineProvider` → `TaskProvider` → `DashboardPrefsProvider` → `Layout`). AuthGate blocks rendering until session check completes. Then HabitContext fires 4 parallel requests (`Promise.allSettled` at `HabitContext.tsx:200-208`): habits+categories, 400-day log summary, wellbeing logs, and potential evidence. RoutineProvider also fetches routines and logs. TaskProvider fetches tasks.
- **Blocking path:** Auth check → HabitContext init (all 4 must settle) → first render
- **Estimated time to interactive:** 1.5-3s on fast connection, 3-5s+ on mobile/slow connections
- **Key concern:** The 400-day `fetchDaySummary` call (`HabitContext.tsx:95-103`) can return 100-300KB for active users. This blocks the loading state from clearing.

#### Dashboard (`ProgressDashboard`)
- **What happens on load:** Calls `useProgressOverview` hook which hits `GET /api/progress/overview`. This endpoint (`progress.ts:34-205`) loads ALL habits, ALL entries (no date filter), and ALL goals in parallel — then loops over bundle parents with sequential `getMembershipsByParent()` calls (N+1 at line 85-86), calculates streaks for every active habit, and computes global + category momentum.
- **What happens on render:** `ProgressDashboard` (262 lines) renders 8+ child components including `ProgressRings` (which contains PieChart + LineChart from Recharts). Goal sparklines render for each goal card.
- **After interaction:** Toggling a habit triggers HabitContext state update → unmemoized provider value → entire app tree re-renders, including dashboard charts.
- **Severity:** **High** — this is the most-visited page and the slowest endpoint.

#### Tracker Grid (Habits Page)
- **What happens on load:** Renders `TrackerGrid` (`src/components/TrackerGrid.tsx`, 1538 lines). For a month view with 50 habits × 31 days = 1,550+ interactive DOM cells. Each cell has click handlers, tooltip state, and conditional styling. Uses `@dnd-kit` for drag-and-drop reordering of habit rows.
- **What happens on render:** Full grid re-renders on ANY habit or log change because it consumes `useHabitStore()` which returns the entire unmemoized context value.
- **After interaction:** Toggling a single habit cell triggers: API call → HabitContext state update → full grid re-render of all 1,550+ cells.
- **Severity:** **High** for users with 50+ habits. The DOM node count alone causes layout thrashing on re-render.

#### Analytics Page
- **What happens on load:** `AnalyticsPage` (232 lines at `src/pages/AnalyticsPage.tsx`) fires 4+ parallel API calls: summary, heatmap, trends, category breakdown. Each of these endpoints (`analytics.ts:33-176`) independently loads ALL habits and ALL entries from the database — the same full dataset fetched 4 times in parallel, then filtered/aggregated in the service layer.
- **What happens on render:** Multiple Recharts components render (TrendChart, heatmap visualization). Data transformations happen in the analytics service layer server-side.
- **Severity:** **High** — the redundant full-entry loads multiply the database pressure by 4x.

#### Goals Page
- **What happens on load:** `GoalsPage` (358 lines) calls `useGoalsWithProgress` which hits `GET /api/goals-with-progress`. The endpoint resolves bundle memberships sequentially per goal via `goalProgressUtilsV2.ts:44-66`.
- **What happens on render:** Goals rendered in collapsible stacks with drag-and-drop. `GoalSparkline` charts render inline for each goal.
- **Severity:** **Medium** — scales with number of goals that reference bundles.

#### Day View
- **What happens on load:** `DayView` (468 lines at `src/components/day-view/DayView.tsx`) calls `GET /api/dayView` endpoint. Server derives weekly progress per habit by filtering entire entry views array repeatedly (`dayViewService.ts:119-166`).
- **Severity:** **Medium** — the per-habit filtering is O(habits × entries) but typically for a single day's context.

---

## 3. Frontend Performance Findings

### 3.1 Bundle Size & Code Splitting

**Finding: No code splitting exists. Zero `React.lazy()`, zero dynamic `import()`, zero `Suspense` boundaries.**

- **Evidence:** `src/App.tsx:14-42` statically imports every page component:
  ```
  import { GoalsPage } from './pages/goals/GoalsPage';
  import { AnalyticsPage } from './pages/AnalyticsPage';
  import { JournalPage } from './pages/JournalPage';
  import { TasksPage } from './pages/TasksPage';
  import { AppleHealthPage } from './pages/AppleHealthPage';
  import { WellbeingHistoryPage } from './pages/WellbeingHistoryPage';
  // ... 10+ more page imports
  ```
- **Vite config** (`vite.config.ts`) is minimal — no `build.rollupOptions.output.manualChunks`, no vendor splitting, no optimization configuration beyond the default `react()` plugin.
- **Estimated bundle composition** (gzipped):
  - React 19: ~50KB
  - Recharts: ~27KB
  - @dnd-kit (core + sortable + utilities): ~15KB
  - date-fns: ~13KB (tree-shakeable, but used broadly)
  - lucide-react: ~30KB (icon library)
  - Application code: ~50-100KB
  - **Total: ~185-235KB gzipped in a single chunk**
- **Impact:** Users visiting only the dashboard still download goals, analytics, health, journal, debug pages. First contentful paint delayed by full bundle parse time.
- **Severity:** **High**

### 3.2 Context Provider Re-render Cascade

**Finding: HabitContext provider value is not memoized, causing full subtree re-renders on any state change.**

- **Evidence:** `src/store/HabitContext.tsx:879-907` — the Provider value is a new object literal on every render:
  ```tsx
  <HabitContext.Provider value={{
      categories, habits, logs, wellbeingLogs,
      addCategory, updateCategory, addHabit, updateHabit,
      // ... 18+ properties
  }}>
  ```
  Since this creates a new object reference on every render, ALL consumers of `useHabitStore()` re-render whenever ANY state in the provider changes — even if the specific data they use hasn't changed.

- **Scope of impact:** 6 nested providers wrap the entire app (`AuthProvider` → `HabitProvider` → `RoutineProvider` → `TaskProvider` → `DashboardPrefsProvider` → `ToastProvider`). The HabitProvider is the heaviest — it holds:
  - `categories[]` (5-10 items)
  - `habits[]` (20-100+ items)
  - `logs: Record<string, DayLog>` (~400+ entries keyed by `{habitId}-{date}`)
  - `wellbeingLogs: Record<string, DailyWellbeing>` (~400 entries)
  - `potentialEvidence[]`
  - 15+ mutation functions

- **Mitigation in place:** HabitContext does use `useCallback` for its internal functions (`loadLogsFromApi`, `refreshHabitsAndCategories`, etc. at lines 107-171). However, the Provider value itself is not wrapped in `useMemo`, negating this benefit.

- **RoutineContext** (`src/store/RoutineContext.tsx`) also holds execution state (`activeRoutine`, `currentStepIndex`, `stepStates`, `stepTimingData`) that changes frequently during routine running. Not verified whether its provider value is memoized.

- **Severity:** **High** — this is the single most impactful React-level performance issue.

### 3.3 Memoization Strategy

**Finding: Partial memoization — better than none, but inconsistently applied.**

- **TrackerGrid** (`src/components/TrackerGrid.tsx`) uses `useMemo` in 8 places for derived data (root habits, daily habits, dates, progress maps). This is good but insufficient because the entire component still re-renders when the unmemoized context value changes.
- **ProgressDashboard** uses 4 `useMemo`/`useCallback` instances.
- **GoalDetailPage** uses 6 instances — reasonable coverage.
- **No `React.memo()` wrappers found** on any page or major component. This means even correctly memoized child data gets discarded when parent re-renders.
- **Pattern:** Components memoize their internal derived data but don't prevent their own re-render from being triggered by context changes.

### 3.4 Chart & Visualization Components

**Finding: Recharts (~27KB gzipped) is eagerly loaded in the main bundle. Charts are not lazy-loaded.**

- Chart components:
  - `src/components/goals/GoalTrendChart.tsx` — ComposedChart (Line + Area)
  - `src/components/goals/GoalSparkline.tsx` — AreaChart (rendered inline for each goal card)
  - `src/components/goals/GoalCumulativeChart.tsx` — AreaChart
  - `src/components/ProgressRings.tsx` — PieChart + LineChart (dashboard)
  - `src/components/analytics/TrendChart.tsx` — AreaChart (analytics page)
- Chart data transformations use `useMemo` (good), but `ResponsiveContainer` from Recharts triggers layout reflow on window resize events.
- **Impact:** Recharts is the 2nd largest dependency. Users who never visit analytics/goals still pay for it.
- **Severity:** **Medium**

### 3.5 List Rendering & Virtualization

**Finding: No virtualization library used anywhere. No react-window, react-virtual, or react-virtuoso.**

- **TrackerGrid:** 50 habits × 31 days = 1,550+ DOM nodes in month view. Each cell is interactive with click handlers. At 100 habits this doubles to 3,100+ nodes — well into "janky on mobile" territory.
- **DayView:** Habits grouped by category, each section rendered in full.
- **GoalsPage:** Goals in collapsible stacks — typically 5-30 items, manageable without virtualization.
- **Impact:** Primarily affects TrackerGrid for power users with many habits. Most other lists are under 50 items.
- **Severity:** **Medium** (High for power users with 50+ habits)

### 3.6 Blocking Initialization Logic

**Finding: App is blocked from rendering until HabitContext finishes loading ALL 4 data sources.**

- `HabitContext.tsx:200-208` uses `Promise.allSettled` for 4 fetches. While they run in parallel, `setLoading(false)` only fires after ALL settle (line 217).
- This means the slowest of 4 requests determines time-to-first-render.
- The 400-day `fetchDaySummary` is likely the slowest (largest payload).
- **Better approach:** Show UI incrementally as each data source arrives. Habits/categories are needed for rendering; wellbeing and evidence are not critical path.
- **Severity:** **Medium-High**

### 3.7 Startup Console Logging

**Finding: Excessive `console.log` calls in HabitContext initialization path.**

- `HabitContext.tsx:184-216` has 8 `console.log` statements in the initialization path. While individually cheap, this adds minor overhead and indicates debug logging left in production code.
- **Severity:** **Low**

---

## 4. Network and Data Flow Findings

### 4.1 Duplicate / Redundant API Requests

**Finding: Dashboard loads overlapping data from multiple endpoints.**

- `useProgressOverview` fetches `GET /api/progress/overview` which returns `goalsWithProgress` as part of the response.
- `useGoalsWithProgress` fetches `GET /api/goals-with-progress` which returns the same goal data.
- Both hooks are used on the dashboard, resulting in overlapping goal progress computation done twice server-side.
- The code itself acknowledges this issue in TODO comments at `src/lib/useProgressOverview.ts:17-24`.
- **Impact:** 1 redundant API call + redundant server computation on every dashboard load.
- **Severity:** **Medium**

### 4.2 No Request Deduplication

**Finding: `src/lib/persistenceClient.ts` (1484 lines) has no request deduplication mechanism.**

- If two components simultaneously request the same endpoint, two separate HTTP requests fire.
- Only goal-related data has a cache layer (`src/lib/goalDataCache.ts` with 30s TTL).
- Habit data, routine data, task data, journal data — all uncached.
- **Cache implementation:** The goal cache is well-structured (stale-while-revalidate pattern with event-based invalidation via `subscribeToCacheInvalidation`), but it only covers 4 cache keys: `goals-with-progress`, `progress-overview`, `completed-goals`, and `goal-detail-{id}`.
- **Severity:** **Medium**

### 4.3 Large Payloads: 400-Day Log Window

**Finding: HabitContext fetches a 400-day log summary on every initialization.**

- `src/store/HabitContext.tsx:95-103` computes a 400-day window for `fetchDaySummary`:
  ```
  start.setDate(start.getDate() - 400); // Always 400 days back
  ```
- For an active user with 50 habits tracked daily, this is potentially:
  - 50 habits × 400 days × ~50 bytes per log entry = ~1MB raw, ~100-300KB over the wire
- This blocks the loading state from clearing (line 217).
- Most users only need the last 7-30 days for the main view. Historical data could be loaded on demand.
- **Severity:** **High**

### 4.4 Analytics Page: 4× Redundant Full-Entry Loads

**Finding: The analytics page triggers 4 separate API calls, each of which loads ALL habit entries from the database.**

- `src/server/routes/analytics.ts` endpoints:
  - `getHabitAnalyticsSummary` (line 40): `getHabitEntriesByUser(householdId, userId)` — ALL entries
  - `getHabitAnalyticsHeatmap` (line 62): `getHabitEntriesByUser(householdId, userId)` — ALL entries again
  - `getHabitAnalyticsTrends` (line 80+): ALL entries again
  - `getHabitAnalyticsCategoryBreakdown` (line 100+): ALL entries again
- Each call independently loads the complete entry collection for the user, then filters by date in the service layer.
- **Impact:** 4× database read amplification. For a user with 10,000 entries, that's 40,000 entry documents read from MongoDB per analytics page load.
- **Better approach:** Either consolidate into a single endpoint that computes all analytics from one data load, or add date-range filtering at the repository level.
- **Severity:** **High**

### 4.5 No Server-Side Cache Headers

**Finding: No ETags, no `Cache-Control` on API responses (except routine images).**

- The only `Cache-Control` header found is on routine image assets: `res.setHeader('Cache-Control', 'public, max-age=86400')` in `src/server/routes/routines.ts:695`.
- All JSON API responses have no caching hints. Browsers cannot use conditional requests (`If-None-Match`) to avoid re-downloading unchanged data.
- **Severity:** **Medium**

### 4.6 Sequential Requests That Should Be Parallel

**Finding: Most data fetching is already parallelized — this is a relative strength.**

- HabitContext uses `Promise.allSettled` for its 4 initial fetches (good).
- Progress overview uses `Promise.all` for habits + entries + goals (good).
- Analytics endpoints use `Promise.all` for habits + entries (good).
- **One exception:** Bundle membership resolution in `goalProgressUtilsV2.ts:44-66` is sequential (see Backend findings).
- **Severity:** **Low** (mostly addressed already)

### 4.7 Polling & Refetching Patterns

**Finding: No automatic polling detected. Data is fetched on mount only.**

- `useProgressOverview` fetches once on mount with stale-while-revalidate from cache.
- `useGoalsWithProgress` same pattern.
- HabitContext fetches once on mount (guarded by `initializedRef`).
- No `setInterval`-based polling found.
- **Risk:** If the user leaves the tab open and returns, they see stale data until they navigate away and back. Not a performance issue, but a freshness trade-off.
- **Severity:** **Low**

---

## 5. Backend / API / Database Findings

### 5.1 N+1 Bundle Membership Queries

**Finding: Two critical endpoints loop over bundle parents with sequential database queries.**

- **`GET /api/progress/overview`** — `src/server/routes/progress.ts:85-86`:
  ```ts
  for (const parent of bundleParents) {
    const memberships = await getMembershipsByParent(parent.id, householdId, userId);
    // ... per-parent derivation
  }
  ```
  If a user has 10 bundle parents, this is 10 sequential DB queries within a single request handler.

- **`GET /api/daySummary`** — `src/server/routes/daySummary.ts:192-195`:
  ```ts
  for (const parent of bundleParents) {
    const memberships = await getMembershipsByParent(parent.id, householdId, userId);
    // ... per-parent derivation
  }
  ```
  Same pattern, same cost.

- **Notably:** The analytics routes already use `getAllMembershipsByUser()` (at `analytics.ts:43`) — the batch-fetch function exists but isn't used in progress or daySummary.

- **Impact:** Adds 50-200ms per request depending on bundle count and DB latency.
- **Fix complexity:** Low — replace loop with existing `getAllMembershipsByUser()` + client-side grouping.
- **Severity:** **High**

### 5.2 Unfiltered Full-Entry Loads

**Finding: `getHabitEntriesByUser()` loads ALL non-deleted entries with no date range, limit, or projection.**

- **Location:** `src/server/repositories/habitEntryRepository.ts:365-377`:
  ```ts
  const documents = await collection
    .find(scopeFilter(householdId, userId, { deletedAt: { $exists: false } }))
    .toArray();
  ```
  Returns every entry ever created by the user. No `.limit()`, no date-range filter, no `.projection()`.

- **Callers:**
  - `GET /api/progress/overview` (`progress.ts:44`) — all entries for streak/momentum calculation
  - `GET /api/analytics/habits/summary` (`analytics.ts:42`) — all entries
  - `GET /api/analytics/habits/heatmap` (`analytics.ts:64`) — all entries
  - `GET /api/analytics/habits/trends` (`analytics.ts:80+`) — all entries
  - `GET /api/analytics/habits/categoryBreakdown` (`analytics.ts:100+`) — all entries

- **Scaling concern:** A user tracking 50 habits daily for 2 years generates ~36,500 entries. Loading all of them on every request is O(n) in perpetuity with no bound.
- **Impact:** 100-500ms+ per endpoint for long-term users, multiplied by 4x on the analytics page.
- **Severity:** **High**

### 5.3 Ping on Every `getDb()` Call

**Finding: Every database access pings MongoDB to verify the connection is alive.**

- **Location:** `src/server/lib/mongoClient.ts:210-214`:
  ```ts
  if (db && client) {
    try {
      await client.db().admin().ping();  // 5-10ms per call
      await runIndexEnsurance(db);
      return db;
    }
  }
  ```
  The `getDb()` function is called by every repository function. Each call does:
  1. `admin().ping()` — verifies connection (~5-10ms network round-trip)
  2. `ensureCoreIndexes()` — guarded by `indexesEnsuredForDbName` check (fast after first call)

- **Impact:** 5-10ms added to every single database operation. For an endpoint that makes 3 DB calls, that's 15-30ms of pure ping overhead.
- **Better approach:** Trust the MongoDB driver's built-in connection monitoring. Only reconnect on actual operation failures. The driver already handles connection pool health internally.
- **Severity:** **Medium-High**

### 5.4 Index Ensurance on Every `getDb()` Call

**Finding: `ensureCoreIndexes()` is called on every `getDb()` invocation.**

- While `ensureCoreIndexes()` at `mongoClient.ts:123-166` has a guard (`indexesEnsuredForDbName`), it's still called every time `getDb()` is invoked. After the first call, it returns immediately, but the function call + string comparison overhead is unnecessary.
- The `runIndexEnsurance` wrapper itself is recreated as a closure on every `getDb()` call (line 199-206).
- **Impact:** Negligible after first request, but the `ping()` issue amplifies it.
- **Severity:** **Low**

### 5.5 Streak Calculation Per Habit Per Request

**Finding: Streak metrics are recalculated from raw entry data for every active habit on every progress overview request.**

- **Location:** `src/server/services/streakService.ts` — `calculateHabitStreakMetrics()` processes all day states for a habit:
  1. Filters completed/frozen entries
  2. Sorts all dayKeys
  3. Walks backward to find current streak (O(n) per habit)
  4. Calculates best consecutive span (O(n) per habit)
  
- Called in `progress.ts` for every active habit (line ~130+).
- **Impact:** For 50 active habits with 400 days each: 50 × 400 = 20,000 iterations minimum.
- **No caching:** Results are discarded after each request. The same streaks are recalculated on the next page load.
- **Severity:** **Medium** — the computation itself is fast (O(n) linear), but it's done repeatedly with no caching.

### 5.6 Missing Database Indexes

**Finding: Current indexes cover the basics but miss key query patterns.**

- **Existing indexes** (`mongoClient.ts:141-160`):
  - `habitEntries`: `(userId, id)` unique, `(userId, habitId, timestamp)`, `(userId, habitId, dayKey)` unique
  - `healthMetricsDaily`: `(householdId, userId, dayKey, source)` unique
  - `habitHealthRules`: `(householdId, userId, habitId)` unique
  - `healthSuggestions`: `(householdId, userId, dayKey, status)`

- **Missing indexes for common query patterns:**
  - `habitEntries (householdId, userId, deletedAt)` — used by `getHabitEntriesByUser()` which is called by 5+ endpoints. Current query uses `scopeFilter(householdId, userId, { deletedAt: { $exists: false } })` but there's no compound index covering this filter.
  - `habitEntries (householdId, userId, dayKey)` — for date-range queries (not yet implemented but needed for the recommended fix in 5.2)
  - `bundleMemberships (householdId, userId, parentHabitId)` — for `getMembershipsByParent()` calls

- **Impact:** Without a covering index, `getHabitEntriesByUser()` may perform a collection scan on the `deletedAt` filter portion.
- **Severity:** **Medium**

### 5.7 No Server-Side Caching

**Finding: Zero caching mechanisms exist on the server.**

- No Redis integration
- No in-memory cache (LRU, TTL, etc.)
- No materialized views / precomputed tables
- No ETag generation for conditional responses
- The only "cache" is the per-request variable reuse within a single request handler

- **Impact:** Every request recalculates everything from scratch. The progress overview endpoint (streak calculation + momentum + bundle derivation + goal progress) likely takes 200-500ms per call, every time.
- **Severity:** **High** for frequently-hit endpoints like progress overview.

### 5.8 Session Query on Every Request

**Finding: Session middleware queries the database to validate the session on every authenticated request.**

- `src/server/middleware/session.ts` reads the `hf_session` cookie, hashes it, and queries the `sessions` collection.
- This adds one DB query per request for session validation.
- **Impact:** ~5-15ms per request. Compounded with the `ping()` overhead, that's 10-25ms before any business logic runs.
- **Better approach:** Cache validated sessions in memory with a short TTL (e.g., 60s).
- **Severity:** **Medium**

---

## 6. Mobile-Specific Performance Risks

### 6.1 TrackerGrid DOM Weight

- **Risk:** 1,550+ interactive DOM nodes (50 habits × 31 days) in the tracker grid is heavy for mobile devices. Lower-end phones (2-3GB RAM, older SoCs) will struggle with layout recalculation when cells are toggled.
- **Compounding factor:** Each cell toggle triggers a full grid re-render (due to unmemoized context) — all 1,550+ cells are diffed and potentially re-laid out.
- **Expected behavior on mobile:** Noticeable jank (100-300ms) when toggling a habit cell. Scrolling may feel stuttery on the month view.
- **Severity:** **High** on mobile

### 6.2 Chart Rendering

- **Risk:** Recharts `ResponsiveContainer` triggers layout reflow on resize events. On mobile, orientation changes and virtual keyboard appearance/disappearance trigger resize events, causing chart re-renders.
- **Components affected:** `ProgressRings` (dashboard), `GoalSparkline` (goals page), `GoalTrendChart` (goal detail), `TrendChart` (analytics).
- **Expected behavior:** Charts may flicker or lag during orientation changes. Multiple sparklines on the goals page multiply this effect.
- **Severity:** **Medium** on mobile

### 6.3 Single-Chunk Bundle Parse Time

- **Risk:** Mobile browsers parse JavaScript significantly slower than desktop (~2-5x). A ~200KB+ gzipped bundle decompresses to ~600KB-1MB of JavaScript that must be parsed before any rendering begins.
- **Expected behavior:** On a mid-range phone with a 3G/4G connection, initial load could take 5-8 seconds (download + parse + execute + API calls + render).
- **Severity:** **High** on mobile

### 6.4 Large Context State in Memory

- **Risk:** HabitContext holds ~50KB of state (400 days of logs for potentially 50+ habits). On memory-constrained mobile devices, this contributes to memory pressure and potential garbage collection pauses.
- **Compounding factor:** The unmemoized provider value creates a new object reference on every render, generating garbage for the GC to collect.
- **Severity:** **Low-Medium** — modern phones handle this, but older devices may experience GC pauses.

### 6.5 Touch Interaction Latency

- **Risk:** Drag-and-drop via `@dnd-kit` on TrackerGrid and GoalsPage may feel unresponsive on touch devices if the component is mid-re-render when the touch event fires.
- **Risk:** No `touch-action: manipulation` CSS found, which means the browser's default 300ms tap delay may apply on some older mobile browsers.
- **Severity:** **Low-Medium**

### 6.6 No Mobile-Specific Data Loading

- **Risk:** Mobile and desktop load identical payloads. No reduced data mode, no progressive loading, no viewport-based data fetching.
- **Impact:** Mobile users on slower connections download the same 400-day log summary as desktop users on fiber.
- **Severity:** **Medium**

---

## 7. Most Likely Root Causes of Perceived Slowness

Ranked by likely contribution to user-perceived slowness.

### Rank 1: Monolithic Bundle + No Code Splitting
- **What:** The entire application (all pages, all charts, all icons, all drag-and-drop code) is shipped as a single JavaScript chunk. No route-level splitting.
- **Where:** `src/App.tsx:14-42` (static imports), `vite.config.ts` (no chunking config)
- **Why it matters:** First paint is blocked until the full ~200KB+ gzipped bundle is downloaded, decompressed (~700KB+), and parsed. On mobile/slow connections, this alone accounts for 2-4 seconds of load time.
- **Confidence:** **Very High** — this is a structural fact, not a heuristic.
- **How to verify:** Run `npx vite build --report` or use `rollup-plugin-visualizer` to see the single-chunk output. Measure bundle size with `ls -la dist/assets/*.js`.

### Rank 2: Unmemoized HabitContext Provider Value
- **What:** The HabitContext provider creates a new value object on every render, causing all consuming components to re-render unnecessarily.
- **Where:** `src/store/HabitContext.tsx:879-907`
- **Why it matters:** Every state change (toggling a habit, logging wellbeing, etc.) triggers a cascade re-render through the entire component tree: TrackerGrid (1,550+ cells), ProgressDashboard (8+ children with charts), DayView, and every other mounted component that calls `useHabitStore()`.
- **Confidence:** **Very High** — React's reconciliation behavior with reference equality checks is well-documented.
- **How to verify:** React DevTools Profiler → toggle a single habit → observe how many components re-render. Expected: nearly all mounted components.

### Rank 3: 400-Day Log Fetch on Every Init
- **What:** HabitContext fetches a 400-day log summary on every app initialization, producing a potentially 100-300KB response.
- **Where:** `src/store/HabitContext.tsx:200-208`, window computed at lines 95-103
- **Why it matters:** This is the slowest of the 4 parallel init requests, and `setLoading(false)` waits for all 4 to settle. Time-to-first-render is gated by this large payload.
- **Confidence:** **High** — payload size scales linearly with habit count × days.
- **How to verify:** Network tab → filter `daySummary` → check response size and time for a user with 50+ habits.

### Rank 4: N+1 Bundle Membership Queries
- **What:** Progress overview and day summary endpoints loop over bundle parents, issuing one DB query per parent.
- **Where:** `src/server/routes/progress.ts:85-86`, `src/server/routes/daySummary.ts:192-195`
- **Why it matters:** Each sequential query adds 5-20ms of network/DB round-trip time. With 10 bundles, that's 50-200ms of unnecessary sequential latency.
- **Confidence:** **High** — the N+1 pattern is visible in the code and the batch alternative already exists.
- **How to verify:** Add timing logs around the bundle loop, or count DB queries per request.

### Rank 5: No Server-Side Caching + Repeated Full-Entry Loads
- **What:** Every request recalculates streaks, momentum, and analytics from raw entries. Analytics page loads ALL entries 4 separate times.
- **Where:** `src/server/routes/analytics.ts:40-64`, `src/server/routes/progress.ts:44`, `src/server/services/streakService.ts`
- **Why it matters:** For long-term users, this is O(total_entries) work per request with no amortization. The analytics page multiplies this by 4x.
- **Confidence:** **High** — the code paths are clear and there is zero caching infrastructure.
- **How to verify:** Add `console.time()` around the full progress overview handler. Expect 200-500ms for users with 5,000+ entries.

### Rank 6: Ping + Index Check on Every DB Access
- **What:** `getDb()` pings MongoDB and runs index ensurance on every call.
- **Where:** `src/server/lib/mongoClient.ts:210-214`
- **Why it matters:** Adds 5-10ms per DB operation. A request that makes 4 DB calls pays 20-40ms in ping overhead alone.
- **Confidence:** **Medium-High** — ping latency depends on network conditions; local dev is fast, production may be slower.
- **How to verify:** Comment out the ping, measure response time difference.

### Rank 7: TrackerGrid DOM Weight
- **What:** 1,550+ interactive DOM nodes with no virtualization, full re-render on state change.
- **Where:** `src/components/TrackerGrid.tsx`
- **Why it matters:** Layout recalculation of 1,500+ nodes is expensive, especially on mobile. Each habit toggle causes a full diff.
- **Confidence:** **Medium** — depends on actual habit count. 20 habits × 31 days = 620 nodes (fine). 80 habits × 31 days = 2,480 nodes (problematic).
- **How to verify:** Chrome DevTools → Performance tab → toggle a habit → measure layout time.

---

## 8. Recommended Fixes

### Phase 1: High-Impact Quick Wins

These can be implemented in <1 day each with low risk.

| # | Issue | Fix | Expected Impact | Effort | Risk | Files |
|---|-------|-----|----------------|--------|------|-------|
| 1.1 | **Unmemoized HabitContext value** | Wrap provider value in `useMemo` with dependency array of all state variables | 40-60% reduction in unnecessary re-renders | 1 hour | Low — pure React optimization, no data flow change | `src/store/HabitContext.tsx:879-907` |
| 1.2 | **N+1 bundle queries in progress.ts** | Replace `getMembershipsByParent()` loop with `getAllMembershipsByUser()` (already used in analytics.ts:43), group by parentHabitId | 50-200ms faster progress overview for users with bundles | 2 hours | Low — the batch function already exists and is tested | `src/server/routes/progress.ts:80-99` |
| 1.3 | **N+1 bundle queries in daySummary.ts** | Same fix as 1.2 | 50-200ms faster day summary | 2 hours | Low | `src/server/routes/daySummary.ts:188-210` |
| 1.4 | **Ping on every getDb()** | Remove the `ping()` call from the cached-connection path. Trust the MongoDB driver's connection monitoring. Keep ping only for initial connection and reconnection. | 5-10ms saved per DB call, 15-40ms per request | 30 min | Low — MongoDB Node driver handles connection health internally | `src/server/lib/mongoClient.ts:210-214` |
| 1.5 | **Console logging in init path** | Remove or gate behind `NODE_ENV !== 'production'` the 8+ `console.log` calls in HabitContext initialization | Minor — reduces noise and microsecond overhead | 15 min | None | `src/store/HabitContext.tsx:184-216` |

### Phase 2: Targeted Structural Improvements

These require 1-3 days each but deliver significant, measurable improvements.

| # | Issue | Fix | Expected Impact | Effort | Risk | Files |
|---|-------|-----|----------------|--------|------|-------|
| 2.1 | **No code splitting** | Use `React.lazy()` + `Suspense` for non-initial pages: `GoalsPage`, `GoalDetailPage`, `AnalyticsPage`, `AppleHealthPage`, `JournalPage`, `WellbeingHistoryPage`, `TasksPage`, `DebugEntriesPage`. Add Suspense fallback (spinner or skeleton). | 30-50% smaller initial bundle. Faster first paint by ~1-2s on mobile. | 1 day | Low — lazy loading is a well-understood pattern. Test that navigation still works. | `src/App.tsx:14-42` |
| 2.2 | **Vite chunking** | Add `build.rollupOptions.output.manualChunks` to split: `vendor` (react, react-dom), `charts` (recharts), `dnd` (@dnd-kit), `date` (date-fns). | Better cache hit rates on deploys. Charts chunk only loaded when needed (with 2.1). | 2 hours | Low | `vite.config.ts` |
| 2.3 | **Date-range filtering for entries** | Add `getHabitEntriesByDateRange(householdId, userId, startDayKey, endDayKey)` to `habitEntryRepository.ts`. Update analytics and progress endpoints to pass appropriate date ranges. | 70-90% reduction in data loaded for analytics (90 days vs all time). | 1 day | **Medium** — must ensure streak calculations that need full history still work. Progress overview may need full history for "best streak". Analytics endpoints have a `days` parameter already. | `src/server/repositories/habitEntryRepository.ts`, `src/server/routes/analytics.ts`, `src/server/routes/progress.ts` |
| 2.4 | **Consolidate analytics endpoint** | Create a single `GET /api/analytics/all?days=90` endpoint that loads entries once and computes all metrics (summary, heatmap, trends, breakdown). Frontend calls 1 endpoint instead of 4. | 4× reduction in DB reads on analytics page. | 1 day | Low — pure server refactor, new endpoint, old endpoints can remain. | `src/server/routes/analytics.ts`, `src/server/services/analyticsService.ts`, `src/pages/AnalyticsPage.tsx` |
| 2.5 | **Reduce default log window** | Change 400-day default to 90 days for initial load. Add a "load more" mechanism or lazy-load historical data when user navigates to history views. | 75% smaller initial payload. Faster time-to-interactive. | 1 day | **Medium** — must ensure TrackerGrid can still show past months. May need to fetch additional data when user scrolls to older months. | `src/store/HabitContext.tsx:95-103` |
| 2.6 | **Add missing DB indexes** | Add compound index: `habitEntries (householdId, userId, deletedAt)`. Add index for date-range queries (once 2.3 is implemented): `habitEntries (householdId, userId, dayKey)`. | Faster query execution for full-entry loads. | 1 hour | Low — indexes are additive; `ensureCoreIndexes` already handles index creation. | `src/server/lib/mongoClient.ts:141+` |

### Phase 3: Deeper Architecture Work

These require 3+ days and involve structural changes.

| # | Issue | Fix | Expected Impact | Effort | Risk | Files |
|---|-------|-----|----------------|--------|------|-------|
| 3.1 | **No server-side caching** | Add in-memory TTL cache (e.g., `lru-cache` or simple Map with TTL) for: (a) progress overview results keyed by `userId+dayKey` with 30s TTL, (b) streak metrics keyed by `userId+habitId` with 60s TTL, (c) analytics results keyed by `userId+days` with 60s TTL. Invalidate on write operations. | 80-95% reduction in server computation for repeated requests. Sub-50ms responses for cached data. | 3 days | **Medium** — cache invalidation is the hard part. Must invalidate on habit entry creation/update/delete, goal mutations, and bundle membership changes. | New `src/server/lib/cache.ts`, modify routes and repositories. |
| 3.2 | **Split HabitContext** | Break into 3 contexts: `HabitDataContext` (habits, categories — changes rarely), `HabitLogContext` (logs — changes on toggle), `WellbeingContext` (wellbeing — changes rarely). Components subscribe only to what they need. | Targeted re-renders. Dashboard doesn't re-render when wellbeing changes. TrackerGrid doesn't re-render when categories change. | 3 days | **Medium-High** — need to audit all `useHabitStore()` consumers and split their subscriptions. | `src/store/HabitContext.tsx` → split into 3 files, update all consumers. |
| 3.3 | **Adopt React Query / TanStack Query** | Replace manual data fetching hooks and goalDataCache with React Query. Get automatic request deduplication, background refetching, cache management, and optimistic updates. | Eliminates duplicate requests, provides stale-while-revalidate out of the box, reduces boilerplate. | 5 days | **Medium** — large migration touching all data-fetching hooks. The existing goal cache pattern maps well to React Query concepts. | `src/lib/persistenceClient.ts`, all `use*` hooks, `src/lib/goalDataCache.ts` (replaced). |
| 3.4 | **TrackerGrid virtualization** | Implement row virtualization using `react-window` or `@tanstack/react-virtual` for the habit rows. Only render habits visible in the viewport + a buffer. | 70-90% DOM reduction for users with 50+ habits. Smooth scrolling on mobile. | 3 days | **Medium** — drag-and-drop interaction with `@dnd-kit` needs careful integration with virtualized lists. | `src/components/TrackerGrid.tsx` |
| 3.5 | **Server-side session caching** | Cache validated sessions in a simple in-memory Map with 60s TTL. Reduces DB query per request to a Map lookup. | 5-15ms saved per request. | 1 day | **Low-Medium** — must handle session invalidation (logout) correctly. | `src/server/middleware/session.ts` |

---

## 9. Instrumentation / Measurement Plan

The codebase currently has **no performance instrumentation** beyond `console.log` debug statements. The following should be added to measure, validate, and monitor performance improvements.

### 9.1 Server-Side: API Duration Logging

**What to add:** Middleware that logs request duration for every API call.

**Where:** `src/server/app.ts` — add as the first middleware after CORS.

**Implementation:**
```ts
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (durationMs > 100) { // Only log slow requests
      console.warn(`[SLOW] ${req.method} ${req.path} ${durationMs.toFixed(1)}ms`);
    }
  });
  next();
});
```

**What to log:** Method, path, duration, response size, userId (hashed). Flag anything >100ms.

### 9.2 Server-Side: Slow Query Logging

**What to add:** Wrap key repository functions with timing.

**Where:** `src/server/repositories/habitEntryRepository.ts` — around `getHabitEntriesByUser()`.

**What to log:** Query name, filter parameters, result count, duration. Flag any query >50ms or returning >1,000 documents.

### 9.3 Client-Side: Route Load Timing

**What to add:** `performance.mark()` and `performance.measure()` around route transitions.

**Where:** `src/App.tsx` — in the route rendering logic, mark when a view change starts and when the component finishes its first render.

**Implementation:**
```ts
useEffect(() => {
  performance.mark(`route-${view}-start`);
  return () => {
    performance.mark(`route-${view}-end`);
    performance.measure(`route-${view}`, `route-${view}-start`, `route-${view}-end`);
  };
}, [view]);
```

### 9.4 Client-Side: API Call Duration

**What to add:** Timing wrapper in `persistenceClient.ts` around `apiRequest()`.

**Where:** `src/lib/persistenceClient.ts:166-253` — the `apiRequest()` function.

**What to log:** Endpoint, method, duration, response size. Report to console in dev, optionally send to a lightweight analytics endpoint in production.

### 9.5 Client-Side: Web Vitals

**What to add:** Install `web-vitals` library and report Core Web Vitals (LCP, FID, CLS, TTFB, INP).

**Where:** `src/main.tsx` — after app mount.

**What to track:**
- **LCP (Largest Contentful Paint):** Target <2.5s. Currently likely 3-5s on mobile due to bundle size.
- **INP (Interaction to Next Paint):** Target <200ms. Currently at risk due to unmemoized context re-renders.
- **CLS (Cumulative Layout Shift):** Likely fine — no lazy-loaded images or dynamic content shifts observed.
- **TTFB (Time to First Byte):** Target <600ms. Depends on server hosting (Render cold starts).

### 9.6 Bundle Analysis

**What to add:** Configure `rollup-plugin-visualizer` in Vite config.

**Where:** `vite.config.ts` — add as a plugin with `template: 'treemap'`.

**What to measure:** Total bundle size, per-dependency size, identify largest chunks. Run after each build to track regressions.

### 9.7 React Render Profiling

**What to use:** React DevTools Profiler (already available since React 19 is in StrictMode).

**What to measure:**
1. Toggle a habit in TrackerGrid → count re-rendered components → should be <10, currently likely 50+.
2. Navigate between views → measure render time of each page component.
3. Dashboard load → measure time from mount to data-populated render.

### 9.8 Database Query Profiling

**What to add:** Enable MongoDB slow query log.

**How:** In MongoDB Atlas or self-hosted, set `slowOpThresholdMs: 50` in the profiler settings.

**What to watch:** Queries without index usage (COLLSCAN), queries returning >500 documents, queries taking >50ms.

---

## 10. Safe Implementation Notes

Performance optimizations must not break correctness. The following areas require extra care.

### 10.1 Streaks

**Risk:** If `getHabitEntriesByDateRange()` (fix 2.3) is used for progress overview, streak calculations that walk backward through history may produce incorrect results if the date range is too narrow.

**Mitigation:** The `calculateHabitStreakMetrics()` function in `streakService.ts` needs ALL historical data to compute `bestStreak` correctly. Options:
- Keep progress overview using full entry load (no date filter) for streaks.
- Cache computed streaks and only recalculate when entries change.
- Accept that "best streak" may require a separate, less frequent query.

**Recommendation:** Apply date-range filtering to analytics endpoints only (where `days` parameter already exists). Keep progress overview with full history until server-side caching (fix 3.1) absorbs the cost.

### 10.2 Habit Entries (Canonical Truth)

**Risk:** Any caching or date-range filtering must not cause stale or missing entries to be displayed. `habitEntries` is the single source of truth per CLAUDE.md.

**Mitigation:**
- Server-side caches (fix 3.1) must invalidate on any write to `habitEntries`.
- Client-side caching must invalidate when `toggleHabit`, `updateLog`, `createHabitEntry`, etc. are called.
- The existing `goalDataCache.ts` pattern (manual invalidation after mutations) is a good model.

### 10.3 Goal Progress

**Risk:** Changing bundle membership resolution from sequential to batch (fix 1.2) could produce different results if the grouping logic differs from the per-parent query.

**Mitigation:** The batch function `getAllMembershipsByUser()` returns the same data as individual `getMembershipsByParent()` calls — it's a superset. Group the results by `parentHabitId` and the derivation logic remains identical.

**Test:** Compare progress overview output before and after the fix for a user with bundles.

### 10.4 Routines Completion Flow

**Risk:** Minimal. Routine data lives in a separate context (`RoutineContext`) and is not directly affected by the proposed performance fixes.

**Mitigation:** If context splitting (fix 3.2) is implemented, ensure `RoutineContext` can still read habit data when needed (e.g., for routine steps that reference habits).

### 10.5 Analytics / History Correctness

**Risk:** Consolidating analytics into a single endpoint (fix 2.4) must produce identical results to the current 4 separate endpoints.

**Mitigation:** Write integration tests that compare outputs of old and new endpoints for a test user with known data. The service functions (`computeHabitAnalyticsSummary`, `computeHeatmapData`, etc.) remain unchanged — only the data loading path changes.

### 10.6 User Identity / Household Scoping

**Risk:** Server-side session caching (fix 3.5) must correctly scope cached sessions to avoid cross-user data leakage.

**Mitigation:** Cache key must be the session token hash (already unique per user). TTL must be short enough (60s) that revoked sessions expire quickly. On logout, explicitly evict the cached session.

### 10.7 DayKey / Timezone Correctness

**Risk:** Date-range filtering (fix 2.3) must respect the user's timezone. Filtering by `dayKey` string comparison is safe because `dayKey` format is `YYYY-MM-DD` which sorts lexicographically.

**Mitigation:** Ensure `startDayKey` and `endDayKey` are computed using the same timezone resolution as the rest of the system (`resolveTimeZone()` in `src/server/utils/dayKey.ts`).

### 10.8 Reducing the 400-Day Window (Fix 2.5)

**Risk:** TrackerGrid allows navigating to past months. If the initial load only fetches 90 days, navigating to month 4 will show empty data.

**Mitigation:** Implement on-demand fetching: when the user navigates to a month outside the loaded range, fetch that month's data and merge it into state. The HabitContext already has a `refreshDayLogs()` function that could be parameterized with a date range.

---

## TOP_PRIORITY_PERFORMANCE_FIXES

The 3 best next actions to take immediately, written for direct implementation handoff.

---

### Fix 1: Memoize HabitContext Provider Value

**File:** `src/store/HabitContext.tsx`
**Lines:** 879-907

**Current code (simplified):**
```tsx
<HabitContext.Provider value={{
    categories, habits, logs, wellbeingLogs,
    addCategory, updateCategory, addHabit, updateHabit,
    moveHabitToCategory, toggleHabit, updateLog,
    updateHabitEntry: updateHabitEntryContext,
    deleteHabitEntry: deleteHabitEntryContext,
    deleteHabit, deleteCategory, importHabits,
    reorderCategories, reorderHabits, logWellbeing,
    lastPersistenceError, clearPersistenceError,
    refreshDayLogs, refreshHabitsAndCategories,
    potentialEvidence, upsertHabitEntry: upsertHabitEntryContext,
    deleteHabitEntryByKey: deleteHabitEntryByKeyContext, loading,
}}>
```

**Fix:** Wrap in `useMemo`. All the callback functions are already wrapped in `useCallback`, so they're stable references. The dependency array should include only the state values:

```tsx
const contextValue = useMemo(() => ({
    categories, habits, logs, wellbeingLogs,
    addCategory, updateCategory, addHabit, updateHabit,
    moveHabitToCategory, toggleHabit, updateLog,
    updateHabitEntry: updateHabitEntryContext,
    deleteHabitEntry: deleteHabitEntryContext,
    deleteHabit, deleteCategory, importHabits,
    reorderCategories, reorderHabits, logWellbeing,
    lastPersistenceError, clearPersistenceError,
    refreshDayLogs, refreshHabitsAndCategories,
    potentialEvidence, upsertHabitEntry: upsertHabitEntryContext,
    deleteHabitEntryByKey: deleteHabitEntryByKeyContext, loading,
}), [categories, habits, logs, wellbeingLogs, potentialEvidence, lastPersistenceError, loading]);

// Then:
<HabitContext.Provider value={contextValue}>
```

**Expected impact:** 40-60% fewer unnecessary re-renders across the entire app. Every component consuming `useHabitStore()` will only re-render when actual state data changes.

**Effort:** 1 hour (including verification with React DevTools Profiler).
**Risk:** Low — no functional change, pure render optimization.

---

### Fix 2: Eliminate N+1 Bundle Membership Queries in Progress Overview

**File:** `src/server/routes/progress.ts`
**Lines:** 80-99

**Current code:**
```ts
for (const parent of bundleParents) {
  const memberships = await getMembershipsByParent(parent.id, householdId, userId);
  // ... per-parent derivation
}
```

**Fix:** Replace with a single batch fetch (the function already exists at `src/server/repositories/bundleMembershipRepository.ts` and is used in `analytics.ts:43`):

```ts
import { getAllMembershipsByUser } from '../repositories/bundleMembershipRepository';

// Replace the loop with:
const allMemberships = await getAllMembershipsByUser(householdId, userId);
const membershipsByParent = new Map<string, BundleMembershipRecord[]>();
for (const m of allMemberships) {
  const existing = membershipsByParent.get(m.parentHabitId) ?? [];
  existing.push(m);
  membershipsByParent.set(m.parentHabitId, existing);
}

for (const parent of bundleParents) {
  const memberships = membershipsByParent.get(parent.id) ?? [];
  // ... rest of derivation logic unchanged
}
```

**Also apply to:** `src/server/routes/daySummary.ts:192-195` (same pattern).

**Expected impact:** 1 DB query instead of N queries. Saves 50-200ms for users with bundles. Progress overview and day summary both get faster.

**Effort:** 2 hours (including both files + testing).
**Risk:** Low — `getAllMembershipsByUser()` is already tested and used in production by analytics endpoints.

---

### Fix 3: Add Route-Level Code Splitting

**File:** `src/App.tsx`
**Lines:** 14-42

**Current code:**
```ts
import { GoalsPage } from './pages/goals/GoalsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { JournalPage } from './pages/JournalPage';
// ... etc
```

**Fix:** Replace static imports with `React.lazy()` for pages that aren't on the initial route:

```ts
import React, { Suspense } from 'react';

// Keep eager: TrackerGrid, ProgressDashboard, DayView (initial routes)
// Lazy load everything else:
const GoalsPage = React.lazy(() => import('./pages/goals/GoalsPage').then(m => ({ default: m.GoalsPage })));
const GoalDetailPage = React.lazy(() => import('./pages/goals/GoalDetailPage').then(m => ({ default: m.GoalDetailPage })));
const GoalCompletedPage = React.lazy(() => import('./pages/goals/GoalCompletedPage').then(m => ({ default: m.GoalCompletedPage })));
const WinArchivePage = React.lazy(() => import('./pages/goals/WinArchivePage').then(m => ({ default: m.WinArchivePage })));
const GoalScheduleView = React.lazy(() => import('./pages/goals/GoalScheduleView').then(m => ({ default: m.GoalScheduleView })));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const JournalPage = React.lazy(() => import('./pages/JournalPage').then(m => ({ default: m.JournalPage })));
const TasksPage = React.lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })));
const AppleHealthPage = React.lazy(() => import('./pages/AppleHealthPage').then(m => ({ default: m.AppleHealthPage })));
const WellbeingHistoryPage = React.lazy(() => import('./pages/WellbeingHistoryPage').then(m => ({ default: m.WellbeingHistoryPage })));
const DebugEntriesPage = React.lazy(() => import('./pages/DebugEntriesPage').then(m => ({ default: m.DebugEntriesPage })));
```

Then wrap the route rendering section with `Suspense`:

```tsx
<Suspense fallback={<div className="flex items-center justify-center h-64">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
</div>}>
  {/* existing route switch */}
</Suspense>
```

**Also recommended (combine with this):** Add `manualChunks` to `vite.config.ts`:
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        charts: ['recharts'],
        dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
      }
    }
  }
}
```

**Expected impact:** 30-50% smaller initial bundle. Goals, analytics, journal, health pages load on demand. Charts chunk (~27KB) only downloaded when visiting a page that uses charts. Faster first paint by 1-2s on mobile.

**Effort:** 1 day (including testing all routes, verifying lazy imports work, adding Suspense boundaries).
**Risk:** Low — well-established React pattern. Verify named exports work with the `.then(m => ({ default: m.X }))` pattern since pages use named exports.

---

## 11. Implementation Status & Results

**Last updated:** 2026-04-07

### Phase 1 Quick Wins — COMPLETED

All Phase 1 quick wins from Section 8 have been implemented and merged via PRs #412 and #413.

| # | Fix | Status | PR | Evidence |
|---|-----|--------|-----|----------|
| 1.1 | **Memoize HabitContext provider value** | ✅ Done | #413 | `useMemo` wrapping provider value at `HabitContext.tsx:865-894` with correct dependency array |
| 1.2 | **N+1 bundle queries in progress.ts** | ✅ Done | #413 | Single `getAllMembershipsByUser()` call at `progress.ts:86`, batch grouped into `membershipsByParent` map |
| 1.3 | **N+1 bundle queries in daySummary.ts** | ✅ Done | #413 | Single `getAllMembershipsByUser()` call at `daySummary.ts:194`, same batch pattern |
| 1.4 | **Remove getDb() ping overhead** | ✅ Done | #413 | Ping removed from cached-connection path in `mongoClient.ts`. Ping only on initial `connectToMongo()` |
| 1.5 | **Console logging in init path** | ⚠️ Partial | — | Logs still present in HabitContext init path. Could be gated behind `NODE_ENV !== 'production'` |

### Top Priority Fixes — COMPLETED

| Fix | Status | PR | Evidence |
|-----|--------|-----|----------|
| **Memoize HabitContext** (Fix 1) | ✅ Done | #413 | See 1.1 above |
| **Memoize RoutineContext** (bonus) | ✅ Done | #413 | `useMemo` wrapping provider value at `RoutineContext.tsx:289-317` |
| **N+1 bundle queries** (Fix 2) | ✅ Done | #413 | See 1.2, 1.3 above |
| **Route-level code splitting** (Fix 3) | ✅ Done | #413 | `React.lazy()` for all non-initial pages at `App.tsx:33-43`, `<Suspense>` boundary at line 389 |
| **Vite manual chunks** (Fix 3 addon) | ✅ Done | #413 | `vendor`, `charts`, `dnd` chunks in `vite.config.ts:10-14` |

### Expected Impact of Phase 1 Fixes

| Metric | Before | After (estimated) |
|--------|--------|-------------------|
| Initial bundle size | ~200KB+ gzipped (single chunk) | ~120-140KB initial + lazy chunks on demand |
| Re-renders on habit toggle | Entire app tree (50+ components) | Only components consuming changed state |
| Progress overview DB queries (10 bundles) | 10+ sequential queries | 1 batch query |
| Day summary DB queries (10 bundles) | 10+ sequential queries | 1 batch query |
| getDb() overhead per call | 5-10ms ping | 0ms (driver manages health) |

### Phase 2 Status — NOT STARTED

All Phase 2 items from Section 8 remain unimplemented:

| # | Fix | Status | Current State |
|---|-----|--------|---------------|
| 2.1 | Code splitting | ✅ Done (moved to Phase 1) | Implemented in #413 |
| 2.2 | Vite chunking | ✅ Done (moved to Phase 1) | Implemented in #413 |
| 2.3 | Date-range filtering for entries | ❌ Not started | `getHabitEntriesByUser()` still loads ALL entries with no date filter |
| 2.4 | Consolidate analytics endpoint | ❌ Not started | Still 5 separate endpoints, each loading ALL entries independently |
| 2.5 | Reduce 400-day log window | ❌ Not started | `HabitContext.tsx:98` still fetches 400 days on every init |
| 2.6 | Add missing DB indexes | ⚠️ Partial | `(householdId, userId, habitId, dayKey)` exists; `(householdId, userId, deletedAt)` still missing |

### Phase 3 Status — NOT STARTED

| # | Fix | Status |
|---|-----|--------|
| 3.1 | Server-side caching (LRU/TTL) | ❌ Not started — zero caching infrastructure exists |
| 3.2 | Split HabitContext into 3 contexts | ❌ Not started |
| 3.3 | Adopt React Query / TanStack Query | ❌ Not started — not in package.json |
| 3.4 | TrackerGrid virtualization | ❌ Not started — no virtualization library installed |
| 3.5 | Server-side session caching | ❌ Not started — 2 DB queries per request with no cache |

---

## 12. Phase 2: Targeted Structural Improvements — Implementation Details

These fixes address the remaining high-impact performance bottlenecks. Each specification is written for direct implementation handoff with concrete file paths, code patterns, and risk notes.

---

### Fix 2.3: Date-Range Filtering for Habit Entries

**Problem:** `getHabitEntriesByUser()` loads ALL non-deleted entries with no date filter. Called by 8+ endpoints. A user with 2 years of data (50 habits × 730 days = 36,500 entries) loads everything on every request.

**Files to modify:**
- `src/server/repositories/habitEntryRepository.ts` — add new query function
- `src/server/routes/analytics.ts` — use date-filtered queries (7 endpoint handlers)
- `src/server/lib/mongoClient.ts` — add supporting index

#### Step 1: Add `getHabitEntriesByUserInRange()` to the repository

**File:** `src/server/repositories/habitEntryRepository.ts`

A date-range-filtered variant of `getHabitEntriesByUser()` already has a partial precedent: `getHabitEntriesByHabitIdsSince()` (lines 416-441) filters by `dayKey >= sinceDayKey` for specific habit IDs. The new function generalizes this for all user entries within a date window.

```ts
export async function getHabitEntriesByUserInRange(
    householdId: string,
    userId: string,
    startDayKey: string,
    endDayKey: string,
): Promise<HabitEntry[]> {
    const db = await getDb();
    const collection = db.collection<HabitEntry>('habitEntries');
    const documents = await collection
        .find(scopeFilter(householdId, userId, {
            deletedAt: { $exists: false },
            dayKey: { $gte: startDayKey, $lte: endDayKey },
        }))
        .toArray();
    return documents.map(mapDocument);
}
```

**Why `dayKey` string comparison works:** DayKey format is `YYYY-MM-DD` which sorts lexicographically. `'2026-01-15' >= '2026-01-01'` is correct.

#### Step 2: Add compound index for date-range queries

**File:** `src/server/lib/mongoClient.ts` — inside `ensureCoreIndexes()`

```ts
await habitEntries.createIndex(
    { householdId: 1, userId: 1, dayKey: 1 },
    { name: 'idx_habitEntries_user_dayKey' }
);
```

This index supports the new `$gte/$lte` dayKey filter efficiently. The existing `(householdId, userId, habitId, dayKey)` unique index is insufficient because it requires `habitId` as a prefix.

#### Step 3: Update analytics endpoints to use date-filtered queries

**File:** `src/server/routes/analytics.ts`

Each of the 5 habit analytics endpoints currently does:
```ts
// BEFORE: Loads ALL entries
const entries = await getHabitEntriesByUser(householdId, userId);
```

Replace with:
```ts
// AFTER: Loads only entries within the requested date range
const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
const entries = await getHabitEntriesByUserInRange(householdId, userId, startDayKey, referenceDayKey);
```

**Endpoints to update (all 5 habit analytics + 2 others):**

| Handler | Line | `days` default | Notes |
|---------|------|----------------|-------|
| `getHabitAnalyticsSummary` | 42 | 90 | Standard conversion |
| `getHabitAnalyticsHeatmap` | 64 | 365 | Largest window — still much better than ALL entries |
| `getHabitAnalyticsTrends` | 84 | 90 | Standard conversion |
| `getHabitAnalyticsCategoryBreakdown` | 104 | 90 | Standard conversion |
| `getHabitAnalyticsInsights` | 125 | 90 | Standard conversion |
| `getRoutineAnalyticsSummary` | 147 | 90 | Also loads routines/logs — only entries need the range filter |
| `getGoalAnalyticsSummary` | 167 | — | Goal analytics may need full history for lifetime progress; evaluate case-by-case |

**Do NOT change yet:**
- `GET /api/progress/overview` — streak calculation requires full history for `bestStreak`. Apply date filtering only after server-side caching (Fix 3.1) absorbs the cost.
- `GET /api/daySummary` — already parameterized with `startDayKey`/`endDayKey` but still calls `getHabitEntriesByUser()` internally. Requires careful migration since frontend depends on the response shape.

#### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Entries loaded per analytics request (2-year user) | ~36,500 | ~4,500 (90 days) or ~18,250 (365 days for heatmap) |
| Analytics page total entries loaded (4 endpoints) | ~146,000 (4 × 36,500) | ~22,250 (3 × 4,500 + 1 × 4,750) |
| DB read amplification | 4× full table scan | 4× bounded range scan |
| Response time (estimated) | 200-500ms per endpoint | 50-150ms per endpoint |

**Effort:** 1 day | **Risk:** Low — analytics service functions already accept entries as input; only the data source changes. All in-memory date filtering in the service layer becomes redundant but harmless.

---

### Fix 2.4: Consolidate Analytics Into Single Endpoint

**Problem:** The analytics page fires 4-5 parallel API calls, each independently loading habits + entries + memberships from the database. Even with Fix 2.3 (date filtering), this is 4-5 redundant DB reads for the same data.

**Files to modify:**
- `src/server/routes/analytics.ts` — add consolidated endpoint
- `src/server/services/analyticsService.ts` — add `computeAllHabitAnalytics()` function
- `src/pages/AnalyticsPage.tsx` — call single endpoint instead of 4

#### Step 1: Add consolidated service function

**File:** `src/server/services/analyticsService.ts`

```ts
export interface AllHabitAnalytics {
    summary: HabitAnalyticsSummary;
    heatmap: HeatmapResponse;
    trends: TrendDataPoint[];
    categoryBreakdown: CategoryBreakdownItem[];
    insights: Insight[];
}

export function computeAllHabitAnalytics(
    habits: Habit[],
    entries: HabitEntry[],
    memberships: BundleMembershipRecord[],
    categories: Category[],
    referenceDayKey: string,
    days: number,
    heatmapDays: number,
    timeZone?: string,
): AllHabitAnalytics {
    return {
        summary: computeHabitAnalyticsSummary(habits, entries, memberships, categories, referenceDayKey, days, timeZone),
        heatmap: computeHeatmapData(habits, entries, referenceDayKey, heatmapDays, timeZone),
        trends: computeTrendData(habits, entries, referenceDayKey, days, timeZone),
        categoryBreakdown: computeCategoryBreakdown(habits, entries, categories, referenceDayKey, days, timeZone),
        insights: computeInsights(habits, entries, referenceDayKey, days, timeZone),
    };
}
```

**Note:** The heatmap uses a 365-day window while other analytics use 90 days. The consolidated function should accept both `days` and `heatmapDays`, and the single DB query should load `max(days, heatmapDays)` worth of entries. Each sub-function already does its own in-memory date filtering, so passing the larger dataset is correct.

#### Step 2: Add consolidated route

**File:** `src/server/routes/analytics.ts`

```ts
// GET /api/analytics/habits/all?days=90&heatmapDays=365&timeZone=America/New_York
router.get('/habits/all', async (req, res) => {
    const { householdId, userId } = req;
    const days = parseDays(req.query.days, 90);
    const heatmapDays = parseDays(req.query.heatmapDays, 365);
    const timeZone = resolveTimeZone(req.query.timeZone);
    const referenceDayKey = todayDayKey(timeZone);

    const maxDays = Math.max(days, heatmapDays);
    const startDayKey = format(subDays(parseISO(referenceDayKey), maxDays - 1), 'yyyy-MM-dd');

    const [habits, entries, memberships, categories] = await Promise.all([
        getHabitsByUser(householdId, userId),
        getHabitEntriesByUserInRange(householdId, userId, startDayKey, referenceDayKey),
        getAllMembershipsByUser(householdId, userId),
        getCategoriesByUser(householdId, userId),
    ]);

    const result = computeAllHabitAnalytics(
        habits, entries, memberships, categories,
        referenceDayKey, days, heatmapDays, timeZone,
    );

    res.json(result);
});
```

**One DB query for entries instead of 5.** Habits, memberships, and categories also fetched once each in parallel.

#### Step 3: Update frontend to use consolidated endpoint

**File:** `src/pages/AnalyticsPage.tsx`

Replace 4-5 separate `fetch` calls with a single call to `/api/analytics/habits/all`. Destructure the response into the same state variables.

**Keep old endpoints alive** — they serve as individual-metric APIs for potential future use (e.g., embedding a single chart elsewhere). No breaking change.

#### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| API calls per analytics page load | 4-5 | 1 |
| DB queries for entries | 4-5 | 1 |
| DB queries for habits | 4-5 | 1 |
| Network round trips | 4-5 | 1 |

**Effort:** 1 day | **Risk:** Low — additive new endpoint + new frontend path. Old endpoints remain.

---

### Fix 2.5: Reduce Default Log Window From 400 to 90 Days

**Problem:** `HabitContext.tsx:98` hard-codes a 400-day window for `fetchDaySummary()`. For an active user with 50 habits, this produces a ~100-300KB payload that blocks the loading state. Most users only need the last 30-90 days for their primary view.

**Files to modify:**
- `src/store/HabitContext.tsx` — reduce initial window, add on-demand loading
- `src/server/routes/daySummary.ts` — ensure it respects the date range (it already accepts `startDayKey`/`endDayKey` params)

#### Step 1: Reduce initial window to 90 days

**File:** `src/store/HabitContext.tsx`

```ts
// BEFORE (line 98):
start.setDate(start.getDate() - 400);

// AFTER:
start.setDate(start.getDate() - 90);
```

#### Step 2: Add on-demand historical loading

When the user navigates to a month beyond the loaded 90-day range (e.g., scrolling back in TrackerGrid), fetch that month's data and merge into state:

```ts
const loadHistoricalRange = useCallback(async (startDayKey: string, endDayKey: string) => {
    const { timeZone } = getCanonicalSummaryWindow();
    const historicalLogs = await fetchDaySummary(startDayKey, endDayKey, timeZone);
    setLogs(prev => ({ ...prev, ...historicalLogs }));
}, []);
```

Expose `loadHistoricalRange` through the context value so TrackerGrid can call it when the user navigates to an older month.

#### Step 3: TrackerGrid integration

**File:** `src/components/TrackerGrid.tsx`

When the user changes the displayed month/date range and the target range extends beyond loaded data:

```ts
useEffect(() => {
    const oldestLoadedDayKey = /* derive from logs keys */;
    const viewStartDayKey = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    if (viewStartDayKey < oldestLoadedDayKey) {
        loadHistoricalRange(viewStartDayKey, oldestLoadedDayKey);
    }
}, [currentMonth]);
```

#### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| TrackerGrid shows empty cells for months beyond 90 days | On-demand fetch (Step 2-3) fills them when user navigates |
| Streak calculation needs full history | Streaks are computed server-side in `progress.ts`, which calls `getHabitEntriesByUser()` (full load). This fix only affects the client-side day summary — streaks are unaffected |
| Progress overview needs momentum data beyond 90 days | Progress overview has its own data path via `/api/progress/overview`, not affected by this change |

#### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Initial daySummary payload (50 habits) | ~100-300KB (400 days) | ~25-75KB (90 days) |
| Time-to-interactive reduction | — | ~0.5-1.5s faster (less data to download, parse, and process) |
| Memory footprint in HabitContext | ~50KB state object | ~12KB state object |

**Effort:** 1 day | **Risk:** Medium — must ensure on-demand loading works smoothly with TrackerGrid month navigation. Test with a user who has >90 days of data.

---

### Fix 2.6: Add Missing Database Indexes

**Problem:** Key query patterns lack compound indexes. `getHabitEntriesByUser()` filters on `(householdId, userId, deletedAt: { $exists: false })` but no index covers this exact filter. Date-range queries (once Fix 2.3 is implemented) need a dayKey-based index.

**File to modify:** `src/server/lib/mongoClient.ts` — inside `ensureCoreIndexes()`

#### Indexes to add

```ts
// 1. Support getHabitEntriesByUserInRange() — date-range queries
await habitEntries.createIndex(
    { householdId: 1, userId: 1, dayKey: 1 },
    { name: 'idx_habitEntries_user_dayKey' }
);

// 2. Support soft-delete filtering in getHabitEntriesByUser()
// Uses partial filter expression to only index non-deleted entries
await habitEntries.createIndex(
    { householdId: 1, userId: 1 },
    {
        name: 'idx_habitEntries_user_active',
        partialFilterExpression: { deletedAt: { $exists: false } },
    }
);

// 3. Support getMembershipsByParent() if still used anywhere
await db.collection('bundleMemberships').createIndex(
    { householdId: 1, userId: 1, parentHabitId: 1 },
    { name: 'idx_bundleMemberships_user_parent' }
);
```

**Why partial filter expression for index #2:** Instead of indexing `deletedAt` (which is `null`/absent for 99%+ of entries), a partial index on `{ householdId, userId }` WHERE `deletedAt` doesn't exist is smaller and faster. MongoDB uses this index when the query filter matches the partial expression.

#### Expected Impact

- Date-range queries go from collection scan to index scan
- Soft-delete queries use partial index instead of full scan + filter
- Index creation is idempotent (MongoDB skips if index already exists)

**Effort:** 1 hour | **Risk:** Low — indexes are additive. `ensureCoreIndexes()` already handles index creation on startup.

---

### Fix 2.7: Gate Console Logging Behind NODE_ENV

**Problem:** HabitContext initialization path has 8+ `console.log` statements that run in production.

**File:** `src/store/HabitContext.tsx`

**Fix:** Wrap debug logging in a development check:

```ts
const isDev = import.meta.env.DEV; // Vite strips this in production builds

// Then replace:
console.log('[loadWellbeingLogsFromApi] ...');
// With:
if (isDev) console.log('[loadWellbeingLogsFromApi] ...');
```

Vite's `import.meta.env.DEV` is statically replaced at build time. Dead-code elimination removes the entire `if` block in production builds, so there's zero runtime cost.

**Effort:** 30 min | **Risk:** None

---

### Phase 2 Priority Order

Implement in this order for maximum progressive impact:

1. **Fix 2.6** (indexes) — 1 hour, enables Fix 2.3 to be fast
2. **Fix 2.7** (console logging) — 30 min, trivial cleanup
3. **Fix 2.3** (date-range filtering) — 1 day, biggest single impact
4. **Fix 2.4** (consolidate analytics) — 1 day, builds on 2.3
5. **Fix 2.5** (reduce 400-day window) — 1 day, independent of 2.3/2.4

---

## 13. Phase 3: Architecture Roadmap — Detailed Plans

Phase 3 fixes involve structural changes that touch multiple files and require careful migration. Each plan includes dependency analysis, migration strategy, and rollback considerations.

---

### Fix 3.1: Server-Side In-Memory Cache

**Problem:** Zero caching infrastructure exists on the server. Every request recalculates streaks, momentum, analytics, and goal progress from raw entries. The progress overview endpoint (the most-hit endpoint) likely takes 200-500ms per call, every time, for long-term users.

**Goal:** Sub-50ms responses for repeated reads of the same data, with correct invalidation on writes.

#### Design

Create a generic TTL cache utility, then apply it to the three highest-traffic read paths.

**New file:** `src/server/lib/cache.ts`

```ts
interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class TTLCache<T> {
    private store = new Map<string, CacheEntry<T>>();
    private readonly ttlMs: number;
    private readonly maxEntries: number;

    constructor(ttlMs: number, maxEntries = 500) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }

    get(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.data;
    }

    set(key: string, data: T): void {
        // Simple eviction: if at capacity, delete oldest entry
        if (this.store.size >= this.maxEntries) {
            const firstKey = this.store.keys().next().value;
            if (firstKey) this.store.delete(firstKey);
        }
        this.store.set(key, { data, expiresAt: Date.now() + this.ttlMs });
    }

    invalidate(key: string): void {
        this.store.delete(key);
    }

    invalidateByPrefix(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
    }

    clear(): void {
        this.store.clear();
    }
}
```

**No external dependencies.** A simple Map-based cache is sufficient for a single-process Node.js server. If HabitFlowAI scales to multiple processes, migrate to Redis.

#### Cache Instances

```ts
// src/server/lib/cacheInstances.ts

import { TTLCache } from './cache';

// Progress overview — 30s TTL, invalidated on habit entry writes
export const progressCache = new TTLCache<ProgressOverviewResponse>(30_000);

// Analytics results — 60s TTL, invalidated on habit entry writes
export const analyticsCache = new TTLCache<AllHabitAnalytics>(60_000);

// Streak metrics — 60s TTL, invalidated on habit entry writes
export const streakCache = new TTLCache<Map<string, StreakMetrics>>(60_000);
```

**Cache key pattern:** `${userId}:${dayKey}` for progress, `${userId}:${days}` for analytics.

#### Integration Points

**Read path** (progress.ts):
```ts
const cacheKey = `${userId}:${referenceDayKey}`;
const cached = progressCache.get(cacheKey);
if (cached) return res.json(cached);

// ... compute result ...
progressCache.set(cacheKey, result);
res.json(result);
```

**Write path** (invalidation in entry mutation routes):
```ts
// In POST/PUT/DELETE /api/entries handlers:
progressCache.invalidateByPrefix(`${userId}:`);
analyticsCache.invalidateByPrefix(`${userId}:`);
streakCache.invalidateByPrefix(`${userId}:`);
```

#### Invalidation Matrix

| Write operation | Caches to invalidate |
|----------------|---------------------|
| Create/update/delete habit entry | progressCache, analyticsCache, streakCache |
| Create/update/delete habit | progressCache (habit list changed) |
| Create/update/delete goal | progressCache (goal progress changed) |
| Create/update/delete bundle membership | progressCache |
| Log wellbeing | None (wellbeing has separate data path) |

#### Expected Impact

| Endpoint | Uncached | Cached |
|----------|----------|--------|
| `/api/progress/overview` | 200-500ms | <5ms |
| `/api/analytics/habits/all` | 150-400ms | <5ms |
| `/api/daySummary` | 100-300ms | <5ms (if added) |

**Effort:** 3 days (cache utility + integration into 3-5 routes + invalidation hooks + testing)
**Risk:** Medium — cache invalidation is the hard part. Must ensure all write paths correctly invalidate. Missing an invalidation path = stale data shown to user. Mitigation: short TTLs (30-60s) bound staleness even if invalidation is missed.

---

### Fix 3.2: Split HabitContext Into Focused Contexts

**Problem:** HabitContext is a monolithic provider holding 7 state variables and 24 functions. Any change to any state variable triggers re-renders in all 37 consuming components, even if they only use `categories` (10 components) or `habits` (15 components).

**Goal:** Components only re-render when their specific data changes. Toggling a habit shouldn't re-render category management UI.

#### Proposed Split

| Context | State | Functions | Consumers |
|---------|-------|-----------|-----------|
| **HabitDataContext** | `habits`, `categories` | `addHabit`, `updateHabit`, `deleteHabit`, `reorderHabits`, `moveHabitToCategory`, `addCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`, `importHabits`, `refreshHabitsAndCategories` | ~25 components (most common) |
| **HabitLogContext** | `logs`, `potentialEvidence` | `toggleHabit`, `updateLog`, `updateHabitEntry`, `deleteHabitEntry`, `upsertHabitEntry`, `deleteHabitEntryByKey`, `refreshDayLogs`, `loadHistoricalRange` | ~12 components (TrackerGrid, DayView, heatmaps) |
| **WellbeingContext** | `wellbeingLogs` | `logWellbeing` | ~3 components (DailyCheckInCard, DailyCheckInModal, ProgressRings) |
| **HabitMetaContext** | `loading`, `lastPersistenceError` | `clearPersistenceError` | ~2 components (App.tsx, error displays) |

#### Migration Strategy

**Phase A: Create new context files (non-breaking)**
1. Create `src/store/HabitDataContext.tsx` — habits and categories
2. Create `src/store/HabitLogContext.tsx` — logs and evidence
3. Create `src/store/WellbeingContext.tsx` — wellbeing logs
4. Keep `HabitContext.tsx` as a **compatibility shim** that composes all 3:

```tsx
// HabitContext.tsx — backward-compatible wrapper
export function HabitProvider({ children }) {
    return (
        <HabitDataProvider>
            <HabitLogProvider>
                <WellbeingProvider>
                    {children}
                </WellbeingProvider>
            </HabitLogProvider>
        </HabitDataProvider>
    );
}

// useHabitStore() still works — reads from all 3 contexts
export function useHabitStore() {
    const data = useHabitData();
    const logCtx = useHabitLogs();
    const wellbeing = useWellbeing();
    return { ...data, ...logCtx, ...wellbeing };
}
```

This means **zero changes to existing consumers** in Phase A. Everything still works via `useHabitStore()`.

**Phase B: Migrate consumers incrementally**
- Replace `useHabitStore()` with specific hooks where possible:
  - `const { categories } = useHabitData();` instead of `const { categories } = useHabitStore();`
  - Components that only need categories stop re-rendering on log changes
- Migrate ~5 files per PR, starting with the simplest (single-property consumers)

**Phase C: Remove compatibility shim**
- Once all 37 consumers are migrated, `useHabitStore()` can be deprecated
- Or keep it as a convenience for components that genuinely need cross-context data

#### Consumer Analysis — What Each Component Needs

| Only needs HabitData | Only needs HabitLogs | Only needs Wellbeing | Needs multiple |
|---------------------|---------------------|---------------------|----------------|
| GoalsPage (categories) | YearHeatmapGrid (logs) | DailyCheckInCard (wellbeingLogs) | App.tsx (all) |
| GoalScheduleView (categories) | CategoryCompletionRow (logs) | DailyCheckInModal (wellbeingLogs, logWellbeing) | TrackerGrid (all) |
| GoalDetailPage (habits) | RecentHeatmapGrid (logs) | | DayView (all) |
| DebugEntriesPage (habits) | AccomplishmentsLog (habits+logs) | | ProgressRings (habits+logs+wellbeing) |
| GoalCard (habits) | | | |
| Heatmap (habits) | | | |
| CategoryTabs (categories) | | | |
| RoutineList (categories) | | | |
| ActivitySection (habits+categories) | | | |
| 10 more... | | | |

**Key win:** The ~25 components that only need `habits`/`categories` stop re-rendering when `logs` change (every habit toggle). This is the most frequent state change in the app.

#### Expected Impact

| Scenario | Before (single context) | After (split) |
|----------|------------------------|----------------|
| Toggle a habit cell | All 37 consumers re-render | Only ~12 log consumers re-render |
| Update a category name | All 37 consumers re-render | Only ~25 data consumers re-render |
| Log wellbeing | All 37 consumers re-render | Only ~3 wellbeing consumers re-render |

**Effort:** 3-5 days (Phase A: 1 day, Phase B: 2-3 days, Phase C: 1 day)
**Risk:** Medium-High — need to audit all 37 consumers. The compatibility shim (Phase A) eliminates risk of breaking changes during migration. Cross-context data dependencies (e.g., `AccomplishmentsLog` needs both `habits` and `logs`) require careful handling.

---

### Fix 3.3: Adopt React Query (TanStack Query)

**Problem:** Data fetching is manual across 63 functions in `persistenceClient.ts` with no request deduplication, no automatic cache management, no stale-while-revalidate (except the hand-built `goalDataCache.ts`), and no optimistic updates (except manual implementations in a few places).

**Goal:** Automatic request deduplication, cache management, background refetching, and optimistic updates out of the box.

#### Why React Query

- **Request deduplication:** If two components request the same data simultaneously, only one HTTP request fires.
- **Stale-while-revalidate:** Built-in, configurable per query. Replaces the manual `goalDataCache.ts`.
- **Optimistic updates:** Built-in mutation callbacks (`onMutate`, `onError`, `onSettled`). Replaces manual state rollback logic.
- **Cache invalidation:** `queryClient.invalidateQueries(['habits'])` replaces manual cache key management.
- **DevTools:** React Query DevTools provides real-time visibility into cache state, query timing, and staleness.

#### Migration Strategy

**This is the largest migration in Phase 3.** It touches `persistenceClient.ts` (1,484 lines, 63 functions), all custom hooks, and most components that fetch data. It should be done incrementally, one data domain at a time.

**Phase A: Install and configure**
1. `npm install @tanstack/react-query @tanstack/react-query-devtools`
2. Add `QueryClientProvider` to `src/App.tsx` (above other providers)
3. Configure defaults: `staleTime: 30_000`, `gcTime: 5 * 60_000`

**Phase B: Migrate goal data first (smallest, best-isolated)**
- Replace `goalDataCache.ts` + `useGoalsWithProgress.ts` + `useGoalDetail.ts` + `useCompletedGoals.ts` with React Query hooks
- This domain is already cache-aware (30s TTL), so the migration validates the approach
- Remove `goalDataCache.ts` after migration

**Phase C: Migrate analytics data**
- Replace the 4-5 analytics fetch calls with a single `useQuery(['analytics', days])` (or the consolidated endpoint from Fix 2.4)
- Low consumer count makes this safe

**Phase D: Migrate habit data (largest)**
- This is the big one: replace `HabitContext`'s manual fetching with React Query
- `useQuery(['habits', userId])` for habits, `useQuery(['logs', userId, startDayKey, endDayKey])` for day summary
- Context providers become thin wrappers around React Query hooks
- Can coexist with the context split (Fix 3.2) — each split context internally uses React Query

**Phase E: Migrate routines, tasks, journal, wellbeing**
- Each domain is relatively isolated
- Replace manual fetch + state management with `useQuery` + `useMutation`

#### Mapping to Existing Patterns

| Current Pattern | React Query Equivalent |
|----------------|----------------------|
| `goalDataCache.ts` (manual TTL cache) | `useQuery({ queryKey, staleTime: 30_000 })` |
| `subscribeToCacheInvalidation()` | `queryClient.invalidateQueries()` |
| `invalidateAllGoalCaches()` | `queryClient.invalidateQueries(['goals'])` |
| `persistenceClient.fetchGoalsWithProgress()` | `queryFn` passed to `useQuery` |
| HabitContext `Promise.allSettled` init | Multiple `useQuery` hooks with `Suspense` or individual loading states |
| Manual `setLogs(prev => ...)` optimistic update | `useMutation({ onMutate })` with cache rollback |

#### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Duplicate API requests (same data, multiple components) | Common | Eliminated (automatic dedup) |
| Cache management code | ~200 lines (goalDataCache.ts + manual state) | ~0 (handled by React Query) |
| Background refetch logic | Manual in a few hooks | Automatic for all queries |
| DevTools for data inspection | Console.log only | React Query DevTools |
| Code in persistenceClient.ts | 1,484 lines (fetch + state management) | ~800 lines (fetch only, state managed by RQ) |

**Effort:** 5-7 days (Phase A: 0.5 day, Phase B: 1 day, Phase C: 0.5 day, Phase D: 2-3 days, Phase E: 1-2 days)
**Risk:** Medium — large migration surface, but each phase is independently deployable. React Query is well-documented and battle-tested. The main risk is incorrect cache key design leading to stale data.

---

### Fix 3.4: TrackerGrid Virtualization

**Problem:** TrackerGrid (1,538 lines) renders ALL habit rows as DOM nodes. For 50 habits × 31 days = 1,550+ interactive cells. At 100 habits, layout recalculation on each toggle causes visible jank, especially on mobile.

**Goal:** Only render visible rows + a small buffer. Reduce DOM node count by 70-90% for power users.

#### Recommended Library: `@tanstack/react-virtual`

**Why:** Lightweight (8KB), framework-agnostic, works well with variable row heights. Better maintained than `react-window`. Compatible with React 19.

#### Implementation Approach

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function TrackerGrid() {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: rootHabits.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48, // estimated row height in px
        overscan: 5, // render 5 rows above/below viewport
    });

    return (
        <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const habit = rootHabits[virtualRow.index];
                    return (
                        <div
                            key={habit.id}
                            style={{
                                position: 'absolute',
                                top: 0,
                                transform: `translateY(${virtualRow.start}px)`,
                                width: '100%',
                            }}
                        >
                            <HabitRow habit={habit} dates={dates} /* ... */ />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

#### Challenges

| Challenge | Mitigation |
|-----------|------------|
| **Drag-and-drop with @dnd-kit** | @dnd-kit supports virtualized lists via `SortableContext` with `strategy={verticalListSortingStrategy}`. Items must have stable `id` props. The virtualized rows need to be the sortable items. |
| **Category headers interspersed with habit rows** | Flatten categories + habits into a single list with type discriminator: `{ type: 'header', categoryId } | { type: 'habit', habit }`. Virtualizer counts all items. |
| **Variable row heights** | Use `measureElement` from react-virtual for dynamic measurement. Category headers may be taller than habit rows. |
| **Horizontal scroll for dates** | Only virtualize vertically (rows). The date columns are typically 7-31 and don't need virtualization — they're lightweight compared to the row count. |

#### When to Apply

This optimization is only impactful for users with **40+ habits**. For users with 10-20 habits, the DOM is manageable. Consider:
- Adding a feature flag to enable virtualization
- Or always virtualizing (simpler code path, no conditional logic)

#### Expected Impact

| Habits | Before (DOM nodes) | After (DOM nodes) | Reduction |
|--------|-------------------|-------------------|-----------|
| 20 | 620 | ~310 (10 visible × 31) | 50% |
| 50 | 1,550 | ~310 | 80% |
| 100 | 3,100 | ~310 | 90% |

**Effort:** 3 days (virtualizer setup + @dnd-kit integration + category header handling + testing)
**Risk:** Medium — @dnd-kit + virtualization integration requires careful testing. The 1,538-line component is complex.

---

### Fix 3.5: Server-Side Session Caching

**Problem:** Session middleware makes 2 sequential DB queries per authenticated request: `findSessionByTokenHash()` + `findUserById()`. For 10 API calls on app load, that's 20 DB queries just for auth.

**File:** `src/server/middleware/session.ts`

#### Implementation

```ts
import { TTLCache } from '../lib/cache'; // from Fix 3.1

interface CachedSession {
    userId: string;
    householdId: string;
    email: string;
    displayName: string;
    role: 'admin' | 'member';
}

const sessionCache = new TTLCache<CachedSession>(60_000); // 60s TTL

export async function sessionMiddleware(req, res, next) {
    const raw = req.cookies?.[SESSION_COOKIE_NAME];
    if (!raw || typeof raw !== 'string') return next();

    const tokenHash = hashSessionToken(raw);

    // Check cache first
    const cached = sessionCache.get(tokenHash);
    if (cached) {
        req.userId = cached.userId;
        req.householdId = cached.householdId;
        req.authUser = {
            email: cached.email,
            displayName: cached.displayName,
            role: cached.role,
        };
        return next();
    }

    // Cache miss — query DB
    const session = await findSessionByTokenHash(tokenHash);
    if (!session) return next();

    const user = await findUserById(session.userId);
    if (!user) return next();

    // Populate cache
    sessionCache.set(tokenHash, {
        userId: session.userId,
        householdId: session.householdId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
    });

    req.userId = session.userId;
    req.householdId = session.householdId;
    req.authUser = { email: user.email, displayName: user.displayName, role: user.role };
    next();
}
```

**Logout invalidation:** On `POST /api/auth/logout`, explicitly evict:
```ts
sessionCache.invalidate(tokenHash);
```

#### Security Considerations

| Concern | Mitigation |
|---------|------------|
| Revoked sessions stay cached | 60s TTL bounds maximum staleness. User cannot do meaningful damage in 60s after session revocation. |
| Cache key is token hash (not raw token) | No raw tokens stored in memory |
| Cross-user data leakage | Cache key is unique per session. No shared keys. |
| Memory growth | `TTLCache` has `maxEntries` cap (default 500). Each entry is ~200 bytes. Max memory: ~100KB. |

#### Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| DB queries for auth per request | 2 (session + user) | 0 (cache hit) or 2 (cache miss, once per 60s) |
| Auth overhead per request | 10-25ms | <1ms (cache hit) |
| DB queries saved per 10-request app load | 20 | 18 (first request misses, other 9 hit cache) |

**Effort:** 1 day | **Risk:** Low-Medium — the TTL approach is conservative. Depends on Fix 3.1 for the cache utility.

---

### Phase 3 Dependency Graph

```
Fix 3.1 (Server Cache Utility)
  ├── Fix 3.5 (Session Caching) — depends on cache utility
  └── used by progress/analytics route caching

Fix 3.2 (Split HabitContext)
  └── Fix 3.3 (React Query) — can coexist, each split context uses RQ internally

Fix 3.4 (TrackerGrid Virtualization) — independent
```

### Phase 3 Priority Order

1. **Fix 3.1** (server cache utility) — 3 days, unlocks 3.5 and route caching
2. **Fix 3.5** (session caching) — 1 day, depends on 3.1, immediate impact
3. **Fix 3.2** (split HabitContext) — 3-5 days, independent, high frontend impact
4. **Fix 3.4** (TrackerGrid virtualization) — 3 days, independent, high impact for power users
5. **Fix 3.3** (React Query) — 5-7 days, largest effort, builds on 3.2 conceptually

---

## 14. Verification & Benchmarking Checklist

Every performance fix must be verified before and after implementation. This section provides concrete, reproducible test procedures.

---

### 14.1 Pre-Implementation Baseline Collection

Before implementing any fix, capture these baselines. All measurements should use a test user with realistic data: **50+ habits, 6+ months of entries, 5+ goals with bundles, 3+ routines.**

#### Backend Baselines (via curl or Postman)

Run each endpoint 5 times, discard the first (cold start), average the remaining 4.

```bash
# Headers required for all requests
HEADERS='-H "X-Household-Id: <test-household>" -H "X-User-Id: <test-user>" -H "Cookie: hf_session=<token>"'

# 1. Progress overview (most impactful endpoint)
curl -w "\n%{time_total}s" $HEADERS http://localhost:3001/api/progress/overview

# 2. Day summary (400-day window)
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/daySummary?startDayKey=2025-03-03&endDayKey=2026-04-07"

# 3. Analytics — each endpoint separately
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/analytics/habits/summary?days=90"
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/analytics/habits/heatmap?days=365"
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/analytics/habits/trends?days=90"
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/analytics/habits/category-breakdown?days=90"
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/analytics/habits/insights?days=90"

# 4. Goals with progress
curl -w "\n%{time_total}s" $HEADERS http://localhost:3001/api/goals-with-progress

# 5. Day view
curl -w "\n%{time_total}s" $HEADERS "http://localhost:3001/api/dayView?dayKey=2026-04-07"
```

**Record:** Response time (ms), response size (bytes), and any `[SLOW]` log output from the server.

#### Frontend Baselines (via Chrome DevTools)

| Test | How to measure | Target metric |
|------|---------------|---------------|
| **Initial bundle size** | DevTools → Network → filter JS → size column (gzipped) | Total JS transferred |
| **Time to interactive** | DevTools → Performance → record page load → Time to Interactive marker | Seconds |
| **Dashboard render** | React DevTools Profiler → navigate to dashboard → record → total render time | Milliseconds |
| **Habit toggle re-renders** | React DevTools Profiler → toggle one habit → count components that re-rendered | Component count |
| **TrackerGrid DOM nodes** | DevTools Console → `document.querySelectorAll('[data-habit-cell]').length` (or similar selector) | Node count |
| **Analytics page load** | DevTools → Network → navigate to analytics → count requests + total time | Request count, total ms |

#### Baseline Recording Template

```
Date: ____
User: ____ (habit count: ___, entry count: ___, goal count: ___, bundle count: ___)

Backend:
  progress/overview:      ___ms, ___KB
  daySummary (400d):      ___ms, ___KB
  analytics/summary:      ___ms, ___KB
  analytics/heatmap:      ___ms, ___KB
  analytics/trends:       ___ms, ___KB
  analytics/breakdown:    ___ms, ___KB
  analytics/insights:     ___ms, ___KB
  goals-with-progress:    ___ms, ___KB
  dayView:                ___ms, ___KB

Frontend:
  Initial JS bundle:      ___KB gzipped
  Time to interactive:    ___s
  Dashboard render:       ___ms
  Habit toggle re-renders: ___ components
  TrackerGrid DOM nodes:  ___
  Analytics page requests: ___
```

---

### 14.2 Per-Fix Verification Procedures

#### Fix 2.3 (Date-Range Filtering) Verification

- [ ] **Correctness:** Compare analytics endpoint output before and after. For `days=90`, results must be identical (service functions already filter by date in-memory).
- [ ] **Performance:** Measure analytics endpoint response times. Expect 50-80% reduction.
- [ ] **Index usage:** Run `db.habitEntries.find({...}).explain("executionStats")` in MongoDB shell. Confirm the query uses `idx_habitEntries_user_dayKey` (IXSCAN, not COLLSCAN).
- [ ] **Edge cases:** Test with a user who has 0 entries, 1 entry, and 10,000+ entries.
- [ ] **Test suite:** `npm run test:run` passes with no new failures.

#### Fix 2.4 (Consolidated Analytics) Verification

- [ ] **Correctness:** Call `/api/analytics/habits/all?days=90&heatmapDays=365` and compare each field against the individual endpoint responses. Must be byte-identical for `summary`, `trends`, `categoryBreakdown`, `insights`. Heatmap may differ if `heatmapDays` changed.
- [ ] **Performance:** 1 network request instead of 4-5 on analytics page. Total time should be less than the slowest individual endpoint (since data is loaded once).
- [ ] **Frontend:** Analytics page still renders all charts correctly.

#### Fix 2.5 (Reduce 400-Day Window) Verification

- [ ] **Initial load:** Confirm daySummary request uses 90-day window (check Network tab payload size).
- [ ] **TrackerGrid navigation:** Scroll to a month >90 days ago. Verify data loads dynamically (not blank).
- [ ] **Streaks:** Verify streak display on dashboard is unchanged (streaks come from progress overview, not daySummary).
- [ ] **Momentum:** Verify momentum metrics on dashboard are unchanged.

#### Fix 3.1 (Server Cache) Verification

- [ ] **Cache hit:** Call progress overview twice within 30s. Second call should return in <5ms (check server logs).
- [ ] **Cache invalidation:** Toggle a habit entry → immediately call progress overview. Response should reflect the new entry (cache was invalidated).
- [ ] **TTL expiry:** Wait >30s → call progress overview. Should recompute (check server timing logs).
- [ ] **Memory:** Under load (100+ cached entries), memory usage should stay <10MB for cache.

#### Fix 3.2 (Split HabitContext) Verification

- [ ] **Functional parity:** All existing behavior works identically. Run full test suite.
- [ ] **Re-render reduction:** Using React DevTools Profiler:
  - Toggle a habit → only HabitLogContext consumers re-render (not category-only consumers)
  - Update a category name → only HabitDataContext consumers re-render (not log consumers)
  - Log wellbeing → only WellbeingContext consumers re-render (~3 components)

#### Fix 3.4 (TrackerGrid Virtualization) Verification

- [ ] **DOM node count:** With 50 habits in month view, `document.querySelectorAll` should show ~310 cells (10 visible rows × 31 days) not 1,550.
- [ ] **Scrolling:** Smooth scroll through all habits. No blank flicker.
- [ ] **Drag-and-drop:** Reorder habits via drag still works correctly.
- [ ] **Category headers:** Visible and correctly positioned.
- [ ] **Mobile:** Test on a real mobile device or Chrome DevTools mobile emulation.

---

### 14.3 Regression Testing Checklist

After **any** performance fix, verify these critical paths are unbroken:

| # | Test | How |
|---|------|-----|
| 1 | **Habit toggle persists** | Toggle a habit → refresh → still toggled |
| 2 | **Streak accuracy** | Check a known habit's streak → matches manual count |
| 3 | **Goal progress** | Create a goal → toggle linked habits → progress % correct |
| 4 | **Bundle completion** | Complete all bundle children → parent shows complete |
| 5 | **Day view shows today's data** | Navigate to day view → today's entries visible |
| 6 | **Analytics charts render** | Navigate to analytics → all 4 charts visible with data |
| 7 | **Routine execution** | Start a routine → complete steps → evidence recorded |
| 8 | **Wellbeing checkin** | Log wellbeing → entry appears in history |
| 9 | **Journal entry** | Create a journal entry → appears in list |
| 10 | **Task CRUD** | Create, update, complete, delete a task |
| 11 | **Build succeeds** | `npm run build` exits 0 |
| 12 | **Tests pass** | `npm run test:run` passes |
| 13 | **Lint passes** | `npm run lint:beta` exits 0 |

---

### 14.4 Performance Budget

Target metrics for the fully optimized app (after all Phase 2 + Phase 3 fixes):

| Metric | Current (estimated) | Target | Measurement |
|--------|-------------------|--------|-------------|
| **Initial JS bundle** | ~200KB gzipped | <130KB gzipped | `ls -la dist/assets/*.js` |
| **Largest lazy chunk** | N/A (single chunk) | <80KB gzipped | Vite build output |
| **Time to interactive (desktop)** | 1.5-3s | <1.5s | Lighthouse |
| **Time to interactive (mobile 4G)** | 3-5s | <2.5s | Lighthouse throttled |
| **LCP (Largest Contentful Paint)** | ~3-5s | <2.5s | Web Vitals |
| **INP (Interaction to Next Paint)** | ~200-400ms | <200ms | Web Vitals |
| **Progress overview response** | 200-500ms | <50ms (cached), <200ms (uncached) | Server timing logs |
| **Analytics page response** | 4× 200-500ms | 1× <150ms | Server timing logs |
| **DaySummary response** | 100-300ms | <100ms | Server timing logs |
| **Components re-rendered on habit toggle** | ~50+ | <15 | React DevTools Profiler |
| **TrackerGrid DOM nodes (50 habits)** | ~1,550 | <400 | DOM query |
| **DB queries per app load** | ~40-60 | <20 | Server query logs |

---

### 14.5 Monitoring After Deployment

Once performance fixes are deployed, add lightweight production monitoring:

1. **Server-side slow request log** (Section 9.1) — log any request >100ms with endpoint, duration, userId hash
2. **Client-side performance beacon** — report LCP, INP, and TTFB via `web-vitals` library to a lightweight endpoint or analytics service
3. **Bundle size CI check** — add a build step that fails if total JS exceeds 300KB gzipped (prevents regression)
4. **MongoDB slow query profiler** — set `slowOpThresholdMs: 50` in Atlas/profiler settings

---

## 15. Summary: Full Optimization Roadmap

### Completed (Phase 1)

| Fix | Impact |
|-----|--------|
| Memoize HabitContext + RoutineContext providers | 40-60% fewer unnecessary re-renders |
| Batch N+1 bundle membership queries | 50-200ms saved per progress/daySummary request |
| Remove getDb() ping overhead | 15-40ms saved per request |
| Route-level code splitting + Vite chunks | 30-50% smaller initial bundle |

### Next Up (Phase 2) — Estimated 4-5 days total

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| 1 | Add missing DB indexes | Enables efficient range queries | 1 hour |
| 2 | Gate console logging | Clean production output | 30 min |
| 3 | Date-range filtering for entries | 70-90% less data loaded in analytics | 1 day |
| 4 | Consolidate analytics endpoint | 4× fewer API calls + DB queries | 1 day |
| 5 | Reduce 400-day window to 90 days | 75% smaller initial payload | 1 day |

### Later (Phase 3) — Estimated 15-23 days total

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| 1 | Server-side TTL cache | Sub-50ms cached responses | 3 days |
| 2 | Session caching | 18 fewer DB queries per app load | 1 day |
| 3 | Split HabitContext | Targeted re-renders (toggle affects 12 not 37 components) | 3-5 days |
| 4 | TrackerGrid virtualization | 80-90% DOM reduction for power users | 3 days |
| 5 | React Query migration | Automatic dedup, caching, refetch for all data | 5-7 days |

### Conservative Total Impact Estimate

| Metric | Before All Fixes | After Phase 1 (done) | After Phase 2 | After Phase 3 |
|--------|-----------------|---------------------|----------------|----------------|
| Initial bundle | ~200KB | ~130KB | ~130KB | ~130KB |
| Time to interactive (mobile) | 3-5s | 2-3.5s | 1.5-2.5s | 1-2s |
| DB queries per app load | 40-60 | 25-35 | 15-25 | 10-15 |
| Progress overview latency | 200-500ms | 150-350ms | 100-250ms | <50ms (cached) |
| Components re-rendered on toggle | 50+ | 15-20 | 15-20 | <10 |
| Analytics page DB entry reads | 146,000 (4 × 36,500) | 146,000 | ~4,500 | ~4,500 (cached) |
