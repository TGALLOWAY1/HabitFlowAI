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
