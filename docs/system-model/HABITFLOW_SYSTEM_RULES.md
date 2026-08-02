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
- Habit archive is reversible; permanent habit removal sets `deletedAt` while retaining the document and its entries for historical/goal resolution.

### R5: Identity Scoping

- Every API request requires `X-Household-Id` and `X-User-Id` headers (or a valid session in production).
- All data access is scoped by `userId`.
- In development with `DEMO_MODE_ENABLED=true`: headers accepted, or bootstrap defaults (`default-household`, `default-user`) applied.
- In production: missing session = 401 -- headers are never used.

**Source:** `src/server/middleware/identity.ts`

---

## 3. Completion Rules

### R6: Daily Boolean Habit Completion

- Complete if: at least one active, non-freeze `HabitEntry` exists for `(habitId, dayKey)`.
- Value is ignored for boolean habits -- any entry means complete.
- **Source:** `src/domain/habits/completion.ts:deriveDailyHabitCompletion()`.

### R7: Daily Numeric Habit Completion

- Complete if: the non-negative finite value for `(habitId, dayKey)` reaches the positive target effective on that DayKey.
- Below-target values are partial progress, never completion. Zero/empty is no progress; negative/non-finite writes are rejected.
- The uniqueness key permits one canonical document per habit/day. Derivation still sums defensively if legacy input contains more than one record.
- **Source:** `src/domain/habits/completion.ts:deriveDailyHabitCompletion()`.

### R8: Weekly Habit Completion

- Week window: Monday to Sunday (`weekStartsOn: 1`).
- A weekly quota is satisfied when the count of distinct scheduled DayKeys that reached daily completion meets `timesPerWeek` or the flexible `requiredDaysPerWeek` rule.
- Numeric quantity completes its own day only after reaching that day's target; raw quantity never inflates occurrence count.
- Off-schedule entries do not satisfy the quota.
- **Source:** `src/domain/habits/weeklyProgress.ts`, `src/server/services/streakService.ts`.

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
- Automatic freeze generation is disabled until the legacy service uses canonical completion and schedule rules.
- **Source:** `src/server/services/freezeService.ts`

---

## 4. Scheduling Rules

### R13: assignedDays Controls Opportunities

- `assignedDays` determines which days a habit appears in the Day View and Schedule View.
- An off-schedule entry can remain in history and goal aggregation, but it does not advance a strict occurrence streak or satisfy a flexible weekly quota.

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

- Count consecutive protected scheduled opportunities through the reference DayKey.
- Days when the habit is not scheduled neither advance nor break the streak.
- An unfinished opportunity on the current reference day preserves the prior streak and marks it at risk.
- Frozen days protect continuity but are not reported as completed days.
- **Source:** `streakService.ts:calculateOpportunityMetrics()`

### R21: Weekly Streak Calculation

- Count consecutive "satisfied" weeks walking backward from current week.
- A week is satisfied if distinct completed scheduled days meet the configured quota.
- If current week satisfied: include it; if not: start from previous week.
- Numeric quantity only completes its individual day after reaching the daily numeric target; quantity does not inflate the number of completed occurrences.
- `atRisk = currentStreak > 0 && !currentWeek.satisfied && daysLeftInWeek <= 2`.
- **Source:** `streakService.ts:calculateWeeklyMetrics()`

### R22: Scheduled-Daily Streak Calculation

- A strict schedule has `requiredDaysPerWeek === assignedDays.length`; it uses scheduled-opportunity streaks measured in days/occurrences.
- A flexible schedule has `requiredDaysPerWeek < assignedDays.length`; it uses satisfied-week streaks.
- Completions on non-assigned days do not advance either mode.
- **Source:** `schedule.ts:usesWeeklyQuotaStreak()`, `streakService.ts`

### R23: Streak Mode Selection

- If `habit.timesPerWeek > 0` -> weekly streak.
- Else if `requiredDaysPerWeek < assignedDays.length` -> flexible weekly streak.
- Else -> scheduled-opportunity streak.
- **Source:** `streakService.ts:calculateHabitStreakMetrics()`

### R23A: Tracking Rule History

- Target and schedule edits are effective from a canonical local DayKey.
- The habit document keeps only tracking-relevant revisions: goal, assigned weekdays, and weekly quota fields.
- Completion and scheduling resolve the revision effective on the historical DayKey; HabitEntries are not rewritten.
- Repeated edits on one DayKey replace that revision.
- A change between occurrence and weekly streak units starts a new comparable streak segment.
- **Source:** `trackingHistory.ts`, `completion.ts`, `schedule.ts`, `streakService.ts`

### R23B: Archive/Restore Opportunities

- User archive preserves the archive day and starts an inactive interval the following local day.
- Restore ends the inactive interval the previous local day, so the restore day is active.
- Inactive daily opportunities do not advance or break a streak.
- Weekly periods touched by an inactive interval are excused as a whole period.
- **Source:** `habitRepository.ts`, `schedule.ts`, `streakService.ts`

### R23C: Backdated and Imported History

- `createdAt` prevents unevidenced missed opportunities before a habit existed.
- If a real entry predates `createdAt`, the earliest such DayKey starts evidenced streak/statistics history.
- The entry must still match the historical weekday rule; no opportunities are invented before it.
- **Source:** `schedule.ts:matchesHabitScheduleOnDay()`, `streakService.ts`, `analyticsService.ts`.

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
- Before `createdAt`, count no opportunity unless a real entry exists on that matching schedule day; that evidenced day is included.
- **Source:** `scheduleEngine.ts:getExpectedOpportunitiesInRange()`, `analyticsService.ts:isHabitAnalyticsOpportunityOnDay()`

---

## 9. Data Flow Rules

### R29: Canonical Data Flow

1. User action -> Frontend upserts or clears a `HabitEntry` via the canonical entry API.
2. Backend validates dayKey/timezone.
3. Backend stores entry in `habitEntries` collection.
4. Derived views computed from entries at read time (`GET /api/day-view`, `GET /api/progress`, etc.).
5. No secondary stores are updated (DayLog recompute is triggered separately if needed).

### R30: Entry Validation

- `dayKey` must be valid `YYYY-MM-DD` format.
- `timezone` must be valid IANA timezone.
- Forbidden fields: stored completion status (completion is always derived).
- `source` is validated against allowed values: `manual`, `routine`, `quick`, `import`, `apple_health`, `test`.
- Numeric values must be finite and non-negative; numeric habits require a value.

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
