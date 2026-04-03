# Habit Scheduling Refactor — Investigation & Impact Analysis

## 1. Current Data Model

### Habit Interface (`src/models/persistenceTypes.ts` lines 82-262)

```typescript
interface Habit {
  id: string;
  categoryId: string;
  name: string;
  goal: HabitGoal;
  archived: boolean;
  createdAt: string;

  // Scheduling fields
  frequency?: 'daily' | 'weekly';           // Root-level (redundant with goal.frequency)
  weeklyTarget?: number;                     // For weekly habits: required completions/week
  requiredDaysPerWeek?: number;              // For scheduled-daily habits
  assignedDays?: number[];                   // 0=Sun..6=Sat
  scheduledTime?: string;                    // HH:mm
  durationMinutes?: number;

  // Other fields...
  type?: 'boolean' | 'number' | 'time' | 'bundle';
  timesPerWeek?: number;                     // (not currently used — will be new field)
  linkedGoalId?: string;
  linkedRoutineIds?: string[];
  nonNegotiable?: boolean;
  nonNegotiableDays?: number[];
}

interface HabitGoal {
  type: 'boolean' | 'number';
  target?: number;
  unit?: string;
  frequency: 'daily' | 'weekly' | 'total';  // Primary discriminator
}
```

### Key Observations
- `goal.frequency` is the **authoritative** frequency field, used in 16+ source files
- Root-level `frequency` is a **redundant mirror** — code reads `h.frequency || h.goal.frequency`
- `weeklyTarget` stores the weekly completion count for weekly habits
- `assignedDays` + `requiredDaysPerWeek` is a separate "scheduled-daily" concept

---

## 2. What Logic Currently Depends on "Weekly Habit" Type?

### Files referencing `'weekly'` (20 total, 1 unrelated):

| File | What it does with `'weekly'` |
|------|------------------------------|
| `src/server/services/scheduleEngine.ts:59` | `isHabitScheduledOnDay`: weekly → show on first assignedDay or Monday only |
| `src/server/services/scheduleEngine.ts:99` | `getExpectedOpportunitiesInRange`: weekly → count distinct weeks |
| `src/server/services/streakService.ts:264` | Routes to `calculateWeeklyMetrics` when `goal.frequency === 'weekly'` |
| `src/server/services/dayViewService.ts:366` | Computes weekly progress (sum/distinct days vs target) |
| `src/server/services/dayViewService.ts:247` | Bundle child weekly check in `deriveBundleCompletion` |
| `src/server/routes/progress.ts:140` | Streak label formatting for weekly habits |
| `src/utils/habitUtils.ts:327` | `getHabitsForDate`: **excludes** weekly habits from Today view |
| `src/utils/habitAggregation.ts:38` | `computeHabitStatus`: weekly habit → count distinct days vs `weeklyTarget` |
| `src/components/day-view/WeeklyView.tsx:85` | Filters habits where `frequency === 'weekly'` |
| `src/components/day-view/HabitGridCell.tsx:300` | Shows "weekly" badge on habit card |
| `src/components/CalendarView.tsx:81` | Filters weekly habits for calendar scheduling |
| `src/components/AddHabitModal.tsx:735` | Daily/Weekly frequency selector toggle |
| `src/components/AddHabitModal.tsx:781` | Weekly intent UI (binary/frequency/quantity) |
| `src/App.tsx:166,332` | `trackerViewMode` includes `'weekly'` |
| `src/models/persistenceTypes.ts` | Type definitions |
| `src/data/predefinedHabits.ts:53-91` | ~20 predefined habits with `frequency: 'weekly'` |
| `src/pages/WellbeingHistoryPage.tsx` | **Unrelated** — uses `'weekly'` for wellbeing view mode |

### Tests referencing `'weekly'` (5 files):
- `src/server/services/scheduleEngine.test.ts`
- `src/server/services/streakService.test.ts`
- `src/server/services/dayViewService.test.ts` + `dayViewService.unit.test.ts`
- `src/utils/habitRingProgress.test.ts`
- `src/server/routes/__tests__/progress.overview.test.ts`

---

## 3. Streak Calculation Analysis

### Current Implementation (`src/server/services/streakService.ts`)

Three distinct calculation paths in `calculateHabitStreakMetrics` (line 258):

#### Path 1: Weekly Habits (`goal.frequency === 'weekly'`)
- Groups completions into ISO weeks (Mon-Sun)
- Week is "satisfied" if progress >= `goal.target`
  - Boolean: 1 completion = satisfied
  - Frequency: distinct days >= target
  - Quantity: sum of values >= target
- **Streak = consecutive satisfied weeks**
- At-risk: streak > 0 AND current week not satisfied AND <= 2 days left in week

#### Path 2: Scheduled Daily (`assignedDays + requiredDaysPerWeek`)
- Uses same weekly-window logic as weekly habits
- Target = `requiredDaysPerWeek ?? assignedDays.length`
- Counts completions on **any** day (not just assigned days) — flexibility built in
- **Streak = consecutive weeks with >= target completions**

#### Path 3: Daily (default)
- Counts consecutive calendar days with completions
- **Streak = consecutive completed days**
- At-risk: streak > 0 AND not completed today

#### Freeze Integration
- Frozen days (entry note starting with `freeze:`) count as "completed" for all streak paths

### Impact of Refactor
After migration, `goal.frequency === 'weekly'` no longer exists. The routing changes to:
- `if (habit.timesPerWeek)` → Path 1 (weekly window evaluation)
- `else if (habit.assignedDays?.length && habit.requiredDaysPerWeek)` → Path 2 (unchanged)
- `else` → Path 3 (daily, unchanged)

**Risk**: Low. The `timesPerWeek` field carries the exact same semantic as the old weekly target. Streak math is identical.

---

## 4. Success Rate Calculation

**No dedicated "success rate" metric exists.** Completion rates are derived contextually:

- **analyticsService.ts** → `completionRate = completedDays / scheduledDays`
- Uses `scheduleEngine.isHabitScheduledOnDay` to count opportunities
- Uses entry existence to count completions
- **No direct `'weekly'` references** in analyticsService — it delegates to scheduleEngine

**Impact**: Updating `scheduleEngine.isHabitScheduledOnDay` automatically fixes all analytics calculations.

---

## 5. Perfect Day / Perfect Week Logic

**Not formally implemented.** The closest concepts:

- **Week satisfaction** (`streakService.ts`): `weekSatisfied = weekProgress >= weekTarget` — returned in `HabitStreakMetrics`
- **Day completion**: `completedToday: boolean` in streak metrics — checks if any completion exists for reference day
- **Momentum** (`momentumService.ts`): States like 'Strong'/'Steady'/'Building' — based on active days and trends, not frequency-dependent

**Impact**: No formal "perfect day/week" definitions to break. The `weekSatisfied` field will continue to work with `timesPerWeek`.

---

## 6. Analytics Impact

### Heatmap (`analyticsService.ts → computeHeatmapData`)
- Calls `getScheduledHabitsForDay` (from scheduleEngine) for each day
- Counts scheduled vs completed
- **No direct frequency logic** — delegates to scheduleEngine
- **Impact**: Automatic fix via scheduleEngine update

### Consistency
- `consistencyScore = daysWithCompletion.size / totalDaysInRange`
- **No frequency dependence** — just checks if any habit was completed that day
- **Impact**: None

### Category Breakdown
- Uses `getExpectedOpportunitiesInRange` from scheduleEngine
- **Impact**: Automatic fix via scheduleEngine update

### Weekly Progress Map (`analyticsService.ts → buildWeeklyProgressMap`)
- Groups by ISO week, counts distinct days or sums values
- Currently used only by streakService (shared utility)
- **Impact**: Update target source from `goal.target` to `timesPerWeek`

---

## 7. Routines Tied to Habits

```typescript
interface Routine {
  linkedHabitIds: string[];    // Direct habit references
  steps: RoutineStep[];        // Steps can link to habits
  variants?: RoutineVariant[]; // Variant-specific habit links
}
```

- **No frequency assumptions** in routine logic
- Any routine can complete any habit type
- Completion creates `HabitEntry` with `source='routine'`
- Frequency validation happens at streak calculation time, not routine time

**Impact**: None. Routines are frequency-agnostic.

---

## 8. Goals Tied to Habits

```typescript
interface Goal {
  linkedHabitIds: string[];
  aggregationMode?: 'count' | 'sum';
  countMode?: 'distinctDays' | 'entries';
}
```

- **NOT frequency-aware** — just aggregates entries from linked habits
- Goal progress = sum(entries) or count(distinct days/entries)
- A weekly habit contributes to a goal the same as a daily habit

**Impact**: None. Goals are frequency-agnostic.

---

## 9. Apple Health Integration

- `healthAutoLogService.ts` / `healthRuleEvaluationService.ts`
- Creates `HabitEntry` with `source='apple_health'` when metrics match rules
- **No frequency handling** — daily signal evaluation only
- If a rule is satisfied for a dayKey, creates entry regardless of habit frequency

**Impact**: None. Apple Health is frequency-agnostic.

---

## 10. UI Impact Analysis

### Current Navigation Structure
```
Tracker view (App.tsx) → 3-way toggle:
  Grid   → TrackerGrid.tsx (habit rows × date columns, daily habits only)
  Today  → DayView.tsx (today's daily habits + total habits)
  Weekly → WeeklyView.tsx (weekly habits only, by category)
```

### Components That Rely on Weekly View
- `WeeklyView.tsx` — **entire component** filters on `frequency === 'weekly'`
- `App.tsx:332` — tab button labeled "Weekly"
- `App.tsx:470` — renders `<WeeklyView />` when `trackerViewMode === 'weekly'`

### Components That Rely on Grid View
- `TrackerGrid.tsx` — uses `getHabitsForDate()` which **excludes** weekly habits
- `App.tsx:321` — tab button labeled "Grid"
- `App.tsx:445` — renders `<TrackerGrid />` when `trackerViewMode === 'grid'`
- `App.tsx:347` — shows `CategoryTabs` only in grid mode

### Components That Assume Habit Frequency Type
- `HabitGridCell.tsx:300` — shows "weekly" badge when `habit.frequency === 'weekly'`
- `CalendarView.tsx:81` — filters weekly habits for schedule display
- `AddHabitModal.tsx:735` — daily/weekly frequency toggle
- `AddHabitModal.tsx:781` — weekly intent section (binary/frequency/quantity)
- `habitUtils.ts:327` — `getHabitsForDate` excludes non-daily/non-total habits
- `habitAggregation.ts:38` — `computeHabitStatus` has weekly-specific logic
- `DayView.tsx` — uses `getHabitsForDate` (indirectly affected)

### New Navigation Structure
```
Tracker view → 3-way toggle:
  All      → TrackerGrid.tsx (all habits, all days, no filtering)
  Today    → DayView.tsx (today's habits including timesPerWeek not yet met)
  Schedule → ScheduleView.tsx (NEW: 7-day strip, day-filtered habits)
```

---

## 11. Proposed New Data Model Schema

```typescript
interface HabitGoal {
  type: 'boolean' | 'number';
  target?: number;
  unit?: string;
  frequency: 'daily' | 'total';        // 'weekly' REMOVED
}

interface Habit {
  id: string;
  categoryId: string;
  name: string;
  goal: HabitGoal;
  archived: boolean;
  createdAt: string;

  // Unified scheduling (NEW MODEL)
  assignedDays?: number[];               // 0=Sun..6=Sat (specific days)
  timesPerWeek?: number;                 // Weekly quota (replaces weeklyTarget)
  requiredDaysPerWeek?: number;          // Existing field, kept

  // REMOVED fields:
  // frequency?: 'daily' | 'weekly'      (redundant with goal.frequency)
  // weeklyTarget?: number               (replaced by timesPerWeek)

  // All other fields unchanged...
}
```

### Scheduling Logic Summary

| `timesPerWeek` | `assignedDays` | Behavior |
|---------------|----------------|----------|
| undefined | undefined | Every day (pure daily) |
| undefined | [1,3,5] | Mon/Wed/Fri only |
| 3 | undefined | 3x/week, user picks days |
| 3 | [1,3,5] | 3x/week on Mon/Wed/Fri |

### Helper Function

```typescript
/** Whether a habit uses weekly-window evaluation for streaks/progress */
export function isWeeklyQuotaHabit(habit: Habit): boolean {
  return habit.timesPerWeek != null && habit.timesPerWeek > 0;
}
```

---

## 12. Updated Streak Calculation Logic

```typescript
// streakService.ts — calculateHabitStreakMetrics
export function calculateHabitStreakMetrics(habit, dayStates, referenceDate, referenceDayKey) {
  // NEW routing: timesPerWeek instead of goal.frequency === 'weekly'
  if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
    return calculateWeeklyMetrics(dayStates, habit, referenceDate, referenceDayKey);
    // Uses weekly windows (Mon-Sun)
    // target = habit.timesPerWeek
    // Streak = consecutive satisfied weeks
  }

  if (habit.assignedDays?.length && habit.requiredDaysPerWeek) {
    return calculateScheduledDailyMetrics(dayStates, habit, referenceDate, referenceDayKey);
    // Uses weekly windows
    // target = requiredDaysPerWeek ?? assignedDays.length
    // Streak = consecutive weeks meeting target
  }

  return calculateDailyMetrics(dayStates, referenceDate, referenceDayKey);
  // Consecutive calendar days
}
```

---

## 13. Updated Success Rate Logic

```typescript
// scheduleEngine.ts — isHabitScheduledOnDay
export function isHabitScheduledOnDay(habit, dayKey) {
  const dow = dayOfWeek(dayKey);

  // Weekly quota habits
  if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
    if (habit.assignedDays?.length) {
      return habit.assignedDays.includes(dow);  // Only on assigned days
    }
    return true;  // Every day (user picks which)
  }

  // Daily with specific days
  if (habit.assignedDays?.length) {
    return habit.assignedDays.includes(dow);
  }

  // Pure daily — every day
  return true;
}
```

**Success rate** = completions on scheduled days / total scheduled days in range. This formula is unchanged; only the `isHabitScheduledOnDay` logic updates.

---

## 14. Risk Summary

| Area | Risk Level | Notes |
|------|-----------|-------|
| Streak calculations | Low | Computed at read-time, `timesPerWeek` = same semantic as old weekly target |
| Weekly success / quota | Low | `buildWeeklyProgressMap` reused with updated target source |
| Heatmap | Low | Delegates to scheduleEngine — auto-fixed |
| Goal tracking | None | Frequency-agnostic |
| Routine completion | None | Frequency-agnostic |
| Apple Health | None | Frequency-agnostic |
| Habit history queries | None | Entries are truth, no frequency in entries |
| Backfilling completions | None | No entry data modified |
| Timezone / DayKey | None | No changes to DayKey handling |
| "Perfect day" logic | None | Not formally defined; `completedToday` still works |
| "Perfect week" logic | Low | `weekSatisfied` field works with `timesPerWeek` |
| Bundle children | Medium | Migration must transform children too; `deriveBundleCompletion` updated |
| Un-migrated data | Medium | Read-time `normalizeHabitFrequency()` shim as safety net |
