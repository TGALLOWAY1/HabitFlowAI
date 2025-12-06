# Storage Audit - HabitFlowAI

**Date:** 2025-01-27  
**Purpose:** Comprehensive audit of all persistence mechanisms before finalizing MongoDB migration

---

## Executive Summary

This application currently uses a **dual-path persistence system**:

1. **Primary (when enabled):** MongoDB via REST API (`src/server/`)
2. **Fallback/Default:** Browser localStorage (`src/store/HabitContext.tsx`)

The system is in a **transitional state** where MongoDB persistence can be enabled via feature flags, but localStorage remains as both a fallback and a dual-write target for safety during migration.

**Feature Flags:**
- Frontend: `VITE_USE_MONGO_PERSISTENCE` (env var)
- Backend: `USE_MONGO_PERSISTENCE` (env var)

---

## Frontend Storage

### Storage Mechanism: Browser localStorage + Optional MongoDB API

**Primary Location:** `src/store/HabitContext.tsx`  
**API Client:** `src/lib/persistenceClient.ts`  
**Configuration:** `src/lib/persistenceConfig.ts`

### Storage Keys and Data Structures

#### 1. `categories` (localStorage key: `'categories'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 95-107 (state initialization), 142-184 (API sync), 288-290 (localStorage sync), 333-357 (addCategory), 511-533 (deleteCategory), 649-670 (reorderCategories)

**Data Shape:**
```typescript
Category[] // Array of Category objects

interface Category {
    id: string;              // UUID generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
    name: string;            // Display name (e.g., "Physical Health")
    color: string;           // Tailwind CSS class (e.g., "bg-emerald-500")
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:** 
  - Line 95-107: `useState` lazy initializer reads from localStorage
  - Line 142-184: If MongoDB enabled, `useEffect` fetches from API on mount
- **Fallback:** If no saved data exists, uses `INITIAL_CATEGORIES` (8 predefined categories from line 50-59)
- **API Endpoint:** `GET /api/categories` (via `fetchCategories()` in persistenceClient.ts)

**Write Operations:**
- **When:** Whenever the `categories` state changes
- **Where:** 
  - Line 288-290: `useEffect` hook watches `categories` dependency (dual-write to localStorage)
  - Line 333-357: `addCategory()` - Adds new category
  - Line 511-533: `deleteCategory()` - Removes category
  - Line 649-670: `reorderCategories()` - Reorders category array
  - Line 535-647: `importHabits()` - May add new categories during import
- **API Endpoints:**
  - `POST /api/categories` (create, via `saveCategory()`)
  - `DELETE /api/categories/:id` (delete, via `deleteCategoryApi()`)
  - `PATCH /api/categories/reorder` (reorder, via `reorderCategoriesApi()`)
- **Dual-Write Pattern:** When MongoDB enabled, writes to API first, then also writes to localStorage as fallback

**Usage in UI:**
- **CategoryTabs.tsx:** Displays category pills, allows reordering via drag-and-drop, adding/deleting categories
- **ProgressDashboard.tsx:** Groups habits by category for display
- **AddHabitModal.tsx:** Category selection dropdown

---

#### 2. `habits` (localStorage key: `'habits'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 109-118 (state initialization), 186-219 (API sync), 292-294 (localStorage sync), 359-397 (addHabit), 467-509 (deleteHabit), 535-647 (importHabits)

**Data Shape:**
```typescript
Habit[] // Array of Habit objects

interface Habit {
    id: string;                    // UUID generated via crypto.randomUUID() (frontend) or randomUUID() (backend)
    categoryId: string;            // Foreign key to Category.id
    name: string;                 // Display name (e.g., "Morning Jog")
    description?: string;          // Optional (currently unused in UI)
    goal: Goal;                   // Goal configuration
    archived: boolean;            // Whether habit is hidden from active tracking
    createdAt: string;            // ISO 8601 timestamp
    pace?: string | null;         // NOT PERSISTED - calculated on-the-fly
}

interface Goal {
    type: 'boolean' | 'number';
    target?: number;              // Required for 'number' type
    unit?: string;                // Display unit (e.g., 'glasses', 'hours')
    frequency: 'daily' | 'weekly' | 'total';
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:**
  - Line 109-118: `useState` lazy initializer reads from localStorage
  - Line 186-219: If MongoDB enabled, `useEffect` fetches from API on mount
- **Fallback:** If no saved data exists, uses `INITIAL_HABITS` (3 demo habits from line 61-86)
- **API Endpoint:** `GET /api/habits` or `GET /api/habits?categoryId=xxx` (via `fetchHabits()` in persistenceClient.ts)

**Write Operations:**
- **When:** Whenever the `habits` state changes
- **Where:**
  - Line 292-294: `useEffect` hook watches `habits` dependency (dual-write to localStorage)
  - Line 359-397: `addHabit()` - Adds new habit
  - Line 467-509: `deleteHabit()` - Removes habit and related logs
  - Line 535-647: `importHabits()` - Bulk import from predefined habits
- **API Endpoints:**
  - `POST /api/habits` (create, via `saveHabit()`)
  - `DELETE /api/habits/:id` (delete, via `deleteHabitApi()`)
  - `PATCH /api/habits/:id` (update, via `updateHabitApi()` - not currently used in HabitContext)
- **Dual-Write Pattern:** When MongoDB enabled, writes to API first, then also writes to localStorage

**Usage in UI:**
- **TrackerGrid.tsx:** Displays habits in a grid with daily checkboxes
- **ProgressDashboard.tsx:** Shows habit completion statistics
- **AddHabitModal.tsx:** Form to create new habits
- **NumericInputPopover.tsx:** Input for numeric habit values

**Notes:**
- `description` field exists in type but is never set or displayed in UI
- `pace` field is calculated dynamically (not stored)
- Deleting a habit also removes related day logs (line 476-478, 491-493)

---

#### 3. `logs` (localStorage key: `'logs'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 120-129 (state initialization), 221-252 (API sync), 296-298 (localStorage sync), 399-439 (toggleHabit), 441-465 (updateLog)

**Data Shape:**
```typescript
Record<string, DayLog> // Object with composite keys

interface DayLog {
    habitId: string;      // Foreign key to Habit.id
    date: string;         // YYYY-MM-DD format (ISO date string)
    value: number;        // 0 or 1 for boolean, actual value for number habits
    completed: boolean;   // Whether goal was met
}

// Composite Key Format: `${habitId}-${date}` (e.g., "abc123-2025-01-27")
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:**
  - Line 120-129: `useState` lazy initializer reads from localStorage
  - Line 221-252: If MongoDB enabled, `useEffect` fetches from API on mount
- **Fallback:** If no saved data exists, uses empty object `{}`
- **API Endpoint:** `GET /api/dayLogs` or `GET /api/dayLogs?habitId=xxx` (via `fetchDayLogs()` in persistenceClient.ts)

**Write Operations:**
- **When:** Whenever the `logs` state changes
- **Where:**
  - Line 296-298: `useEffect` hook watches `logs` dependency (dual-write to localStorage)
  - Line 399-439: `toggleHabit()` - Toggles habit completion (creates/deletes log)
  - Line 441-465: `updateLog()` - Updates numeric habit value
  - Line 476-478, 491-493: `deleteHabit()` - Removes related logs when habit is deleted
- **API Endpoints:**
  - `POST /api/dayLogs` (upsert, via `saveDayLog()`)
  - `DELETE /api/dayLogs/:habitId/:date` (delete, via `deleteDayLogApi()`)
- **Dual-Write Pattern:** When MongoDB enabled, writes to API, but also writes to localStorage

**Usage in UI:**
- **TrackerGrid.tsx:** Displays checkboxes/inputs for each habit-date combination
- **Heatmap.tsx:** Visual heatmap of habit completion over time
- **ProgressRings.tsx:** Calculates completion statistics

**Notes:**
- Composite key format: `${habitId}-${date}` ensures unique log per habit per day
- Toggle operation: If log exists, deletes it; if not, creates it with `value: 1, completed: true`
- No referential integrity: Deleting a habit manually removes logs from state, but orphaned logs in localStorage/MongoDB may exist if deletion fails

---

#### 4. `wellbeingLogs` (localStorage key: `'wellbeingLogs'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 131-140 (state initialization), 254-285 (API sync), 300-302 (localStorage sync), 304-331 (logWellbeing)

**Data Shape:**
```typescript
Record<string, DailyWellbeing> // Object keyed by date string

interface DailyWellbeing {
    date: string;                    // YYYY-MM-DD format (ISO date string)
    morning?: WellbeingSession;     // Optional morning check-in
    evening?: WellbeingSession;     // Optional evening check-in
    // Legacy fields (read-only for backward compatibility):
    depression?: number;
    anxiety?: number;
    energy?: number;
    sleepScore?: number;
    notes?: string;
}

interface WellbeingSession {
    depression: number;    // 1-5 scale
    anxiety: number;      // 1-5 scale
    energy: number;      // 1-5 scale
    sleepScore: number;  // 0-100 scale
    notes?: string;
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:**
  - Line 131-140: `useState` lazy initializer reads from localStorage
  - Line 254-285: If MongoDB enabled, `useEffect` fetches from API on mount
- **Fallback:** If no saved data exists, uses empty object `{}`
- **API Endpoint:** `GET /api/wellbeingLogs` (via `fetchWellbeingLogs()` in persistenceClient.ts)

**Write Operations:**
- **When:** Whenever the `wellbeingLogs` state changes
- **Where:**
  - Line 300-302: `useEffect` hook watches `wellbeingLogs` dependency (dual-write to localStorage)
  - Line 304-331: `logWellbeing()` - Saves wellbeing check-in data
- **API Endpoint:** `POST /api/wellbeingLogs` (upsert, via `saveWellbeingLog()`)
- **Dual-Write Pattern:** When MongoDB enabled, writes to API, but also writes to localStorage

**Usage in UI:**
- **DailyCheckInModal.tsx:** Form to input morning/evening wellbeing data
- **ProgressRings.tsx:** Displays current wellbeing metrics and 7-day trends

**Data Merging Logic:**
- The `logWellbeing()` function performs a deep merge (line 304-331)
- Preserves existing morning/evening sessions when updating the other
- Legacy top-level fields are maintained for backward compatibility
- Priority order for reading: `evening` → `morning` → legacy top-level (see ProgressRings.tsx)

**Notes:**
- Key format: YYYY-MM-DD (same as DayLog.date)
- New data is only written in `morning`/`evening` session format
- Legacy fields are read-only for backward compatibility

---

## Backend Storage

### Storage Mechanism: MongoDB

**Location:** `src/server/`  
**Database:** MongoDB (connection via `src/server/lib/mongoClient.ts`)  
**Collections:** `categories`, `habits`, `dayLogs`, `wellbeingLogs`

### Configuration

**Feature Flag:** `USE_MONGO_PERSISTENCE` (env var, checked in `src/server/config/index.ts`)  
**Environment Variables:**
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB_NAME` - Database name
- `USE_MONGO_PERSISTENCE` - Must be `'true'` to enable

**Server Entry Point:** `src/server/index.ts`  
**Port:** Default 3000 (configurable via `PORT` env var)  
**API Base Path:** `/api`

### Repository Layer

All data access is through repository functions in `src/server/repositories/`:

#### 1. Categories Repository (`categoryRepository.ts`)

**Collection:** `categories`  
**Operations:**
- `createCategory(data, userId)` - Create new category
- `getCategoriesByUser(userId)` - Get all categories for user
- `getCategoryById(id, userId)` - Get single category
- `updateCategory(id, userId, patch)` - Update category
- `deleteCategory(id, userId)` - Delete category
- `reorderCategories(userId, categories)` - Replace all categories (reorder)

**MongoDB Document Structure:**
```typescript
{
    _id: ObjectId,           // MongoDB auto-generated
    id: string,              // UUID (application-level ID)
    name: string,
    color: string,
    userId: string           // User scoping (currently 'anonymous-user')
}
```

**Notes:**
- Uses application-level `id` (UUID) as primary identifier, not MongoDB `_id`
- All queries are scoped by `userId`
- Reorder operation deletes all and re-inserts (not efficient for large datasets)

---

#### 2. Habits Repository (`habitRepository.ts`)

**Collection:** `habits`  
**Operations:**
- `createHabit(data, userId)` - Create new habit
- `getHabitsByUser(userId)` - Get all habits for user
- `getHabitsByCategory(categoryId, userId)` - Get habits filtered by category
- `getHabitById(id, userId)` - Get single habit
- `updateHabit(id, userId, patch)` - Update habit
- `deleteHabit(id, userId)` - Delete habit

**MongoDB Document Structure:**
```typescript
{
    _id: ObjectId,           // MongoDB auto-generated
    id: string,              // UUID (application-level ID)
    categoryId: string,
    name: string,
    description?: string,
    goal: Goal,
    archived: boolean,
    createdAt: string,       // ISO 8601 timestamp
    userId: string           // User scoping
}
```

**Notes:**
- Uses application-level `id` (UUID) as primary identifier
- All queries are scoped by `userId`
- No cascade delete of day logs at repository level (handled in route handler)

---

#### 3. DayLogs Repository (`dayLogRepository.ts`)

**Collection:** `dayLogs`  
**Operations:**
- `upsertDayLog(log, userId)` - Create or update day log
- `getDayLogsByUser(userId)` - Get all day logs for user
- `getDayLogsByHabit(habitId, userId)` - Get logs filtered by habit
- `getDayLog(habitId, date, userId)` - Get single day log
- `deleteDayLog(habitId, date, userId)` - Delete day log
- `deleteDayLogsByHabit(habitId, userId)` - Delete all logs for a habit (cascade)

**MongoDB Document Structure:**
```typescript
{
    _id: ObjectId,           // MongoDB auto-generated
    habitId: string,
    date: string,           // YYYY-MM-DD
    value: number,
    completed: boolean,
    compositeKey: string,    // `${habitId}-${date}` (for efficient querying)
    userId: string          // User scoping
}
```

**Notes:**
- Uses `compositeKey` field for efficient querying (matches frontend key format)
- Unique constraint: `compositeKey + userId` (enforced by upsert logic)
- Cascade delete: `deleteDayLogsByHabit()` is called when habit is deleted (in route handler)

---

#### 4. WellbeingLogs Repository (`wellbeingLogRepository.ts`)

**Collection:** `wellbeingLogs`  
**Operations:**
- `upsertWellbeingLog(log, userId)` - Create or update wellbeing log
- `getWellbeingLogsByUser(userId)` - Get all wellbeing logs for user
- `getWellbeingLog(date, userId)` - Get single wellbeing log by date
- `deleteWellbeingLog(date, userId)` - Delete wellbeing log

**MongoDB Document Structure:**
```typescript
{
    _id: ObjectId,           // MongoDB auto-generated
    date: string,            // YYYY-MM-DD (unique per user)
    morning?: WellbeingSession,
    evening?: WellbeingSession,
    // Legacy fields (for backward compatibility):
    depression?: number,
    anxiety?: number,
    energy?: number,
    sleepScore?: number,
    notes?: string,
    userId: string          // User scoping
}
```

**Notes:**
- Unique constraint: `date + userId` (enforced by upsert logic)
- Legacy fields are preserved for backward compatibility

---

### API Routes

All routes are in `src/server/routes/` and follow REST conventions:

#### Categories Routes (`categories.ts`)
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `GET /api/categories/:id` - Get single category
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `PATCH /api/categories/reorder` - Reorder categories

#### Habits Routes (`habits.ts`)
- `GET /api/habits` - Get all habits (optional `?categoryId=xxx` filter)
- `POST /api/habits` - Create habit
- `GET /api/habits/:id` - Get single habit
- `PATCH /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit (cascades to day logs)

#### DayLogs Routes (`dayLogs.ts`)
- `GET /api/dayLogs` - Get all day logs (optional `?habitId=xxx` filter)
- `POST /api/dayLogs` - Upsert day log
- `PUT /api/dayLogs` - Upsert day log (alias)
- `GET /api/dayLogs/:habitId/:date` - Get single day log
- `DELETE /api/dayLogs/:habitId/:date` - Delete day log

#### WellbeingLogs Routes (`wellbeingLogs.ts`)
- `GET /api/wellbeingLogs` - Get all wellbeing logs
- `POST /api/wellbeingLogs` - Upsert wellbeing log
- `PUT /api/wellbeingLogs` - Upsert wellbeing log (alias)
- `GET /api/wellbeingLogs/:date` - Get single wellbeing log
- `DELETE /api/wellbeingLogs/:date` - Delete wellbeing log

**Error Handling:**
- Returns 501 if `USE_MONGO_PERSISTENCE` is false
- Returns 400 for validation errors
- Returns 404 for not found
- Returns 500 for server errors

**Authentication:**
- Currently uses placeholder `'anonymous-user'` (set in middleware at `src/server/index.ts:38`)
- TODO: Replace with actual authentication token/session extraction

---

## Storage Lifecycle

### Initialization Flow

1. **App Startup** (`src/main.tsx` → `src/App.tsx`)
   - `HabitProvider` mounts
   - Four `useState` hooks initialize with localStorage reads:
     - `categories`: Reads `localStorage.getItem('categories')` → falls back to `INITIAL_CATEGORIES`
     - `habits`: Reads `localStorage.getItem('habits')` → falls back to `INITIAL_HABITS`
     - `logs`: Reads `localStorage.getItem('logs')` → falls back to `{}`
     - `wellbeingLogs`: Reads `localStorage.getItem('wellbeingLogs')` → falls back to `{}`

2. **API Sync (if MongoDB enabled)**
   - After initial localStorage load, `useEffect` hooks (lines 142-285) fetch from API
   - If API returns data, it replaces localStorage data
   - If API fails or returns empty, localStorage data is used (with warning)
   - Dual-write: API data is also written back to localStorage

3. **Persistence Flow**
   - Each state variable has a corresponding `useEffect` that watches for changes
   - On any state change, the effect immediately writes to localStorage via `localStorage.setItem()`
   - If MongoDB enabled, mutations also write to API (with localStorage fallback on error)

### Write Triggers

| State | Write Triggers | API Endpoints (if enabled) |
|-------|----------------|---------------------------|
| `categories` | `addCategory()`, `deleteCategory()`, `reorderCategories()`, `importHabits()` | POST, DELETE, PATCH /api/categories |
| `habits` | `addHabit()`, `deleteHabit()`, `importHabits()` | POST, DELETE /api/habits |
| `logs` | `toggleHabit()`, `updateLog()`, `deleteHabit()` | POST, DELETE /api/dayLogs |
| `wellbeingLogs` | `logWellbeing()` | POST /api/wellbeingLogs |

### Read Triggers

- **Initial load:** Component mount (once per app session)
- **Runtime:** All reads are from React state (not directly from localStorage or API)
- **No lazy loading:** All data is loaded into memory at startup
- **API sync:** Only happens on mount if MongoDB enabled

---

## Data Relationships

```
Category (1) ──< (many) Habit (1) ──< (many) DayLog
                                   
DailyWellbeing (standalone, keyed by date)
```

**Foreign Key Relationships:**
- `Habit.categoryId` → `Category.id`
- `DayLog.habitId` → `Habit.id`
- `DayLog.date` → ISO date string (YYYY-MM-DD)
- `DailyWellbeing.date` → ISO date string (YYYY-MM-DD)

**Referential Integrity:**
- **Frontend:** Deleting a habit manually removes related logs from state (line 476-478)
- **Backend:** Deleting a habit cascades to day logs (via `deleteDayLogsByHabit()` in route handler)
- **No cascade for categories:** Deleting a category does not delete associated habits (orphaned habits possible)

---

## Known Limitations

### 1. **Dual-Write Complexity**
- Current system writes to both MongoDB and localStorage when enabled
- This creates potential for data inconsistency if one write succeeds and the other fails
- localStorage is used as both fallback and dual-write target (confusing)

### 2. **No User Authentication**
- Currently uses placeholder `'anonymous-user'` for all operations
- No actual user identification or session management
- All users share the same data if using the same placeholder

### 3. **Single Device/Browser (localStorage)**
- localStorage data is device/browser-specific
- Cannot sync across devices without MongoDB
- Cannot access data from different browsers on the same device

### 4. **Data Loss Risks**
- Clearing browser data (cookies, localStorage) will delete all localStorage data
- Using incognito/private mode creates a separate data store
- Browser uninstall/reinstall may lose data
- No backup or export functionality (though data is JSON, so it could be manually extracted)

### 5. **Storage Size Limits**
- localStorage typically limited to 5-10MB per domain
- With many habits and long history, could approach limits
- No pagination or data archival strategy
- MongoDB has no such limits (scales to terabytes)

### 6. **No Data Validation**
- Frontend does minimal validation before writing to localStorage
- Backend has validation in route handlers, but frontend may bypass it if API fails
- No schema validation at database level

### 7. **Race Conditions**
- Multiple tabs/windows can cause race conditions with localStorage
- No locking mechanism for concurrent writes
- MongoDB handles concurrency better, but still no explicit locking

### 8. **Error Handling**
- API failures fall back to localStorage silently (with console warnings)
- User may not be aware that data is not syncing to MongoDB
- No retry mechanism for failed API calls

### 9. **Performance**
- All data loaded into memory at startup (no pagination)
- Large datasets could cause performance issues
- MongoDB queries are not optimized with indexes (should add indexes for `userId`, `compositeKey`, etc.)

### 10. **Migration Path**
- Current dual-write system is transitional
- Need clear migration plan to remove localStorage dependency
- Need data migration script to move existing localStorage data to MongoDB

---

## Data Shape Uncertainties

### ⚠️ Areas Requiring Clarification:

1. **Habit.pace field:**
   - Defined in type but explicitly marked as "NOT PERSISTED" in comments
   - Calculated on-the-fly using `getEstimatedCompletionDate()` utility
   - **Uncertainty:** Should this field be included in MongoDB schema? (Probably not, since it's calculated)

2. **Habit.description field:**
   - Defined in type but never used in UI
   - Not set when creating habits
   - **Uncertainty:** Should this field be removed or implemented? (Currently stored in MongoDB if provided)

3. **DailyWellbeing legacy fields:**
   - Top-level `depression`, `anxiety`, `energy`, `sleepScore`, `notes` are read-only
   - New data only written in `morning`/`evening` session format
   - **Uncertainty:** How long should legacy fields be preserved? When can they be removed?

4. **Category reordering:**
   - Current implementation deletes all categories and re-inserts (inefficient)
   - **Uncertainty:** Should we add an `order` field to Category model for more efficient reordering?

5. **User ID placeholder:**
   - Currently hardcoded as `'anonymous-user'`
   - **Uncertainty:** What will the actual user identification system look like? UUID? Email? Auth token?

6. **Composite keys:**
   - DayLogs use `${habitId}-${date}` as composite key
   - Stored in MongoDB as `compositeKey` field
   - **Uncertainty:** Should we use MongoDB compound indexes instead? (More efficient)

---

## Proposed Persistence Data Models

All persistent data models are explicitly defined in **`src/models/persistenceTypes.ts`**. This file serves as the single source of truth for data shapes used in both localStorage and MongoDB persistence.

### Core Entity Models

#### 1. `Category`
```typescript
export interface Category {
    id: string;        // UUID (application-level primary key)
    name: string;      // Display name
    color: string;    // Tailwind CSS class
}
```
- **Storage:** Array in localStorage, document array in MongoDB
- **Key/Collection:** `'categories'` (both)
- **Notes:** Application-level `id` is used, not MongoDB `_id`

#### 2. `Habit`
```typescript
export interface Habit {
    id: string;                    // UUID (application-level primary key)
    categoryId: string;            // Foreign key to Category.id
    name: string;
    description?: string;          // ⚠️ Defined but never used in UI
    goal: Goal;                    // Embedded Goal configuration
    archived: boolean;
    createdAt: string;            // ISO 8601 timestamp
    pace?: string | null;          // ⚠️ NOT PERSISTED - calculated on-the-fly
}
```
- **Storage:** Array in localStorage, document array in MongoDB
- **Key/Collection:** `'habits'` (both)
- **Embedded:** `Goal` interface (type, target, unit, frequency)
- **TODO Items:**
  - `description` field exists but is never set or displayed
  - `pace` field should NOT be stored in MongoDB (computed property)

#### 3. `DayLog`
```typescript
export interface DayLog {
    habitId: string;      // Foreign key to Habit.id
    date: string;         // YYYY-MM-DD format
    value: number;        // 0/1 for boolean, actual value for number
    completed: boolean;   // Whether goal was met
}
```
- **Storage:** Record with composite keys in localStorage, separate documents in MongoDB
- **Key/Collection:** `'logs'` (localStorage) / `'dayLogs'` (MongoDB)
- **Composite Key:** `${habitId}-${date}` (stored as `compositeKey` field in MongoDB)

#### 4. `DailyWellbeing`
```typescript
export interface DailyWellbeing {
    date: string;                    // YYYY-MM-DD format
    morning?: WellbeingSession;      // Optional morning check-in
    evening?: WellbeingSession;      // Optional evening check-in
    // Legacy fields (read-only):
    depression?: number;
    anxiety?: number;
    energy?: number;
    sleepScore?: number;
    notes?: string;
}
```
- **Storage:** Record keyed by date in localStorage, separate documents in MongoDB
- **Key/Collection:** `'wellbeingLogs'` (both)
- **Embedded:** `WellbeingSession` interface (depression, anxiety, energy, sleepScore, notes)
- **Legacy Fields:** Preserved for backward compatibility, not written to in new data

### Supporting Types

#### `Goal`
```typescript
export interface Goal {
    type: 'boolean' | 'number';
    target?: number;              // Required for 'number' type
    unit?: string;               // Display unit (e.g., 'glasses', 'hours')
    frequency: 'daily' | 'weekly' | 'total';
}
```
- **Storage:** Embedded within `Habit` entity
- **Notes:** `'total'` frequency means cumulative goal across all time

#### `WellbeingSession`
```typescript
export interface WellbeingSession {
    depression: number;    // 1-5 scale
    anxiety: number;       // 1-5 scale
    energy: number;        // 1-5 scale
    sleepScore: number;   // 0-100 scale
    notes?: string;
}
```
- **Storage:** Embedded within `DailyWellbeing` entity (morning/evening)

### Storage Structure Types

These types represent the exact format stored in localStorage:

```typescript
export type CategoriesStorage = Category[];
export type HabitsStorage = Habit[];
export type DayLogsStorage = Record<string, DayLog>;        // Key: `${habitId}-${date}`
export type WellbeingLogsStorage = Record<string, DailyWellbeing>;  // Key: YYYY-MM-DD
```

### Complete Schema

```typescript
export interface PersistenceSchema {
    categories: CategoriesStorage;
    habits: HabitsStorage;
    logs: DayLogsStorage;
    wellbeingLogs: WellbeingLogsStorage;
}
```

### MongoDB Document Structure Differences

**Important:** The interfaces above represent application-level data models. MongoDB documents include additional fields added at the repository layer:

1. **`_id`** - MongoDB auto-generated ObjectId (stripped before returning to application)
2. **`userId`** - User scoping (currently `'anonymous-user'` placeholder, stripped before returning)
3. **`compositeKey`** - For DayLogs only: `${habitId}-${date}` (for efficient querying, stripped before returning)

These fields are added when writing to MongoDB and removed when reading, so the application always works with the clean interfaces defined above.

### Constants

```typescript
// localStorage keys
export const STORAGE_KEYS = {
    CATEGORIES: 'categories',
    HABITS: 'habits',
    LOGS: 'logs',
    WELLBEING_LOGS: 'wellbeingLogs',
} as const;

// MongoDB collection names
export const MONGO_COLLECTIONS = {
    CATEGORIES: 'categories',
    HABITS: 'habits',
    DAY_LOGS: 'dayLogs',  // Note: Different from localStorage key
    WELLBEING_LOGS: 'wellbeingLogs',
} as const;
```

### Ambiguities and TODOs

The following items are marked with TODO comments in the code and require clarification:

1. **`Habit.pace`** - Field exists in type but is NOT persisted. Should be excluded from MongoDB schema.
2. **`Habit.description`** - Field exists but is never used in UI. Consider removing or implementing.
3. **`DailyWellbeing` legacy fields** - How long should these be preserved? When can they be deprecated?
4. **`Category.color`** - Type comment suggests hex codes might be used, but code always uses Tailwind classes. Verify consistency.

---

## Summary

**Current State:**
- ✅ Frontend: localStorage with 4 keys, well-structured data types
- ✅ Backend: MongoDB with 4 collections, REST API, repository pattern
- ✅ **Data Models: Explicit TypeScript interfaces in `src/models/persistenceTypes.ts`**
- ⚠️ Transitional: Dual-write system with localStorage fallback
- ⚠️ Incomplete: No authentication, placeholder user IDs

**Storage Locations:**
1. **Browser localStorage:** 4 keys (`categories`, `habits`, `logs`, `wellbeingLogs`)
2. **MongoDB:** 4 collections (`categories`, `habits`, `dayLogs`, `wellbeingLogs`)

**Data Model Source:**
- **File:** `src/models/persistenceTypes.ts`
- **Interfaces:** `Category`, `Habit`, `DayLog`, `DailyWellbeing`, `Goal`, `WellbeingSession`
- **Storage Types:** `CategoriesStorage`, `HabitsStorage`, `DayLogsStorage`, `WellbeingLogsStorage`
- **Schema:** `PersistenceSchema` (complete application state)

**Next Steps for Migration:**
1. Implement proper user authentication
2. Add data migration script (localStorage → MongoDB)
3. Remove dual-write complexity (choose single source of truth)
4. Add database indexes for performance
5. Implement proper error handling and retry logic
6. Add data validation at database level
7. Consider pagination for large datasets
8. **Resolve TODO items in data models** (pace, description, legacy fields)

---

**End of Audit**
