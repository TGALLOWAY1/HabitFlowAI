# HabitFlowAI System Rules

## 1. Purpose

This document defines the invariant rules that govern HabitFlowAI's behavior. Any feature addition, bug fix, or refactor MUST comply with these rules. Violations indicate a bug.

---

## 2. Truth Rules

### R1: HabitEntry Is the Single Source of Truth

- `habitEntries` collection is the canonical record of all habit completions.
- All derived views (day view, progress, streaks, goal progress) are computed from entries at read time.
- Never store completion state separately -- always derive it.
- DayLog exists only as a deprecated cache and must not be written to directly.

**Source:** `src/server/services/truthQuery.ts` -- all history reads go through `truthQuery`, returning normalized `EntryView` structures for charts, day views, and goal aggregation.

### R2: WellbeingEntry Is the Canonical Truth for Subjective Check-ins

- `wellbeingEntries` collection stores individual metric observations.
- Uniqueness: `(userId, dayKey, timeOfDay, metricKey)`.
- DailyWellbeing/wellbeingLogs is legacy and should not receive new writes.

### R3: DayKey Is the Aggregation Boundary

- DayKey format: `YYYY-MM-DD`.
- Computed using the user's IANA timezone; falls back to `America/New_York` when the client provides no timezone or an invalid one.
- Server authority: `src/server/utils/dayKey.ts` (`resolveTimeZone()`, `getDayKeyForDate()`).
- All date-based grouping, querying, and display uses DayKey.
- `HabitEntry.dayKey` is the ONLY persisted aggregation day field (`date` and `dateKey` are deprecated legacy fields; fallback to them is gated behind `allowDayKeyLegacyFallback()`).

### R4: Soft Delete, Never Hard Delete

- Truth records (HabitEntry, WellbeingEntry) use a `deletedAt` timestamp for soft delete.
- Queries must filter `deletedAt` unless explicitly including deleted records.
- Habits use `archived: true` instead of deletion.

### R5: Identity Scoping

- Every API request requires `X-Household-Id` and `X-User-Id` headers (or a valid session in production).
- All data access is scoped by `userId`.
- In development with `DEMO_MODE_ENABLED=true`: headers accepted, or bootstrap defaults (`default-household`, `default-user`) applied.
- In production: missing session = 401 -- headers are never used.

**Source:** `src/server/middleware/identity.ts`

---

## 3. Completion Rules

### R6: Daily Boolean Habit Completion

- Complete if: at least one non-deleted `HabitEntry` exists for `(habitId, dayKey)`.
- Value is ignored for boolean habits -- any entry means complete.
- **Source:** `dayViewService.ts:deriveDailyCompletion()` -- returns `true` when `entryViews.some(entry => entry.habitId === habitId && entry.dayKey === dayKey && !entry.deletedAt)`.

### R7: Daily Numeric Habit Completion

- Complete if: sum of entry values for `(habitId, dayKey)` >= `habit.goal.target`.
- Multiple entries per day are summed.
- **Source:** `dayViewService.ts` -- numeric completion is derived by summing `entry.value` across all non-deleted entries for the day.

### R8: Weekly Habit Completion

- Week window: Monday to Sunday (`weekStartsOn: 1`).
- **"Is this habit weekly?" MUST be computed as:**
  ```
  isWeekly = (timesPerWeek != null && timesPerWeek > 0)
          || (requiredDaysPerWeek != null && requiredDaysPerWeek > 0)
  ```
  See **R8a** below for why both fields must be checked.
- Three sub-types determined by `deriveWeeklyProgress()`:
  - **Quantity weekly** (`habit.goal.type === 'number'`): sum of entry values in week >= weekly target.
  - **Frequency weekly** (`!isQuantity && target > 1`): count of distinct `dayKeys` with entries in week >= target.
  - **Binary weekly** (single entry suffices): any non-deleted entry in week = complete.
- The weekly target value MUST be resolved as `timesPerWeek ?? requiredDaysPerWeek ?? goal.target ?? 1`.
- **Source:** `dayViewService.ts:deriveWeeklyProgress()`

### R8a: Weekly target canonical field

- `Habit` currently has two duplicative fields: `timesPerWeek` and `requiredDaysPerWeek`. Both express "weekly target count" and are written from separate controls in `AddHabitModal`.
- Until a migration collapses them, **every reader must check both** (see R8 formula above).
- Known violators:
  - `src/server/services/dayViewService.ts:366` — checks only `timesPerWeek`. This causes **BUG-4**: a quantity habit with `requiredDaysPerWeek=3, timesPerWeek=undefined` is misclassified as daily, and the Today view shows today-only progress instead of weekly progress.
  - `src/server/services/dayViewService.ts:138` (`deriveWeeklyProgress` target resolution) — same issue.
- Known correct readers:
  - `src/server/routes/progress.ts:158-159`.
- **Long-term fix (root cause):** add a migration following `002_migrate_weekly_frequency.ts` that folds `requiredDaysPerWeek` → `timesPerWeek`, delete the duplicated UI control in `AddHabitModal`, and remove `requiredDaysPerWeek` from the type. Having two fields for the same concept is the defect; the short-term "check both" fix is a patch, not a cure.

### R9: Checklist Bundle Completion

- Completion determined by `checklistSuccessRule` on the parent habit.
- Rule types:
  - `full` (default): ALL scheduled children must be complete.
  - `any`: at least 1 child complete.
  - `threshold`: at least N children complete (`N = rule.threshold`; falls back to `totalCount` if threshold not set).
  - `percent`: `(completedCount / totalCount) * 100 >= rule.percent`.
- Children resolved via `BundleMembership` records (temporal), fallback to `subHabitIds`.
- **Source:** `shared/checklistSuccessRule.ts:evaluateChecklistSuccess()`

### R10: Choice Bundle Completion

- Complete if: ANY child habit has a completion for the day.
- Children resolved via `BundleMembership` (temporal), fallback to `subHabitIds`.
- **Source:** `dayViewService.ts:deriveBundleCompletion()` -- `isComplete = completedCount > 0` for choice bundles.

### R11: Bundle Parents Never Have Direct Entries

- Bundle parent completion is ALWAYS derived from children.
- The parent habit itself should never receive a `HabitEntry`.
- This is a critical invariant -- violating it would cause double-counting.
- **Source:** `dayViewService.ts` comment: "Bundle parents never have entries. Completion is derived from children."

### R12: Freeze Markers Are Entries with Special Notes

- Freeze entries: `HabitEntry` with `value=0` and note starting with `"freeze:"` (e.g., `"freeze:auto"`, `"freeze:manual"`, `"freeze:soft"`).
- Frozen days count as valid for streak calculations (they prevent streak breakage).
- Detection: `parseFreezeType(entry.note)` in progress utilities.
- Freeze inventory: `habit.freezeCount`, max 3.
- Auto-freeze: applied for yesterday only, consumes 1 inventory, only if day-2 had an entry (protecting an active streak).
- **Source:** `src/server/services/freezeService.ts`

---

## 4. Scheduling Rules

### R13: assignedDays Controls Visibility, Not Completion

- `assignedDays` determines which days a habit appears in the Day View and Schedule View.
- A habit can still be completed on non-assigned days (entries are always accepted).
- Completing on a non-assigned day still counts toward streaks and goals.

### R14: Scheduling Logic

- Weekly habit with `assignedDays`: shown only on those days.
- Weekly habit without `assignedDays`: shown every day (user picks which days).
- Daily habit with `assignedDays`: shown only on those days.
- Daily habit without `assignedDays`: shown every day.
- **Source:** `scheduleEngine.ts:isHabitScheduledOnDay()`

### R15: Week Window Is Monday-Sunday

- All weekly calculations use ISO week: Monday (`weekStartsOn: 1`) to Sunday.
- Consistent across: `streakService`, `dayViewService`, `scheduleEngine`, `analyticsService`.
- **Source:** date-fns `startOfWeek` / `endOfWeek` with `{ weekStartsOn: 1 }`

---

## 5. Linking Rules

### R16: Habit<->Goal Is a Dual Link

- Habit stores: `linkedGoalId` (single goal reference).
- Goal stores: `linkedHabitIds[]` (array of habit references).
- BOTH sides must be updated when linking or unlinking.
- Goal also supports `linkedTargets[]` for granular Choice Habit V2 linking.
- Goal progress is computed from entries of linked habits via `truthQuery`.

### R17: Habit<->Routine Is a Dual Link

- Habit stores: `linkedRoutineIds[]`.
- Routine stores: `linkedHabitIds[]`.
- `RoutineVariant` stores: `linkedHabitIds[]` (computed from variant's steps on save).
- `RoutineStep` stores: `linkedHabitId` (single habit per step).
- Routine completion (`RoutineRunner`) offers to create `HabitEntries` for linked habits.

### R18: Bundle Membership Is Temporal

- `BundleMembership` records define time ranges: `activeFromDayKey..activeToDayKey`.
- `activeToDayKey = null` means currently active.
- `daysOfWeek` field allows per-day scheduling within the active range.
- `graduatedAt` marks behavioral graduation (UX hint only).
- Legacy fallback: `habit.subHabitIds[]` and `habit.bundleParentId` (static, pre-migration).

### R19: Categories Must Behave Consistently

- Category creation should be available inline wherever entities reference categories.
- Category selection should offer the same options everywhere.
- Categories are shared across Habits, Goals, and Routines.

---

## 6. Streak Rules

### R20: Daily Streak Calculation

- Count consecutive completed/frozen days walking backward from today.
- If completed today: start from today.
- If not completed today: start from yesterday.
- Frozen days (`isFrozen`) count as valid -- they prevent streak breakage.
- `atRisk = currentStreak > 0 && !completedToday`.
- **Source:** `streakService.ts:calculateDailyMetrics()`

### R21: Weekly Streak Calculation

- Count consecutive "satisfied" weeks walking backward from current week.
- A week is satisfied if weekly progress >= target (`timesPerWeek` or `goal.target`).
- If current week satisfied: include it; if not: start from previous week.
- For quantity habits: sum values; for frequency: count distinct days.
- `atRisk = currentStreak > 0 && !currentWeek.satisfied && daysLeftInWeek <= 2`.
- **Source:** `streakService.ts:calculateWeeklyMetrics()`

### R22: Scheduled-Daily Streak Calculation

- For habits with `assignedDays` + `requiredDaysPerWeek`.
- Uses weekly windows: week satisfied if completions (on ANY day) >= `requiredDaysPerWeek`.
- Note: completions on non-assigned days still count toward the week.
- **Source:** `streakService.ts:calculateScheduledDailyMetrics()`

### R23: Streak Mode Selection

- If `habit.timesPerWeek > 0` -> weekly streak (`calculateWeeklyMetrics`).
- Else if `habit.assignedDays?.length && habit.requiredDaysPerWeek` -> scheduled-daily streak (`calculateScheduledDailyMetrics`).
- Else -> daily streak (`calculateDailyMetrics`).
- **Source:** `streakService.ts:calculateHabitStreakMetrics()`

---

## 7. Goal Progress Rules

### R24: Goal Aggregation Modes

- `sum`: Sum entry values from linked habits (default for cumulative goals).
- `count`: Count entries or distinct days (default for onetime goals).
- Count sub-modes: `distinctDays` (count unique `dayKeys`) or `entries` (count total entries).
- **Source:** `goalProgressUtilsV2.ts`, `goalLinkSemantics.ts` (`getAggregationMode()`, `getCountMode()`)

### R25: Bundle Resolution for Goals

- If a linked habit is a bundle, resolve to its child habits.
- Uses `BundleMembership` records (temporal, past + present).
- Fallback: static `subHabitIds` (pre-migration).
- **Source:** `goalProgressUtilsV2.ts:resolveBundleIds()`

### R26: Deleted Habit Entries Still Count for Goals

- Deleting a HABIT does not set `deletedAt` on its entries.
- Entries from deleted habits still contribute to goal progress (they remain in the `habitEntries` collection without `deletedAt`).
- Only soft-deleted ENTRIES (`entry.deletedAt` set) are excluded.
- **Source:** `goalProgressUtilsV2.ts` comment: "Deleted habits won't be in the map -- still count their raw entry value."

---

## 8. Analytics Rules

### R27: Bundle Parents Excluded from Analytics

- Analytics counts individual child habit completions, not bundle parent state.
- `isTrackableHabit()` returns `false` for bundle parents (`habit.type !== 'bundle'`) and archived habits.
- Progress/dashboard views DO include bundle parents as single units (different purpose: user-facing daily list vs. statistical completion rates).
- **Source:** `scheduleEngine.ts:isTrackableHabit()`

### R28: Opportunity Counting

- Daily habits: 1 opportunity per day in range.
- Daily with `assignedDays`: 1 opportunity per assigned day in range.
- Weekly habits with `assignedDays`: count assigned days in range.
- Weekly without `assignedDays`: count distinct weeks in range.
- **Source:** `scheduleEngine.ts:getExpectedOpportunitiesInRange()`

---

## 9. Data Flow Rules

### R29: Canonical Data Flow

1. User action -> Frontend writes `HabitEntry` via `POST /api/entries`.
2. Backend validates dayKey/timezone.
3. Backend stores entry in `habitEntries` collection.
4. Derived views computed from entries at read time (`GET /api/day-view`, `GET /api/progress`, etc.).
5. No secondary stores are updated (DayLog recompute is triggered separately if needed).

### R30: Entry Validation

- `dayKey` must be valid `YYYY-MM-DD` format.
- `timezone` must be valid IANA timezone.
- Forbidden fields: stored completion status (completion is always derived).
- `source` is validated against allowed values: `manual`, `routine`, `quick`, `import`, `apple_health`, `test`.

---

## 10. How to Use This Document

When adding a new feature:

1. Check which rules apply.
2. Ensure the feature derives data from truth stores (R1, R2).
3. Use DayKey as aggregation boundary (R3).
4. Respect soft-delete semantics (R4).
5. Update both sides of dual links (R16, R17).
6. Follow the correct completion logic for the habit type (R6-R12).
7. Use the correct streak mode (R20-R23).
8. Update this document if new invariant rules are introduced.
