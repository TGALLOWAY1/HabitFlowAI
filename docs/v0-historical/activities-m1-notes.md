> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# Activities M1 - Backend Schema & DB Audit Notes

**Date:** 2025-01-27  
**Purpose:** Audit existing habit-related models and MongoDB persistence patterns to guide Activity implementation

---

## Current Habit Models

### File Locations

**Primary Type Definition:**
- `src/models/persistenceTypes.ts` (lines 78-121)
  - This is the **authoritative** definition for MongoDB persistence
  - Includes detailed JSDoc comments about field usage and storage behavior
  - Part of the `PersistenceSchema` interface

**Frontend Type Definition:**
- `src/types/index.ts` (lines 34-43)
  - Simplified version used in frontend components
  - Less detailed than persistenceTypes but functionally equivalent

**Usage:**
- `src/store/HabitContext.tsx` - React context for habit state management
- `src/components/AddHabitModal.tsx` - Habit creation UI
- `src/server/repositories/habitRepository.ts` - MongoDB repository layer
- `src/server/routes/habits.ts` - REST API routes

### Habit Interface Structure

```typescript
interface Habit {
    id: string;                    // UUID (application-level PK, not MongoDB _id)
    categoryId: string;            // FK to Category.id
    name: string;                  // Display name
    description?: string;          // Optional (defined but rarely used in UI)
    goal: Goal;                    // Embedded Goal configuration
    archived: boolean;             // Hidden from active tracking
    createdAt: string;             // ISO 8601 timestamp
    pace?: string | null;          // ⚠️ NOT persisted to MongoDB (computed field)
}
```

### Goal Configuration (Embedded)

```typescript
interface Goal {
    type: 'boolean' | 'number';
    target?: number;               // Required for 'number', optional for 'boolean'
    unit?: string;                 // Display unit (e.g., 'glasses', 'hours')
    frequency: 'daily' | 'weekly' | 'total';  // Tracking frequency
}
```

### Key Fields Summary

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string (UUID) | Yes | Application-level PK, generated via `randomUUID()` |
| `categoryId` | string | Yes | Foreign key to Category |
| `name` | string | Yes | Display name |
| `description` | string? | No | Defined but rarely used in UI |
| `goal` | Goal | Yes | Embedded goal configuration |
| `archived` | boolean | Yes | Default: `false` |
| `createdAt` | string (ISO 8601) | Yes | Generated on creation |
| `pace` | string? | No | **NOT persisted** - computed field only |

---

## Current HabitCompletion Model

**Note:** There is no separate "HabitCompletion" model. Completion data is stored in the **DayLog** entity.

### File Locations

**Primary Type Definition:**
- `src/models/persistenceTypes.ts` (lines 134-163)
  - Authoritative definition with detailed documentation

**Frontend Type Definition:**
- `src/types/index.ts` (lines 45-50)
  - Simplified version

**Usage:**
- `src/server/repositories/dayLogRepository.ts` - MongoDB repository layer
- `src/server/routes/dayLogs.ts` - REST API routes
- `src/store/HabitContext.tsx` - State management for tracking

### DayLog Interface Structure

```typescript
interface DayLog {
    habitId: string;               // FK to Habit.id
    date: string;                  // YYYY-MM-DD format
    value: number;                 // 0/1 for boolean, actual value for number
    completed: boolean;            // Whether goal was met (calculated)
}
```

### Key Fields Summary

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `habitId` | string | Yes | Foreign key to Habit.id |
| `date` | string (YYYY-MM-DD) | Yes | ISO date string |
| `value` | number | Yes | 0/1 for boolean habits, actual value for number habits |
| `completed` | boolean | Yes | Calculated: `value > 0` for boolean, `value >= goal.target` for number |

### Composite Key Pattern

- **Application Key Format:** `${habitId}-${date}` (e.g., `"abc123-2025-01-27"`)
- **MongoDB Storage:** Stored as `compositeKey` field for efficient querying
- **Storage Format:** `Record<string, DayLog>` in frontend, array of documents in MongoDB

### Completion Logic

The `completed` field is calculated when the log is created/updated:
- **Boolean habits:** `completed = value > 0`
- **Number habits:** `completed = value >= goal.target`

Logic is in `HabitContext.tsx` (lines 446, 412).

---

## Mongo / Persistence Layout

### MongoDB Connection

**File:** `src/server/lib/mongoClient.ts`

**Pattern:** Singleton connection pattern
- `getDb(): Promise<Db>` - Get database instance (reuses connection)
- Connection pooling: max 10, min 1 connections
- Automatic reconnection on connection loss
- Health check via `ping()` before returning

**Environment Variables:**
- `MONGODB_URI` - Connection string
- `MONGODB_DB_NAME` - Database name

**Config File:** `src/server/config/env.ts`
- Loads `.env` file
- Provides `getMongoDbUri()` and `getMongoDbName()` functions

### Collection Access Pattern

**Pattern Used:** **Repository Layer** (not direct `db.collection()` calls)

All MongoDB access goes through repository classes in `src/server/repositories/`:

1. **Repository Pattern:**
   - Each entity has its own repository file
   - Repositories handle MongoDB document structure (add/remove `_id`, `userId`, `compositeKey`)
   - Application code receives clean entity objects without MongoDB internals

2. **Collection Names:**
   - Defined in `src/models/persistenceTypes.ts` (lines 300-305):
     ```typescript
     export const MONGO_COLLECTIONS = {
         CATEGORIES: 'categories',
         HABITS: 'habits',
         DAY_LOGS: 'dayLogs',
         WELLBEING_LOGS: 'wellbeingLogs',
     } as const;
     ```
   - Also hardcoded in repository files (e.g., `const COLLECTION_NAME = 'habits'`)

3. **User Scoping:**
   - All queries include `userId` filter
   - Currently using placeholder: `'anonymous-user'`
   - TODO: Extract from authentication token/session

### Habit Repository Pattern

**File:** `src/server/repositories/habitRepository.ts`

**Collection:** `'habits'`

**Functions:**
- `createHabit(data, userId): Promise<Habit>`
- `getHabitsByUser(userId): Promise<Habit[]>`
- `getHabitsByCategory(categoryId, userId): Promise<Habit[]>`
- `getHabitById(id, userId): Promise<Habit | null>`
- `updateHabit(id, userId, patch): Promise<Habit | null>`
- `deleteHabit(id, userId): Promise<boolean>`

**MongoDB Document Structure:**
```typescript
{
    _id: ObjectId,              // MongoDB internal ID (stripped before return)
    id: string,                 // Application-level UUID
    categoryId: string,
    name: string,
    description?: string,
    goal: Goal,
    archived: boolean,
    createdAt: string,
    userId: string              // Added at repository layer (stripped before return)
}
```

**Key Pattern:**
- Repository adds `userId` when inserting
- Repository strips `_id` and `userId` when returning to application
- Application never sees MongoDB internals

### DayLog Repository Pattern

**File:** `src/server/repositories/dayLogRepository.ts`

**Collection:** `'dayLogs'`

**Functions:**
- `upsertDayLog(log, userId): Promise<DayLog>`
- `getDayLogsByUser(userId): Promise<Record<string, DayLog>>`
- `getDayLogsByHabit(habitId, userId): Promise<Record<string, DayLog>>`
- `getDayLog(habitId, date, userId): Promise<DayLog | null>`
- `deleteDayLog(habitId, date, userId): Promise<boolean>`
- `deleteDayLogsByHabit(habitId, userId): Promise<number>` (cascade delete)

**MongoDB Document Structure:**
```typescript
{
    _id: ObjectId,              // MongoDB internal ID (stripped before return)
    habitId: string,
    date: string,               // YYYY-MM-DD
    value: number,
    completed: boolean,
    compositeKey: string,       // `${habitId}-${date}` (added at repository layer)
    userId: string              // Added at repository layer (stripped before return)
}
```

**Key Pattern:**
- Uses `compositeKey` field for efficient querying
- Upsert pattern: `updateOne(..., { upsert: true })`
- Returns `Record<string, DayLog>` keyed by composite key
- Cascade delete when habit is deleted

### REST API Routes

**Pattern:** Route handlers call repository functions

**Habit Routes:** `src/server/routes/habits.ts`
- `GET /api/habits` - Get all habits (optional `?categoryId=xxx` filter)
- `POST /api/habits` - Create habit
- `GET /api/habits/:id` - Get single habit
- `PATCH /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit (cascades to dayLogs)

**DayLog Routes:** `src/server/routes/dayLogs.ts`
- `GET /api/dayLogs` - Get all logs (optional `?habitId=xxx` filter)
- `POST /api/dayLogs` - Upsert log
- `GET /api/dayLogs/:habitId/:date` - Get single log
- `DELETE /api/dayLogs/:habitId/:date` - Delete log

**Route Pattern:**
1. Extract `userId` from request (currently placeholder: `'anonymous-user'`)
2. Validate request body/params
3. Call repository function
4. Return JSON response with entity or error

### Frontend Persistence Client

**File:** `src/lib/persistenceClient.ts`

**Pattern:** HTTP client that calls REST API

**Functions:**
- `fetchHabits(): Promise<Habit[]>`
- `saveHabit(habit): Promise<Habit>`
- `updateHabit(id, patch): Promise<Habit>`
- `deleteHabit(id): Promise<void>`
- `fetchDayLogs(): Promise<Record<string, DayLog>>`
- `saveDayLog(log): Promise<DayLog>`
- `deleteDayLog(habitId, date): Promise<void>`

**Base URL:** Configured in `src/lib/persistenceConfig.ts`

---

## Summary: Pattern to Mirror for Activities

### 1. **Type Definitions**
- Define Activity interface in `src/models/persistenceTypes.ts` (authoritative)
- Optionally define simplified version in `src/types/index.ts` (if needed)
- Add to `PersistenceSchema` interface
- Add collection name to `MONGO_COLLECTIONS` constant

### 2. **Repository Layer**
- Create `src/server/repositories/activityRepository.ts`
- Follow same pattern as `habitRepository.ts`:
  - Use `getDb()` from `mongoClient.ts`
  - Add `userId` when inserting
  - Strip `_id` and `userId` when returning
  - Implement CRUD functions with user scoping

### 3. **REST API Routes**
- Create `src/server/routes/activities.ts`
- Follow same pattern as `habits.ts`:
  - Extract `userId` from request
  - Validate request body/params
  - Call repository functions
  - Return JSON responses

### 4. **Frontend Client**
- Add functions to `src/lib/persistenceClient.ts`
- Follow same HTTP client pattern
- Update `HabitContext.tsx` or create `ActivityContext.tsx` as needed

### 5. **MongoDB Document Structure**
- Store application-level `id` (UUID) as primary key
- Add `userId` for multi-user scoping
- Add `_id` automatically by MongoDB (strip before return)
- Use composite keys if needed (like DayLog's `compositeKey`)

### 6. **Collection Naming**
- Use camelCase: `'activities'` (matches `'dayLogs'`, `'wellbeingLogs'`)
- Add to `MONGO_COLLECTIONS` constant
- Use constant in repository file

---

## Files Reference

### Core Model Files
- `src/models/persistenceTypes.ts` - Authoritative type definitions
- `src/types/index.ts` - Frontend type definitions

### Repository Files
- `src/server/repositories/habitRepository.ts` - Habit CRUD
- `src/server/repositories/dayLogRepository.ts` - DayLog CRUD
- `src/server/repositories/categoryRepository.ts` - Category CRUD (reference)
- `src/server/repositories/wellbeingLogRepository.ts` - Wellbeing CRUD (reference)

### Route Files
- `src/server/routes/habits.ts` - Habit REST API
- `src/server/routes/dayLogs.ts` - DayLog REST API

### Infrastructure Files
- `src/server/lib/mongoClient.ts` - MongoDB connection singleton
- `src/server/config/env.ts` - Environment variable loading
- `src/server/config/index.ts` - Feature flags and config

### Frontend Files
- `src/lib/persistenceClient.ts` - HTTP client for REST API
- `src/lib/persistenceConfig.ts` - API base URL config
- `src/store/HabitContext.tsx` - React context for state management

---

## Notes for Activity Implementation

1. **No HabitCompletion Model:** Use DayLog pattern - Activity completions should be stored in a similar completion/log entity (e.g., `ActivityLog` or `ActivityCompletion`)

2. **Repository Pattern is Standard:** All MongoDB access goes through repositories, not direct collection calls

3. **User Scoping:** All queries must include `userId` filter (currently placeholder, but structure is ready for auth)

4. **Composite Keys:** If Activity completions need date-based queries, consider using composite key pattern like DayLog

5. **Cascade Deletes:** When deleting an Activity, consider if related completion logs should be deleted (like habits → dayLogs)

6. **Type Safety:** Use TypeScript interfaces from `persistenceTypes.ts` for type safety across the stack
