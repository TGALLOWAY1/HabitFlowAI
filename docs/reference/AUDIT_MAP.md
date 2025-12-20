# Milestone A Audit Map

## Header

**Milestone A purpose:**
Find every place history is stored, computed, cached, or merged from non-entry sources

**Current date:** 2025-12-20

**Current git branch:** 176-switch-to-canonical-vocabulary

**How to update this file:**
1. Add findings to the appropriate canonical object section
2. Document all read/write paths, collections, and risks
3. Accumulate raw grep findings in the Shadow Truth Ledger section
4. Keep this file as the single source of architectural truth during audit

---

## Authority Notice

**Canonical Vocabulary Reference:** [/reference/00_NORTHSTAR.md](./00_NORTHSTAR.md)

**Core Invariant:** HabitEntry is the only historical truth; everything else is derived.

All progress, history, and time-based data must ultimately trace back to HabitEntry records. Any stored caches, computed history, or merged data from non-entry sources represents shadow truth that must be identified and audited.

---

## Audit Map Entries

### HabitEntry

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Habit

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### RoutineExecution

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### HabitPotentialEvidence

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Goal

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### GoalLink

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Category

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Persona

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### Identity

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### DerivedMetrics

**Note:** Explicitly call out stored caches here. DerivedMetrics should be computed on-demand from HabitEntry, not stored as historical truth.

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### JournalTemplate

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### JournalEntry

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

### HabitEntryReflection

Current collections:
- ...

Read paths:
- ...

Write paths:
- ...

Known risks:
- ...

Action:
- ...

---

## Shadow Truth Ledger (Raw Findings)

This section accumulates raw grep findings, code snippets, and observations that may indicate shadow truth (history stored, computed, cached, or merged from non-entry sources).

**Reminder:** HabitEntry is the only historical truth; everything else is derived.

### Raw Findings

#### Legacy Store: DayLog Collection

**File:** `src/server/repositories/dayLogRepository.ts`  
**Classification:** legacy store  
**Layer:** backend  
**Details:**
- Collection name: `'dayLogs'` (MongoDB)
- Stores completion history with `completed` boolean field
- Composite key: `${habitId}-${date}`
- Contains `value`, `completed`, `source`, `routineId` fields
- Comment in code: "DEPRECATED SOURCE OF TRUTH: derived cache from HabitEntry"
- Interface defined in `src/models/persistenceTypes.ts` lines 255-325

**File:** `src/models/persistenceTypes.ts` (lines 239-325)  
**Classification:** legacy store  
**Layer:** shared  
**Details:**
- DayLog interface definition
- Comment: "DEPRECATED SOURCE OF TRUTH: derived cache from HabitEntry"
- Storage key: 'logs'
- Storage format: `Record<string, DayLog>` with composite keys

#### Write Paths: DayLog Operations

**File:** `src/server/repositories/dayLogRepository.ts`  
**Classification:** write path  
**Layer:** backend  
**Details:**
- `upsertDayLog(log, userId)` - Creates/updates DayLog in MongoDB
- `deleteDayLog(habitId, date, userId)` - Deletes DayLog
- `deleteDayLogsByHabit(habitId, userId)` - Cascade delete for habit

**File:** `src/server/routes/dayLogs.ts`  
**Classification:** write path  
**Layer:** backend  
**Details:**
- `POST /api/dayLogs` - Upsert route (upsertDayLogRoute)
- `DELETE /api/dayLogs/:habitId/:date` - Delete route

**File:** `src/lib/persistenceClient.ts` (line 339)  
**Classification:** write path  
**Layer:** shared  
**Details:**
- `saveDayLog(log)` - Frontend API wrapper for saving DayLog

**File:** `src/store/HabitContext.tsx` (lines 294, 359)  
**Classification:** write path  
**Layer:** frontend  
**Details:**
- `toggleHabit(habitId, date)` - Toggles habit completion, writes to DayLog
- `updateLog(habitId, date, value)` - Updates DayLog value

**File:** `src/server/routes/habits.ts` (line 299)  
**Classification:** write path  
**Layer:** backend  
**Details:**
- Calls `deleteDayLogsByHabit` when deleting a habit (cascade)

#### Read Paths: DayLog Queries

**File:** `src/server/repositories/dayLogRepository.ts`  
**Classification:** read path  
**Layer:** backend  
**Details:**
- `getDayLogsByUser(userId)` - Returns all DayLogs for user
- `getDayLogsByHabit(habitId, userId)` - Returns DayLogs for specific habit
- `getDayLog(habitId, date, userId)` - Returns single DayLog

**File:** `src/server/routes/dayLogs.ts`  
**Classification:** read path  
**Layer:** backend  
**Details:**
- `GET /api/dayLogs` - Get all logs (optional `?habitId=xxx` filter)
- `GET /api/dayLogs/:habitId/:date` - Get single log

**File:** `src/server/utils/goalProgressUtils.ts` (lines 9, 88, 140, 354, 392)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- `computeGoalProgress()` - Reads DayLogs via `getDayLogsByHabit()` to compute goal progress
- `computeFullGoalProgress()` - Aggregates DayLogs for goal calculations
- Uses DayLogs instead of HabitEntries for progress computation

**File:** `src/server/services/momentumService.ts` (lines 18, 44, 58)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- `calculateGlobalMomentum(logs: DayLog[])` - Computes momentum from DayLog array
- `calculateCategoryMomentum(logs: DayLog[], categoryHabitIds)` - Category-level momentum
- `calculateActiveDays(logs: DayLog[])` - Counts active days from DayLogs

**File:** `src/server/routes/progress.ts` (lines 42-74)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- `getProgressOverview()` - Fetches HabitEntries but converts to DayLog-like structure
- Uses `getHabitEntriesByUser()` but treats as DayLogs for momentum/streak calculations
- Calls `processAutoFreezes()` with DayLog-like structure

**File:** `src/server/routes/goals.ts` (line 833)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- Reads DayLogs via `getDayLogsByHabit()` for goal-related queries

**File:** `src/server/utils/migrationUtils.ts` (lines 1, 22)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- `backfillDayLogsToEntries()` - Migration utility reading DayLogs to create HabitEntries
- Indicates DayLogs existed before HabitEntries

**File:** `src/components/day-view/DayView.tsx` (line 61)  
**Classification:** read path  
**Layer:** frontend  
**Details:**
- Calls `toggleHabit()` which reads/writes DayLogs

**File:** `src/App.tsx` (lines 90, 391-392)  
**Classification:** read path  
**Layer:** frontend  
**Details:**
- Uses `logs` from `useHabitStore()` (DayLog structure)
- Passes `toggleHabit` and `updateLog` to components

**File:** `src/store/HabitContext.tsx`  
**Classification:** read path  
**Layer:** frontend  
**Details:**
- Stores `logs: Record<string, DayLog>` in context state
- Provides DayLog-based operations to components

#### Caches and Computed Values

**File:** `src/models/persistenceTypes.ts` (lines 750-773)  
**Classification:** cache  
**Layer:** shared  
**Details:**
- `GoalProgress` interface stores computed progress values:
  - `currentValue`, `percent`, `lastSevenDays`, `lastThirtyDays`
  - These are computed from DayLogs, not HabitEntries

**File:** `src/server/utils/goalProgressUtils.ts` (lines 194-340)  
**Classification:** cache  
**Layer:** backend  
**Details:**
- `computeFullGoalProgress()` creates GoalProgress objects
- Aggregates DayLogs using `reduce()` operations
- Computes `lastSevenDays` and `lastThirtyDays` arrays from DayLogs
- Stores computed progress snapshots

**File:** `src/server/routes/progress.ts` (lines 89-182)  
**Classification:** cache  
**Layer:** backend  
**Details:**
- Computes streaks from DayLog-like structures
- Calculates momentum from DayLog arrays
- Builds `habitsToday` array with completion status derived from DayLogs

**File:** `src/types/index.ts` (lines 138-174)  
**Classification:** cache  
**Layer:** shared  
**Details:**
- `ProgressOverview` interface contains computed momentum/streak data
- `GoalDetail` interface includes progress calculations

**File:** `src/lib/useProgressOverview.ts`  
**Classification:** cache  
**Layer:** frontend  
**Details:**
- Hook that fetches and caches progress overview data
- Data includes momentum, streaks computed from DayLogs

**File:** `src/lib/useGoalsWithProgress.ts`  
**Classification:** cache  
**Layer:** frontend  
**Details:**
- Hook that fetches goals with computed progress
- Progress computed from DayLogs, not HabitEntries

#### Aggregation Operations

**File:** `src/server/utils/goalProgressUtils.ts` (lines 233, 255, 290, 307)  
**Classification:** aggregation  
**Layer:** backend  
**Details:**
- Multiple `reduce()` operations aggregating DayLog values
- `allLogs.reduce((sum, log) => sum + (log.value ?? 0), 0)` - Sums DayLog values
- `manualLogs.reduce((sum, log) => sum + log.value, 0)` - Sums manual logs
- Groups DayLogs by date for daily aggregation

**File:** `src/components/goals/GoalWeeklySummary.tsx` (line 27)  
**Classification:** aggregation  
**Layer:** frontend  
**Details:**
- `weekEntries.reduce((sum, entry) => sum + entry.value, 0)` - Aggregates entries

**File:** `src/utils/analytics.ts` (line 20)  
**Classification:** aggregation  
**Layer:** frontend  
**Details:**
- `.reduce((sum, log) => sum + (log.value || 0), 0)` - Aggregates log values

**File:** `src/utils/pace.ts` (line 38)  
**Classification:** aggregation  
**Layer:** frontend  
**Details:**
- `habitLogs.reduce((sum, log) => sum + (log.value || 0), 0)` - Aggregates habit logs

#### Completion State Fields

**File:** `src/models/persistenceTypes.ts` (line 284)  
**Classification:** legacy store  
**Layer:** shared  
**Details:**
- DayLog interface has `completed: boolean` field
- Comment says "calculated when the log is created/updated, not stored independently"
- But field IS stored in database

**File:** `src/server/repositories/dayLogRepository.ts` (line 37)  
**Classification:** legacy store  
**Layer:** backend  
**Details:**
- Stores `completed` field in MongoDB document
- Field is persisted, not just computed

**File:** `src/server/routes/progress.ts` (line 99)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- Reads `completed` field from DayLog: `const completed = todayLog?.completed || false`

**File:** `src/components/day-view/HabitGridCell.tsx` (line 94)  
**Classification:** read path  
**Layer:** frontend  
**Details:**
- Reads `isCompleted` from DayLog structure to render checkmark

**File:** `src/components/day-view/DayHabitRow.tsx` (line 78)  
**Classification:** read path  
**Layer:** frontend  
**Details:**
- Renders Check icon based on completion state from DayLog

#### Date/Time Key Operations

**File:** `src/models/persistenceTypes.ts` (line 266)  
**Classification:** legacy store  
**Layer:** shared  
**Details:**
- DayLog uses `date: string` (YYYY-MM-DD format)
- Not using canonical `dayKey` terminology consistently

**File:** `src/server/repositories/dayLogRepository.ts` (line 29)  
**Classification:** write path  
**Layer:** backend  
**Details:**
- Creates composite key from `date` field: `${log.habitId}-${log.date}`
- Uses `date` not `dayKey` in storage

**File:** `src/server/routes/progress.ts` (line 91)  
**Classification:** read path  
**Layer:** backend  
**Details:**
- Uses `format(subDays(new Date(), 1), 'yyyy-MM-dd')` for date calculations
- Not consistently using DayKey utilities

#### Migration and Backfill

**File:** `src/server/utils/migrationUtils.ts`  
**Classification:** legacy store  
**Layer:** backend  
**Details:**
- `backfillDayLogsToEntries()` function exists
- Indicates DayLogs were created before HabitEntries
- Migration path from DayLog → HabitEntry suggests DayLog is legacy

#### Frontend State Management

**File:** `src/store/HabitContext.tsx`  
**Classification:** cache  
**Layer:** frontend  
**Details:**
- Stores `logs: Record<string, DayLog>` in React context
- Provides DayLog-based API to components
- `toggleHabit()` and `updateLog()` operate on DayLog structure

**File:** `src/lib/persistenceClient.ts`  
**Classification:** write path  
**Layer:** shared  
**Details:**
- `saveDayLog()` function persists DayLogs
- Part of persistence layer that writes to DayLog collection

#### Summary Statistics

**Total findings:** 40+ code locations  
**Legacy stores:** 5 files  
**Write paths:** 8 files  
**Read paths:** 15 files  
**Caches/computed:** 8 files  
**Aggregation operations:** 4 files  

**Critical Risk Areas:**
1. DayLog collection (`dayLogs`) is actively used as source of truth for progress, momentum, streaks
2. Goal progress computation reads from DayLogs, not HabitEntries
3. Momentum service operates on DayLog arrays
4. Frontend state management built around DayLog structure
5. Completion state stored in DayLog `completed` field
6. Multiple aggregation operations on DayLog arrays instead of HabitEntries

