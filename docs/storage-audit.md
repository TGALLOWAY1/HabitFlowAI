# Storage Audit - HabitFlowAI

**Date:** 2025-01-27  
**Purpose:** Document all current persistence mechanisms before migrating to MongoDB

---

## Executive Summary

This application currently uses **browser localStorage exclusively** for all data persistence. There is **no backend storage** - this is a pure frontend React application. All data is stored client-side and will be lost if the user clears their browser data or uses a different device.

---

## Frontend Storage

### Storage Mechanism: Browser localStorage

**Location:** `src/store/HabitContext.tsx`

All storage operations are centralized in the `HabitProvider` component, which manages React state and synchronizes it with localStorage using `useEffect` hooks.

---

### Storage Keys and Data Structures

#### 1. `categories` (localStorage key: `'categories'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 73-90

**Data Shape:**
```typescript
Category[] // Array of Category objects

interface Category {
    id: string;              // UUID generated via crypto.randomUUID()
    name: string;            // Display name (e.g., "Physical Health")
    color: string;           // Tailwind CSS class (e.g., "bg-emerald-500")
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:** Line 74-75: `useState` lazy initializer reads from localStorage
- **Fallback:** If no saved data exists, uses `INITIAL_CATEGORIES` (8 predefined categories)

**Write Operations:**
- **When:** Whenever the `categories` state changes
- **Where:** Line 88-90: `useEffect` hook watches `categories` dependency
- **Triggered by:**
  - `addCategory()` - Adds new category (line 100-103)
  - `deleteCategory()` - Removes category (line 149-151)
  - `reorderCategories()` - Reorders category array (line 204-206)
  - `importHabits()` - May add new categories during import (line 153-202)

**Usage in UI:**
- **CategoryTabs.tsx:** Displays category pills, allows reordering via drag-and-drop, adding/deleting categories
- **ProgressDashboard.tsx:** Groups habits by category for display
- **App.tsx:** Filters habits by active category

**Initial Data:**
- 8 predefined categories stored in `INITIAL_CATEGORIES` constant (lines 34-43)
- Also available in `src/data/predefinedHabits.ts` as `PREDEFINED_CATEGORIES`

---

#### 2. `habits` (localStorage key: `'habits'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 78-94

**Data Shape:**
```typescript
Habit[] // Array of Habit objects

interface Habit {
    id: string;                    // UUID generated via crypto.randomUUID()
    categoryId: string;            // References Category.id
    name: string;                  // Display name (e.g., "Morning Jog")
    description?: string;          // Optional description
    goal: Goal;                    // Goal configuration
    archived: boolean;             // Whether habit is archived (default: false)
    createdAt: string;             // ISO 8601 timestamp
    pace?: string | null;          // Estimated completion date (optional)
}

interface Goal {
    type: 'boolean' | 'number';    // Track completion or numeric value
    target?: number;               // Target value (e.g., 8 for "8 glasses")
    unit?: string;                 // Unit label (e.g., "glasses", "hours")
    frequency: 'daily' | 'weekly' | 'total'; // Tracking frequency
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:** Line 79-80: `useState` lazy initializer reads from localStorage
- **Fallback:** If no saved data exists, uses `INITIAL_HABITS` (3 demo habits)

**Write Operations:**
- **When:** Whenever the `habits` state changes
- **Where:** Line 92-94: `useEffect` hook watches `habits` dependency
- **Triggered by:**
  - `addHabit()` - Adds new habit (line 105-113)
  - `deleteHabit()` - Removes habit (line 145-147)
  - `importHabits()` - Bulk imports habits from predefined list (line 153-202)

**Usage in UI:**
- **TrackerGrid.tsx:** Main habit tracking interface, displays habits in a grid with date columns
- **ProgressDashboard.tsx:** Shows habit statistics, consistency scores, streaks
- **ProgressRings.tsx:** Calculates daily completion percentage
- **Heatmap.tsx:** Visualizes habit completion over time
- **AccomplishmentsLog.tsx:** Displays milestones and streaks
- **AddHabitModal.tsx:** Form to create new habits
- **App.tsx:** Filters habits by category

**Initial Data:**
- 3 demo habits stored in `INITIAL_HABITS` constant (lines 45-70)
- 92 predefined habits available in `src/data/predefinedHabits.ts` as `PREDEFINED_HABITS` (importable via CategoryTabs)

---

#### 3. `logs` (localStorage key: `'logs'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 83-98

**Data Shape:**
```typescript
Record<string, DayLog> // Object with composite keys

// Key format: `${habitId}-${date}` (e.g., "abc123-2025-01-27")
// Value:
interface DayLog {
    habitId: string;      // References Habit.id
    date: string;         // ISO date string (YYYY-MM-DD format)
    value: number;        // 0 or 1 for boolean habits, actual value for numeric habits
    completed: boolean;   // Whether the goal was met (value >= target for numeric, value > 0 for boolean)
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:** Line 84-85: `useState` lazy initializer reads from localStorage
- **Fallback:** If no saved data exists, uses empty object `{}`

**Write Operations:**
- **When:** Whenever the `logs` state changes
- **Where:** Line 96-98: `useEffect` hook watches `logs` dependency
- **Triggered by:**
  - `toggleHabit()` - Toggles boolean habit completion (line 115-130)
  - `updateLog()` - Updates numeric habit value (line 132-143)

**Usage in UI:**
- **TrackerGrid.tsx:** Displays checkmarks/values for each habit-date combination
- **ProgressDashboard.tsx:** Calculates statistics (streaks, consistency, totals)
- **ProgressRings.tsx:** Calculates daily completion rate
- **Heatmap.tsx:** Aggregates completion data for visualization
- **AccomplishmentsLog.tsx:** Identifies milestone achievements
- **Analytics utilities:** `src/utils/analytics.ts` - `calculateHabitStats()` function
- **Pace utilities:** `src/utils/pace.ts` - `getEstimatedCompletionDate()` function

**Key Generation:**
- Composite key: `${habitId}-${date}` ensures unique log entries per habit per day
- Date format: `YYYY-MM-DD` (e.g., "2025-01-27")
- Generated using `date-fns` `format()` function throughout the codebase

---

#### 4. `wellbeingLogs` (localStorage key: `'wellbeingLogs'`)

**File:** `src/store/HabitContext.tsx`  
**Lines:** 208-215

**Data Shape:**
```typescript
Record<string, DailyWellbeing> // Object keyed by date string

// Key: ISO date string (YYYY-MM-DD format)
// Value:
interface DailyWellbeing {
    date: string;                    // ISO date string (YYYY-MM-DD)
    morning?: WellbeingSession;       // Optional morning check-in
    evening?: WellbeingSession;       // Optional evening check-in
    // Legacy fields (for backward compatibility):
    depression?: number;             // 1-5 scale
    anxiety?: number;                // 1-5 scale
    energy?: number;                 // 1-5 scale
    sleepScore?: number;             // 0-100 scale
    notes?: string;                  // Free text notes
}

interface WellbeingSession {
    depression: number;    // 1-5 scale
    anxiety: number;       // 1-5 scale
    energy: number;        // 1-5 scale
    sleepScore: number;    // 0-100 scale
    notes?: string;       // Optional notes
}
```

**Read Operations:**
- **When:** On component mount (initial state initialization)
- **Where:** Line 209-210: `useState` lazy initializer reads from localStorage
- **Fallback:** If no saved data exists, uses empty object `{}`

**Write Operations:**
- **When:** Whenever the `wellbeingLogs` state changes
- **Where:** Line 213-215: `useEffect` hook watches `wellbeingLogs` dependency
- **Triggered by:**
  - `logWellbeing()` - Saves wellbeing check-in data (line 217-231)
  - Performs deep merge to preserve both morning and evening sessions

**Usage in UI:**
- **DailyCheckInModal.tsx:** Form to input morning/evening wellbeing data
- **ProgressRings.tsx:** Displays current wellbeing metrics and 7-day trends
- **ProgressDashboard.tsx:** Contains button to open DailyCheckInModal

**Data Merging Logic:**
- The `logWellbeing()` function performs a deep merge (line 217-231)
- Preserves existing morning/evening sessions when updating the other
- Legacy top-level fields are maintained for backward compatibility
- Priority order for reading: `evening` → `morning` → legacy top-level (see ProgressRings.tsx line 27-34)

---

## Backend Storage

**Status:** None found

**Searched Locations:**
- `src/server/` - Does not exist
- `backend/` - Does not exist
- `server/` - Does not exist

**Conclusion:** This is a pure frontend application with no backend API or server-side storage.

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

2. **Persistence Flow**
   - Each state variable has a corresponding `useEffect` that watches for changes
   - On any state change, the effect immediately writes to localStorage via `localStorage.setItem()`
   - Data is serialized as JSON using `JSON.stringify()`

### Write Triggers

| State | Write Triggers |
|-------|----------------|
| `categories` | `addCategory()`, `deleteCategory()`, `reorderCategories()`, `importHabits()` |
| `habits` | `addHabit()`, `deleteHabit()`, `importHabits()` |
| `logs` | `toggleHabit()`, `updateLog()` |
| `wellbeingLogs` | `logWellbeing()` |

### Read Triggers

- **Initial load:** Component mount (once per app session)
- **Runtime:** All reads are from React state (not directly from localStorage)
- **No lazy loading:** All data is loaded into memory at startup

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

**No referential integrity:** Deletion of a category or habit does not cascade delete related logs. This could lead to orphaned data.

---

## Known Limitations

### 1. **Single Device/Browser**
- Data is stored only in the user's browser
- Cannot sync across devices
- Cannot access data from different browsers on the same device

### 2. **No User Accounts**
- All data is anonymous and local
- No authentication or user identification
- Cannot share data or collaborate

### 3. **Data Loss Risks**
- Clearing browser data (cookies, localStorage) will delete all data
- Using incognito/private mode creates a separate data store
- Browser uninstall/reinstall may lose data
- No backup or export functionality (though data is JSON, so it could be manually extracted)

### 4. **Storage Size Limits**
- localStorage typically limited to 5-10MB per domain
- With many habits and long history, could approach limits
- No pagination or data archival strategy

### 5. **No Data Validation**
- No schema validation on read/write
- Corrupted JSON could break the app
- No migration strategy for schema changes

### 6. **No Offline Conflict Resolution**
- Not applicable (no sync), but worth noting for future

### 7. **Performance Considerations**
- All data loaded into memory at startup
- Large log histories could impact initial load time
- No lazy loading or pagination

### 8. **Orphaned Data**
- Deleting a habit does not delete its logs
- Deleting a category does not delete its habits or logs
- Could lead to inconsistent state

---

## Migration Considerations

### Data to Migrate

1. **Categories Collection**
   - Fields: `id`, `name`, `color`
   - Index: `id` (primary), consider `name` for uniqueness

2. **Habits Collection**
   - Fields: `id`, `categoryId`, `name`, `goal`, `archived`, `createdAt`
   - **Note:** `description` field exists in type but is never used - can be omitted
   - **Note:** `pace` is calculated on-the-fly, not stored - do not migrate
   - Index: `id` (primary), `categoryId` (foreign key), `archived` (for filtering)

3. **DayLogs Collection**
   - Fields: `habitId`, `date`, `value`, `completed`
   - Index: Composite `(habitId, date)` (unique), `date` (for date range queries), `habitId` (foreign key)
   - **Note:** Current composite key `${habitId}-${date}` should become a compound index

4. **WellbeingLogs Collection**
   - Fields: `date` (primary), `morning`, `evening`, legacy fields (for backward compatibility)
   - Index: `date` (primary, unique)
   - **Note:** Legacy top-level fields (`depression`, `anxiety`, etc.) are read-only for backward compatibility

### Fields NOT Stored (Computed On-The-Fly)

- **`Habit.pace`**: Calculated dynamically using `getEstimatedCompletionDate()` utility. Not persisted.
- **`Habit.description`**: Defined in type but never used. Can be omitted from migration.

### Schema Design Recommendations

- Use MongoDB `_id` for primary keys (can map existing UUIDs or generate new ObjectIds)
- Add `userId` field to all collections for multi-user support
- Add `createdAt` and `updatedAt` timestamps to all collections
- Consider embedding `DayLog` documents in `Habit` documents (denormalization) for better query performance
- Or keep separate collections with proper indexes for flexibility

### Data Migration Strategy

1. **Export existing localStorage data** (if users have data)
2. **Parse JSON and validate structure**
3. **Transform to MongoDB documents**
4. **Handle orphaned logs** (decide: delete or keep with null reference)
5. **Migrate legacy wellbeing format** (top-level fields → morning/evening sessions)

---

## Proposed Persistence Data Models

**Location:** `src/models/persistenceTypes.ts`

Explicit TypeScript interfaces have been extracted for all persistent entities. These models represent the exact shape of data as stored in localStorage and will be used as the basis for MongoDB schema design.

### Entity Models

#### 1. `Category`
```typescript
export interface Category {
    id: string;              // UUID generated via crypto.randomUUID()
    name: string;            // Display name
    color: string;           // Tailwind CSS class (e.g., "bg-emerald-500")
}
```
- **Storage:** Array of Category objects
- **Storage Key:** `'categories'`
- **Notes:** No ambiguities or inconsistencies found

#### 2. `Habit`
```typescript
export interface Habit {
    id: string;                    // UUID
    categoryId: string;            // Foreign key to Category.id
    name: string;
    description?: string;          // ⚠️ Defined but never used
    goal: Goal;                    // Goal configuration
    archived: boolean;
    createdAt: string;             // ISO 8601 timestamp
    pace?: string | null;          // ⚠️ Calculated on-the-fly, NOT persisted
}

export interface Goal {
    type: 'boolean' | 'number';
    target?: number;
    unit?: string;
    frequency: 'daily' | 'weekly' | 'total';
}
```
- **Storage:** Array of Habit objects
- **Storage Key:** `'habits'`
- **Notes:** 
  - `description` field exists but is never used in UI or set when creating habits
  - `pace` field is calculated dynamically, not stored

#### 3. `DayLog`
```typescript
export interface DayLog {
    habitId: string;      // Foreign key to Habit.id
    date: string;         // YYYY-MM-DD format
    value: number;         // 0 or 1 for boolean, actual value for number
    completed: boolean;   // Whether goal was met
}
```
- **Storage:** Record<string, DayLog> with composite keys
- **Storage Key:** `'logs'`
- **Composite Key Format:** `${habitId}-${date}` (e.g., "abc123-2025-01-27")
- **Notes:** No ambiguities found

#### 4. `DailyWellbeing`
```typescript
export interface DailyWellbeing {
    date: string;                    // YYYY-MM-DD format
    morning?: WellbeingSession;      // Optional morning check-in
    evening?: WellbeingSession;      // Optional evening check-in
    // Legacy fields (read-only for backward compatibility):
    depression?: number;
    anxiety?: number;
    energy?: number;
    sleepScore?: number;
    notes?: string;
}

export interface WellbeingSession {
    depression: number;    // 1-5 scale
    anxiety: number;       // 1-5 scale
    energy: number;        // 1-5 scale
    sleepScore: number;    // 0-100 scale
    notes?: string;
}
```
- **Storage:** Record<string, DailyWellbeing> keyed by date
- **Storage Key:** `'wellbeingLogs'`
- **Key Format:** YYYY-MM-DD (same as DayLog.date)
- **Notes:** 
  - Legacy top-level fields are read-only for backward compatibility
  - New data is only written in `morning`/`evening` session format
  - Reading priority: `evening` → `morning` → legacy top-level

### Storage Structure Types

The file also defines storage structure types that match the exact localStorage format:

```typescript
export type CategoriesStorage = Category[];
export type HabitsStorage = Habit[];
export type DayLogsStorage = Record<string, DayLog>;
export type WellbeingLogsStorage = Record<string, DailyWellbeing>;
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

### Storage Keys

Constants are defined for localStorage keys:

```typescript
export const STORAGE_KEYS = {
    CATEGORIES: 'categories',
    HABITS: 'habits',
    LOGS: 'logs',
    WELLBEING_LOGS: 'wellbeingLogs',
} as const;
```

### Migration Notes

- **Fields to exclude from MongoDB:**
  - `Habit.pace` - Calculated on-the-fly, not persisted
  - `Habit.description` - Never used, can be omitted (or kept for future use)

- **Fields to handle carefully:**
  - `DailyWellbeing` legacy fields - Read-only, should be migrated but can be deprecated after migration
  - Composite keys in `DayLogsStorage` - Should become compound indexes in MongoDB

- **Foreign key relationships:**
  - `Habit.categoryId` → `Category.id`
  - `DayLog.habitId` → `Habit.id`
  - No referential integrity currently enforced (orphaned data possible)

---

## Files Referenced

### Core Storage
- `src/store/HabitContext.tsx` - **Primary storage implementation**

### Type Definitions
- `src/types/index.ts` - All TypeScript interfaces (original definitions)
- `src/models/persistenceTypes.ts` - **Explicit persistence data models** (extracted for migration)

### Data Files
- `src/data/predefinedHabits.ts` - Initial/default data (not storage, but data source)

### Components Using Storage
- `src/App.tsx` - Main app, uses HabitProvider
- `src/components/TrackerGrid.tsx` - Reads/writes logs
- `src/components/ProgressDashboard.tsx` - Reads all data
- `src/components/ProgressRings.tsx` - Reads habits, logs, wellbeingLogs
- `src/components/Heatmap.tsx` - Reads habits, logs
- `src/components/AccomplishmentsLog.tsx` - Reads habits, logs
- `src/components/DailyCheckInModal.tsx` - Reads/writes wellbeingLogs
- `src/components/AddHabitModal.tsx` - Writes habits
- `src/components/CategoryTabs.tsx` - Reads/writes categories, imports habits

### Utilities
- `src/utils/analytics.ts` - Reads logs for statistics
- `src/utils/pace.ts` - Reads logs for completion estimates

---

## Uncertainties and Questions

### ⚠️ Data Shape Uncertainties

1. **WellbeingLogs Legacy Fields:**
   - **Question:** Are legacy top-level fields (`depression`, `anxiety`, etc.) still being written, or only read for backward compatibility?
   - **Location:** `DailyCheckInModal.tsx` only writes `morning`/`evening` sessions
   - **Impact:** Need to verify if old data format is still being created
   - **Status:** ✅ **RESOLVED** - Legacy fields are only read for backward compatibility, not written

2. **Pace Field:**
   - **Question:** Where is `Habit.pace` field written? It's defined in the type but not seen being set in HabitContext.
   - **Location:** Type definition exists, but no setter found
   - **Impact:** May be calculated on-the-fly or set elsewhere (need to search)
   - **Status:** ✅ **RESOLVED** - `pace` is **calculated on-the-fly**, not stored. It's computed in `ProgressDashboard.tsx` using `getEstimatedCompletionDate()` from `src/utils/pace.ts`. The field in the type is likely for display purposes only, not persistence.

3. **Habit Description:**
   - **Question:** Is `Habit.description` field used? Not seen in any components.
   - **Location:** Type definition exists, but no UI found
   - **Impact:** May be unused field or future feature
   - **Status:** ✅ **RESOLVED** - `description` is **not used** anywhere. It's defined in the type but:
     - Not in `AddHabitModal.tsx` form
     - Not displayed in any component
     - Not set when creating habits
     - **Recommendation:** Can be safely ignored for migration or removed from schema

### ⚠️ Lifecycle Uncertainties

1. **Import Habits Behavior:**
   - **Question:** Does `importHabits()` merge with existing habits or replace them?
   - **Location:** `HabitContext.tsx` line 153-202
   - **Analysis:** Code shows it checks for duplicates by name+categoryId, so it merges
   - **Clarification Needed:** What happens if a habit with same name exists in different category?

2. **Category Deletion Cascade:**
   - **Question:** What happens to habits when a category is deleted?
   - **Location:** `deleteCategory()` only removes category, doesn't touch habits
   - **Impact:** Orphaned habits with invalid `categoryId` references

3. **Habit Deletion Cascade:**
   - **Question:** What happens to logs when a habit is deleted?
   - **Location:** `deleteHabit()` only removes habit, doesn't touch logs
   - **Impact:** Orphaned logs with invalid `habitId` references

4. **Initial Data Overwrite:**
   - **Question:** If user has saved data, does initial data ever get used?
   - **Answer:** No - initial data is only fallback when localStorage is empty
   - **Clarification:** This is correct behavior, but worth documenting

---

## Summary

This application uses **4 localStorage keys** to persist all application data:
1. `categories` - User-defined habit categories
2. `habits` - User's habit definitions
3. `logs` - Daily habit completion records
4. `wellbeingLogs` - Daily wellbeing check-in data

All storage is **client-side only** with no backend. The storage mechanism is straightforward: React state synchronized with localStorage via `useEffect` hooks. The data structures are well-typed with TypeScript interfaces.

**Key migration challenges:**
- Need to add user authentication/identification
- Need to handle data relationships (foreign keys)
- Need to decide on orphaned data cleanup strategy
- Need to migrate legacy wellbeing data format
- Need to add data validation and error handling

