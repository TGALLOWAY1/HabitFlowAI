# HabitFlow UX Paths

This document maps every user-facing path for creating, editing, deleting, completing, and linking entities in HabitFlowAI. It is the authoritative reference for understanding where CRUD operations live in the UI and where inconsistencies exist between different entry points.

---

## Navigation Structure

### Bottom Tab Bar (`BottomTabBar`)

The persistent bottom navigation provides access to four primary views:

| Tab | Route | Icon |
|-----|-------|------|
| Dashboard | `dashboard` | BarChart3 |
| Habits | `tracker` | Calendar |
| Routines | `routines` | ClipboardList |
| Goals | `goals` | Target |

### Views Accessible via Navigation (not in tab bar)

These views are reachable from links within the app but do not appear in the bottom tab bar:

| View | Route | Entry Point |
|------|-------|-------------|
| Journal | `journal` | Dashboard card, side nav |
| Tasks | `tasks` | Dashboard card, side nav |
| Analytics | `analytics` | Dashboard link |
| Wellbeing History | `wellbeing-history` | Dashboard link |
| Apple Health | `health` | Dashboard link |
| Win Archive | `wins` (legacy) / `goals` achievements tab | Goals page achievements toggle |
| Debug Entries | `debug-entries` | Dev only |

### Sub-view Toggles

**Tracker** (`tracker` route) has three sub-views toggled by segmented control:
- **All** -- `TrackerGrid` with category tabs
- **Today** -- `DayView` showing today's scheduled habits
- **Schedule** -- `ScheduleView` showing weekly calendar

**Goals** (`goals` route) has three sub-views toggled by segmented control:
- **All** -- `GoalsPage` with drag-and-drop goal cards
- **Schedule** -- `GoalScheduleView` timeline
- **Achievements** -- `WinArchivePage` completed goals

---

## UX Path Tables

### Habit Creation

| Location | Component | Form Fields Available | Notes |
|----------|-----------|----------------------|-------|
| Tracker "+" button | `AddHabitModal` | Full: name, type (regular/bundle), goalType (boolean/number), target, unit, timesPerWeek, scheduledTime, durationMinutes, assignedDays, requiredDaysPerWeek, linkedGoalId, linkedRoutineIds, category, bundleMode (checklist/choice), sub-habits, description | Full-featured creation |
| Day View "+" button | `AddHabitModal` | Same as above | Identical modal, opened from DayView |
| Goal Detail "Create Habit" | `HabitCreationInlineModal` | Simplified: name, type (binary/quantified), target, unit, categoryId, imageUrl (not persisted) | Missing: scheduling, bundles, routines, duration, timesPerWeek, linkedGoalId, description |
| Apple Health Page | `AppleHealthPage` inline form | habitName, categoryId, operator, threshold, behavior, backfillOption | Creates habit + health rule together; no scheduling or bundle support |

### Habit Editing

| Location | Component | Notes |
|----------|-----------|-------|
| Tracker Grid pencil icon | `AddHabitModal` (edit mode via `initialData`) | Full edit of all fields |
| Day View edit button | `AddHabitModal` (edit mode via `initialData`) | Full edit of all fields |
| Tracker Grid "Convert to Bundle" | `AddHabitModal` (with `initialBundleConvert=true`) | Opens edit mode pre-configured for bundle conversion |
| `CategoryPickerModal` | `CategoryPickerModal` | Move habit to a different category only |
| `BundlePickerModal` | `BundlePickerModal` | Add habit to an existing bundle only |
| `WeeklyHabitEditModal` | `WeeklyHabitEditModal` | Edit scheduling only: assignedDays, scheduledTime, durationMinutes, requiredDaysPerWeek |

### Habit Deletion

| Location | Component | Notes |
|----------|-----------|-------|
| Tracker Grid trash icon | Inline confirmation (`deleteConfirmId` state) | Calls `deleteHabit` which sets `archived=true` |
| Day View delete button | Inline confirmation | Calls `deleteHabit` which sets `archived=true` |

### Habit Completion / Entry Logging

| Location | Component | Mechanism | Notes |
|----------|-----------|-----------|-------|
| Tracker Grid cell click | `TrackerGrid` | Creates `HabitEntry` (source: manual) | Boolean toggle or `NumericInputPopover` for number goals |
| Day View cell | `DayView` via `DayCategorySection` | Creates `HabitEntry` (source: manual) | Same toggle/numeric behavior |
| Schedule View cell | `ScheduleView` via `DayCategorySection` | Creates `HabitEntry` (source: manual) | Same toggle/numeric behavior |
| Routine Runner finish | `RoutineRunnerModal` | Creates `HabitEntry` (source: routine) via `batchCreateEntries` | Logs entries for linked habits on routine completion |
| Apple Health auto-log | `healthAutoLogService` (backend) | Creates `HabitEntry` (source: apple_health) | Automatic based on `HabitHealthRule` threshold |
| Habit History Modal | `HabitHistoryModal` | Can add, edit, and delete individual entries via `createHabitEntry`, `updateHabitEntry`, `deleteHabitEntry` | Calendar-based entry management for any past date |

### Category Creation

| Location | Component | Notes |
|----------|-----------|-------|
| `AddHabitModal` inline | `AddHabitModal` | Inline creation (name only) during habit create/edit, calls `addCategory` |
| `CreateGoalModal` inline | `CreateGoalModal` | Inline creation (name only) during goal create, calls `addCategory` |
| `EditGoalModal` inline | `EditGoalModal` | Inline creation (name only) during goal edit, calls `addCategory` |

All three locations offer the same inline experience: text input for category name, then submit.

### Goal Creation

| Location | Component | Notes |
|----------|-----------|-------|
| Goals Page "+" button | `CreateGoalModal` | 2-step wizard: Step 1 = title, type (cumulative/onetime), targetValue, unit, deadline, categoryId; Step 2 = habit linking with search, category filter, inline habit creation |
| Dashboard "Create Goal" button | `CreateGoalModal` | Same wizard, triggered from `ProgressDashboard` via `onCreateGoal` |

### Goal Editing

| Location | Component | Notes |
|----------|-----------|-------|
| Goal Detail Page edit icon | `EditGoalModal` | Full edit: title, description, targetValue, unit, deadline, categoryId, linkedHabitIds with search and category filter toggle |
| Goal Card edit button | `EditGoalModal` | Same modal, opened from `GoalGridCard` on `GoalsPage` |

### Goal Deletion

| Location | Component | Notes |
|----------|-----------|-------|
| Goal Detail Page trash icon | `DeleteGoalConfirmModal` | Calls `deleteGoal` API (soft delete) |

### Goal Completion

| Location | Component | Notes |
|----------|-----------|-------|
| Goal Detail "Mark Complete" button | `GoalDetailPage` | Calls `markGoalAsCompleted`, navigates to `GoalCompletedPage` |
| Auto-completion | `GoalDetailPage` | When cumulative progress reaches 100%, triggers completion automatically |
| `GoalCompletedPage` actions | `GoalCompletedPage` | Post-completion options: Level Up (`iterateGoal`), Repeat (`createGoal` clone), Archive, View Details |

### Goal-Habit Linking

| Location | Component | Direction | Notes |
|----------|-----------|-----------|-------|
| `CreateGoalModal` step 2 | `CreateGoalModal` | Goal -> Habits | Multi-select with search, category filter by goal's category, inline habit creation via `HabitCreationInlineModal` |
| `EditGoalModal` | `EditGoalModal` | Goal -> Habits | Multi-select with search, category filter toggle (`filterByGoalCategory`), inline habit creation via `AddHabitModal` |
| `AddHabitModal` | `AddHabitModal` | Habit -> Goal | Single goal dropdown (`linkedGoalId`), no category filter |
| Goal Detail Page | `GoalDetailPage` | Read-only | View linked habits, click to open `HabitHistoryModal` |

### Routine Creation/Editing

| Location | Component | Notes |
|----------|-----------|-------|
| Routines Page "+" button | `RoutineEditorModal` (mode: create) | Full: title, categoryId, image upload, variants with steps; each variant has name, estimatedDurationMinutes, steps with timers and `linkedHabitId` |
| Routine card edit button | `RoutineEditorModal` (mode: edit) | Full edit via `RoutineCard` on `RoutineList` |
| Routine Preview edit button | `RoutineEditorModal` (mode: edit) | Opens from `RoutinePreviewModal` with `initialVariantId` |

### Routine Deletion

| Location | Component | Notes |
|----------|-----------|-------|
| Routine card delete button | Inline confirmation on `RoutineCard` in `RoutineList` | Calls `deleteRoutine` |

### Routine Execution

| Location | Component | Notes |
|----------|-----------|-------|
| Routines Page play button | `RoutineRunnerModal` | Start from `RoutineList`, uses `defaultVariantId` |
| Dashboard pinned routine | `RoutineRunnerModal` | Start from `PinnedRoutinesCard` in `ProgressDashboard`, uses `defaultVariantId` |
| Tracker Grid play icon | `RoutineRunnerModal` | For habits with linked routines, started from `HabitActionButtons` |
| Routine Preview play | `RoutineRunnerModal` | From `RoutinePreviewModal`, can select specific `variantId` |

### Routine-Habit Linking

| Location | Component | Direction | Notes |
|----------|-----------|-----------|-------|
| `RoutineEditorModal` / `VariantEditor` | `VariantEditor` | Routine step -> Habit | Per-step `linkedHabitId`; variant `linkedHabitIds` auto-computed from steps |
| `AddHabitModal` | `AddHabitModal` | Habit -> Routines | Multi-select `linkedRoutineIds` on the habit record |

### Task Management

| Location | Component | Notes |
|----------|-----------|-------|
| Tasks Page (Today column) | `AddTaskInput` (defaultPlacement: today) + `TaskItem` | Create, complete, delete tasks committed for today |
| Tasks Page (Inbox column) | `AddTaskInput` (defaultPlacement: inbox) + `TaskItem` | Create, complete, move to today, delete inbox tasks |

### Journal

| Location | Component | Notes |
|----------|-----------|-------|
| Journal Page (Free tab) | `JournalEditor` | Free-write entry creation |
| Journal Page (Templates tab) | `JournalEditor` | Guided entry from template |
| Journal Page (History tab) | `JournalDisplay` | View past entries; click to edit via `JournalEditor` in edit mode |

### Wellbeing Check-in

| Location | Component | Notes |
|----------|-----------|-------|
| Dashboard check-in card | `DailyCheckInModal` | Morning/Evening tabs, metric sliders (0-4 scale for subjective, 0-100 for sleep score, 1-5 for legacy), notes field |
| Wellbeing History Page | `WellbeingHistoryPage` | Read-only: heatmap, weekly, and multiples views for historical wellbeing data |

### Health Rules

| Location | Component | Notes |
|----------|-----------|-------|
| Apple Health Page | `AppleHealthPage` | Per-metric cards (steps, sleep, workouts, calories, weight): expand to create rule with operator/threshold/behavior, backfill option, or delete existing rule |

---

## Inconsistencies in UX Paths

### Habit creation field parity

- `AddHabitModal` offers full configuration: scheduling (assignedDays, scheduledTime, durationMinutes, requiredDaysPerWeek), bundles (checklist/choice mode with sub-habits), linked routines, linked goals, timesPerWeek, description.
- `HabitCreationInlineModal` (from `CreateGoalModal` step 2) only offers: name, type (binary/quantified), target, unit, categoryId.
- `EditGoalModal` uses the full `AddHabitModal` for inline habit creation, while `CreateGoalModal` uses the simplified `HabitCreationInlineModal`.
- **Impact:** Habits created from the goal creation wizard cannot be scheduled, bundled, or linked to routines without a separate edit. The two goal modals use different components for inline habit creation.

### Category filter in linking modals

- `CreateGoalModal` step 2 filters available habits by the goal's `categoryId` when set.
- `EditGoalModal` has an explicit `filterByGoalCategory` toggle (defaults to on) for habit selection.
- `AddHabitModal` goal dropdown shows all goals with no category filter.
- **Impact:** Inconsistent filtering experience when linking habits to goals depending on which direction the link is created from.

### Bundle management entry points

- Bundle creation: only via `AddHabitModal` with `habitType='bundle'`.
- Add to bundle: `BundlePickerModal` accessible from Tracker Grid and Day View.
- Convert to bundle: `ConvertBundleConfirmModal` triggered from Tracker Grid context menu, opens `AddHabitModal` with `initialBundleConvert=true`.
- No bundle management from Goals page or Routines page.
- **Impact:** Bundle operations are scattered across different UI entry points with no centralized bundle management view.

### Routine-habit linking has two different semantics

- From `RoutineEditorModal` / `VariantEditor`: links habits via `step.linkedHabitId` per step. The variant's `linkedHabitIds` is auto-computed from all step links. These step links generate `PotentialEvidence` when a routine is completed.
- From `AddHabitModal`: links routines via `habit.linkedRoutineIds` on the habit record. This is informational and enables the play button on the tracker grid.
- These are independent link records with different semantics -- changing one does not update the other.
- **Impact:** A habit can show a routine play button (via `linkedRoutineIds`) even if that routine does not actually link back to the habit in any step (via `step.linkedHabitId`), and vice versa.

### Inline habit creation differs between goal modals

- `CreateGoalModal` uses `HabitCreationInlineModal` (simplified fields).
- `EditGoalModal` uses `AddHabitModal` (full fields, opened via `isAddHabitOpen` state).
- **Impact:** Users creating a habit while setting up a new goal get a different (reduced) experience than users creating a habit while editing an existing goal.

---

## Missing UX Paths

Operations that are absent from the current UI:

- **No bulk-archive habits** -- habits can only be archived one at a time via the trash icon.
- **No way to reorder goals across categories** -- `GoalsPage` supports drag-and-drop reordering within a category section via `reorderGoals`, but not moving goals between categories (that requires `EditGoalModal`).
- **No way to create a routine directly from a habit** -- the play button on a habit only launches an existing linked routine; there is no "Create Routine for this Habit" shortcut.
- **No way to see all habits linked to a specific routine from the habit side** -- `AddHabitModal` shows `linkedRoutineIds` for the current habit, but there is no view showing "all habits that reference Routine X".
- **No inline habit creation from routine editor** -- `VariantEditor` can only link existing habits to steps via a dropdown; there is no "Create New Habit" option within the step editor.
- **No goal creation from Goal Detail Page** -- the detail page has edit and delete but no "Create Related Goal" or "Create Sub-Goal" action.
- **No task creation from Dashboard** -- the `TasksCard` on the dashboard links to the Tasks page but does not offer inline task creation.
- **No wellbeing entry editing** -- `DailyCheckInModal` creates/overwrites the current day's entry, but there is no way to edit a past day's wellbeing entry from `WellbeingHistoryPage`.
- **No journal entry creation from Dashboard** -- the `JournalCard` links to the Journal page but does not offer inline journaling.
