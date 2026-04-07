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
