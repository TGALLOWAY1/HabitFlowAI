# MongoDB Migration Plan - HabitFlowAI

**Update:** As of 2025-01-27, the app runs in a single Mongo-primary mode and no longer supports localStorage persistence or migration. This document is kept for historical context only.

**Date:** 2025-01-27  
**Purpose:** Design a minimal, low-risk "Mongo-primary mode" that makes MongoDB the source of truth when enabled, while preserving local-only behavior and avoiding data loss.

---

## Current Behavior (Summary)

Based on `docs/runtime-persistence-map.md`, the current dual-write system has the following characteristics:

### Key Findings

1. **All Entities: Initial Read from localStorage**
   - All four entities (categories, habits, logs, wellbeingLogs) use localStorage lazy initializers
   - This happens regardless of the MongoDB flag
   - MongoDB sync only occurs after mount via `useEffect` hooks

2. **All Entities: Always Write to localStorage**
   - Every state change triggers a `useEffect` that writes to localStorage
   - Most write operations also explicitly write to localStorage before the effect runs
   - This results in **double writes** to localStorage in many cases

3. **All Entities: Optional MongoDB Writes**
   - When `VITE_USE_MONGO_PERSISTENCE=true`, writes also go to MongoDB via `persistenceClient`
   - MongoDB writes are in addition to localStorage writes, not instead of

4. **Error Handling Patterns:**
   - **Categories/Habits:** Transactional pattern - wait for API response, fallback to localStorage on failure
   - **Logs/WellbeingLogs:** Optimistic pattern - update state immediately, fire-and-forget API calls, no rollback on failure

5. **Mount Behavior:**
   - Initial state from localStorage (may be stale)
   - Then API fetch replaces it with MongoDB data (if enabled and successful)
   - Falls back to localStorage if API fails or returns empty

### Main Risks and Downsides

1. **Stale localStorage Overwriting Fresh MongoDB Data:**
   - On mount, state initializes from localStorage (which may be outdated)
   - If MongoDB has newer data, it replaces localStorage data after mount
   - However, if user makes changes before API sync completes, localStorage changes could overwrite MongoDB data

2. **Noisy Writes:**
   - Every state change writes to localStorage twice (explicit + useEffect)
   - This is unnecessary when MongoDB is the source of truth
   - Adds overhead and potential for race conditions

3. **Data Inconsistency:**
   - Optimistic updates (logs/wellbeingLogs) can leave state out of sync with MongoDB if API fails
   - No mechanism to detect or recover from sync failures
   - localStorage and MongoDB can diverge without user awareness

4. **Migration Risk:**
   - No clear path to transition existing users from localStorage to MongoDB
   - Dual-write mode is intended as temporary but has no expiration mechanism
   - Users may have data in both places with no clear "source of truth"

5. **Performance:**
   - Unnecessary localStorage writes when MongoDB is enabled
   - Double writes add overhead
   - localStorage writes are synchronous and can block UI

---

## Target Modes

The system should support three explicit persistence modes:

### Mode 1: `local-only`

**Purpose:** Exactly the current behavior when MongoDB is disabled. Pure localStorage persistence.

**Configuration:**
- `VITE_USE_MONGO_PERSISTENCE=false` (or not set)

**Behavior:**
- **Initial Read:** From localStorage only
- **Mount Read:** No API calls
- **Writes:** localStorage only
- **Error Handling:** N/A (no API calls)

**Use Cases:**
- Development without backend
- Users who prefer local-only storage
- Offline-first scenarios

---

### Mode 2: `mongo-migration`

**Purpose:** Current dual-write hybrid mode. Intended as a **temporary transition mode only**.

**Configuration:**
- `VITE_USE_MONGO_PERSISTENCE=true`
- `VITE_PERSISTENCE_MODE=migration` (new flag, defaults to this when MongoDB enabled)

**Behavior:**
- **Initial Read:** From localStorage (lazy initializer)
- **Mount Read:** Fetch from MongoDB, replace localStorage data if API succeeds
- **Writes:** Both localStorage and MongoDB (dual-write)
- **Error Handling:**
  - API fetch failure → use localStorage
  - API write failure → fallback to localStorage-only

**Use Cases:**
- Migration period for existing users
- Testing dual-write behavior
- Gradual rollout of MongoDB

**⚠️ Important:** This mode should be deprecated once all users have migrated. It's a safety net, not a permanent solution.

---

### Mode 3: `mongo-primary`

**Purpose:** MongoDB as source of truth. localStorage is read-only fallback only.

**Configuration:**
- `VITE_USE_MONGO_PERSISTENCE=true`
- `VITE_PERSISTENCE_MODE=primary` (new flag)

**Behavior:**
- **Initial Read:** From MongoDB via API (blocking or with loading state)
- **Mount Read:** Fetch from MongoDB, only fall back to localStorage if API fails AND explicitly allowed
- **Writes:** MongoDB only (no routine localStorage writes)
- **Error Handling:**
  - API fetch failure → fallback to localStorage (if enabled) OR show error
  - API write failure → entity-specific handling (see per-entity section)

**Use Cases:**
- Production deployment with MongoDB
- Multi-device sync
- Long-term data persistence

**Key Differences from mongo-migration:**
- No dual-write to localStorage
- MongoDB is primary source, not secondary
- localStorage is read-only fallback, not active storage

---

## Per-Entity Behavior in Mongo-primary Mode

### Categories

**Reads:**
- **On Mount:** Fetch from MongoDB via `fetchCategories()`
- **Fallback:** Only if API fails AND fallback is explicitly enabled, read from localStorage
- **Loading State:** Show loading indicator while fetching (no stale localStorage data)

**Writes:**
- **Create (`addCategory`):** 
  - Call `saveCategory()` API
  - On success: Update state with API response
  - On failure: Revert state change, show error, optionally allow localStorage fallback
  - **No localStorage write in success path**

- **Delete (`deleteCategory`):**
  - Call `deleteCategoryApi()` API
  - On success: Update state
  - On failure: Revert state change, show error
  - **No localStorage write in success path**

- **Reorder (`reorderCategories`):**
  - Call `reorderCategoriesApi()` API
  - On success: Update state with API response
  - On failure: Revert state change, show error
  - **No localStorage write in success path**

**Error Handling:**
- Keep transactional pattern (API-first, update state only on success)
- On API failure: Revert optimistic state, show user-friendly error
- Consider retry mechanism for transient failures

---

### Habits

**Reads:**
- **On Mount:** Fetch from MongoDB via `fetchHabits()`
- **Fallback:** Only if API fails AND fallback is explicitly enabled, read from localStorage
- **Loading State:** Show loading indicator while fetching

**Writes:**
- **Create (`addHabit`):**
  - Call `saveHabit()` API
  - On success: Update state with API response
  - On failure: Revert state change, show error
  - **No localStorage write in success path**

- **Delete (`deleteHabit`):**
  - Call `deleteHabitApi()` API
  - On success: Update habits and logs state
  - On failure: Revert state changes, show error
  - **No localStorage write in success path**

- **Import (`importHabits`):**
  - Batch API calls for categories and habits
  - On success: Update state with API responses
  - On partial failure: Update state with successful items, show errors for failed items
  - **No localStorage write in success path**

**Error Handling:**
- Keep transactional pattern (API-first)
- On API failure: Revert optimistic state, show error
- For import: Handle partial failures gracefully

---

### Logs (DayLogs)

**Reads:**
- **On Mount:** Fetch from MongoDB via `fetchDayLogs()`
- **Fallback:** Only if API fails AND fallback is explicitly enabled, read from localStorage
- **Loading State:** Show loading indicator while fetching

**Writes:**
- **Toggle (`toggleHabit`):**
  - Update state immediately (optimistic update - keep for UX)
  - Call `saveDayLog()` or `deleteDayLogApi()` API
  - On success: State already updated, no change needed
  - On failure: **Decision needed** - see "Open Questions" section
  - **No localStorage write in success path**

- **Update (`updateLog`):**
  - Update state immediately (optimistic update)
  - Call `saveDayLog()` API
  - On success: State already updated, no change needed
  - On failure: **Decision needed** - see "Open Questions" section
  - **No localStorage write in success path**

**Error Handling:**
- **Short-term:** Keep optimistic updates, log warnings on API failure
- **Future improvement:** Track "dirty" state, show sync indicator, retry failed writes
- **Consideration:** For critical data, may want to switch to transactional pattern

**Note:** Logs are high-frequency writes (every habit toggle). Optimistic updates provide better UX but require careful error handling.

---

### WellbeingLogs

**Reads:**
- **On Mount:** Fetch from MongoDB via `fetchWellbeingLogs()`
- **Fallback:** Only if API fails AND fallback is explicitly enabled, read from localStorage
- **Loading State:** Show loading indicator while fetching

**Writes:**
- **Log (`logWellbeing`):**
  - Perform deep merge, update state immediately (optimistic update)
  - Call `saveWellbeingLog()` API
  - On success: State already updated, no change needed
  - On failure: **Decision needed** - see "Open Questions" section
  - **No localStorage write in success path**

**Error Handling:**
- **Short-term:** Keep optimistic updates, log warnings on API failure
- **Future improvement:** Track "dirty" state, show sync indicator, retry failed writes

**Note:** Wellbeing logs are lower frequency than day logs, but still benefit from optimistic updates for UX.

---

## Migration Strategy (LocalStorage → Mongo)

### Overview

The migration strategy ensures existing users can safely transition from localStorage to MongoDB without data loss.

### Step 1: Run in `mongo-migration` Mode (Optional)

**Purpose:** Allow users to gradually sync their data to MongoDB while maintaining localStorage as backup.

**Duration:** Variable - can run for days/weeks until confident MongoDB is stable.

**Behavior:**
- Users continue using app normally
- All writes go to both localStorage and MongoDB
- MongoDB gradually accumulates data
- localStorage remains as backup

**Exit Criteria:**
- MongoDB has been stable for sufficient time
- All critical data has been synced
- Ready to switch to mongo-primary mode

---

### Step 2: One-Time Migration Helper

**Purpose:** Explicitly migrate existing localStorage data to MongoDB for users who haven't fully synced.

**Trigger:**
- Manual action (debug button, admin panel, or user-initiated)
- OR automatic on first mount in mongo-primary mode (if localStorage has data and MongoDB is empty)

**Process:**
1. **Read localStorage snapshot:**
   - Read all four entities: `categories`, `habits`, `logs`, `wellbeingLogs`
   - Validate data structure
   - Log what will be migrated

2. **Upsert to MongoDB:**
   - For each entity, use existing API endpoints to upsert data
   - **Conflict Resolution Rules:**
     - **MongoDB wins:** If a record exists in both localStorage and MongoDB, MongoDB version is kept
     - **Create missing:** Only create records that don't exist in MongoDB
     - **Never overwrite:** Never replace MongoDB data with localStorage data

3. **Validation:**
   - Verify all data was successfully migrated
   - Log any failures
   - Show user confirmation

4. **Cleanup (Optional):**
   - **Do NOT automatically delete localStorage** (safety measure)
   - Provide option to clear localStorage after successful migration
   - User can manually clear if desired

**Error Handling:**
- If migration fails partially, log which items failed
- Allow retry of failed items
- Never delete localStorage until migration is fully successful

---

### Step 3: Switch to `mongo-primary` Mode

**Purpose:** Make MongoDB the source of truth, stop dual-writing to localStorage.

**Trigger:**
- After successful migration
- OR for new users (no localStorage data)

**Behavior:**
- Initial read from MongoDB (not localStorage)
- Writes go to MongoDB only
- localStorage is read-only fallback (if enabled)

**Rollback Plan:**
- If issues arise, can temporarily switch back to `mongo-migration` mode
- localStorage data is preserved (not deleted) as safety net

---

### Conflict Resolution Rules

**When Both localStorage and MongoDB Have Data:**

1. **On Mount (mongo-primary mode):**
   - Always fetch from MongoDB first
   - Only use localStorage if MongoDB fetch fails AND fallback is enabled
   - MongoDB is always the source of truth

2. **During Migration:**
   - MongoDB wins for existing records
   - Only create missing records from localStorage
   - Never overwrite MongoDB with localStorage data

3. **After Migration:**
   - localStorage is ignored (read-only fallback only)
   - All operations use MongoDB

**Key Principle:** MongoDB is always authoritative. localStorage is only used for:
- Initial migration (one-time)
- Read-only fallback (if API fails and fallback enabled)

---

## Implementation Checklist

### Phase 1: Configuration and Mode System

- [ ] **Add persistence mode enum/constants**
  - Create `PersistenceMode` type: `'local-only' | 'mongo-migration' | 'mongo-primary'`
  - Add to `persistenceConfig.ts`
  - Add helper functions: `getPersistenceMode()`, `isMongoPrimary()`, `isMongoMigration()`, `isLocalOnly()`

- [ ] **Update environment variable handling**
  - Add `VITE_PERSISTENCE_MODE` env var
  - Default to `'mongo-migration'` when `VITE_USE_MONGO_PERSISTENCE=true` (backward compatible)
  - Default to `'local-only'` when `VITE_USE_MONGO_PERSISTENCE=false`
  - Allow explicit `'mongo-primary'` mode

- [ ] **Add fallback configuration**
  - Add `VITE_ALLOW_LOCALSTORAGE_FALLBACK` flag (default: `false` in mongo-primary)
  - Controls whether to read from localStorage when MongoDB fails

---

### Phase 2: Update HabitContext Read Paths

- [ ] **Categories: Update initial state**
  - In mongo-primary mode: Start with empty array or loading state (not localStorage)
  - In mongo-migration/local-only: Keep current localStorage lazy initializer

- [ ] **Categories: Update mount effect**
  - In mongo-primary mode: Fetch from MongoDB, show loading state
  - In mongo-primary mode: Only fallback to localStorage if API fails AND fallback enabled
  - In mongo-migration mode: Keep current behavior (fetch then fallback)

- [ ] **Habits: Update initial state**
  - Same pattern as categories

- [ ] **Habits: Update mount effect**
  - Same pattern as categories

- [ ] **Logs: Update initial state**
  - Same pattern as categories

- [ ] **Logs: Update mount effect**
  - Same pattern as categories

- [ ] **WellbeingLogs: Update initial state**
  - Same pattern as categories

- [ ] **WellbeingLogs: Update mount effect**
  - Same pattern as categories

---

### Phase 3: Update HabitContext Write Paths

- [ ] **Categories: Remove localStorage writes in mongo-primary mode**
  - Update `addCategory()`: No localStorage write on success
  - Update `deleteCategory()`: No localStorage write on success
  - Update `reorderCategories()`: No localStorage write on success
  - Keep localStorage fallback on API failure (if fallback enabled)

- [ ] **Habits: Remove localStorage writes in mongo-primary mode**
  - Update `addHabit()`: No localStorage write on success
  - Update `deleteHabit()`: No localStorage write on success
  - Update `importHabits()`: No localStorage write on success
  - Keep localStorage fallback on API failure (if fallback enabled)

- [ ] **Logs: Remove localStorage writes in mongo-primary mode**
  - Update `toggleHabit()`: No localStorage write on success
  - Update `updateLog()`: No localStorage write on success
  - Keep optimistic updates (state updated before API call)
  - Document error handling decision (see Open Questions)

- [ ] **WellbeingLogs: Remove localStorage writes in mongo-primary mode**
  - Update `logWellbeing()`: No localStorage write on success
  - Keep optimistic updates
  - Document error handling decision (see Open Questions)

- [ ] **Remove or gate dual-write useEffects**
  - In mongo-primary mode: Disable useEffect hooks that auto-sync to localStorage (lines 288-302)
  - In mongo-migration mode: Keep current behavior
  - In local-only mode: Keep current behavior

---

### Phase 4: Error Handling Improvements

- [ ] **Categories/Habits: Improve error handling**
  - Add user-friendly error messages
  - Consider retry mechanism for transient failures
  - Document fallback behavior clearly

- [ ] **Logs/WellbeingLogs: Decide on error handling**
  - **Option A:** Keep optimistic updates, log warnings (least work, current behavior)
  - **Option B:** Track "dirty" state, show sync indicator, retry failed writes (better UX, more work)
  - **Option C:** Switch to transactional pattern (consistent with categories/habits, but worse UX)
  - Document decision and implement chosen approach

- [ ] **Add loading states**
  - Show loading indicators during initial MongoDB fetch
  - Show loading indicators during write operations (if not optimistic)
  - Prevent user actions during critical operations

---

### Phase 5: Migration Helper

- [ ] **Create migration utility function**
  - Location: `src/lib/migrationHelper.ts` (or similar)
  - Function: `migrateLocalStorageToMongo()`
  - Reads all four entities from localStorage
  - Validates data structure
  - Upserts to MongoDB using existing API endpoints
  - Returns migration report (success/failure counts)

- [ ] **Add migration UI (optional)**
  - Debug button in dev mode
  - OR admin panel option
  - OR automatic on first mount in mongo-primary mode (if conditions met)
  - Show progress and results

- [ ] **Add migration validation**
  - Verify all data was successfully migrated
  - Compare counts (localStorage vs MongoDB)
  - Log any discrepancies

- [ ] **Add conflict resolution**
  - Implement "MongoDB wins" rule
  - Only create missing records
  - Never overwrite existing MongoDB data

---

### Phase 6: Testing

- [ ] **Unit tests for mode detection**
  - Test `getPersistenceMode()` with various env var combinations
  - Test helper functions (`isMongoPrimary()`, etc.)

- [ ] **Integration tests for mongo-primary mode**
  - Test initial read from MongoDB (not localStorage)
  - Test writes go to MongoDB only (not localStorage)
  - Test fallback behavior when API fails

- [ ] **Integration tests for mongo-migration mode**
  - Test dual-write behavior
  - Test localStorage fallback on API failure

- [ ] **Integration tests for local-only mode**
  - Test localStorage-only behavior
  - Test no API calls are made

- [ ] **Migration helper tests**
  - Test migration of all four entities
  - Test conflict resolution (MongoDB wins)
  - Test error handling (partial failures)

- [ ] **Manual QA checklist**
  - [ ] Test mongo-primary mode with fresh user (no localStorage)
  - [ ] Test mongo-primary mode with existing user (has localStorage)
  - [ ] Test migration helper with mixed data (localStorage + MongoDB)
  - [ ] Test fallback behavior when MongoDB is unavailable
  - [ ] Test error handling for each entity type
  - [ ] Test optimistic updates (logs/wellbeingLogs) with API failures
  - [ ] Test transactional updates (categories/habits) with API failures
  - [ ] Verify no localStorage writes in mongo-primary mode (success paths)
  - [ ] Verify localStorage is preserved (not deleted) after migration

---

### Phase 7: Documentation and Rollout

- [ ] **Update README**
  - Document new persistence modes
  - Document environment variables
  - Document migration process

- [ ] **Update code comments**
  - Add comments explaining mode behavior
  - Mark mongo-migration mode as temporary
  - Document error handling decisions

- [ ] **Create rollout plan**
  - Start with mongo-migration mode for existing users
  - Run migration helper for users
  - Gradually switch users to mongo-primary mode
  - Monitor for issues, have rollback plan

- [ ] **Add monitoring/logging**
  - Log which mode is active
  - Log migration attempts and results
  - Log API failures and fallback usage
  - Monitor for data inconsistencies

---

## Open Questions and Tradeoffs

### 1. Logs/WellbeingLogs Error Handling

**Question:** What should happen when optimistic updates fail (API call fails after state is updated)?

**Options:**
- **Option A (Current):** Keep state as-is, log warning. User sees updated state but MongoDB doesn't have it.
  - **Pros:** Simple, no code changes needed, good UX (no flickering)
  - **Cons:** State/MongoDB inconsistency, data loss risk if user closes browser

- **Option B:** Track "dirty" state, show sync indicator, retry failed writes in background.
  - **Pros:** Better UX (user knows sync status), automatic recovery
  - **Cons:** More complex, requires state management for dirty tracking

- **Option C:** Switch to transactional pattern (wait for API before updating state).
  - **Pros:** Consistent with categories/habits, guaranteed sync
  - **Cons:** Worse UX (delayed feedback), especially for high-frequency operations like habit toggles

**Recommendation:** Start with Option A (current behavior), plan Option B as future improvement. Document the tradeoff clearly.

---

### 2. Fallback Behavior in mongo-primary Mode

**Question:** Should mongo-primary mode allow reading from localStorage when MongoDB fails?

**Options:**
- **Option A:** Always allow fallback (safety first)
  - **Pros:** Better resilience, users can still use app if MongoDB is down
  - **Cons:** May mask MongoDB issues, localStorage could be stale

- **Option B:** Never allow fallback (strict mode)
  - **Pros:** Forces MongoDB to be reliable, clear error states
  - **Cons:** App unusable if MongoDB is down

- **Option C:** Configurable fallback (via env var)
  - **Pros:** Flexible, can be strict in production, lenient in development
  - **Cons:** More configuration complexity

**Recommendation:** Option C (configurable). Default to `false` (strict) in production, allow `true` in development. Document clearly.

---

### 3. Migration Trigger

**Question:** When should the migration helper run?

**Options:**
- **Option A:** Manual only (debug button, admin panel)
  - **Pros:** User control, no surprises
  - **Cons:** Users may forget to migrate

- **Option B:** Automatic on first mount in mongo-primary mode (if conditions met)
  - **Pros:** Seamless, no user action needed
  - **Cons:** May run unexpectedly, harder to debug

- **Option C:** Prompt user to migrate (one-time modal)
  - **Pros:** User aware, can choose timing
  - **Cons:** Requires UI work, user may dismiss

**Recommendation:** Option C (prompt user). Show one-time modal when localStorage has data and MongoDB is empty or has less data. Allow "migrate now" or "skip for now".

---

### 4. localStorage Cleanup

**Question:** Should we automatically delete localStorage after successful migration?

**Options:**
- **Option A:** Never auto-delete (safety first)
  - **Pros:** Always have backup, can recover if MongoDB fails
  - **Cons:** localStorage may become stale, takes up space

- **Option B:** Auto-delete after successful migration
  - **Pros:** Clean state, no stale data
  - **Cons:** No backup if MongoDB fails

- **Option C:** Provide option to delete (user choice)
  - **Pros:** User control, safety with convenience
  - **Cons:** Requires UI work

**Recommendation:** Option C (user choice). After successful migration, show option to "Clear localStorage backup" with explanation. Default to keeping it.

---

### 5. Loading States

**Question:** How should we handle loading states during initial MongoDB fetch?

**Options:**
- **Option A:** Show loading spinner, block UI
  - **Pros:** Clear feedback, prevents stale data display
  - **Cons:** Slower perceived startup

- **Option B:** Show stale localStorage data immediately, update when MongoDB loads
  - **Pros:** Faster perceived startup
  - **Cons:** May show stale data briefly, then flicker when updated

- **Option C:** Show skeleton/placeholder UI
  - **Pros:** Good UX, shows something is loading
  - **Cons:** Requires UI work

**Recommendation:** Option C (skeleton UI). Show placeholder content while fetching, then update smoothly when data loads. Falls back to Option A if skeleton UI is too complex.

---

### 6. Mode Transition

**Question:** Should users be able to switch modes at runtime, or only via env vars?

**Options:**
- **Option A:** Env vars only (build-time configuration)
  - **Pros:** Simple, clear, no runtime complexity
  - **Cons:** Requires rebuild to change mode

- **Option B:** Runtime switching (via UI or API)
  - **Pros:** Flexible, can switch modes without rebuild
  - **Cons:** More complex, potential for confusion

**Recommendation:** Option A (env vars only). Modes are deployment-level decisions, not user preferences. Keep it simple.

---

## Success Criteria

The migration is successful when:

1. ✅ MongoDB is the source of truth in mongo-primary mode
2. ✅ No routine localStorage writes in mongo-primary mode
3. ✅ Existing users can migrate without data loss
4. ✅ New users start with MongoDB (no localStorage dependency)
5. ✅ System can gracefully handle MongoDB failures (with fallback if enabled)
6. ✅ All entities behave consistently within their error handling pattern
7. ✅ No data inconsistencies between localStorage and MongoDB
8. ✅ Performance is acceptable (no unnecessary writes)

---

**End of Migration Plan**
