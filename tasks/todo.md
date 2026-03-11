# Dashboard & Goals UI Fixes

## Tasks

- [ ] **1. Dashboard Ring**: Remove "Steady" momentum text, add "Daily Habits" label
  - In `DailyOverviewCard.tsx`: Remove momentum badge (lines 72-82), add "Daily Habits" text below ring

- [ ] **2. Routine Icon/Color Customization**: Allow users to change icons/colors for pinned routines
  - Add `icon` and `color` fields to Routine model (already has `icon?: string` on some related models)
  - Add icon/color picker in manage mode of `PinnedRoutinesCard.tsx`
  - Persist via `updateRoutine` API

- [ ] **3. Goals at a Glance Management**: Allow users to manage which goals appear
  - Add localStorage-based pinned goals feature (similar to pinned routines pattern)
  - Add "Manage" button to goals section header in `ProgressDashboard.tsx`
  - Show pin/unpin UI for goal selection

- [ ] **4. Goals Page Layout**: Make Overview button inline with trophy and add buttons
  - In `GoalsPage.tsx`: Restructure header to put all three buttons in one flex row

## Review
- [ ] Verify all changes render correctly
- [ ] Commit and push
