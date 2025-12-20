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
- `habitEntries` (MongoDB collection: `'habitEntries'`) - **Source of Truth**
  - Location: `src/server/repositories/habitEntryRepository.ts` (line 13)
  - Storage format: Array of HabitEntry documents
  - Schema: `src/models/persistenceTypes.ts` (lines 896-980)
  - Indexed by: `habitId`, `date`, `userId`, `deletedAt` (soft delete)
- `dayLogs` (MongoDB collection: `'dayLogs'`) - **Derived Cache** ⚠️
  - Location: `src/server/repositories/dayLogRepository.ts` (line 11)
  - Storage format: Record<string, DayLog> with composite keys `${habitId}-${date}`
  - Schema: `src/models/persistenceTypes.ts` (lines 255-325)
  - **Status:** Marked as "DEPRECATED SOURCE OF TRUTH" in code comments
  - **Derivation:** Computed from HabitEntries via `recomputeDayLogForHabit()` in `src/server/utils/recomputeUtils.ts`

Read paths:
- **Backend Repository:**
  - `getHabitEntries(habitId)` - `src/server/repositories/habitEntryRepository.ts:70` - ⚠️ No userId scoping
  - `getHabitEntriesByHabit(habitId, userId)` - `src/server/repositories/habitEntryRepository.ts:97`
  - `getHabitEntriesForDay(habitId, date, userId)` - `src/server/repositories/habitEntryRepository.ts:125`
  - `getHabitEntriesByUser(userId)` - `src/server/repositories/habitEntryRepository.ts:328` - Used for progress aggregation
- **Backend API Routes:**
  - `GET /api/entries?habitId=...&date=...` - `src/server/routes/habitEntries.ts:24` - `getHabitEntriesRoute()`
  - Returns entries filtered by habitId (and optionally date)
- **Frontend Persistence Client:**
  - `fetchHabitEntries(habitId, date?)` - `src/lib/persistenceClient.ts:757` - Calls `/api/entries`
- **Frontend Components:**
  - `GoalDetailPage.tsx:48` - Fetches linked habit entries for goal progress
  - `HabitHistoryModal.tsx:28` - Fetches entries for history view
- **Entry→DayLog Adapters (Derivation Logic):**
  - `recomputeDayLogForHabit(habitId, date, userId)` - `src/server/utils/recomputeUtils.ts:20`
    - Reads: `getHabitEntriesForDay()` to fetch entries
    - Aggregates entries into DayLog structure
    - Writes: `upsertDayLog()` or `deleteDayLog()` based on entry count
    - Called automatically after every entry mutation (create/update/delete)
- **Progress/Momentum Services (Reading Entries):**
  - `getProgressOverview()` - `src/server/routes/progress.ts:28`
    - Reads: `getHabitEntriesByUser()` (line 43)
    - ⚠️ **Issue:** Converts entries to DayLog-like structure (lines 46-50) for momentum/streak calculations
    - ⚠️ **Issue:** Momentum service expects DayLog[] but receives HabitEntry[] (line 74)

Write paths:
- **HabitEntry Creation:**
  - `createHabitEntry(entry, userId)` - `src/server/repositories/habitEntryRepository.ts:22`
  - `POST /api/entries` - `src/server/routes/habitEntries.ts:52` - `createHabitEntryRoute()`
    - Validates entry payload
    - Creates entry
    - **Auto-triggers:** `recomputeDayLogForHabit()` (line 94)
  - Frontend: `createHabitEntry()` - `src/lib/persistenceClient.ts:772`
  - Frontend: `HabitContext.tsx:339` - `toggleHabit()` creates entry via `createHabitEntry()`
  - Frontend: `HabitContext.tsx:382` - `updateLog()` creates entry via `createHabitEntry()`
- **HabitEntry Update:**
  - `updateHabitEntry(id, userId, patch)` - `src/server/repositories/habitEntryRepository.ts:156`
  - `PATCH /api/entries/:id` - `src/server/routes/habitEntries.ts:190` - `updateHabitEntryRoute()`
    - ⚠️ **Issue:** Only recomputes new date if date changed (line 226), should recompute both old and new dates
    - **Auto-triggers:** `recomputeDayLogForHabit()` (line 226)
  - Frontend: `updateHabitEntry(id, patch)` - `src/lib/persistenceClient.ts:787`
  - Frontend: `HabitContext.tsx:400` - `updateHabitEntryContext()`
- **HabitEntry Upsert:**
  - `upsertHabitEntry(habitId, date, userId, updates)` - `src/server/repositories/habitEntryRepository.ts:247`
  - `PUT /api/entries` - `src/server/routes/habitEntries.ts:283` - `upsertHabitEntryRoute()`
    - **Auto-triggers:** `recomputeDayLogForHabit()` (line 312)
  - Frontend: `upsertHabitEntry(habitId, dateKey, data)` - `src/lib/persistenceClient.ts:802`
  - Frontend: `HabitContext.tsx:573` - `upsertHabitEntryContext()`
  - Frontend: `TrackerGrid.tsx:735` - Multiple calls to `upsertHabitEntry()`
  - Frontend: `DayView.tsx:18` - Uses `upsertHabitEntry()`
- **HabitEntry Deletion:**
  - `deleteHabitEntry(id, userId)` - `src/server/repositories/habitEntryRepository.ts:189` - Soft delete
  - `deleteHabitEntryByKey(habitId, date, userId)` - `src/server/repositories/habitEntryRepository.ts:300` - Soft delete by key
  - `deleteHabitEntriesForDay(habitId, date, userId)` - `src/server/repositories/habitEntryRepository.ts:218` - Bulk soft delete
  - `DELETE /api/entries/:id` - `src/server/routes/habitEntries.ts:115` - `deleteHabitEntryRoute()`
    - **Auto-triggers:** `recomputeDayLogForHabit()` (line 173)
  - `DELETE /api/entries/key?habitId=...&dateKey=...` - `src/server/routes/habitEntries.ts:329` - `deleteHabitEntryByKeyRoute()`
    - **Auto-triggers:** `recomputeDayLogForHabit()` (line 345)
  - `DELETE /api/entries?habitId=...&date=...` - `src/server/routes/habitEntries.ts:247` - `deleteHabitEntriesForDayRoute()`
    - **Auto-triggers:** `recomputeDayLogForHabit()` (line 265)
  - Frontend: `deleteHabitEntry(id)` - `src/lib/persistenceClient.ts:840`
  - Frontend: `deleteHabitEntryByKey(habitId, dateKey)` - `src/lib/persistenceClient.ts:818`
  - Frontend: `HabitContext.tsx:410` - `deleteHabitEntryContext()`
  - Frontend: `HabitContext.tsx:593` - `deleteHabitEntryByKeyContext()`
- **DayLog Writes (Derived Cache):**
  - `recomputeDayLogForHabit()` - `src/server/utils/recomputeUtils.ts:20`
    - Called automatically after every entry mutation
    - Aggregates entries: sums values, computes `completed` boolean
    - Writes: `upsertDayLog()` or `deleteDayLog()` based on entry count
  - ⚠️ **Legacy Direct DayLog Writes (Should be banned):**
    - `upsertDayLog()` - `src/server/repositories/dayLogRepository.ts:20` - Still accessible via API
    - `POST /api/dayLogs` - `src/server/routes/dayLogs.ts` - Direct write bypassing entries
    - `saveDayLog()` - `src/lib/persistenceClient.ts:339` - Frontend wrapper
    - `toggleHabit()` - `src/store/HabitContext.tsx:294` - Legacy path may write DayLogs directly
    - `updateLog()` - `src/store/HabitContext.tsx:359` - Legacy path may write DayLogs directly

Known risks:
- **Progress Overview Route Drift:**
  - `getProgressOverview()` reads HabitEntries but converts to DayLog structure (lines 46-50)
  - Momentum/streak services expect DayLog[] but receive HabitEntry[] (type casting on line 74)
  - **Risk:** Type mismatch could cause runtime errors or incorrect calculations
- **Goal Progress Reading DayLogs:**
  - `computeGoalProgress()` - `src/server/utils/goalProgressUtils.ts:72` reads from DayLogs via `getDayLogsByHabit()`
  - `computeFullGoalProgress()` - `src/server/utils/goalProgressUtils.ts:194` aggregates DayLogs
  - **Risk:** Goal progress computed from derived cache instead of source of truth
  - **Risk:** If DayLogs are out of sync, goal progress will be incorrect
- **Momentum Service Type Mismatch:**
  - `calculateGlobalMomentum()` - `src/server/services/momentumService.ts:44` expects `DayLog[]`
  - `calculateCategoryMomentum()` - `src/server/services/momentumService.ts:58` expects `DayLog[]`
  - Receives `HabitEntry[]` from progress route (type cast to `any[]`)
  - **Risk:** Accesses `log.completed` and `log.date` which exist on both, but structure differs
- **Frontend State Management:**
  - `HabitContext.tsx` stores `logs: Record<string, DayLog>` (DayLog structure)
  - Entry operations return `{ entry, dayLog }` but frontend primarily uses `dayLog`
  - **Risk:** Frontend depends on DayLog structure, not HabitEntry structure
- **Direct DayLog Writes Bypassing Entries:**
  - `POST /api/dayLogs` route still exists and allows direct writes
  - `toggleHabit()` and `updateLog()` in HabitContext may have legacy paths
  - **Risk:** DayLogs can be written without corresponding HabitEntries
  - **Risk:** DayLogs and HabitEntries can become out of sync
- **Date Change Edge Case:**
  - `updateHabitEntryRoute()` only recomputes new date if date changed (line 226)
  - Comment indicates old date should also be recomputed (lines 205-224)
  - **Risk:** Moving entry between days leaves old DayLog stale
- **Multiple Entry Schemas:**
  - ✅ **Single schema confirmed:** Only `habitEntries` collection exists
  - ✅ **No duplicate collections found**

Action:
- **Milestone A Plan:**
  1. **Create `truthQuery` utility:**
     - Function that reads from HabitEntries and returns canonical structure
     - Replace all DayLog reads with HabitEntry reads + derivation
     - Location: `src/server/utils/truthQuery.ts` (new file)
  2. **Implement legacy merge adapter:**
     - Function that converts HabitEntry[] to DayLog[] structure for compatibility
     - Used during transition period for services expecting DayLog format
     - Location: `src/server/utils/legacyAdapter.ts` (new file)
  3. **Ban direct DayLog reads:**
     - Update `goalProgressUtils.ts` to read from HabitEntries via `truthQuery`
     - Update `momentumService.ts` to accept HabitEntry[] or use adapter
     - Add lint rule or code review checklist to prevent new DayLog reads
  4. **Migrate read paths:**
     - `computeGoalProgress()` → Read from HabitEntries
     - `computeFullGoalProgress()` → Read from HabitEntries
     - `getProgressOverview()` → Use truthQuery + adapter pattern
  5. **Enforce write discipline:**
     - Deprecate `POST /api/dayLogs` route (return 410 Gone)
     - Ensure all entry mutations trigger recompute (already done)
     - Add validation to prevent DayLog writes without corresponding entries
  6. **Fix date change edge case:**
     - Update `updateHabitEntryRoute()` to recompute both old and new dates when date changes

---

### Habit

Current collections:
- `habits` (MongoDB collection: `'habits'`)
  - Location: `src/server/repositories/habitRepository.ts` (line 11)
  - Storage format: Array of Habit documents
  - Schema: `src/models/persistenceTypes.ts` (lines 82-237)
  - No derived caches - Habit is configuration only

Read paths:
- **Backend Repository:**
  - `getHabitsByUser(userId)` - `src/server/repositories/habitRepository.ts:72`
  - `getHabitsByCategory(categoryId, userId)` - `src/server/repositories/habitRepository.ts:94`
  - `getHabitById(id, userId)` - `src/server/repositories/habitRepository.ts:127`
- **Backend API Routes:**
  - `GET /api/habits` - `src/server/routes/habits.ts:155` - `getHabit()`
  - `GET /api/habits` (all) - `src/server/routes/habits.ts` - Returns all habits for user
- **Frontend:**
  - `HabitContext.tsx` - Stores habits in React context
  - `useHabitStore()` - Hook to access habits
  - Various UI components read habits for display

Write paths:
- **Backend Repository:**
  - `createHabit(data, userId)` - `src/server/repositories/habitRepository.ts:20`
  - `updateHabit(id, userId, patch)` - `src/server/repositories/habitRepository.ts:155`
  - `deleteHabit(id, userId)` - `src/server/repositories/habitRepository.ts:280`
  - `deleteHabitsByCategory(categoryId, userId)` - `src/server/repositories/habitRepository.ts:250`
- **Backend API Routes:**
  - `POST /api/habits` - `src/server/routes/habits.ts:199` - `createHabitRoute()`
  - `PATCH /api/habits/:id` - `src/server/routes/habits.ts:206` - `updateHabitRoute()`
  - `DELETE /api/habits/:id` - `src/server/routes/habits.ts:280` - `deleteHabitRoute()`
    - **Cascade:** Calls `deleteDayLogsByHabit()` (line 299) - ⚠️ Should delete HabitEntries instead
- **Frontend:**
  - `HabitContext.tsx` - Provides create/update/delete operations

Known risks:
- **Habit Deletion Cascade:**
  - `deleteHabitRoute()` deletes DayLogs via `deleteDayLogsByHabit()` (line 299)
  - ⚠️ **Risk:** Should delete HabitEntries instead of DayLogs
  - ⚠️ **Risk:** DayLogs are derived cache, not source of truth
- **No Progress Storage:**
  - ✅ Habit does not store completion/streak/progress (correct)
  - ✅ All progress derived from HabitEntries (correct)

Action:
- **Milestone A Plan:**
  1. Update `deleteHabitRoute()` to delete HabitEntries instead of DayLogs
  2. Ensure habit deletion cascades to entries (soft delete)
  3. DayLogs will be automatically cleaned up via recompute when entries are deleted

---

### RoutineExecution

Current collections:
- `routineLogs` (MongoDB collection: `'routineLogs'`)
  - Location: `src/server/repositories/routineLogRepository.ts` (line 11)
  - Storage format: Record<string, RoutineLog> with composite keys `${routineId}-${date}`
  - Schema: `src/models/persistenceTypes.ts` (lines 620-660)
  - **Note:** RoutineLog represents RoutineExecution (execution intent, not completion)

Read paths:
- **Backend Repository:**
  - `getRoutineLogsByUser(userId)` - `src/server/repositories/routineLogRepository.ts:73`
  - Returns Record<string, RoutineLog> keyed by composite key
- **Backend API Routes:**
  - `GET /api/routineLogs` - `src/server/routes/routineLogs.ts` - Returns all routine logs for user
- **Frontend:**
  - `RoutineContext.tsx:50` - Stores `routineLogs: Record<string, RoutineLog>`
  - `fetchRoutineLogs()` - `src/lib/persistenceClient.ts` - Fetches routine logs

Write paths:
- **Backend Repository:**
  - `saveRoutineLog(log, userId)` - `src/server/repositories/routineLogRepository.ts:20`
    - Upserts routine log (creates or updates)
- **Backend API Routes:**
  - `POST /api/routineLogs` - `src/server/routes/routineLogs.ts` - Creates/updates routine log
- **Frontend:**
  - `RoutineContext.tsx` - Manages routine execution state
  - Routine execution creates RoutineLog when started

Known risks:
- **RoutineLog vs HabitEntry Boundary:**
  - ✅ RoutineLog does not store completion (correct - it's execution intent)
  - ✅ RoutineLog does not contribute to progress (correct)
  - ✅ Only HabitEntries count toward streaks/goals (correct)
- **No Shadow Truth:**
  - ✅ RoutineLog is not used as source of truth for habit completion
  - ✅ No derived caches from RoutineLog

Action:
- **Milestone A Plan:**
  1. No changes required - RoutineLog is correctly separated from HabitEntry
  2. Ensure RoutineLog → HabitPotentialEvidence → HabitEntry flow remains one-way
  3. Verify no code reads RoutineLog to compute habit completion

---

### HabitPotentialEvidence

Current collections:
- `habitPotentialEvidence` (MongoDB collection: `'habitPotentialEvidence'`)
  - Location: `src/server/repositories/habitPotentialEvidenceRepository.ts` (line 17)
  - Storage format: Array of HabitPotentialEvidence documents
  - Schema: `src/models/persistenceTypes.ts` (lines 1006-1050)
  - **Note:** Evidence is a signal, not truth - requires user confirmation to become HabitEntry

Read paths:
- **Backend Repository:**
  - `getPotentialEvidence(date, userId, habitId?)` - `src/server/repositories/habitPotentialEvidenceRepository.ts:66`
  - `evidenceExistsForStep(routineId, stepId, date, userId)` - `src/server/repositories/habitPotentialEvidenceRepository.ts:104`
- **Backend API Routes:**
  - `GET /api/habitPotentialEvidence` - `src/server/routes/habitPotentialEvidence.ts` - Returns evidence for date/habit
- **Frontend:**
  - `HabitContext.tsx` - Stores `potentialEvidence` in state
  - `TrackerGrid.tsx` - Displays potential evidence for user confirmation

Write paths:
- **Backend Repository:**
  - `createPotentialEvidence(evidence, userId)` - `src/server/repositories/habitPotentialEvidenceRepository.ts:26`
- **Backend API Routes:**
  - `POST /api/habitPotentialEvidence` - `src/server/routes/habitPotentialEvidence.ts` - Creates evidence
- **Frontend:**
  - Evidence created when routine steps complete
  - User confirms evidence → creates HabitEntry

Known risks:
- **Evidence → Entry Boundary:**
  - ✅ Evidence does not count as completion (correct)
  - ✅ Evidence must be confirmed to become HabitEntry (correct)
  - ✅ No code treats evidence as truth for progress (correct)
- **No Shadow Truth:**
  - ✅ Evidence is not used to compute completion/progress
  - ✅ Evidence is UI hint only, not historical truth

Action:
- **Milestone A Plan:**
  1. No changes required - Evidence correctly separated from HabitEntry
  2. Verify evidence confirmation always creates HabitEntry (not DayLog directly)
  3. Ensure no code aggregates evidence for progress calculations

---

### Goal

Current collections:
- `goals` (MongoDB collection: `'goals'`)
  - Location: `src/server/repositories/goalRepository.ts` (line 13)
  - Storage format: Array of Goal documents
  - Schema: `src/models/persistenceTypes.ts` (lines 670-740)
  - **No progress storage** - GoalProgress is computed, not stored

Read paths:
- **Backend Repository:**
  - `getGoalsByUser(userId)` - `src/server/repositories/goalRepository.ts:55`
  - `getCompletedGoalsByUser(userId)` - `src/server/repositories/goalRepository.ts:77`
  - `getGoalById(id, userId)` - `src/server/repositories/goalRepository.ts:100`
- **Backend API Routes:**
  - `GET /api/goals` - `src/server/routes/goals.ts` - Returns all goals
  - `GET /api/goals/:id` - `src/server/routes/goals.ts:785` - `getGoalDetailRoute()`
  - `GET /api/goals/:id/progress` - `src/server/routes/goals.ts:272` - `getGoalProgress()`
  - `GET /api/goals/with-progress` - `src/server/routes/goals.ts:244` - `getGoalsWithProgress()`
- **Goal Progress Computation (⚠️ CRITICAL SHADOW TRUTH):**
  - `computeGoalProgress(goalId, userId)` - `src/server/utils/goalProgressUtils.ts:72`
    - ⚠️ **Reads DayLogs:** `getDayLogsByHabit()` (line 88) - Should read HabitEntries
  - `computeFullGoalProgress(goal, allLogs, manualLogs, habitMap)` - `src/server/utils/goalProgressUtils.ts:194`
    - ⚠️ **Accepts DayLog[]:** Aggregates DayLogs instead of HabitEntries
  - `computeGoalsWithProgress(userId)` - `src/server/utils/goalProgressUtils.ts:350`
    - ⚠️ **Reads DayLogs:** `getDayLogsByHabit()` (line 392) - Batch reads DayLogs for all goals
- **Frontend:**
  - `GoalDetailPage.tsx` - Displays goal with progress
  - `useGoalsWithProgress()` - `src/lib/useGoalsWithProgress.ts` - Hook that fetches goals with computed progress
  - `GoalDetailPage.tsx:48` - Fetches linked HabitEntries (correct approach)

Write paths:
- **Backend Repository:**
  - `createGoal(data, userId)` - `src/server/repositories/goalRepository.ts:22`
  - `updateGoal(id, userId, patch)` - `src/server/repositories/goalRepository.ts:155`
  - `deleteGoal(id, userId)` - `src/server/repositories/goalRepository.ts:200`
- **Backend API Routes:**
  - `POST /api/goals` - `src/server/routes/goals.ts:322` - `createGoalRoute()`
  - `PATCH /api/goals/:id` - `src/server/routes/goals.ts` - Updates goal
  - `DELETE /api/goals/:id` - `src/server/routes/goals.ts` - Deletes goal
- **Frontend:**
  - Goal creation/editing UI components

Known risks:
- **⚠️ CRITICAL: Goal Progress Reads DayLogs:**
  - `computeGoalProgress()` reads from DayLogs via `getDayLogsByHabit()` (line 88)
  - `computeFullGoalProgress()` aggregates DayLog[] instead of HabitEntry[]
  - `computeGoalsWithProgress()` batch reads DayLogs (line 392)
  - **Risk:** Goal progress computed from derived cache, not source of truth
  - **Risk:** If DayLogs are out of sync, goal progress will be incorrect
  - **Risk:** Goal progress may show stale data if DayLog recomputation fails
- **GoalManualLog:**
  - Manual logs stored separately (`goalManualLogs` collection)
  - ✅ Correctly merged with habit progress in `computeFullGoalProgress()`
  - ✅ Manual logs are additive, not replacement for habit entries
- **No Progress Storage:**
  - ✅ Goal does not store `currentValue` or `percent` (correct - computed only)
  - ✅ GoalProgress interface is computed, not persisted

Action:
- **Milestone A Plan (HIGH PRIORITY):**
  1. **Update `computeGoalProgress()`:**
     - Replace `getDayLogsByHabit()` with `getHabitEntriesByHabit()` via truthQuery
     - Aggregate HabitEntries instead of DayLogs
  2. **Update `computeFullGoalProgress()`:**
     - Change signature from `allLogs: DayLog[]` to `allEntries: HabitEntry[]`
     - Aggregate entries by date to compute daily completion
     - Compute `completed` boolean from entries (not from DayLog.completed)
  3. **Update `computeGoalsWithProgress()`:**
     - Replace batch `getDayLogsByHabit()` with batch `getHabitEntriesByHabit()`
     - Use truthQuery utility for efficient entry fetching
  4. **Update callers:**
     - `getGoalProgress()` route - Update to use entry-based computation
     - `getGoalsWithProgress()` route - Update to use entry-based computation
     - `GoalDetailPage.tsx` - Already fetches HabitEntries (good), ensure it uses them
  5. **Test:**
     - Verify goal progress matches when computed from entries vs DayLogs
     - Ensure manual logs still merge correctly

---

### GoalLink

Current collections:
- **Embedded in Goal** (not a separate collection)
  - `Goal.linkedHabitIds: string[]` - Array of habit IDs
  - `Goal.linkedTargets?: Array<...>` - Granular linking for Choice Habits V2
  - Location: `src/models/persistenceTypes.ts` (lines 710-724)
  - **Note:** GoalLink is configuration, not data - stored as part of Goal entity

Read paths:
- **Via Goal:**
  - `getGoalById(id, userId)` - `src/server/repositories/goalRepository.ts:100`
  - `getGoalsByUser(userId)` - `src/server/repositories/goalRepository.ts:55`
  - Goal progress computation reads `goal.linkedHabitIds` to find contributing habits
- **Goal Progress Computation:**
  - `resolveBundleIds(habitIds, userId)` - `src/server/utils/goalProgressUtils.ts:39`
    - Resolves bundle habits to sub-habits for goal linking
  - `computeGoalProgress()` - Uses `goal.linkedHabitIds` to fetch habit data
- **Frontend:**
  - `GoalDetailPage.tsx` - Displays linked habits
  - `EditGoalModal.tsx` - UI for editing habit links

Write paths:
- **Via Goal Updates:**
  - `updateGoal(id, userId, patch)` - `src/server/repositories/goalRepository.ts:155`
    - Can update `linkedHabitIds` or `linkedTargets`
  - `PATCH /api/goals/:id` - Updates goal including links
- **Frontend:**
  - Goal editing UI updates linked habits

Known risks:
- **Goal Progress Reads DayLogs:**
  - Goal progress computation uses `goal.linkedHabitIds` to find habits
  - Then reads DayLogs for those habits (via `getDayLogsByHabit()`)
  - ⚠️ **Risk:** Should read HabitEntries instead of DayLogs
  - ⚠️ **Risk:** GoalLink configuration is correct, but progress computation uses wrong source
- **No Progress Storage:**
  - ✅ GoalLink does not store progress (correct - it's configuration)
  - ✅ Progress computed from linked habits' entries (correct concept, wrong implementation)

Action:
- **Milestone A Plan:**
  1. GoalLink configuration is correct - no changes needed
  2. Goal progress computation must read HabitEntries instead of DayLogs
  3. Update `computeGoalProgress()` to use HabitEntries via truthQuery
  4. Ensure bundle resolution still works with entry-based computation

---

### Category

Current collections:
- `categories` (MongoDB collection: `'categories'`)
  - Location: `src/server/repositories/categoryRepository.ts` (line 13)
  - Storage format: Array of Category documents
  - Schema: `src/models/persistenceTypes.ts` (lines 430-450)
  - **No progress storage** - Category is organizational only

Read paths:
- **Backend Repository:**
  - `getCategoriesByUser(userId)` - `src/server/repositories/categoryRepository.ts:65`
  - `getCategoryById(id, userId)` - `src/server/repositories/categoryRepository.ts:96`
- **Backend API Routes:**
  - `GET /api/categories` - `src/server/routes/categories.ts` - Returns all categories
- **Frontend:**
  - `HabitContext.tsx` - Stores categories in React context
  - Various UI components use categories for organization

Write paths:
- **Backend Repository:**
  - `createCategory(data, userId)` - `src/server/repositories/categoryRepository.ts:22`
  - `updateCategory(id, userId, patch)` - `src/server/repositories/categoryRepository.ts:120`
  - `deleteCategory(id, userId)` - `src/server/repositories/categoryRepository.ts:160`
  - `deleteCategoriesByUser(userId)` - `src/server/repositories/categoryRepository.ts:190`
- **Backend API Routes:**
  - `POST /api/categories` - Creates category
  - `PATCH /api/categories/:id` - Updates category
  - `DELETE /api/categories/:id` - Deletes category
- **Frontend:**
  - Category management UI

Known risks:
- **Category Momentum:**
  - `calculateCategoryMomentum()` - `src/server/services/momentumService.ts:58`
    - ⚠️ **Reads DayLogs:** Expects `DayLog[]` but receives `HabitEntry[]` (type cast)
    - Filters by `categoryHabitIds` to compute category-level momentum
    - ⚠️ **Risk:** Type mismatch - accesses `log.completed` and `log.date` which exist on both
  - `getProgressOverview()` - `src/server/routes/progress.ts:84`
    - Computes category momentum using DayLog-like structure
- **No Progress Storage:**
  - ✅ Category does not store completion/streak/progress (correct)
  - ✅ Category momentum is computed, not stored (correct)

Action:
- **Milestone A Plan:**
  1. Update `calculateCategoryMomentum()` to accept HabitEntry[] or use adapter
  2. Ensure category momentum computation uses HabitEntries via truthQuery
  3. Update `getProgressOverview()` to use entry-based category momentum

---

### Persona

Current collections:
- **Not found in repositories** - Persona may be:
  - Stored in memory only (frontend state)
  - Not yet implemented in backend
  - Stored as part of another entity (e.g., user preferences)
- Schema reference: `docs/reference/09_PERSONA.md`
- **Note:** Persona is a lens/filter, not a data container

Read paths:
- **Frontend (if implemented):**
  - Persona selection UI (if exists)
  - May filter/emphasize habits/goals by persona
- **Backend:**
  - No repository found - persona may not be persisted

Write paths:
- **Frontend (if implemented):**
  - Persona selection/editing UI
- **Backend:**
  - No routes found - persona may not be persisted

Known risks:
- **No Shadow Truth:**
  - ✅ Persona does not own data (correct per canonical definition)
  - ✅ Persona is a filter/lens only (correct)
  - ✅ No progress stored in persona (correct)
- **Implementation Status:**
  - ⚠️ **Unknown:** Persona may not be fully implemented
  - ⚠️ **Risk:** If persona exists, ensure it never stores progress/completion

Action:
- **Milestone A Plan:**
  1. Verify persona implementation status
  2. If persona exists, ensure it's purely a filter (no data ownership)
  3. No changes required if persona is correctly implemented as lens only

---

### Identity

Current collections:
- **Schema defined but repository not found**
  - Schema: `src/models/persistenceTypes.ts` (lines 495-513)
  - Storage key: `'identities'` (per PersistenceSchema)
  - **Note:** Identity may not be fully implemented in backend
  - Schema reference: `docs/reference/07_IDENTITY.md`

Read paths:
- **Backend:**
  - No repository found - identity may not be persisted
  - May be stored in memory or as part of user preferences
- **Frontend:**
  - Identity selection/editing UI (if exists)

Write paths:
- **Backend:**
  - No routes found - identity may not be persisted
- **Frontend:**
  - Identity creation/editing UI (if exists)

Known risks:
- **No Shadow Truth:**
  - ✅ Identity does not own tracking (correct per canonical definition)
  - ✅ Identity is narrative only, not relational (correct)
  - ✅ No progress stored in identity (correct)
- **Implementation Status:**
  - ⚠️ **Unknown:** Identity may not be fully implemented
  - ⚠️ **Risk:** If identity exists, ensure it never aggregates progress

Action:
- **Milestone A Plan:**
  1. Verify identity implementation status
  2. If identity exists, ensure it's purely narrative (no data ownership)
  3. No changes required if identity is correctly implemented as non-referential

---

### DerivedMetrics

**Note:** Explicitly call out stored caches here. DerivedMetrics should be computed on-demand from HabitEntry, not stored as historical truth.

Current collections:
- **⚠️ CRITICAL: Stored Derived Caches:**
  1. **`dayLogs` collection** - `src/server/repositories/dayLogRepository.ts`
     - Stores: `completed`, `value`, `source`, `routineId`
     - **Status:** Derived cache from HabitEntries
     - **Risk:** Treated as truth in many read paths
  2. **`GoalProgress` interface** - Computed but may be cached
     - Location: `src/models/persistenceTypes.ts` (lines 750-773)
     - Stores: `currentValue`, `percent`, `lastSevenDays`, `lastThirtyDays`
     - **Status:** Computed on-demand, not persisted (correct)
     - **Risk:** Computed from DayLogs instead of HabitEntries
  3. **Frontend state caches:**
     - `HabitContext.tsx` - Stores `logs: Record<string, DayLog>`
     - `ProgressOverview` - Caches momentum/streak data
     - **Status:** Runtime cache, not persisted (acceptable if invalidated correctly)

Read paths:
- **Momentum Computation:**
  - `calculateGlobalMomentum(logs: DayLog[])` - `src/server/services/momentumService.ts:44`
    - ⚠️ **Reads DayLog[]:** Should read HabitEntry[] instead
    - Computes active days from `log.completed` and `log.date`
  - `calculateCategoryMomentum(logs: DayLog[], categoryHabitIds)` - `src/server/services/momentumService.ts:58`
    - ⚠️ **Reads DayLog[]:** Should read HabitEntry[] instead
- **Streak Computation:**
  - `calculateDailyStreak(logs, habitId)` - `src/server/services/streakService.ts`
    - ⚠️ **Reads DayLog-like structure:** Expects `completed` and `date` fields
  - `calculateWeeklyStreak(logs, habitId)` - `src/server/services/streakService.ts`
    - ⚠️ **Reads DayLog-like structure:** Expects `completed` and `date` fields
- **Progress Overview:**
  - `getProgressOverview()` - `src/server/routes/progress.ts:28`
    - Reads HabitEntries (line 43) but converts to DayLog structure (lines 46-50)
    - Passes to momentum/streak services with type casting (line 74)
- **Goal Progress:**
  - `computeGoalProgress()` - `src/server/utils/goalProgressUtils.ts:72`
    - ⚠️ **Reads DayLogs:** `getDayLogsByHabit()` (line 88)
  - `computeFullGoalProgress()` - `src/server/utils/goalProgressUtils.ts:194`
    - ⚠️ **Accepts DayLog[]:** Aggregates DayLogs instead of HabitEntries

Write paths:
- **DayLog Writes (Derived Cache):**
  - `recomputeDayLogForHabit()` - `src/server/utils/recomputeUtils.ts:20`
    - Writes DayLogs after entry mutations (correct - keeps cache in sync)
  - `upsertDayLog()` - `src/server/repositories/dayLogRepository.ts:20`
    - ⚠️ **Legacy direct writes:** Still accessible via `POST /api/dayLogs`
- **No Direct Metric Writes:**
  - ✅ Momentum/streak/progress are computed, never written directly (correct)

Known risks:
- **⚠️ CRITICAL: DayLogs Treated as Truth:**
  - Goal progress reads DayLogs instead of HabitEntries
  - Momentum service expects DayLog[] structure
  - Streak service expects DayLog-like structure
  - **Risk:** If DayLogs are out of sync, all derived metrics are incorrect
- **⚠️ Type Mismatch:**
  - Progress route passes HabitEntry[] to services expecting DayLog[]
  - Type casting (`as any[]`) hides structural differences
  - **Risk:** Runtime errors or incorrect calculations
- **Frontend Cache:**
  - `HabitContext.tsx` caches DayLog structure
  - **Risk:** Frontend depends on DayLog format, not HabitEntry format
- **No Persisted Metrics:**
  - ✅ Momentum/streak/progress are not stored in DB (correct)
  - ✅ All metrics are computed on-demand (correct concept, wrong source)

Action:
- **Milestone A Plan (HIGHEST PRIORITY):**
  1. **Create `truthQuery` utility:**
     - `src/server/utils/truthQuery.ts` - Reads HabitEntries and returns canonical structure
     - Provides efficient batch queries for progress computation
  2. **Create `legacyAdapter` utility:**
     - `src/server/utils/legacyAdapter.ts` - Converts HabitEntry[] to DayLog[] structure
     - Used during transition for services expecting DayLog format
  3. **Update Momentum Service:**
     - Change `calculateGlobalMomentum()` to accept HabitEntry[] or use adapter
     - Change `calculateCategoryMomentum()` to accept HabitEntry[] or use adapter
     - Compute `completed` from entries (not from DayLog.completed)
  4. **Update Streak Service:**
     - Change streak functions to accept HabitEntry[] or use adapter
     - Compute completion from entries for each day
  5. **Update Goal Progress:**
     - Replace all `getDayLogsByHabit()` calls with `getHabitEntriesByHabit()` via truthQuery
     - Update `computeFullGoalProgress()` to aggregate HabitEntries
  6. **Update Progress Overview:**
     - Use truthQuery to read HabitEntries
     - Use adapter to convert to DayLog structure for legacy services (temporary)
  7. **Deprecate Direct DayLog Reads:**
     - Add lint rule or code review checklist
     - Update all read paths to use HabitEntries
  8. **Frontend Migration (Future):**
     - Update frontend to use HabitEntry structure
     - Remove DayLog dependency from HabitContext

---

### JournalTemplate

Current collections:
- **Not found in repositories** - JournalTemplate may be:
  - Stored in frontend code only (`src/data/journalTemplates.ts`)
  - Not persisted to database
  - Static configuration, not user data
- **Location:** `src/data/journalTemplates.ts` - Static template definitions

Read paths:
- **Frontend:**
  - `JournalEditor.tsx` - Reads templates for journal creation
  - `JournalDisplay.tsx` - Uses templates for display
  - `src/data/journalTemplates.ts` - Static template definitions

Write paths:
- **Frontend:**
  - Templates are static - no write operations
  - User cannot create/edit templates (if implemented as static)

Known risks:
- **No Shadow Truth:**
  - ✅ Templates do not track progress (correct per canonical definition)
  - ✅ Templates are configuration only (correct)
  - ✅ No completion stored in templates (correct)
- **Implementation Status:**
  - Templates appear to be static frontend code
  - No database persistence found

Action:
- **Milestone A Plan:**
  1. Verify template implementation - if static, no changes needed
  2. Ensure templates never store or compute progress
  3. No changes required if templates are correctly implemented as static config

---

### JournalEntry

Current collections:
- `journalEntries` (MongoDB collection: `'journalEntries'`)
  - Location: `src/server/repositories/journal.ts` (line 11)
  - Storage format: Array of JournalEntry documents
  - Schema: `src/models/persistenceTypes.ts` (lines 439-482)
  - **No progress storage** - JournalEntry is reflection only

Read paths:
- **Backend Repository:**
  - `getEntriesByUser(userId)` - `src/server/repositories/journal.ts:55`
  - `getEntryById(id, userId)` - `src/server/repositories/journal.ts:75`
- **Backend API Routes:**
  - `GET /api/journal` - `src/server/routes/journal.ts` - Returns all journal entries
  - `GET /api/journal/:id` - Returns single entry
- **Frontend:**
  - `JournalPage.tsx` - Displays journal entries
  - `JournalEditor.tsx` - Creates/edits entries
  - `JournalDisplay.tsx` - Displays entry content

Write paths:
- **Backend Repository:**
  - `createEntry(data, userId)` - `src/server/repositories/journal.ts:20`
  - `updateEntry(id, userId, patch)` - `src/server/repositories/journal.ts:93`
  - `deleteEntry(id, userId)` - `src/server/repositories/journal.ts:120`
- **Backend API Routes:**
  - `POST /api/journal` - Creates journal entry
  - `PATCH /api/journal/:id` - Updates entry
  - `DELETE /api/journal/:id` - Deletes entry
- **Frontend:**
  - `JournalEditor.tsx` - Creates/updates entries
  - `JournalPage.tsx` - Manages entry lifecycle

Known risks:
- **No Shadow Truth:**
  - ✅ JournalEntry does not track completion (correct per canonical definition)
  - ✅ JournalEntry does not affect progress (correct)
  - ✅ JournalEntry is reflection only (correct)
- **No Progress Storage:**
  - ✅ JournalEntry does not store completion/streak/progress (correct)

Action:
- **Milestone A Plan:**
  1. No changes required - JournalEntry is correctly separated from HabitEntry
  2. Verify no code reads JournalEntry to compute habit completion
  3. Ensure journal entries never contribute to progress calculations

---

### HabitEntryReflection

Current collections:
- **Not found in repositories** - HabitEntryReflection may be:
  - Embedded in HabitEntry (as optional field)
  - Not yet implemented
  - Stored separately (collection not found)
- Schema reference: `docs/reference/15_HABIT_ENTRY_REFLECTION.md`
- **Note:** Reflection is qualitative annotation, not progress

Read paths:
- **If embedded in HabitEntry:**
  - Read via HabitEntry queries
  - `getHabitEntriesByHabit()` - Includes reflection if present
- **If separate collection:**
  - No repository found - may not be implemented

Write paths:
- **If embedded in HabitEntry:**
  - Write via HabitEntry updates
  - `updateHabitEntry()` - Can update reflection field
- **If separate collection:**
  - No routes found - may not be implemented

Known risks:
- **No Shadow Truth:**
  - ✅ Reflection does not affect completion (correct per canonical definition)
  - ✅ Reflection does not affect streaks/momentum (correct)
  - ✅ Reflection is annotation only (correct)
- **Implementation Status:**
  - ⚠️ **Unknown:** HabitEntryReflection may not be fully implemented
  - ⚠️ **Risk:** If reflection exists, ensure it never affects progress

Action:
- **Milestone A Plan:**
  1. Verify reflection implementation status
  2. If reflection exists, ensure it's purely qualitative (no progress impact)
  3. No changes required if reflection is correctly implemented as annotation only

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

