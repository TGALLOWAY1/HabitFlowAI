# Drag & Drop Reconnaissance Report

## Summary
This document maps the existing drag-and-drop (DnD) implementation for Habits and identifies the Goals page structure for future DnD implementation.

---

## 1. Goals Page

### File Paths
- **Main Component**: `src/pages/goals/GoalsPage.tsx`
- **Route**: Handled in `src/App.tsx` (line 433) - route `'goals'`
- **Data Hook**: `src/lib/useGoalsWithProgress.ts` (used by GoalsPage)

### Goal Data Structure
**Location**: `src/models/persistenceTypes.ts` (lines 794-882)

```typescript
export interface Goal {
    id: string;
    categoryId?: string;  // Optional category association
    title: string;
    type: 'cumulative' | 'frequency' | 'onetime';
    targetValue?: number;
    unit?: string;
    linkedHabitIds: string[];
    aggregationMode?: 'count' | 'sum';
    countMode?: 'distinctDays' | 'entries';
    linkedTargets?: Array<...>;
    deadline?: string;
    createdAt: string;
    completedAt?: string;
    notes?: string;
    badgeUrl?: string;
    // ⚠️ NO sortOrder field currently exists
}
```

### Category Data Structure (for Goals)
**Location**: `src/models/persistenceTypes.ts` (lines 23-39)

```typescript
export interface Category {
    id: string;
    name: string;
    color: string;
    // ⚠️ NO sortOrder field - ordering maintained by array position
}
```

### Current Goals Page Behavior
- Displays goals in a grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- No drag-and-drop reordering currently implemented
- Goals are fetched via `useGoalsWithProgress()` hook
- Goals can be filtered by category (via `categoryId` field)

---

## 2. Habits Page Drag & Drop Implementation

### DnD Library
**Library**: `@dnd-kit` (modern, accessible DnD library)
- Core: `@dnd-kit/core`
- Sortable: `@dnd-kit/sortable`
- Utilities: `@dnd-kit/utilities`

### Components Responsible for DnD

#### A. Category Reordering
**File**: `src/components/CategoryTabs.tsx`

**Components**:
- `CategoryTabs` (main component, lines 166-306)
- `SortableCategoryPill` (sortable item, lines 39-164)

**Implementation Details**:
- Uses `DndContext` with `closestCenter` collision detection
- Uses `SortableContext` with `horizontalListSortingStrategy`
- Sensors: `PointerSensor` (8px activation distance) + `KeyboardSensor`
- Drag handle: Entire pill is draggable (via `useSortable` hook)

**Persistence**:
- Handler: `handleDragEnd` (lines 188-200)
- Calls: `reorderCategories(arrayMove(categories, oldIndex, newIndex))`
- Store function: `HabitContext.reorderCategories()` (line 555)
- API: `persistenceClient.reorderCategories()` → `/categories/reorder` PATCH
- Backend: `categoryRepository.reorderCategories()` - **Deletes all and re-inserts in new order**

#### B. Habit Reordering (Within Category)
**File**: `src/components/TrackerGrid.tsx`

**Components**:
- `TrackerGrid` (main component, lines 758-1411)
- `SortableHabitRow` (sortable item, lines 482-637)
- `HabitRowContent` (renders the row UI, lines 172-480)

**Implementation Details**:
- Uses `DndContext` with `closestCenter` collision detection
- Uses `SortableContext` with `verticalListSortingStrategy` (line 1196)
- Sensors: `PointerSensor` (8px activation distance) + `KeyboardSensor`
- Drag handle: `GripVertical` icon (lines 237-245) - only visible on hover, only for depth 0 (non-virtual habits)

**Persistence**:
- Handler: `handleDragEnd` (lines 901-909)
- Calls: `reorderHabits(newOrder)` where `newOrder` is array of habit IDs
- Store function: `HabitContext.reorderHabits()` (line 566)
- API: `persistenceClient.reorderHabits()` → `/habits/reorder` PATCH
- Backend: `habitRepository.reorderHabits()` - **Updates `order` field via bulkWrite**

### Habit Data Structure
**Location**: `src/models/persistenceTypes.ts` (lines 82-237)

```typescript
export interface Habit {
    id: string;
    categoryId: string;
    name: string;
    goal: HabitGoal;
    archived: boolean;
    createdAt: string;
    order?: number;  // ✅ Display order field (lower = earlier)
    // ... other fields
}
```

### Category Ordering Strategy
**Current Implementation**: Categories are **NOT stored with a `sortOrder` field**. Instead:
- Order is maintained by **array position** in MongoDB
- `reorderCategories()` **deletes all categories** and **re-inserts them in new order**
- This is a simple but potentially inefficient approach (works for small datasets)

**Backend Implementation**: `src/server/repositories/categoryRepository.ts` (lines 166-188)
```typescript
// Deletes all existing categories for this user
await collection.deleteMany({ userId });
// Insert categories in new order
await collection.insertMany(documents);
```

### Habit Ordering Strategy
**Current Implementation**: Habits **DO have an `order` field** (optional number)
- `reorderHabits()` updates the `order` field for each habit via `bulkWrite`
- More efficient than category approach (updates only, no delete/re-insert)

**Backend Implementation**: `src/server/repositories/habitRepository.ts` (lines 198-223)
```typescript
// Updates order field: order = index in array
const operations = habitIds.map((id, index) => ({
    updateOne: {
        filter: { id, userId },
        update: { $set: { order: index } }
    }
}));
```

---

## 3. Persistence Flow

### Category Reordering
```
CategoryTabs.handleDragEnd()
  → HabitContext.reorderCategories(newOrder: Category[])
    → persistenceClient.reorderCategories(categories: Category[])
      → API: PATCH /categories/reorder { categories: Category[] }
        → categoryRepository.reorderCategories()
          → MongoDB: deleteMany + insertMany (array position = order)
```

### Habit Reordering
```
TrackerGrid.handleDragEnd()
  → HabitContext.reorderHabits(newOrderIds: string[])
    → persistenceClient.reorderHabits(habitIds: string[])
      → API: PATCH /habits/reorder { habitIds: string[] }
        → habitRepository.reorderHabits()
          → MongoDB: bulkWrite (update order field for each habit)
```

---

## 4. Key Patterns & Notes

### DnD Configuration
- **Activation Distance**: 8px (prevents accidental drags on clicks)
- **Collision Detection**: `closestCenter`
- **Keyboard Support**: Yes (via `KeyboardSensor`)
- **Visual Feedback**: `isDragging` state used for styling (z-index, shadows)

### Ordering Fields
- **Categories**: No `sortOrder` field - order = array position
- **Habits**: Has `order?: number` field (lower = earlier)
- **Goals**: **NO `sortOrder` field currently** ⚠️

### Constraints
- Habits can only be reordered within their category (filtered by `categoryId` in TrackerGrid)
- Categories are reordered globally (all categories)
- Virtual habits (bundle children) are NOT draggable (depth > 0 check)

---

## 5. Recommendations for Goals DnD

### Option A: Add `sortOrder` field to Goal (Recommended)
- Add `sortOrder?: number` to `Goal` interface
- Follow habit pattern: use `bulkWrite` to update order fields
- More efficient than category approach

### Option B: Use array position (like Categories)
- Simpler but less efficient
- Requires delete/re-insert pattern
- Only suitable if goal count stays small

### Implementation Notes
- Goals are currently displayed in a grid, not a list
- May need to switch to list view for drag-and-drop, or implement grid DnD
- Consider category-based grouping if `categoryId` is used
- Reuse existing `@dnd-kit` setup from Habits implementation

---

## Files Referenced

### Goals
- `src/pages/goals/GoalsPage.tsx`
- `src/lib/useGoalsWithProgress.ts`
- `src/models/persistenceTypes.ts` (Goal interface)

### Habits DnD
- `src/components/CategoryTabs.tsx` (category reordering)
- `src/components/TrackerGrid.tsx` (habit reordering)
- `src/store/HabitContext.tsx` (reorder functions)
- `src/lib/persistenceClient.ts` (API calls)
- `src/server/repositories/categoryRepository.ts` (category persistence)
- `src/server/repositories/habitRepository.ts` (habit persistence)

### Types
- `src/models/persistenceTypes.ts` (Category, Habit, Goal interfaces)
- `src/types/index.ts` (legacy types, may be deprecated)

