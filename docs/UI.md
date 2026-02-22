# UI Inventory

## Current App Shell

- Root component: `src/App.tsx`
- Layout/header shell: `src/components/Layout.tsx`
- Navigation is view-state based (`view` query param) with additive path route support for the Main Dashboard.

## Page/Surface Inventory

- Dashboard (existing default): `src/components/ProgressDashboard.tsx`
- Habits Tracker Grid: `src/components/TrackerGrid.tsx`
- Habits Day View: `src/components/day-view/DayView.tsx`
- Routines: `src/components/RoutineList.tsx`
- Goals: `src/pages/goals/GoalsPage.tsx`
- Goal Detail: `src/pages/goals/GoalDetailPage.tsx`
- Goal Completion: `src/pages/goals/GoalCompletedPage.tsx`
- Win Archive: `src/pages/goals/WinArchivePage.tsx`
- Journal: `src/pages/JournalPage.tsx`
- Tasks: `src/pages/TasksPage.tsx`
- Wellbeing History: `src/pages/WellbeingHistoryPage.tsx`
- Debug Entries: `src/pages/DebugEntriesPage.tsx`
- Main Dashboard (new read-only analytics page): `src/pages/MainDashboardPage.tsx`

## Main Dashboard (New)

- Path entrypoints:
  - `/dashboard`
  - `/insights/dashboard`
- Purpose:
  - high-density monthly analytics view derived from HabitEntries
  - summary rings, daily chart, habit/day heatmap, category rollups
- Data contract source:
  - `GET /api/dashboard?month=YYYY-MM` (+ optional filters)

## UX Boundaries

- Logging/editing behavior remains in existing pages.
- Main Dashboard is read-only analytics and does not mutate truth.
