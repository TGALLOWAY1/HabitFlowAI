> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# MongoDB Architecture Plan - HabitFlowAI

**Date:** 2025-01-27  
**Purpose:** Design MongoDB-backed persistence architecture and REST API

---

## MongoDB Client Configuration

### Environment Variables

The MongoDB client requires two environment variables:

- **`MONGODB_URI`** - MongoDB connection string
- **`MONGODB_DB_NAME`** - Name of the database to use

### Local Configuration

1. **Create a `.env` file** in the project root (copy from `.env.example` if available):
   ```bash
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=habitflowai
   ```

2. **For local MongoDB:**
   ```env
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=habitflowai
   ```

3. **For MongoDB Atlas (cloud):**
   ```env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   MONGODB_DB_NAME=habitflowai
   ```

4. **For MongoDB with authentication:**
   ```env
   MONGODB_URI=mongodb://username:password@localhost:27017
   MONGODB_DB_NAME=habitflowai
   ```

### Connection Lifecycle

The MongoDB client uses a **singleton pattern** to manage connections:

1. **Initial Connection:**
   - On first call to `getDb()`, a new `MongoClient` is created
   - Connection is tested with `ping()` to verify it's working
   - Connection is stored in a singleton variable for reuse

2. **Connection Reuse:**
   - Subsequent calls to `getDb()` reuse the existing connection
   - Connection health is verified with `ping()` before returning
   - If connection is dead, it automatically reconnects

3. **Error Handling:**
   - If `MONGODB_URI` or `MONGODB_DB_NAME` are missing, throws clear error
   - If connection fails, throws descriptive error with troubleshooting hints
   - Connection errors are logged to console for debugging

4. **Connection Pooling:**
   - Uses MongoDB connection pooling (max 10, min 1 connections)
   - Connections are reused across requests for efficiency
   - Automatic retry for reads and writes

5. **Graceful Shutdown:**
   - Call `closeConnection()` during application shutdown
   - Closes all connections and cleans up resources

### Usage

```typescript
import { getDb } from './server/lib/mongoClient';

// Get database instance (connects automatically if needed)
const db = await getDb();

// Use database
const collection = db.collection('categories');
const categories = await collection.find({}).toArray();
```

### File Structure

- **`src/server/lib/mongoClient.ts`** - MongoDB client utility with singleton pattern
- **`src/server/config/env.ts`** - Environment variable loading and validation
- **`.env`** - Environment variables (not committed to git)
- **`.env.example`** - Example environment variables (committed to git)

### Troubleshooting

**Connection fails:**
- Verify MongoDB is running: `mongosh` or check MongoDB service
- Verify `MONGODB_URI` is correct (check for typos, correct port)
- For MongoDB Atlas: verify network access and credentials
- Check firewall settings if connecting remotely

**Environment variables not loading:**
- Ensure `.env` file is in project root
- Verify `dotenv` is configured correctly
- Check that `src/server/config/env.ts` is imported before using MongoDB client

**Connection timeout:**
- Increase `connectTimeoutMS` in `mongoClient.ts` if needed
- Check network connectivity to MongoDB server
- Verify MongoDB server is accessible from your network

---

## Implementation Status

### ✅ Completed

- **MongoDB Client Setup** - Singleton connection with error handling
- **Category Repository** - Full CRUD operations with feature flag support
- **Category Routes** - REST API endpoints implemented:
  - `GET /api/categories` - Get all categories
  - `POST /api/categories` - Create category
  - `GET /api/categories/:id` - Get single category
  - `PATCH /api/categories/:id` - Update category
  - `DELETE /api/categories/:id` - Delete category
  - `PATCH /api/categories/reorder` - Reorder categories

### 🚧 In Progress / Pending

- **Frontend Integration** - Routes are implemented but **not yet used by the frontend UI**
- **Authentication** - User ID is currently hardcoded as placeholder; needs auth middleware
- **Other Repositories** - Habits, DayLogs, and WellbeingLogs repositories not yet implemented
- **Other Routes** - Habits, DayLogs, and WellbeingLogs routes not yet implemented

### 📝 Notes

- All routes respect the `USE_MONGO_PERSISTENCE` feature flag
- When flag is `false`, routes return `501 Not Implemented` with clear error message
- Routes include input validation and error handling
- Test coverage includes happy paths and feature flag disabled scenarios

---

## Frontend Persistence Client

### Overview

The frontend includes a persistence client (`src/lib/persistenceClient.ts`) that provides a safe wrapper for communicating with the MongoDB-backed REST API. The client uses a feature flag to determine whether to use the API or continue with localStorage.

### Feature Flag: `VITE_USE_MONGO_PERSISTENCE`

The frontend uses the `VITE_USE_MONGO_PERSISTENCE` environment variable to control persistence behavior:

- **`false` (default)** - Uses localStorage (existing behavior)
- **`true`** - Uses REST API endpoints (MongoDB-backed)

**Configuration:**
```env
# In .env file
VITE_USE_MONGO_PERSISTENCE=false  # Use localStorage (default)
VITE_USE_MONGO_PERSISTENCE=true   # Use MongoDB API
```

### How It Works

1. **Feature Flag Check:**
   - The client checks `VITE_USE_MONGO_PERSISTENCE` at runtime
   - If `false`, functions throw errors indicating localStorage should be used
   - If `true`, functions make API requests to the backend

2. **API Base URL:**
   - Defaults to `/api` (relative path, same origin)
   - Can be overridden with `VITE_API_BASE_URL` environment variable
   - Example: `VITE_API_BASE_URL=http://localhost:3000/api`

3. **Error Handling:**
   - All API requests include error handling
   - Returns user-friendly error messages
   - Handles HTTP status codes (400, 404, 500, 501)

### Available Functions

**Category Operations:**
- `fetchCategories()` - Get all categories
- `saveCategory(data)` - Create new category
- `fetchCategoryById(id)` - Get single category
- `updateCategory(id, patch)` - Update category
- `deleteCategory(id)` - Delete category
- `reorderCategories(categories)` - Reorder categories array

### Usage Example

```typescript
import { 
  fetchCategories, 
  saveCategory,
  isMongoPersistenceEnabled 
} from './lib/persistenceClient';

// Check if MongoDB persistence is enabled
if (isMongoPersistenceEnabled()) {
  // Use API
  const categories = await fetchCategories();
  const newCategory = await saveCategory({ 
    name: 'Physical Health', 
    color: 'bg-emerald-500' 
  });
} else {
  // Use localStorage (existing logic)
  const categories = JSON.parse(localStorage.getItem('categories') || '[]');
}
```

### Migration Strategy

The persistence client is implemented but **not yet integrated** into the stores. When ready to migrate:

1. Update `HabitContext.tsx` to check `isMongoPersistenceEnabled()`
2. If enabled, use persistence client functions
3. If disabled, continue using localStorage
4. Maintain same interface so UI components don't need changes

### File Structure

- **`src/lib/persistenceClient.ts`** - API client functions
- **`src/lib/persistenceConfig.ts`** - Feature flag configuration
- **`.env`** - Environment variables (not committed)
- **`.env.example`** - Example environment variables

---

## Persistence API Design

This section defines the REST API endpoints needed to replace localStorage with MongoDB-backed persistence. The API is designed to match existing frontend operations in `HabitContext.tsx` without requiring UI changes.

**Base URL:** `/api`

**Authentication:** All endpoints require user authentication (to be implemented). User ID will be extracted from auth token/session.

---

### Categories

Manage habit categories (e.g., "Physical Health", "Mental Health").

**Status:** ✅ **Implemented** - Routes are complete and tested, but not yet integrated with frontend.

#### `GET /api/categories`

Get all categories for the authenticated user.

**Response:** `200 OK`
```typescript
{
  categories: Category[]  // See src/models/persistenceTypes.ts
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

---

#### `POST /api/categories`

Create a new category.

**Request Body:**
```typescript
{
  name: string;      // Category display name
  color: string;     // Tailwind CSS class (e.g., "bg-emerald-500")
}
```
Type: `Omit<Category, 'id'>` (see `src/models/persistenceTypes.ts`)

**Response:** `201 Created`
```typescript
{
  category: Category  // Created category with generated ID
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body (missing name or color)
- `401 Unauthorized` - User not authenticated
- `409 Conflict` - Category with same name already exists (if uniqueness enforced)
- `500 Internal Server Error` - Database error

---

#### `DELETE /api/categories/:id`

Delete a category by ID.

**URL Parameters:**
- `id` (string) - Category ID

**Response:** `200 OK`
```typescript
{
  message: "Category deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Category not found or doesn't belong to user
- `409 Conflict` - Category has associated habits (if cascade delete not implemented)
- `500 Internal Server Error` - Database error

**Note:** Current frontend doesn't cascade delete habits when category is deleted, leading to orphaned data. API should either:
- Option A: Cascade delete all habits in this category
- Option B: Return 409 if category has habits
- Option C: Allow deletion but leave habits orphaned (matches current behavior)

---

#### `PATCH /api/categories/reorder`

Update the order of categories. Replaces entire categories array with new order.

**Request Body:**
```typescript
{
  categories: Category[]  // Complete array in new order
}
```

**Response:** `200 OK`
```typescript
{
  categories: Category[]  // Updated categories array
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body (missing categories array)
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

**Note:** This endpoint replaces the entire categories array. Alternative design could use `PATCH /api/categories/:id` with `{ order: number }` for individual updates, but bulk update matches current frontend `reorderCategories()` behavior.

---

### Habits

Manage individual habits that users track.

#### `GET /api/habits`

Get all habits for the authenticated user.

**Query Parameters:**
- `categoryId` (optional, string) - Filter by category ID
- `archived` (optional, boolean) - Filter by archived status (default: false if not specified)

**Response:** `200 OK`
```typescript
{
  habits: Habit[]  // See src/models/persistenceTypes.ts
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

---

#### `POST /api/habits`

Create a new habit.

**Request Body:**
```typescript
{
  categoryId: string;
  name: string;
  description?: string;  // Optional, currently unused in UI
  goal: {
    type: 'boolean' | 'number';
    target?: number;
    unit?: string;
    frequency: 'daily' | 'weekly' | 'total';
  }
}
```
Type: `Omit<Habit, 'id' | 'createdAt' | 'archived'>` (see `src/models/persistenceTypes.ts`)

**Response:** `201 Created`
```typescript
{
  habit: Habit  // Created habit with generated ID, createdAt, and archived=false
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body (missing required fields, invalid goal type)
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Referenced categoryId does not exist
- `500 Internal Server Error` - Database error

---

#### `GET /api/habits/:id`

Get a single habit by ID.

**URL Parameters:**
- `id` (string) - Habit ID

**Response:** `200 OK`
```typescript
{
  habit: Habit
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Habit not found or doesn't belong to user
- `500 Internal Server Error` - Database error

---

#### `PATCH /api/habits/:id`

Update an existing habit (partial update).

**URL Parameters:**
- `id` (string) - Habit ID

**Request Body:** (all fields optional)
```typescript
{
  name?: string;
  categoryId?: string;
  description?: string;
  goal?: Goal;
  archived?: boolean;
}
```

**Response:** `200 OK`
```typescript
{
  habit: Habit  // Updated habit
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Habit not found or doesn't belong to user
- `500 Internal Server Error` - Database error

**Note:** Currently frontend doesn't have an update habit operation, but this endpoint supports future UI features.

---

#### `DELETE /api/habits/:id`

Delete a habit by ID.

**URL Parameters:**
- `id` (string) - Habit ID

**Response:** `200 OK`
```typescript
{
  message: "Habit deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Habit not found or doesn't belong to user
- `500 Internal Server Error` - Database error

**Note:** Current frontend doesn't cascade delete logs when habit is deleted. API should either:
- Option A: Cascade delete all logs for this habit
- Option B: Allow deletion but leave logs orphaned (matches current behavior)
- Option C: Soft delete (set archived=true) instead of hard delete

---

#### `POST /api/habits/import`

Bulk import habits and categories. Matches frontend `importHabits()` operation.

**Request Body:**
```typescript
{
  categories: Omit<Category, 'id'>[];  // Categories to create if they don't exist
  habits: {
    categoryName: string;  // Name of category (will be matched to ID)
    habit: Omit<Habit, 'id' | 'categoryId' | 'createdAt' | 'archived'>;
  }[]
}
```

**Response:** `200 OK`
```typescript
{
  categoriesCreated: number;
  habitsCreated: number;
  categories: Category[];  // All categories after import
  habits: Habit[];         // All habits after import
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

**Note:** This endpoint:
1. Creates categories if they don't exist (matched by name)
2. Creates habits, avoiding duplicates (matched by name + categoryId)
3. Returns full updated lists (matches frontend expectation)

---

### Day Logs

Track daily completion records for habits.

#### `GET /api/logs`

Get all day logs for the authenticated user.

**Query Parameters:**
- `habitId` (optional, string) - Filter by habit ID
- `date` (optional, string) - Filter by specific date (YYYY-MM-DD)
- `startDate` (optional, string) - Filter logs from this date (YYYY-MM-DD)
- `endDate` (optional, string) - Filter logs up to this date (YYYY-MM-DD)
- `completed` (optional, boolean) - Filter by completion status

**Response:** `200 OK`
```typescript
{
  logs: DayLog[]  // Array of DayLog objects (not Record format)
}
```

**Note:** Frontend currently stores logs as `Record<string, DayLog>` with composite keys. API returns array for flexibility. Frontend can transform to Record format if needed.

**Error Responses:**
- `400 Bad Request` - Invalid date format
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

---

#### `GET /api/logs/:habitId/:date`

Get a specific day log by habit ID and date.

**URL Parameters:**
- `habitId` (string) - Habit ID
- `date` (string) - Date in YYYY-MM-DD format

**Response:** `200 OK`
```typescript
{
  log: DayLog | null  // null if log doesn't exist
}
```

**Error Responses:**
- `400 Bad Request` - Invalid date format
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Habit not found or doesn't belong to user
- `500 Internal Server Error` - Database error

---

#### `PUT /api/logs/:habitId/:date`

Create or update a day log (upsert operation). Matches frontend `toggleHabit()` and `updateLog()` operations.

**URL Parameters:**
- `habitId` (string) - Habit ID
- `date` (string) - Date in YYYY-MM-DD format

**Request Body:**
```typescript
{
  value: number;  // 0 or 1 for boolean habits, actual value for number habits
}
```

**Response:** `200 OK` (if updated) or `201 Created` (if created)
```typescript
{
  log: DayLog  // Created/updated log with computed `completed` field
}
```

**Note:** Server should compute `completed` field based on habit's goal:
- Boolean habits: `completed = value > 0`
- Number habits: `completed = value >= goal.target`

**Error Responses:**
- `400 Bad Request` - Invalid date format, invalid value
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Habit not found or doesn't belong to user
- `500 Internal Server Error` - Database error

---

#### `DELETE /api/logs/:habitId/:date`

Delete a day log. Matches frontend `toggleHabit()` toggle-off operation.

**URL Parameters:**
- `habitId` (string) - Habit ID
- `date` (string) - Date in YYYY-MM-DD format

**Response:** `200 OK`
```typescript
{
  message: "Log deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid date format
- `401 Unauthorized` - User not authenticated
- `404 Not Found` - Log not found, or habit doesn't belong to user
- `500 Internal Server Error` - Database error

---

### Wellbeing Logs

Track daily wellbeing check-ins (morning/evening sessions).

#### `GET /api/wellbeing`

Get all wellbeing logs for the authenticated user.

**Query Parameters:**
- `date` (optional, string) - Filter by specific date (YYYY-MM-DD)
- `startDate` (optional, string) - Filter logs from this date (YYYY-MM-DD)
- `endDate` (optional, string) - Filter logs up to this date (YYYY-MM-DD)

**Response:** `200 OK`
```typescript
{
  wellbeingLogs: DailyWellbeing[]  // Array (not Record format)
}
```

**Note:** Frontend stores as `Record<string, DailyWellbeing>` keyed by date. API returns array for flexibility.

**Error Responses:**
- `400 Bad Request` - Invalid date format
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

---

#### `GET /api/wellbeing/:date`

Get wellbeing log for a specific date.

**URL Parameters:**
- `date` (string) - Date in YYYY-MM-DD format

**Response:** `200 OK`
```typescript
{
  wellbeing: DailyWellbeing | null  // null if no log exists for this date
}
```

**Error Responses:**
- `400 Bad Request` - Invalid date format
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

---

#### `PUT /api/wellbeing/:date`

Create or update a wellbeing log (upsert with deep merge). Matches frontend `logWellbeing()` operation.

**URL Parameters:**
- `date` (string) - Date in YYYY-MM-DD format

**Request Body:**
```typescript
{
  date: string;                    // Must match URL parameter
  morning?: WellbeingSession;      // Optional morning session
  evening?: WellbeingSession;      // Optional evening session
  // Legacy fields (optional, for backward compatibility):
  depression?: number;
  anxiety?: number;
  energy?: number;
  sleepScore?: number;
  notes?: string;
}
```
Type: `DailyWellbeing` (see `src/models/persistenceTypes.ts`)

**Response:** `200 OK` (if updated) or `201 Created` (if created)
```typescript
{
  wellbeing: DailyWellbeing  // Merged wellbeing log
}
```

**Merge Behavior:**
- If existing log exists, perform deep merge:
  - Preserve existing `morning` session if new data doesn't include `morning`
  - Preserve existing `evening` session if new data doesn't include `evening`
  - Merge `morning`/`evening` fields if both exist
- Matches frontend `logWellbeing()` merge logic

**Error Responses:**
- `400 Bad Request` - Invalid date format, invalid request body
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

---

### Bulk Operations

#### `GET /api/data`

Get all user data in a single request. Useful for initial app load, matching current frontend behavior of loading all data at startup.

**Response:** `200 OK`
```typescript
{
  categories: Category[];
  habits: Habit[];
  logs: DayLog[];           // Array format (frontend can transform to Record)
  wellbeingLogs: DailyWellbeing[];  // Array format (frontend can transform to Record)
}
```

**Error Responses:**
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Database error

**Note:** This endpoint matches the current frontend pattern of loading all data at app startup. Alternative: frontend could load each resource separately, but bulk endpoint is more efficient.

---

## API Design Notes

### Authentication

All endpoints require user authentication. User ID will be:
- Extracted from JWT token, session cookie, or auth header
- Used to scope all queries (users can only access their own data)
- Implementation details TBD (OAuth, JWT, session-based, etc.)

### Data Format Differences

**Frontend Storage (localStorage):**
- `logs`: `Record<string, DayLog>` with composite keys `${habitId}-${date}`
- `wellbeingLogs`: `Record<string, DailyWellbeing>` keyed by date

**API Response:**
- Returns arrays for flexibility and easier querying
- Frontend can transform to Record format if needed for backward compatibility

### Error Handling

All endpoints should return consistent error response format:

```typescript
{
  error: {
    code: string;        // Error code (e.g., "NOT_FOUND", "VALIDATION_ERROR")
    message: string;     // Human-readable error message
    details?: any;       // Optional additional error details
  }
}
```

### Status Codes

- `200 OK` - Successful GET, PUT, PATCH, DELETE
- `201 Created` - Successful POST (resource created)
- `400 Bad Request` - Invalid request body or parameters
- `401 Unauthorized` - Authentication required or invalid
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate, has dependencies)
- `500 Internal Server Error` - Server/database error

### Pagination

Currently, frontend loads all data at startup. For future scalability:
- Consider adding pagination to `GET /api/logs` and `GET /api/wellbeing` endpoints
- Query parameters: `page`, `limit`, `offset`
- Response includes metadata: `{ data: T[], total: number, page: number, limit: number }`

### Orphaned Data Handling

Current frontend behavior allows orphaned data:
- Deleting a category doesn't delete its habits
- Deleting a habit doesn't delete its logs

**API Design Decision Needed:**
1. **Cascade Delete:** Automatically delete related data
2. **Prevent Delete:** Return 409 if dependencies exist
3. **Allow Orphaned:** Match current frontend behavior (not recommended for production)

Recommendation: Implement cascade delete or soft delete for better data integrity.

---

## Frontend Integration

The API is designed to match existing frontend operations in `HabitContext.tsx`:

| Frontend Operation | API Endpoint |
|-------------------|--------------|
| `addCategory()` | `POST /api/categories` |
| `deleteCategory()` | `DELETE /api/categories/:id` |
| `reorderCategories()` | `PATCH /api/categories/reorder` |
| `addHabit()` | `POST /api/habits` |
| `deleteHabit()` | `DELETE /api/habits/:id` |
| `importHabits()` | `POST /api/habits/import` |
| `toggleHabit()` | `PUT /api/logs/:habitId/:date` or `DELETE /api/logs/:habitId/:date` |
| `updateLog()` | `PUT /api/logs/:habitId/:date` |
| `logWellbeing()` | `PUT /api/wellbeing/:date` |
| Initial data load | `GET /api/data` (or separate GET requests) |

**Migration Strategy:**
1. Create API client service layer
2. Replace localStorage operations with API calls
3. Maintain same React Context interface (no UI changes needed)
4. Handle loading/error states
5. Implement optimistic updates for better UX

