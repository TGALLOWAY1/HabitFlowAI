# Persona UI Implementation Map

> **Scan Results** — Branch Hygiene + Prep Scan (No Code Changes)  
> Generated: 2025-01-XX  
> Purpose: Identify insertion points for Persona UI system

---

## 1. User Preferences Storage

### Server Model
**Status**: ❌ **NOT FOUND** — No user preferences model exists yet

**Current State:**
- User identification via `userId` header (see `src/server/middleware/auth.ts`)
- No User entity or preferences collection in MongoDB
- All data scoped by `userId` but no user profile/preferences storage

**Recommended Insertion Point:**
- **New Model**: `src/models/persistenceTypes.ts`
  - Add `UserPreferences` interface
  - Add to `PersistenceSchema` interface (line ~868)
  - Add collection name to `MONGO_COLLECTIONS` (line ~907)

- **New Repository**: `src/server/repositories/userPreferencesRepository.ts`
  - CRUD operations for user preferences
  - Follow pattern from `categoryRepository.ts` or `goalRepository.ts`

- **New Route**: `src/server/routes/userPreferences.ts`
  - `GET /api/userPreferences` — fetch user preferences
  - `PUT /api/userPreferences` — update user preferences
  - Register in `src/server/index.ts` (line ~27)

### Client State
**Status**: ❌ **NOT FOUND** — No dedicated preferences store

**Current State:**
- State managed in context providers:
  - `src/store/HabitContext.tsx` — habits, categories, logs
  - `src/store/RoutineContext.tsx` — routines, routine logs
  - `src/context/TaskContext.tsx` — tasks
- No centralized preferences/state management

**Recommended Insertion Point:**
- **New Context**: `src/store/UserPreferencesContext.tsx`
  - Store active persona ID
  - Store dashboard widget preferences
  - Sync with server via `src/lib/persistenceClient.ts`
  - Follow pattern from `HabitContext.tsx`

- **Alternative**: Add to existing `HabitContext.tsx` if preferences are minimal
  - Less ideal — mixes concerns

---

## 2. Settings UI

### Current State
**Location**: `src/components/Layout.tsx` (lines 30-36)

**Status**: ⚠️ **PARTIAL** — Settings icon exists but only triggers refresh

```tsx
<button
  onClick={handleRefresh}
  className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-400 hover:text-white"
  title="Refresh Habits and Categories"
>
  <Settings size={20} />
</button>
```

**No Settings Page Found:**
- No `SettingsPage.tsx` in `src/pages/`
- No settings modal component
- Settings button in header is non-functional for preferences

### Recommended Insertion Point

**Option A: Settings Modal (Recommended)**
- **New Component**: `src/components/SettingsModal.tsx`
  - Triggered from Settings button in `Layout.tsx`
  - Contains persona selector
  - Contains dashboard widget visibility/order controls
  - Follow pattern from `AddHabitModal.tsx` or `RoutineEditorModal.tsx`

**Option B: Settings Page**
- **New Page**: `src/pages/SettingsPage.tsx`
  - Add route `'settings'` to `AppRoute` type in `src/App.tsx` (line 32)
  - Add navigation button in `App.tsx` (around line 223-276)
  - More space for complex settings

**Recommendation**: **Option A (Modal)** — Settings are typically accessed infrequently, modal is less disruptive

---

## 3. Dashboard Widget Registration

### Current State
**Location**: `src/components/ProgressDashboard.tsx`

**Status**: ⚠️ **HARDCODED** — Widgets are directly rendered in JSX, no registration system

**Current Widgets (in render order):**
1. **ProgressRings** (line 84) — `import { ProgressRings } from './ProgressRings'`
2. **Goals at a glance** (lines 87-132) — Inline JSX with `GoalPulseCard` components
3. **Activity Heatmap** (lines 134-210) — Inline JSX with `Heatmap` and `CategoryCompletionRow`

**No Widget System:**
- Widgets are hardcoded in component
- No visibility/order configuration
- No widget registry or factory pattern

### Recommended Insertion Point

**Option A: Widget Registry Pattern (Recommended)**
- **New File**: `src/components/dashboard/widgetRegistry.ts`
  - Define widget types: `'progressRings' | 'goals' | 'heatmap' | ...`
  - Define widget config interface: `{ id, component, defaultVisible, order }`
  - Export widget registry array

- **Modify**: `src/components/ProgressDashboard.tsx`
  - Read widget visibility/order from user preferences
  - Map over widget registry instead of hardcoding
  - Conditionally render based on preferences

**Option B: Configuration Object**
- **New File**: `src/components/dashboard/widgetConfig.ts`
  - Simple config object mapping widget IDs to components
  - Less flexible but simpler

**Recommendation**: **Option A (Registry)** — More extensible, supports future widget additions

**Widget Preference Storage:**
- Store in `UserPreferences` model (see Section 1)
- Structure: `{ widgetId: string, visible: boolean, order: number }[]`

---

## 4. Reference Folder & Canonical Docs

### Current State
**Location**: `docs/reference/`

**Status**: ✅ **EXISTS** — Well-structured canonical documentation system

**Structure:**
```
docs/reference/
├── 00_NORTHSTAR.md
├── 01_HABIT.md
├── 02_HABIT_ENTRY.md
├── ...
├── 09_PERSONA.md                    ← Persona canonical definition
├── personas/
│   ├── 00_PERSONA_FRAMEWORK.md      ← Framework v2
│   ├── 01_PERSONA_EMOTIONAL_REGULATION.md
│   ├── 02_PERSONA_FITNESS_FOCUSED.md
│   ├── 03_PERSONA_CREATIVE.md
│   ├── 04_PERSONA_GROWTH_LEARNING.md
│   ├── 05_PERSONA_MINIMALIST.md
│   ├── 06_PERSONA_POWER_USER.md
│   └── 99_PERSONA_COMPARISON.md
└── AUDIT_MAP.md
```

**Canonical Pattern:**
- Documents marked with `> **Canonical Object**` or `> **Canonical Persona Document**`
- Documents are authoritative — implementation must match docs
- Persona docs follow consistent structure (see `06_PERSONA_POWER_USER.md`)

### Recommended Insertion Point

**Persona Types + Config:**
- **New File**: `src/domain/personaTypes.ts` (or `src/models/personaTypes.ts`)
  - Define TypeScript types matching canonical persona structure
  - Import persona configs from canonical docs (or mirror structure)
  - Export persona registry/constants

- **Alternative**: `src/data/personas.ts`
  - Follow pattern from `src/data/predefinedHabits.ts`
  - Store persona definitions as TypeScript objects
  - Reference canonical docs in comments

**Recommendation**: **`src/domain/personaTypes.ts`** — Domain layer is appropriate for persona types, matches existing `src/domain/canonicalTypes.ts` pattern

---

## Summary: Recommended File Structure

### New Files to Create

1. **Models & Types**
   - `src/models/persistenceTypes.ts` — Add `UserPreferences` interface
   - `src/domain/personaTypes.ts` — Persona type definitions

2. **Server**
   - `src/server/repositories/userPreferencesRepository.ts` — CRUD for preferences
   - `src/server/routes/userPreferences.ts` — API routes

3. **Client State**
   - `src/store/UserPreferencesContext.tsx` — Preferences state management

4. **UI Components**
   - `src/components/SettingsModal.tsx` — Settings UI with persona selector
   - `src/components/dashboard/widgetRegistry.ts` — Widget registration system

5. **Client API**
   - `src/lib/persistenceClient.ts` — Add `fetchUserPreferences()`, `updateUserPreferences()`

### Files to Modify

1. **Server**
   - `src/server/index.ts` — Register user preferences routes

2. **Client**
   - `src/components/Layout.tsx` — Wire Settings button to open modal
   - `src/components/ProgressDashboard.tsx` — Use widget registry instead of hardcoded widgets
   - `src/lib/persistenceClient.ts` — Add preferences API calls

3. **Models**
   - `src/models/persistenceTypes.ts` — Add `UserPreferences` to schema

---

## Implementation Order Recommendation

1. **Phase 1: Data Layer**
   - Create `UserPreferences` model
   - Create repository + routes
   - Create client API functions

2. **Phase 2: State Management**
   - Create `UserPreferencesContext`
   - Wire to server API

3. **Phase 3: Persona Types**
   - Create `personaTypes.ts` from canonical docs
   - Define persona registry

4. **Phase 4: UI**
   - Create `SettingsModal` with persona selector
   - Create widget registry
   - Modify `ProgressDashboard` to use registry

5. **Phase 5: Integration**
   - Wire Settings button to modal
   - Test persona switching
   - Test widget visibility/order

---

## Notes

- **No User Model**: System uses `userId` string, not a User entity. Preferences can be stored as a separate collection keyed by `userId`.
- **Canonical Docs**: Persona definitions exist in `docs/reference/personas/` — implementation must match these docs.
- **Widget System**: Currently hardcoded — needs refactoring to support persona-based visibility.
- **Settings UI**: Currently non-functional — needs implementation from scratch.

