# Runtime Persistence Map - HabitFlowAI

**Date:** 2025-01-27  
**Purpose:** Precise mapping of how each entity uses MongoDB vs localStorage at runtime

**Feature Flag:** `VITE_USE_MONGO_PERSISTENCE` (checked via `isMongoPersistenceEnabled()` from `persistenceConfig.ts`)

---

## Overview

All four entities follow a **dual-path persistence pattern** with the following characteristics:

1. **Initial State:** Always loads from localStorage (lazy initializer), regardless of MongoDB flag
2. **On Mount:** If MongoDB enabled, fetches from API and replaces localStorage data
3. **Writes:** Always writes to localStorage, optionally also writes to MongoDB
4. **Dual-Write Effect:** All state changes automatically sync to localStorage via `useEffect`

**Key Pattern:** Even when MongoDB is enabled, localStorage is used as:
- Initial data source (non-blocking)
- Fallback on API failure
- Dual-write target (safety during transition)

---

## 1. Categories

**State Variable:** `categories` (line 95)  
**Type:** `Category[]`

### Read Path

#### Initial State (Component Mount)
- **Location:** Lines 95-107 (`useState` lazy initializer)
- **Source:** Always `localStorage.getItem('categories')`
- **Fallback:** `INITIAL_CATEGORIES` (8 predefined categories) if localStorage is empty
- **Behavior:** 
  - ✅ **Always uses localStorage** for initial state, regardless of MongoDB flag
  - MongoDB flag only affects whether API sync happens after mount

#### On Mount (API Sync)
- **Location:** Lines 142-184 (`useEffect` hook, runs once on mount)
- **Condition:** Only runs if `isMongoPersistenceEnabled() === true`
- **Flow:**
  1. Calls `fetchCategories()` from `persistenceClient.ts`
  2. **If API succeeds and returns data:**
     - Updates state with API data: `setCategories(apiCategories)`
     - **Dual-writes to localStorage:** `localStorage.setItem('categories', JSON.stringify(apiCategories))`
  3. **If API succeeds but returns empty array:**
     - Checks localStorage for existing data
     - If localStorage has data, uses it (with console warning)
     - If localStorage is empty, state remains empty
  4. **If API fails:**
     - Falls back to localStorage (with console warning)
     - Uses localStorage data if available

**Summary:** Reads from localStorage first, then syncs from MongoDB if enabled. Falls back to localStorage on API failure.

### Write Path

#### Create (`addCategory`)
- **Location:** Lines 333-357
- **If MongoDB enabled:**
  1. Calls `saveCategory(category)` → `POST /api/categories`
  2. On success: Updates state with API response, **dual-writes to localStorage** (line 342)
  3. On failure: Falls back to localStorage-only, generates UUID locally
- **If MongoDB disabled:**
  1. Generates UUID locally
  2. Updates state
  3. Writes to localStorage (via dual-write effect)

#### Delete (`deleteCategory`)
- **Location:** Lines 511-533
- **If MongoDB enabled:**
  1. Calls `deleteCategoryApi(id)` → `DELETE /api/categories/:id`
  2. On success: Updates state, **dual-writes to localStorage** (line 520)
  3. On failure: Falls back to localStorage-only (updates state but doesn't write localStorage explicitly - relies on useEffect)
- **If MongoDB disabled:**
  1. Updates state
  2. Writes to localStorage (via dual-write effect)

#### Reorder (`reorderCategories`)
- **Location:** Lines 649-670
- **If MongoDB enabled:**
  1. Calls `reorderCategoriesApi(newOrder)` → `PATCH /api/categories/reorder`
  2. On success: Updates state with API response, **dual-writes to localStorage** (line 657)
  3. On failure: Falls back to localStorage-only
- **If MongoDB disabled:**
  1. Updates state
  2. Writes to localStorage (via dual-write effect)

#### Dual-Write Effect
- **Location:** Lines 288-290
- **Behavior:** Automatically syncs `categories` state to localStorage on every state change
- **Note:** This means localStorage is written twice in some cases (explicit write + effect)

### Error Handling

- **API fetch failure:** Falls back to localStorage, logs warning
- **API write failure:** Falls back to localStorage-only, logs warning
- **Empty API response:** Uses localStorage if available, logs warning

### Summary

| Operation | localStorage | MongoDB | Notes |
|-----------|-------------|---------|-------|
| Initial Read | ✅ Always | ❌ Never | Lazy initializer always uses localStorage |
| Mount Read | ✅ Fallback | ✅ If enabled | Fetches from API, falls back to localStorage |
| Create | ✅ Always | ✅ If enabled | Dual-write pattern |
| Delete | ✅ Always | ✅ If enabled | Dual-write pattern |
| Reorder | ✅ Always | ✅ If enabled | Dual-write pattern |

**⚠️ Key Finding:** Categories **always** use localStorage, and **optionally** use MongoDB when enabled. Dual-write pattern ensures localStorage is always up-to-date.

---

## 2. Habits

**State Variable:** `habits` (line 109)  
**Type:** `Habit[]`

### Read Path

#### Initial State (Component Mount)
- **Location:** Lines 109-118 (`useState` lazy initializer)
- **Source:** Always `localStorage.getItem('habits')`
- **Fallback:** `INITIAL_HABITS` (3 demo habits) if localStorage is empty
- **Behavior:** 
  - ✅ **Always uses localStorage** for initial state, regardless of MongoDB flag

#### On Mount (API Sync)
- **Location:** Lines 186-219 (`useEffect` hook, runs once on mount)
- **Condition:** Only runs if `isMongoPersistenceEnabled() === true`
- **Flow:**
  1. Calls `fetchHabits()` from `persistenceClient.ts`
  2. **If API succeeds and returns data:**
     - Updates state: `setHabits(apiHabits)`
     - **Dual-writes to localStorage:** `localStorage.setItem('habits', JSON.stringify(apiHabits))`
  3. **If API succeeds but returns empty array:**
     - Checks localStorage for existing data
     - If localStorage has data, uses it (with console warning)
  4. **If API fails:**
     - Falls back to localStorage (with console warning)
     - Uses localStorage data if available

### Write Path

#### Create (`addHabit`)
- **Location:** Lines 359-397
- **If MongoDB enabled:**
  1. Calls `saveHabit(habit)` → `POST /api/habits`
  2. On success: Updates state with API response, **dual-writes to localStorage** (line 368)
  3. On failure: Falls back to localStorage-only, generates UUID and timestamps locally
- **If MongoDB disabled:**
  1. Generates UUID and timestamps locally
  2. Updates state
  3. Writes to localStorage (via dual-write effect)

#### Delete (`deleteHabit`)
- **Location:** Lines 467-509
- **If MongoDB enabled:**
  1. Calls `deleteHabitApi(id)` → `DELETE /api/habits/:id`
  2. On success: 
     - Updates habits state (removes habit)
     - Updates logs state (removes related day logs)
     - **Dual-writes both to localStorage** (lines 481-482)
  3. On failure: Falls back to localStorage-only (updates both habits and logs)
- **If MongoDB disabled:**
  1. Updates habits and logs state
  2. Writes to localStorage (via dual-write effects)

#### Import (`importHabits`)
- **Location:** Lines 535-647
- **Complex operation:** Creates both categories and habits
- **If MongoDB enabled:**
  - Creates categories via `saveCategory()` API calls
  - Creates habits via `saveHabit()` API calls
  - Each API call has individual error handling (falls back to localStorage for that item)
- **If MongoDB disabled:**
  - Creates categories and habits locally
  - Updates state
  - Writes to localStorage (via dual-write effects)

#### Dual-Write Effect
- **Location:** Lines 292-294
- **Behavior:** Automatically syncs `habits` state to localStorage on every state change

### Error Handling

- **API fetch failure:** Falls back to localStorage, logs warning
- **API write failure:** Falls back to localStorage-only, logs warning
- **Empty API response:** Uses localStorage if available, logs warning
- **Import operation:** Individual items can fail independently, each falls back to localStorage

### Summary

| Operation | localStorage | MongoDB | Notes |
|-----------|-------------|---------|-------|
| Initial Read | ✅ Always | ❌ Never | Lazy initializer always uses localStorage |
| Mount Read | ✅ Fallback | ✅ If enabled | Fetches from API, falls back to localStorage |
| Create | ✅ Always | ✅ If enabled | Dual-write pattern |
| Delete | ✅ Always | ✅ If enabled | Also removes related logs, dual-write |
| Import | ✅ Always | ✅ If enabled | Per-item error handling |

**⚠️ Key Finding:** Habits **always** use localStorage, and **optionally** use MongoDB when enabled. Delete operation also cascades to logs.

---

## 3. Logs (DayLogs)

**State Variable:** `logs` (line 120)  
**Type:** `Record<string, DayLog>` (key: `${habitId}-${date}`)

### Read Path

#### Initial State (Component Mount)
- **Location:** Lines 120-129 (`useState` lazy initializer)
- **Source:** Always `localStorage.getItem('logs')`
- **Fallback:** Empty object `{}` if localStorage is empty
- **Behavior:** 
  - ✅ **Always uses localStorage** for initial state, regardless of MongoDB flag

#### On Mount (API Sync)
- **Location:** Lines 221-252 (`useEffect` hook, runs once on mount)
- **Condition:** Only runs if `isMongoPersistenceEnabled() === true`
- **Flow:**
  1. Calls `fetchDayLogs()` from `persistenceClient.ts`
  2. **If API succeeds and returns data:**
     - Updates state: `setLogs(apiLogs)`
     - **Dual-writes to localStorage:** `localStorage.setItem('logs', JSON.stringify(apiLogs))`
  3. **If API succeeds but returns empty object:**
     - Checks localStorage for existing data
     - If localStorage has data, uses it (with console warning)
  4. **If API fails:**
     - Falls back to localStorage (with console warning)
     - Uses localStorage data if available

### Write Path

#### Toggle (`toggleHabit`)
- **Location:** Lines 399-439
- **Behavior:** Toggles log existence (creates if missing, deletes if exists)
- **Flow:**
  1. Updates state immediately (optimistic update)
  2. **Always writes to localStorage** (line 420)
  3. **If MongoDB enabled:**
     - **If creating log:** Calls `saveDayLog(logToSave)` → `POST /api/dayLogs`
     - **If deleting log:** Calls `deleteDayLogApi(habitId, date)` → `DELETE /api/dayLogs/:habitId/:date`
     - On API failure: Only logs warning (state already updated)

#### Update (`updateLog`)
- **Location:** Lines 441-465
- **Behavior:** Updates numeric habit value
- **Flow:**
  1. Calculates `completed` based on goal target
  2. Updates state immediately
  3. **Always writes to localStorage** (line 454)
  4. **If MongoDB enabled:**
     - Calls `saveDayLog(logToSave)` → `POST /api/dayLogs` (upsert)
     - On API failure: Only logs warning (state already updated)

#### Delete (via `deleteHabit`)
- **Location:** Lines 476-478, 491-493
- **Behavior:** Removes all logs for a deleted habit
- **Flow:**
  - Part of `deleteHabit()` operation
  - Updates logs state (filters out logs with matching `habitId`)
  - Writes to localStorage (via dual-write effect or explicit write)

#### Dual-Write Effect
- **Location:** Lines 296-298
- **Behavior:** Automatically syncs `logs` state to localStorage on every state change

### Error Handling

- **API fetch failure:** Falls back to localStorage, logs warning
- **API write failure:** State already updated, only logs warning (no rollback)
- **Empty API response:** Uses localStorage if available, logs warning

**⚠️ Important:** Logs use **optimistic updates** - state is updated before API call completes. If API fails, state is not rolled back (only warning logged).

### Summary

| Operation | localStorage | MongoDB | Notes |
|-----------|-------------|---------|-------|
| Initial Read | ✅ Always | ❌ Never | Lazy initializer always uses localStorage |
| Mount Read | ✅ Fallback | ✅ If enabled | Fetches from API, falls back to localStorage |
| Toggle (Create) | ✅ Always | ✅ If enabled | Optimistic update, API failure doesn't rollback |
| Toggle (Delete) | ✅ Always | ✅ If enabled | Optimistic update, API failure doesn't rollback |
| Update | ✅ Always | ✅ If enabled | Optimistic update, API failure doesn't rollback |
| Delete (via habit) | ✅ Always | ✅ If enabled | Part of habit deletion |

**⚠️ Key Finding:** Logs use **optimistic updates** - state changes happen immediately, MongoDB writes are fire-and-forget. If API fails, state is not rolled back.

---

## 4. WellbeingLogs

**State Variable:** `wellbeingLogs` (line 131)  
**Type:** `Record<string, DailyWellbeing>` (key: `YYYY-MM-DD`)

### Read Path

#### Initial State (Component Mount)
- **Location:** Lines 131-140 (`useState` lazy initializer)
- **Source:** Always `localStorage.getItem('wellbeingLogs')`
- **Fallback:** Empty object `{}` if localStorage is empty
- **Behavior:** 
  - ✅ **Always uses localStorage** for initial state, regardless of MongoDB flag

#### On Mount (API Sync)
- **Location:** Lines 254-285 (`useEffect` hook, runs once on mount)
- **Condition:** Only runs if `isMongoPersistenceEnabled() === true`
- **Flow:**
  1. Calls `fetchWellbeingLogs()` from `persistenceClient.ts`
  2. **If API succeeds and returns data:**
     - Updates state: `setWellbeingLogs(apiWellbeingLogs)`
     - **Dual-writes to localStorage:** `localStorage.setItem('wellbeingLogs', JSON.stringify(apiWellbeingLogs))`
  3. **If API succeeds but returns empty object:**
     - Checks localStorage for existing data
     - If localStorage has data, uses it (with console warning)
  4. **If API fails:**
     - Falls back to localStorage (with console warning)
     - Uses localStorage data if available

### Write Path

#### Log Wellbeing (`logWellbeing`)
- **Location:** Lines 304-331
- **Behavior:** Merges new wellbeing data with existing data for the date
- **Flow:**
  1. Performs deep merge of morning/evening sessions
  2. Updates state immediately (optimistic update)
  3. **Always writes to localStorage** (line 320)
  4. **If MongoDB enabled:**
     - Calls `saveWellbeingLog(mergedData)` → `POST /api/wellbeingLogs` (upsert)
     - On API failure: Only logs warning (state already updated)

#### Dual-Write Effect
- **Location:** Lines 300-302
- **Behavior:** Automatically syncs `wellbeingLogs` state to localStorage on every state change

### Error Handling

- **API fetch failure:** Falls back to localStorage, logs warning
- **API write failure:** State already updated, only logs warning (no rollback)
- **Empty API response:** Uses localStorage if available, logs warning

**⚠️ Important:** Wellbeing logs use **optimistic updates** - state is updated before API call completes. If API fails, state is not rolled back (only warning logged).

### Summary

| Operation | localStorage | MongoDB | Notes |
|-----------|-------------|---------|-------|
| Initial Read | ✅ Always | ❌ Never | Lazy initializer always uses localStorage |
| Mount Read | ✅ Fallback | ✅ If enabled | Fetches from API, falls back to localStorage |
| Log (Upsert) | ✅ Always | ✅ If enabled | Optimistic update, deep merge, API failure doesn't rollback |

**⚠️ Key Finding:** Wellbeing logs use **optimistic updates** with deep merging. State changes happen immediately, MongoDB writes are fire-and-forget.

---

## Cross-Entity Observations

### Dual-Write Pattern

**ALL entities dual-write to localStorage:**
- Every state change triggers a `useEffect` that writes to localStorage (lines 288-302)
- Most write operations also explicitly write to localStorage before the effect runs
- This means localStorage is often written **twice** for a single state change

### Optimistic Updates

**Logs and WellbeingLogs use optimistic updates:**
- State is updated **before** API call completes
- If API fails, state is **not rolled back** (only warning logged)
- This can lead to state/MongoDB inconsistency if API fails

**Categories and Habits use transactional updates:**
- API call happens **before** state update
- If API fails, falls back to localStorage-only (state updated with local data)

### Error Handling Inconsistencies

1. **Categories/Habits:** API failure → fallback to localStorage, state updated with local data
2. **Logs/WellbeingLogs:** API failure → state already updated, only warning logged (no rollback)

This inconsistency means:
- Categories/Habits: State matches localStorage on API failure
- Logs/WellbeingLogs: State may differ from MongoDB on API failure (but matches localStorage)

---

## Entities That Never Use persistenceClient

**None.** All four entities use `persistenceClient` when MongoDB is enabled.

However, **all entities always use localStorage** as well, so there are no "MongoDB-only" entities.

---

## Entities That Dual-Write

**ALL entities dual-write to localStorage and MongoDB:**
- ✅ Categories: Dual-writes on all operations
- ✅ Habits: Dual-writes on all operations
- ✅ Logs: Dual-writes on all operations
- ✅ WellbeingLogs: Dual-writes on all operations

**Pattern:** localStorage is always written, MongoDB is optionally written (when flag enabled).

---

## Read/Write Mismatches

### All Entities: Read from localStorage first, then sync from MongoDB

**Pattern:**
1. Initial state: Always from localStorage (lazy initializer)
2. On mount: If MongoDB enabled, fetch from API and replace localStorage data
3. Writes: Always to localStorage, optionally to MongoDB

**Implication:** There's a brief moment on mount where state may be from localStorage, then gets replaced by MongoDB data (if available).

### Logs/WellbeingLogs: Optimistic updates vs Categories/Habits: Transactional updates

**Mismatch:**
- **Categories/Habits:** Wait for API response before updating state
- **Logs/WellbeingLogs:** Update state immediately, API call is fire-and-forget

**Implication:** Different error handling behavior - logs/wellbeing logs may have state that doesn't match MongoDB if API fails.

---

## Summary Table

| Entity | Initial Read | Mount Read | Writes | Error Handling |
|--------|-------------|------------|--------|----------------|
| **Categories** | localStorage | MongoDB (if enabled) → localStorage fallback | localStorage + MongoDB (if enabled) | Fallback to localStorage |
| **Habits** | localStorage | MongoDB (if enabled) → localStorage fallback | localStorage + MongoDB (if enabled) | Fallback to localStorage |
| **Logs** | localStorage | MongoDB (if enabled) → localStorage fallback | localStorage + MongoDB (if enabled) | Optimistic update, no rollback |
| **WellbeingLogs** | localStorage | MongoDB (if enabled) → localStorage fallback | localStorage + MongoDB (if enabled) | Optimistic update, no rollback |

**Key Patterns:**
1. ✅ All entities always use localStorage
2. ✅ All entities optionally use MongoDB (when flag enabled)
3. ✅ All entities dual-write to localStorage and MongoDB
4. ⚠️ Logs and WellbeingLogs use optimistic updates (state may not match MongoDB on API failure)
5. ⚠️ Categories and Habits use transactional updates (state matches localStorage on API failure)

---

**End of Runtime Persistence Map**
