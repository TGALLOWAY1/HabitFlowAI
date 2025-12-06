# Activities M2 – Frontend Audit

**Date:** 2025-01-27  
**Purpose:** Audit existing Habits UI implementation to guide Activity UI development

---

## Habit List UI

### Main Component Location

**File:** `src/App.tsx`  
**Component:** `HabitTrackerContent` (lines 10-67)

The main habits list screen is implemented directly in `App.tsx` as a component within the `HabitProvider` context. There is **no separate routing** - the app is a single-page application.

### List Display Component

**File:** `src/components/TrackerGrid.tsx`  
**Component:** `TrackerGrid`

**Key Features:**
- Displays habits in a grid format with date columns (14 days: today + last 13 days)
- Shows habit name, goal target/unit in the left column
- Each habit row has clickable cells for each date
- Supports boolean habits (toggle on/off) and numeric habits (popover input)
- Delete button appears on hover (with confirmation click)
- "Add New Habit" button at the bottom of the grid

**Props:**
```typescript
interface TrackerGridProps {
    habits: Habit[];
    logs: Record<string, DayLog>;
    onToggle: (habitId: string, date: string) => Promise<void>;
    onUpdateValue: (habitId: string, date: string, value: number) => Promise<void>;
    onAddHabit: () => void;
}
```

**Key Patterns:**
- Uses `date-fns` for date formatting (`format`, `eachDayOfInterval`, `subDays`, `isToday`)
- Date cells are keyed by `${habitId}-${dateStr}` format
- Visual feedback: completed cells have emerald background with glow effect
- Numeric input handled via `NumericInputPopover` component (positioned popover)
- Delete confirmation: first click highlights, second click deletes (5-second timeout)

**Reusable Components:**
- `NumericInputPopover` - Popover for numeric value input (used for number-type habits)

### Category Filtering

**File:** `src/components/CategoryTabs.tsx`  
**Component:** `CategoryTabs`

**Key Features:**
- Horizontal scrollable tabs for category selection
- Drag-and-drop reordering (using `@dnd-kit/core`)
- Active category highlighted with category color
- Delete category button (with confirmation) on active tab
- Inline "Add Category" form
- Import predefined habits button

**Props:**
```typescript
interface CategoryTabsProps {
    categories: Category[];
    activeCategoryId: string;
    onSelectCategory: (id: string) => void;
}
```

**Key Patterns:**
- Uses `@dnd-kit` for drag-and-drop functionality
- Inline editing: clicking "+" shows input field inline
- Delete confirmation: first click highlights delete button, second click confirms
- Category color applied as background class (e.g., `bg-emerald-500`)

**Reusable Components:**
- `SortableCategoryPill` - Individual sortable category tab component

### View Toggle

**Location:** `src/App.tsx` (lines 23-36)

The app has a view toggle between:
- **Tracker view** (`'tracker'`) - Shows `TrackerGrid` with category tabs
- **Progress view** (`'progress'`) - Shows `ProgressDashboard` (analytics/visualizations)

Toggle implemented as icon buttons in header (Calendar icon for tracker, BarChart3 for progress).

---

## Habit Create/Edit UI

### Create Modal

**File:** `src/components/AddHabitModal.tsx`  
**Component:** `AddHabitModal`

**Key Features:**
- Modal overlay with backdrop blur
- Form fields:
  - Habit Name (required text input)
  - Target (optional number input)
  - Unit (optional text input)
  - Cumulative goal checkbox
- Submit creates habit via `addHabit` from context
- Closes on submit or cancel

**Props:**
```typescript
interface AddHabitModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId: string;  // Pre-filled category (required)
}
```

**Key Patterns:**
- Modal pattern: fixed overlay with centered dialog
- Form state managed with `useState` hooks
- Form submission calls context method (`addHabit`)
- Error handling: logs to console, still closes modal
- Form reset on successful submit

**Modal Structure:**
- Fixed overlay: `fixed inset-0 z-50` with backdrop
- Dialog: `max-w-md` centered with rounded corners
- Header: Title + close button (X icon)
- Form: Input fields + Cancel/Submit buttons

### Edit Functionality

**Note:** There is **no dedicated edit modal** for habits. Editing is handled inline:
- **Delete:** Hover over habit row → trash icon appears → click to confirm delete
- **Update values:** Click date cells to update log values (via `NumericInputPopover`)

The `updateHabit` function exists in `persistenceClient.ts` but is **not currently used in the UI**. It's reserved for future use (see `HabitContext.tsx` line 10).

### CRUD Operations Flow

**Create:**
1. User clicks "Add New Habit" button in `TrackerGrid`
2. `onAddHabit` callback opens `AddHabitModal`
3. User fills form and submits
4. `AddHabitModal` calls `addHabit` from `useHabitStore()`
5. `HabitContext.addHabit()` calls `saveHabit()` from `persistenceClient.ts`
6. `saveHabit()` makes `POST /api/habits` request
7. New habit added to context state
8. Modal closes, habit appears in grid

**Read:**
1. `HabitContext` loads habits on mount via `useEffect`
2. Calls `fetchHabits()` from `persistenceClient.ts`
3. `fetchHabits()` makes `GET /api/habits` request
4. Habits stored in context state
5. `App.tsx` filters habits by `activeCategoryId` and passes to `TrackerGrid`

**Update:**
- Currently only log values are updated (via `updateLog`)
- Habit metadata editing not implemented in UI

**Delete:**
1. User hovers over habit row in `TrackerGrid`
2. Trash icon appears
3. First click: highlights delete button (confirmation state)
4. Second click within 5 seconds: calls `deleteHabit` from context
5. `HabitContext.deleteHabit()` calls `deleteHabit()` from `persistenceClient.ts`
6. `deleteHabit()` makes `DELETE /api/habits/:id` request
7. Habit removed from context state
8. Related logs also removed from state (cascade cleanup)

---

## Routing & Navigation

### No Router Implementation

**Key Finding:** The application does **not use React Router** or any routing library. It's a single-page application with view toggles.

**File:** `src/App.tsx`

**Structure:**
```typescript
function App() {
  return (
    <HabitProvider>
      <Layout>
        <HabitTrackerContent />
      </Layout>
    </HabitProvider>
  );
}
```

**View Management:**
- View state managed with `useState<'tracker' | 'progress'>`
- Conditional rendering based on view state
- No URL-based routing or navigation

### Layout Component

**File:** `src/components/Layout.tsx`  
**Component:** `Layout`

**Key Features:**
- Fixed header with app branding ("HabitFlow")
- Settings and User icon buttons (not functional yet)
- Main content area with max-width and padding
- Full-height flex layout

**Pattern:**
- Wraps all page content
- Provides consistent header/footer structure
- Children rendered in main content area

### Navigation Pattern

**Current Pattern:**
- **Single-page app** - All content in one component tree
- **View toggles** - Switch between tracker/progress views
- **Category filtering** - Filter habits by category (no navigation, just filtering)

**For Activities UI:**
- Consider same pattern: single-page with view toggles
- Or implement React Router if Activities need separate routes
- Category/group filtering can follow same pattern as Habits

---

## State Management & Context

### Context Provider Pattern

**File:** `src/store/HabitContext.tsx`  
**Component:** `HabitProvider`  
**Hook:** `useHabitStore()`

**Key Features:**
- React Context API for global state
- Manages: categories, habits, logs, wellbeingLogs
- Provides CRUD methods: `addHabit`, `deleteHabit`, `toggleHabit`, `updateLog`, etc.
- Loads data from API on mount (4 separate `useEffect` hooks)
- Optimistic updates for log operations

**Context Interface:**
```typescript
interface HabitContextType {
    categories: Category[];
    habits: Habit[];
    logs: Record<string, DayLog>;
    wellbeingLogs: Record<string, DailyWellbeing>;
    addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
    addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => Promise<void>;
    toggleHabit: (habitId: string, date: string) => Promise<void>;
    updateLog: (habitId: string, date: string, value: number) => Promise<void>;
    deleteHabit: (id: string) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;
    importHabits: (...) => Promise<void>;
    reorderCategories: (newOrder: Category[]) => Promise<void>;
    logWellbeing: (date: string, data: DailyWellbeing) => Promise<void>;
}
```

**Key Patterns:**
- **Data Loading:** Separate `useEffect` hooks for each data type (categories, habits, logs, wellbeing)
- **Optimistic Updates:** Log operations update state immediately, then sync to API
- **Error Handling:** Try/catch blocks with console.error, state updates preserved
- **Cancellation:** `useEffect` cleanup prevents state updates after unmount

**Persistence Integration:**
- All CRUD operations call functions from `persistenceClient.ts`
- Functions imported: `fetchHabits`, `saveHabit`, `updateHabit`, `deleteHabit`, etc.
- API calls are async and handled with try/catch

### Persistence Client

**File:** `src/lib/persistenceClient.ts`

**Pattern:** HTTP client wrapper for REST API

**Habit Functions:**
- `fetchHabits(categoryId?: string): Promise<Habit[]>`
- `saveHabit(data): Promise<Habit>`
- `updateHabit(id, patch): Promise<Habit>`
- `deleteHabit(id): Promise<void>`

**Key Patterns:**
- Base URL from `persistenceConfig.ts` (defaults to `/api`)
- Error handling with status code checks (400, 404, 501)
- JSON request/response handling
- User ID extraction (currently placeholder: `'anonymous-user'`)

---

## Reusable Components & Patterns

### Components to Leverage for Activities

1. **Modal Pattern** (`AddHabitModal.tsx`)
   - Reusable modal overlay structure
   - Form handling pattern
   - Can be adapted for `AddActivityModal`

2. **Grid Display** (`TrackerGrid.tsx`)
   - Date-based grid layout
   - Row/cell interaction patterns
   - Delete confirmation pattern
   - Can be adapted for `ActivityGrid` or `ActivityList`

3. **Category Tabs** (`CategoryTabs.tsx`)
   - Tab navigation pattern
   - Drag-and-drop reordering
   - Inline editing pattern
   - Can be reused or adapted for Activity groups/categories

4. **Numeric Input Popover** (`NumericInputPopover.tsx`)
   - Positioned popover for numeric input
   - Can be reused for Activity value inputs

5. **Layout** (`Layout.tsx`)
   - Consistent page structure
   - Header/navigation pattern
   - Can be reused as-is

### UI Patterns to Mirror

1. **Delete Confirmation:**
   - First click: highlight/confirm state
   - Second click: execute delete
   - Timeout to reset confirmation state
   - Used in: `TrackerGrid` (habits), `CategoryTabs` (categories)

2. **Optimistic Updates:**
   - Update UI immediately
   - Sync to API in background
   - Preserve state on error (don't rollback)
   - Used in: `toggleHabit`, `updateLog`, `logWellbeing`

3. **Loading States:**
   - Data loads on mount via `useEffect`
   - No explicit loading indicators (data appears when ready)
   - Consider adding loading states for Activities

4. **Filtering:**
   - Client-side filtering by category
   - Filtered data passed to display component
   - Pattern: `habits.filter(h => h.categoryId === activeCategoryId)`

5. **View Toggle:**
   - State-based view switching
   - Icon buttons for view selection
   - Conditional rendering

---

## File Structure Summary

### Core UI Files

```
src/
├── App.tsx                    # Main app component, habits list screen
├── components/
│   ├── Layout.tsx            # Page layout wrapper
│   ├── TrackerGrid.tsx       # Habits list/grid display
│   ├── AddHabitModal.tsx     # Habit creation modal
│   ├── CategoryTabs.tsx      # Category filtering tabs
│   ├── NumericInputPopover.tsx  # Numeric input popover
│   └── ProgressDashboard.tsx # Analytics view (not for Activities M2)
├── store/
│   └── HabitContext.tsx      # React Context for state management
└── lib/
    ├── persistenceClient.ts  # HTTP client for API calls
    └── persistenceConfig.ts  # API base URL config
```

### Patterns to Mirror for Activities

1. **Create `ActivityContext.tsx`** (mirror `HabitContext.tsx`)
   - Context provider for Activity state
   - CRUD methods: `addActivity`, `deleteActivity`, etc.
   - Load activities on mount

2. **Create `ActivityList.tsx` or `ActivityGrid.tsx`** (mirror `TrackerGrid.tsx`)
   - Display list of activities
   - Support activity-specific interactions
   - Delete confirmation pattern

3. **Create `AddActivityModal.tsx`** (mirror `AddHabitModal.tsx`)
   - Modal for creating activities
   - Form fields for activity properties
   - Submit via context method

4. **Update `App.tsx` or create routing**
   - Add Activities view/toggle
   - Or create separate route for Activities
   - Filter activities by group/category

5. **Add Activity functions to `persistenceClient.ts`**
   - `fetchActivities()`
   - `saveActivity()`
   - `updateActivity()`
   - `deleteActivity()`

---

## Key Takeaways for Activities UI

### 1. **Context/Provider Pattern**
- Use React Context for Activity state management
- Mirror `HabitContext.tsx` structure
- Provide CRUD methods via context
- Load data on mount with `useEffect`

### 2. **Modal vs Page**
- Habits use **modal** for creation (`AddHabitModal`)
- No dedicated edit page (inline editing only)
- Consider same pattern for Activities: modal for create, inline for edit

### 3. **Routing Pattern**
- **No routing** - single-page app with view toggles
- Activities can follow same pattern OR implement React Router if needed
- View state managed with `useState`

### 4. **Component Structure**
- Main list component (`TrackerGrid`) receives filtered data as props
- Category filtering handled in parent (`App.tsx`)
- Delete confirmation pattern reusable
- Numeric input popover reusable

### 5. **Persistence Integration**
- All API calls go through `persistenceClient.ts`
- Context methods call persistence client functions
- Error handling at context level (logs errors, preserves state)

### 6. **UI/UX Patterns**
- Optimistic updates for better UX
- Hover states for actions (delete button)
- Visual feedback for completed items (emerald color, glow effect)
- Inline editing where possible
- Confirmation patterns for destructive actions

---

## Next Steps for Activities M2

1. **Create Activity Context** (`src/store/ActivityContext.tsx`)
   - Mirror `HabitContext.tsx` structure
   - Add Activity CRUD methods
   - Integrate with `persistenceClient.ts` Activity functions

2. **Create Activity List Component** (`src/components/ActivityList.tsx` or `ActivityGrid.tsx`)
   - Display activities in list or grid format
   - Support activity-specific interactions
   - Include delete functionality with confirmation

3. **Create Add Activity Modal** (`src/components/AddActivityModal.tsx`)
   - Mirror `AddHabitModal.tsx` structure
   - Form fields for Activity properties (name, description, etc.)
   - Submit via Activity context

4. **Update App.tsx or Add Routing**
   - Add Activities view/toggle
   - Or implement React Router for separate Activities route
   - Filter activities by group/category

5. **Add Persistence Client Functions** (`src/lib/persistenceClient.ts`)
   - `fetchActivities()`
   - `saveActivity()`
   - `updateActivity()`
   - `deleteActivity()`

---

## Files Reference

### UI Components
- `src/App.tsx` - Main app, habits list screen
- `src/components/TrackerGrid.tsx` - Habits grid/list display
- `src/components/AddHabitModal.tsx` - Habit creation modal
- `src/components/CategoryTabs.tsx` - Category filtering tabs
- `src/components/Layout.tsx` - Page layout wrapper
- `src/components/NumericInputPopover.tsx` - Numeric input popover

### State Management
- `src/store/HabitContext.tsx` - React Context for habits state

### Persistence
- `src/lib/persistenceClient.ts` - HTTP client for API calls
- `src/lib/persistenceConfig.ts` - API configuration

### Types
- `src/types/index.ts` - Frontend type definitions
- `src/models/persistenceTypes.ts` - Backend/persistence type definitions
