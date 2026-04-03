# Habit Scheduling Refactor — Implementation Plan

## Summary of Changes

| Feature | Before | After |
|---------|--------|-------|
| Weekly habit type | `goal.frequency: 'weekly'` | Removed — use `timesPerWeek` field |
| Root `frequency` field | `frequency?: 'daily' \| 'weekly'` | Removed (redundant) |
| `weeklyTarget` field | `weeklyTarget?: number` | Removed — replaced by `timesPerWeek` |
| Grid view | Tab labeled "Grid" | Tab labeled "All" (all habits, no day filter) |
| Weekly view | Tab labeled "Weekly" | Tab labeled "Schedule" (7-day strip selector) |
| Streak logic routing | `goal.frequency === 'weekly'` | `timesPerWeek != null` |
| Today view | Excludes weekly habits | Includes all habits scheduled today (including timesPerWeek) |

---

## Data Model Changes

### Before
```typescript
interface HabitGoal {
  type: 'boolean' | 'number';
  target?: number;
  unit?: string;
  frequency: 'daily' | 'weekly' | 'total';
}

interface Habit {
  frequency?: 'daily' | 'weekly';
  weeklyTarget?: number;
  assignedDays?: number[];
  requiredDaysPerWeek?: number;
  // ...
}
```

### After
```typescript
interface HabitGoal {
  type: 'boolean' | 'number';
  target?: number;
  unit?: string;
  frequency: 'daily' | 'total';              // 'weekly' removed
}

interface Habit {
  // frequency field REMOVED
  // weeklyTarget field REMOVED
  timesPerWeek?: number;                      // NEW — weekly quota
  assignedDays?: number[];                    // unchanged
  requiredDaysPerWeek?: number;               // unchanged
  // ...
}
```

---

## API Changes

No new endpoints required. Existing endpoints continue to work:
- `POST /api/habits` — accepts `timesPerWeek` field (new), rejects `frequency: 'weekly'` in `goal`
- `PUT /api/habits/:id` — same
- `GET /api/day-view` — returns updated progress format for `timesPerWeek` habits

Backend validation should reject `goal.frequency: 'weekly'` on write after migration.

---

## Migration Plan

### Migration Script: `src/server/migrations/002_remove_weekly_frequency.ts`

```typescript
// For each habit where goal.frequency === 'weekly' OR frequency === 'weekly':
//
// 1. Determine timesPerWeek:
//    - If weeklyTarget exists → timesPerWeek = weeklyTarget
//    - Else if goal.target > 1  → timesPerWeek = goal.target, goal.target = 1
//    - Else                     → timesPerWeek = 1
//
// 2. Set goal.frequency = 'daily'
// 3. $unset: { frequency: 1, weeklyTarget: 1 }
//
// Features:
// - --dry-run flag: logs changes without writing
// - Idempotent: skips habits already migrated
// - Includes bundle children
```

### Migration Rules Table

| Old Shape | New Shape |
|-----------|-----------|
| `goal.frequency='weekly'`, `goal.target=1`, boolean | `goal.frequency='daily'`, `timesPerWeek=1` |
| `goal.frequency='weekly'`, `goal.target=3`, boolean | `goal.frequency='daily'`, `timesPerWeek=3`, `goal.target=1` |
| `goal.frequency='weekly'`, `weeklyTarget=3` | `goal.frequency='daily'`, `timesPerWeek=3` |
| `goal.frequency='weekly'`, `goal.type='number'`, `goal.target=30` | `goal.frequency='daily'`, `timesPerWeek=30`, `goal.type='number'` |
| `goal.frequency='weekly'`, `assignedDays=[1,3,5]` | `goal.frequency='daily'`, `timesPerWeek=1`, `assignedDays=[1,3,5]` |

### Static Data Updates
- `src/data/predefinedHabits.ts`: Convert ~20 habits from `frequency: 'weekly'` to `frequency: 'daily'` + `timesPerWeek`
- `scripts/seed-fitness.ts`: Update frequency references

---

## UI Changes

### Navigation (App.tsx)

| Before | After |
|--------|-------|
| `trackerViewMode: 'grid' \| 'day' \| 'weekly'` | `trackerViewMode: 'all' \| 'day' \| 'schedule'` |
| Tab: "Grid" | Tab: "All" |
| Tab: "Today" | Tab: "Today" |
| Tab: "Weekly" → `<WeeklyView />` | Tab: "Schedule" → `<ScheduleView />` |

### New: ScheduleView (`src/components/day-view/ScheduleView.tsx`)

```
┌──────────────────────────────────────────────────────────┐
│  ◀  [ Mon 6 ] [ Tue 7 ] [*Wed 8*] [ Thu 9 ] ...  ▶    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ Scheduled for Wednesday ──────────────────────────┐  │
│  │  ☐ Gym (2/3 this week)                             │  │
│  │  ☐ Yoga Session                                    │  │
│  │  ☐ ML Study Block                                  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ▸ Daily Habits (collapsed)                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Features:
- 7-day strip selector (Mon-Sun, current week)
- Prev/Next week navigation
- Selected day updates habit list
- `timesPerWeek` habits show "X/Y this week" progress
- Daily habits (every-day) collapsed by default
- Reuses `DayCategorySection` for rendering

### Updated: AddHabitModal

**Remove**: Daily/Weekly frequency toggle + weekly intent UI (binary/frequency/quantity)

**Replace with**:
- Goal type toggle: Done (Y/N) vs Numeric — **unchanged**
- Schedule section:
  - Day chip selector (assignedDays) — "Which days?" (optional)
  - Times per week input — "How many times per week?" (optional)
- On submit: always `goal.frequency = 'daily'`, set `timesPerWeek` and `assignedDays` from inputs

### Updated: TrackerGrid (All View)
- Remove daily-only filtering
- Show all habits regardless of schedule
- Grouped by category
- Same grid completion UI

### Updated: Today View (DayView)
- Now includes `timesPerWeek` habits (previously excluded as "weekly")
- Shows `timesPerWeek` habits that haven't met their weekly quota yet

### Minor Component Updates
- `HabitGridCell.tsx:300`: `habit.frequency === 'weekly'` → `habit.timesPerWeek != null` (badge)
- `CalendarView.tsx:81`: `goal.frequency === 'weekly'` → `h.timesPerWeek != null` (filter)
- `InfoModal.tsx`: Update Basics tab to reflect unified scheduling model

### Deleted
- `src/components/day-view/WeeklyView.tsx` — replaced by ScheduleView

---

## Analytics Changes

### Schedule Engine (`src/server/services/scheduleEngine.ts`)
- `isHabitScheduledOnDay`: Remove `freq === 'weekly'` branch → add `timesPerWeek` check
- `getExpectedOpportunitiesInRange`: Remove `freq === 'weekly'` branch → count weeks for `timesPerWeek` habits

### Streak Service (`src/server/services/streakService.ts`)
- Routing: `goal.frequency === 'weekly'` → `timesPerWeek != null && timesPerWeek > 0`
- Target source: `habit.timesPerWeek ?? habit.goal.target ?? 1`

### Day View Service (`src/server/services/dayViewService.ts`)
- `computeDayView`: Replace `goal.frequency === 'weekly'` with `timesPerWeek` check
- `deriveWeeklyProgress`: Update target source
- `deriveBundleCompletion`: Update child frequency check

### No Changes Needed
- `analyticsService.ts` — delegates to scheduleEngine, auto-fixed
- `goalProgressUtilsV2.ts` — frequency-agnostic
- `healthAutoLogService.ts` — frequency-agnostic
- `momentumService.ts` — frequency-agnostic

---

## Backward Compatibility

### Read-Time Normalization Shim

```typescript
// Add to shared utility
export function normalizeHabitFrequency(habit: Habit): Habit {
  if (habit.goal?.frequency === 'weekly' || habit.frequency === 'weekly') {
    return {
      ...habit,
      goal: { ...habit.goal, frequency: 'daily' },
      timesPerWeek: habit.timesPerWeek
        ?? habit.weeklyTarget
        ?? (habit.goal.target && habit.goal.target > 1 ? habit.goal.target : 1),
    };
  }
  return habit;
}
```

Apply at repository read boundaries to handle un-migrated documents.

---

## Testing Plan

### Existing Tests to Update (5 files)
1. `src/server/services/scheduleEngine.test.ts` — Replace `frequency: 'weekly'` fixtures with `timesPerWeek`
2. `src/server/services/streakService.test.ts` — Same fixture updates
3. `src/server/services/dayViewService.test.ts` + `dayViewService.unit.test.ts` — Same
4. `src/utils/habitRingProgress.test.ts` — Line 332 weekly fixture
5. `src/server/routes/__tests__/progress.overview.test.ts` — Weekly streak formatting

### New Tests to Add
- Migration script: verify all weekly variants are correctly transformed
- ScheduleView: 7-day strip interaction, correct habit filtering per day
- `timesPerWeek` + `assignedDays` combinations (both set, only one set, neither set)
- Streak calculation equivalence: verify same results for migrated data
- `normalizeHabitFrequency` shim: handles all legacy formats

### Verification Commands
```bash
npm run build          # TypeScript catches remaining 'weekly' references
npm run test:run       # All tests pass
npm run lint:beta      # Linting passes
npm run test:beta      # CI beta suite passes
```

---

## Rollback Plan

1. **Git revert**: All changes are on one feature branch — revert the entire branch
2. **Reverse migration**: `timesPerWeek → weeklyTarget`, `goal.frequency = 'weekly'`, restore root `frequency`
3. **No entry data modified**: Entries only have `habitId + dayKey + value` (frequency-agnostic), so rollback is clean
4. **Read-time shim**: Even without reverse migration, the normalization shim handles both old and new formats

---

## Execution Order

| Step | What | Files |
|------|------|-------|
| 1 | Data model types | `persistenceTypes.ts`, `types/index.ts` |
| 2 | Migration script + predefined habits | `migrations/002_*.ts`, `predefinedHabits.ts` |
| 3 | Schedule engine | `scheduleEngine.ts` |
| 4 | Streak service | `streakService.ts` |
| 5 | Day view service | `dayViewService.ts` |
| 6 | Progress route | `progress.ts` |
| 7 | Frontend utilities | `habitUtils.ts`, `habitAggregation.ts` |
| 8 | Navigation refactor | `App.tsx` |
| 9 | New ScheduleView | `ScheduleView.tsx` (new) |
| 10 | AddHabitModal refactor | `AddHabitModal.tsx` |
| 11 | Minor component updates | `HabitGridCell.tsx`, `CalendarView.tsx`, `TrackerGrid.tsx` |
| 12 | Delete WeeklyView | `WeeklyView.tsx` |
| 13 | Update tests | 5 test files + new tests |
| 14 | Update InfoModal | `InfoModal.tsx` |
| 15 | Update seed scripts | `seed-fitness.ts` |

---

## Impacted Files Summary (Complete List)

### Modified (18 files)
1. `src/models/persistenceTypes.ts`
2. `src/types/index.ts`
3. `src/server/services/scheduleEngine.ts`
4. `src/server/services/streakService.ts`
5. `src/server/services/dayViewService.ts`
6. `src/server/routes/progress.ts`
7. `src/utils/habitUtils.ts`
8. `src/utils/habitAggregation.ts`
9. `src/App.tsx`
10. `src/components/AddHabitModal.tsx`
11. `src/components/day-view/HabitGridCell.tsx`
12. `src/components/CalendarView.tsx`
13. `src/components/TrackerGrid.tsx`
14. `src/components/InfoModal.tsx`
15. `src/data/predefinedHabits.ts`
16. `scripts/seed-fitness.ts`

### New (2 files)
17. `src/server/migrations/002_remove_weekly_frequency.ts`
18. `src/components/day-view/ScheduleView.tsx`

### Deleted (1 file)
19. `src/components/day-view/WeeklyView.tsx`

### Tests Modified (5 files)
20. `src/server/services/scheduleEngine.test.ts`
21. `src/server/services/streakService.test.ts`
22. `src/server/services/dayViewService.test.ts` + `dayViewService.unit.test.ts`
23. `src/utils/habitRingProgress.test.ts`
24. `src/server/routes/__tests__/progress.overview.test.ts`

---

## Acceptance Criteria

### Today View
- [x] Shows daily habits (every day, no assignedDays)
- [x] Shows habits with assignedDays matching today
- [x] Shows timesPerWeek habits not yet at weekly quota
- [x] Does NOT show timesPerWeek habits that already met quota this week
- [x] Shows total (cumulative) habits

### All View
- [x] Shows all active habits regardless of schedule
- [x] Grouped by category
- [x] Grid completion UI works for all habit types

### Schedule View
- [x] 7-day strip selector (Mon-Sun)
- [x] Selected day filters habit list
- [x] Daily habits collapsed by default
- [x] timesPerWeek habits show weekly progress (e.g., "2/3 this week")
- [x] Prev/Next week navigation

### Analytics
- [x] Streaks correct for daily habits
- [x] Streaks correct for timesPerWeek habits (consecutive satisfied weeks)
- [x] Success rate / completion rate correct
- [x] Heatmap reflects actual scheduled days
- [x] History still accurate (entries unchanged)

### Migration
- [x] All existing weekly habits converted to timesPerWeek model
- [x] No data loss
- [x] Idempotent (safe to re-run)
- [x] --dry-run support
