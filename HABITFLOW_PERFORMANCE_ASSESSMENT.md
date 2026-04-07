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
