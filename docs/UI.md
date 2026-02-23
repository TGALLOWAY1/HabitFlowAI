# UI Inventory

## Current App Shell

- Root component: `src/App.tsx`
- Layout/header shell: `src/components/Layout.tsx`
- Navigation is view-state based (`view` query param).

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

## UX Boundaries

- Logging/editing behavior remains in existing pages.
