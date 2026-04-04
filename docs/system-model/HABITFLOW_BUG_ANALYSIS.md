# HabitFlow Bug Analysis

Catalog of confirmed bugs, inconsistencies, and design risks found during the system consistency audit. Each finding references specific source files and includes verified code-level details.

## Classification

- **BUG**: Confirmed code defect with specific file/line reference
- **INCONSISTENCY**: Behavior that differs across similar contexts
- **DESIGN RISK**: Fragile patterns that could cause future issues
- **TECH DEBT**: Deprecated patterns still in use

---

## Confirmed Bugs

### BUG-1: truthQuery drops `apple_health` source

**Severity:** Medium

**File:** `src/server/services/truthQuery.ts` lines 157-168

The `mapEntryToView` function maps `entry.source` to a validated set of known sources. The condition at lines 158-163 checks for `'manual'`, `'routine'`, `'quick'`, `'import'`, and `'test'`:

```typescript
if (
  entry.source === 'manual' ||
  entry.source === 'routine' ||
  entry.source === 'quick' ||
  entry.source === 'import' ||
  entry.source === 'test'
) {
  source = entry.source;
} else {
  source = 'manual';
}
```

Meanwhile, the `EntryView` type at line 26 explicitly includes `'apple_health'` as a valid source:

```typescript
source: 'manual' | 'routine' | 'quick' | 'import' | 'apple_health' | 'legacy' | 'test';
```

And the health routes (`src/server/routes/health.ts` line 49, `src/server/routes/healthSuggestions.ts` line 76) create entries with `source: 'apple_health'`.

**Impact:** All Apple Health auto-logged entries lose their provenance when read back through truthQuery. The `source` field in EntryView says `'manual'` for apple_health entries. Analytics cannot distinguish auto-logged vs manually logged entries.

**Fix:** Add `entry.source === 'apple_health'` to the condition at lines 158-163. (`'legacy'` is not a valid `HabitEntry.source` value — only present in `EntryView` — so no entries are created with it; the fallback to `'manual'` is correct for that case.)

**Status:** Resolved. Added `'apple_health'` to the source allowlist in `mapEntryToView`.

---

### BUG-2: FreezeService only processes daily-frequency habits

**Severity:** Medium

**File:** `src/server/services/freezeService.ts` line 32

The auto-freeze loop explicitly skips non-daily habits:

```typescript
if (habit.goal.frequency !== 'daily') continue;
```

The code comment at lines 29-31 acknowledges this is an MVP limitation:

```
// PRD: "If weekly habits exist, ensure the frozen state applies at the appropriate unit (week)."
// MVP: Focus on Daily auto-freeze.
```

**Impact:** Weekly habits (those with `timesPerWeek` set) and total-frequency habits never receive auto-freezes. Users with weekly habits can lose streaks even when they have freeze inventory available. The freeze service also only checks "yesterday" (line 24: `const yesterday = subDays(new Date(), 1)`), which is appropriate for daily habits but the weekly equivalent would need to check the previous week boundary.

**Status:** Resolved. Added weekly habit freeze support: on Mondays, the service checks if the previous week (Mon-Sun) was unsatisfied (completions < `timesPerWeek`) and if there was an active streak to protect (the week before was satisfied). If so, creates a freeze marker on the previous week's Sunday and decrements freeze inventory.

---

### BUG-3: Streak calculation treats value-0 entries as completions

**Severity:** Low-Medium

**File:** `src/server/routes/progress.ts` lines 59-74, `src/server/services/streakService.ts` lines 61-69

In progress.ts, the entry aggregation logic builds `HabitDayState` from entries. If an entry's note does not start with `"freeze:"`, it is marked as completed regardless of value:

```typescript
const freezeType = parseFreezeType(entry.note);
if (freezeType) {
  existing.isFrozen = true;
} else {
  existing.completed = true;
  existing.value += typeof entry.value === 'number' ? entry.value : 1;
}
```

In streakService.ts, `calculateDailyMetrics` counts any day where `completed || isFrozen` as valid for streaks:

```typescript
const validDayKeys = new Set(
  dayStates
    .filter(state => state.completed || state.isFrozen)
    .map(state => state.dayKey)
);
```

A legitimate entry with `value: 0` (e.g., user logs "0 glasses of water") gets `completed: true` with `value: 0`. For boolean habits this is fine (any entry = complete). But for numeric habits, the dayViewService correctly checks `value >= target` (`src/server/services/dayViewService.ts` line 150: `isComplete = currentValue >= target`), while the streak service counts the day as valid regardless.

**Impact:** For numeric habits, a user could maintain a daily streak by logging value=0, even though the day view would correctly show the habit as incomplete (0 < target). The streak counter and the day view give contradictory signals.

**Status:** Resolved. Added a post-aggregation correction pass in `progress.ts` that sets `completed = value >= target` for numeric habits (those with `goal.type === 'number'` and `goal.target > 0`). This runs after all entries are summed and after bundle derivation, but before momentum and streak calculations consume the data. Boolean habits remain unaffected (any entry = complete).

---

## Inconsistencies

### INCONSISTENCY-1: Dual Habit-Goal link sync

**Files:** `src/server/routes/goals.ts` lines 444-446, 722-734, 953-957; `src/server/routes/habits.ts` lines 319; `src/server/repositories/habitRepository.ts` lines 209-245

The goal routes maintain bidirectional sync between `goal.linkedHabitIds` and `habit.linkedGoalId`:

- **Goal creation** (goals.ts line 444-446): After creating a goal, calls `linkHabitsToGoal()` to set `linkedGoalId` on all linked habits.
- **Goal update** (goals.ts lines 722-734): When `linkedHabitIds` changes, clears `linkedGoalId` from removed habits and sets it on current habits.
- **Goal deletion** (goals.ts lines 953-957): Calls `unlinkHabitsFromGoal()` to clear `linkedGoalId` from all habits that reference the deleted goal.

However, the habit routes (habits.ts line 319) allow setting `linkedGoalId` directly on a habit without updating the goal's `linkedHabitIds`:

```typescript
if (linkedGoalId !== undefined) patch.linkedGoalId = linkedGoalId;
```

No corresponding call updates `goal.linkedHabitIds` when a habit's `linkedGoalId` is changed from the habit side.

**Impact:** If a user links a habit to a goal via the habit edit flow, the goal's `linkedHabitIds` array will not include that habit. Goal progress calculations that iterate `goal.linkedHabitIds` will miss the habit. Conversely, if a user unlinks from the habit side, the goal still thinks the habit is linked.

---

### INCONSISTENCY-2: MomentumService typed on deprecated DayLog

**File:** `src/server/services/momentumService.ts` line 1

The service imports `DayLog` type and operates on `DayLog[]` parameters:

```typescript
import type { DayLog, GlobalMomentumState, CategoryMomentumState } from '../../types';
```

The progress route (`src/server/routes/progress.ts` lines 99-108) constructs DayLog-shaped objects from HabitEntry-derived data to feed into momentum:

```typescript
const completionLogs: DayLog[] = Array.from(dayStatesByHabit.entries()).flatMap(([habitId, dayMap]) =>
  Array.from(dayMap.values())
    .filter(state => state.completed)
    .map(state => ({
      habitId,
      date: state.dayKey,
      value: state.value,
      completed: true,
    }))
);
```

Not a data correctness bug (data is derived from entries), but the interface uses a deprecated type.

**Impact:** Type confusion; new developers may think momentum reads from the deprecated DayLog collection. The `DayLog` type is declared in `src/models/persistenceTypes.ts` (line 282) alongside the deprecated `dayLogs` collection.

---

### INCONSISTENCY-3: HabitCreationInlineModal vs AddHabitModal field parity

**Files:** `src/components/HabitCreationInlineModal.tsx`, `src/components/AddHabitModal.tsx`

`HabitCreationInlineModal` (triggered from goal creation) only supports: name, type (binary/quantified), target, unit, category, and imageUrl. It hardcodes `frequency: 'daily'` (line 54):

```typescript
goal: {
  type: type === 'quantified' ? 'number' : 'boolean',
  target: type === 'quantified' && target ? Number(target) : undefined,
  unit: type === 'quantified' && unit ? unit.trim() : undefined,
  frequency: 'daily',
},
```

`AddHabitModal` supports the full set of fields: scheduling (assignedDays, scheduledTime, duration), bundles, linked routines, linked goals, non-negotiable settings, pinning, time estimates, `requiredDaysPerWeek`, and more.

**Impact:** Habits created from the goal linking flow cannot be scheduled, bundled, or linked to routines without a separate edit step. They are always daily-frequency. Users creating a weekly habit from a goal context would need to edit it afterward.

---

### INCONSISTENCY-4: Category filter availability in linking modals

`CreateGoalModal` and `EditGoalModal` provide category filter toggles for habit selection. `AddHabitModal`'s goal dropdown does not have category filtering.

**Impact:** When linking a habit to a goal from the habit side, users must scroll through all goals without category filtering. Minor UX friction, but inconsistent with the goal-side experience.

---

### INCONSISTENCY-5: scheduleEngine vs frontend filtering

**Backend:** `src/server/services/scheduleEngine.ts` provides `isHabitScheduledOnDay()` which handles four scheduling modes: timesPerWeek with assignedDays, timesPerWeek without assignedDays, daily with assignedDays, and daily without assignedDays.

**Frontend:** `src/components/day-view/DayView.tsx` and `src/components/TrackerGrid.tsx` may implement their own filtering logic.

**Risk:** If frontend and backend scheduling logic diverge, the day view could show different habits than what the backend considers scheduled. The scheduleEngine is used by analyticsService and streakService but the frontend may duplicate logic rather than relying on backend-derived scheduling state.

**Recommendation:** Verify frontend uses the same rules or delegates to the backend.

---

## Design Risks

### RISK-1: Freeze detection via note string parsing

**File:** `src/server/routes/progress.ts` lines 24-29

Freeze entries are identified by parsing the `entry.note` field:

```typescript
function parseFreezeType(note?: string): 'manual' | 'auto' | 'soft' | undefined {
  if (!note || !note.startsWith('freeze:')) return undefined;
  const raw = note.slice('freeze:'.length);
  if (raw === 'manual' || raw === 'auto' || raw === 'soft') return raw;
  return 'auto';
}
```

The freezeService (`src/server/services/freezeService.ts` line 63) creates freeze markers with `note: 'freeze:auto'`. No schema-level field (like `isFreezeMarker: boolean`) distinguishes freeze from real entries.

**Risk level:** Low (unlikely user behavior) but fragile. If a user's note coincidentally starts with `"freeze:"`, it would be misclassified as a freeze marker and not count toward completion.

**Recommendation:** Add a dedicated field to HabitEntry for freeze markers.

---

### RISK-2: Bundle parent entries could corrupt data

The entry creation route (`src/server/routes/habitEntries.ts` lines 86-179) validates the entry payload structure and checks that the habit exists (line 133-137), but does not check whether the habit is a bundle parent (`habit.type === 'bundle'`).

Rule R11 states bundle parents never have direct entries -- their completion is derived from children. But the server-side route will accept and persist an entry for a bundle parent.

**Impact:** If a bundle parent receives a direct entry, it could be double-counted: once from the entry itself (in progress.ts aggregation) and once from derived child completion (in `deriveBundleParentDayStatesFromMemberships`).

**Recommendation:** Add server-side validation in entry creation route to reject entries for bundle parent habits.

---

### RISK-3: Legacy bundleOptions coexistence with subHabitIds

`Habit.bundleOptions` is deprecated in favor of `subHabitIds` (Choice V2 with real child habits). However, `bundleOptions` is still referenced in 13 files across the codebase:

- UI components: `BundleComponents.tsx`, `DayHabitRow.tsx`, `AddHabitModal.tsx`, `TrackerGrid.tsx`, `HabitLogModal.tsx`
- Backend: `habits.ts`, `habitValidation.ts`
- Types: `persistenceTypes.ts`, `types/index.ts`
- Utils: `habitAggregation.ts`, `habitUtils.ts`
- Migration script: `migrateChoiceBundles.ts`

The progress route (`src/server/routes/progress.ts` line 88-91) falls back to `subHabitIds` when no `BundleMembershipRecord` exists, meaning pre-migration bundles still work but through a different code path.

**Risk:** Two parallel systems for representing bundle children, leading to confusion about which is authoritative.

**Recommendation:** Complete migration and remove bundleOptions support.

---

## Tech Debt

### DEBT-1: DayLog collection still exists

`DayLog` and `dayLogs` collection are deprecated (per CLAUDE.md: "Removed collections: dayLogs") but still:

- Typed in `src/models/persistenceTypes.ts` (line 282: `export interface DayLog`)
- Used as interface type in `src/server/services/momentumService.ts` (line 1)
- Constructed in `src/server/routes/progress.ts` (lines 99-108) for momentum
- Referenced in `src/store/HabitContext.tsx`
- Storage type `DayLogsStorage` defined at persistenceTypes.ts line 940

**Recommendation:** Refactor momentumService to accept `EntryView[]` or `HabitDayState[]`, then remove DayLog type.

---

### DEBT-2: Three date fields on HabitEntry

HabitEntry has three date-related fields:
- `dayKey` (canonical, YYYY-MM-DD)
- `date` (deprecated, line 1380 in persistenceTypes.ts: `date?: string`)
- `dateKey` (deprecated, line 1398 in persistenceTypes.ts: `dateKey?: string`, annotated `@deprecated Use dayKey instead`)

The truthQuery `mapEntryToView` function (lines 128-155) has a four-level fallback chain: `dayKey` -> `date` -> `dateKey` -> derive from `timestamp`. The fallback is gated behind `allowDayKeyLegacyFallback()` in production.

**Recommendation:** Migrate all entries to have `dayKey`, then remove fallback logic.

---

### DEBT-3: DailyWellbeing legacy format

The `wellbeingLogs` collection uses the `DailyWellbeing` format (morning/evening sessions + flat legacy fields). A newer canonical format using `WellbeingEntry` (individual metric observations) is served by `src/server/routes/wellbeingEntries.ts`.

Both systems coexist -- 13 files still reference `wellbeingLogs` or `DailyWellbeing`, including:
- Repository: `src/server/repositories/wellbeingLogRepository.ts`
- Routes: `src/server/routes/wellbeingLogs.ts`
- Frontend: `DailyCheckInCard.tsx`, `DailyCheckInModal.tsx`, `ProgressRings.tsx`
- State: `HabitContext.tsx`

**Recommendation:** Complete migration to WellbeingEntry, then deprecate DailyWellbeing reads.

---

### DEBT-4: Habit.pace field declared but never stored

`Habit.pace` is typed as `string | null` in `src/models/persistenceTypes.ts` (line 143) with an explicit comment:

```
* or calculated in the application layer, not stored in the database.
```

It exists in the Habit interface but is not persisted to MongoDB.

**Recommendation:** Move to a separate computed type or remove from Habit interface.

---

## User-Reported Bug Investigation

### Investigation: Weekly habit showing wrong contribution count

**User report:** "If a habit has a weekly target of 3 times per week, and I go to the gym 2 days, the Today view sometimes shows only 1 contribution instead of 2."

Traced the logic through `src/server/services/dayViewService.ts`:

1. `deriveWeeklyProgress()` (lines 119-167) filters entries to the current week window (Monday-Sunday) using string comparison: `entry.dayKey >= weekStartDayKey && entry.dayKey <= weekEndDayKey`
2. For frequency weekly habits (line 151-155): counts distinct dayKeys via `new Set(weekEntries.map(e => e.dayKey)).size`
3. For quantity weekly habits (line 147-150): sums values via `weekEntries.reduce((sum, entry) => sum + (entry.value ?? 0), 0)`

**Possible causes:**

- **Timezone mismatch**: If entries were created with a different timezone than the current request, their dayKey might fall outside the expected week window. The week window is computed using `startOfWeek(parseISO(dayKey), { weekStartsOn: 1 })` in the user's timezone, but if entries were written with a different timezone, the dayKey itself could differ by a day at the boundary.
- **Multiple entries on same day**: For frequency weekly, only distinct dayKeys count. If user logged twice on the same day, it counts as 1.
- **Soft-deleted entries**: The `!entry.deletedAt` filter (line 135) excludes entries the user may think exist.
- **Habit type confusion**: If the habit is configured as quantity (`goal.type === 'number'`) but user expects frequency counting, the logic branches differently (line 141-142: `const isQuantity = habit.goal.type === 'number'`).

**Recommendation:** Add debug logging to the day view API to trace which entries are found and how they are counted, to narrow down the specific user scenario.

---

## Summary Table

| ID | Type | Severity | Component | Status |
|----|------|----------|-----------|--------|
| BUG-1 | Bug | Medium | truthQuery.ts | **Resolved** |
| BUG-2 | Bug | Medium | freezeService.ts | **Resolved** |
| BUG-3 | Bug | Low-Med | progress.ts / streakService.ts | **Resolved** |
| INC-1 | Inconsistency | Medium | Goal-Habit bidirectional sync | Verified: habit-side update does not sync to goal |
| INC-2 | Inconsistency | Low | momentumService types | Tech debt |
| INC-3 | Inconsistency | Medium | Habit creation modal parity | Verified: inline modal missing many fields |
| INC-4 | Inconsistency | Low | Category filters in modals | Unresolved |
| INC-5 | Inconsistency | Medium | Schedule filtering | Needs verification |
| RISK-1 | Design Risk | Low | Freeze detection via note parsing | Unresolved |
| RISK-2 | Design Risk | Medium | Bundle parent entry validation | Unresolved |
| RISK-3 | Design Risk | Medium | Legacy bundleOptions coexistence | Migration needed |
| DEBT-1 | Tech Debt | Low | DayLog type removal | Planned |
| DEBT-2 | Tech Debt | Low | Entry date field consolidation | Planned |
| DEBT-3 | Tech Debt | Low | Wellbeing format migration | Planned |
| DEBT-4 | Tech Debt | Low | Habit.pace field | Planned |
