# HabitFlow Routines Feature Audit

**Date**: 2026-03-14
**Purpose**: Complete architectural audit of the Routines feature prior to introducing Routine Variants.
**Scope**: Data models, persistence, creation flow, execution lifecycle, UI architecture, analytics, coupling risks, and technical debt.

---

## 1 — High Level Overview

A **Routine** in HabitFlow is a guided, step-by-step workflow that helps users complete a sequence of related activities. Routines serve as **support structures** — they do not track completion or progress themselves. Instead, they optionally generate `HabitEntry` records (the system's single source of truth for habit completion) only when users explicitly confirm.

### What a Routine Represents

A routine is a reusable template consisting of an ordered list of steps. Each step can include a title, instructions, an optional timer, an optional image, and an optional link to a habit. Routines are scoped to a user and optionally grouped by category.

### How Steps Are Structured

Steps are embedded directly inside the `Routine` document as an ordered array. Each step has a unique `id` (UUID), a `title`, and optional fields: `instruction`, `imageUrl`, `timerSeconds`, and `linkedHabitId`. Steps do not exist as independent entities — they are always part of a routine.

### How Routines Relate to Habits

Routines connect to habits through two mechanisms:

1. **`Routine.linkedHabitIds`**: An array of habit IDs that the routine is "in service of." When a user completes a routine and opts to log habits, these are the habits presented for confirmation.
2. **`RoutineStep.linkedHabitId`**: An individual step can link to a specific habit. When the user reaches that step during execution, `HabitPotentialEvidence` is generated as a UI hint (never as actual completion).

The linking is bidirectional: habits also store `linkedRoutineIds` to enable reverse lookups (e.g., showing a "play" button on a habit row in the tracker grid).

### How Users Interact with Routines

1. **Browse**: Users view routines grouped by category in the `RoutineList` page.
2. **Preview**: Clicking a routine opens `RoutinePreviewModal` showing steps, duration, and linked habits.
3. **Execute**: Starting a routine opens `RoutineRunnerModal` — a step-by-step guided view with timers, navigation, and step status tracking.
4. **Complete**: At the end, the user can complete the routine without logging habits, or choose to log specific linked habits via `CompletedHabitsModal`.
5. **Dashboard**: Users can pin routines to their dashboard via `PinnedRoutinesCard` for quick access.

### Core Semantic Rule

> **Routines never imply completion; only HabitEntries do.**

Completing a routine creates a `RoutineLog` record but does NOT auto-create `HabitEntry` records. Progress, streaks, and day view derive completion exclusively from `HabitEntry`. This is enforced by a dedicated guardrail test (`routines.completion-guardrail.test.ts`).

---

## 2 — Data Model Analysis

### 2.1 Routine

**File**: `src/models/persistenceTypes.ts` (lines 368–420)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID, application-level primary key |
| `userId` | `string` | Yes | Scopes routine to a user |
| `title` | `string` | Yes | Display name |
| `categoryId` | `string` | No | Groups routine under a category |
| `linkedHabitIds` | `string[]` | Yes | Habits offered for logging on completion |
| `steps` | `RoutineStep[]` | Yes | Ordered step list (embedded) |
| `icon` | `string` | No | Lucide icon key or emoji |
| `color` | `string` | No | Tailwind CSS color class |
| `imageId` | `string` | No | Reference to `routine_images` collection |
| `imageUrl` | `string \| null` | No | Computed image URL (set by API) |
| `createdAt` | `string` | Yes | ISO 8601 timestamp |
| `updatedAt` | `string` | Yes | ISO 8601 timestamp |

**Example JSON**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "userId": "user-123",
  "title": "Morning Workout",
  "categoryId": "cat-fitness",
  "linkedHabitIds": ["habit-pushups", "habit-stretching"],
  "steps": [
    {
      "id": "step-1",
      "title": "Warm Up",
      "instruction": "5 minutes of light jogging",
      "timerSeconds": 300,
      "linkedHabitId": "habit-stretching"
    },
    {
      "id": "step-2",
      "title": "Push-ups",
      "instruction": "3 sets of 15",
      "timerSeconds": 180,
      "linkedHabitId": "habit-pushups"
    }
  ],
  "icon": "Dumbbell",
  "color": "bg-emerald-500",
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-03-01T10:30:00.000Z"
}
```

### 2.2 RoutineStep

**File**: `src/models/persistenceTypes.ts` (lines 330–365)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID, unique within the routine |
| `title` | `string` | Yes | Step display name |
| `instruction` | `string` | No | Detailed instructions |
| `imageUrl` | `string` | No | Visual guidance image |
| `timerSeconds` | `number` | No | Duration for timer-based steps |
| `linkedHabitId` | `string` | No | Habit to generate evidence for when reached |

**Note**: Steps are **embedded** in the `Routine` document, not stored in a separate collection. Step IDs are auto-generated if not provided.

### 2.3 RoutineLog

**File**: `src/models/persistenceTypes.ts` (lines 422–441)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `routineId` | `string` | Yes | FK to `Routine.id` |
| `date` | `string` | Yes | YYYY-MM-DD format |
| `completedAt` | `string` | Yes | ISO 8601 completion timestamp |

**Storage key**: Composite `${routineId}-${date}` — one log per routine per day.

**Example JSON**:
```json
{
  "routineId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2026-03-14",
  "completedAt": "2026-03-14T07:45:00.000Z"
}
```

### 2.4 HabitPotentialEvidence

**File**: `src/models/persistenceTypes.ts` (lines 1268–1294)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID |
| `habitId` | `string` | Yes | FK to `Habit.id` |
| `routineId` | `string` | Yes | FK to `Routine.id` |
| `stepId` | `string` | Yes | FK to `RoutineStep.id` |
| `date` | `string` | Yes | YYYY-MM-DD format |
| `timestamp` | `string` | Yes | ISO 8601 |
| `source` | `'routine-step'` | Yes | Always `'routine-step'` |

**Purpose**: Generated automatically when a user reaches a step with a `linkedHabitId`. Used as a UI hint only — never counts toward habit completion.

### 2.5 Related Fields on Other Models

**HabitEntry** (`src/models/persistenceTypes.ts`):
- `source: 'manual' | 'routine' | 'quick' | 'import' | 'test'` — tracks provenance
- `routineId?: string` — optional reference to originating routine

**Habit** (`src/models/persistenceTypes.ts`):
- `linkedRoutineIds?: string[]` — reverse link for UI display (e.g., play buttons on tracker)

**DayLog** (`src/models/persistenceTypes.ts`):
- `source?: 'manual' | 'routine'` — indicates if entry came from routine
- `routineId?: string` — FK to originating routine

---

## 3 — Persistence Layer

### 3.1 MongoDB Collections

| Collection | Constant | Purpose |
|-----------|----------|---------|
| `routines` | `MONGO_COLLECTIONS.ROUTINES` | Routine definitions |
| `routineLogs` | `MONGO_COLLECTIONS.ROUTINE_LOGS` | Completion records |
| `routineImages` | `MONGO_COLLECTIONS.ROUTINE_IMAGES` | Binary image storage |
| `habitPotentialEvidence` | `MONGO_COLLECTIONS.HABIT_POTENTIAL_EVIDENCE` | Step evidence records |

### 3.2 Repository Files

#### routineRepository.ts
**File**: `src/server/repositories/routineRepository.ts`

| Operation | Method | Filter Pattern |
|-----------|--------|----------------|
| List all | `find()` | `{ householdId, userId }`, sorted by `{ updatedAt: -1 }` |
| Get one | `findOne()` | `{ householdId, userId, id }` |
| Create | `insertOne()` | Auto-generates `id`, `createdAt`, `updatedAt`, step IDs |
| Update | `findOneAndUpdate()` | `$set` with patch, auto-generates missing step IDs |
| Delete | `deleteOne()` | `{ householdId, userId, id }` |

All queries use `scopeFilter(householdId, userId)` for multi-tenancy. Scope fields (`_id`, `userId`, `householdId`) are stripped before returning to the client.

#### routineLogRepository.ts
**File**: `src/server/repositories/routineLogRepository.ts`

| Operation | Method | Key Pattern |
|-----------|--------|-------------|
| Upsert | `findOneAndUpdate()` | Composite key `${routineId}-${date}`, upsert: true |
| List by user | `find()` | `{ userId }`, returns `Record<compositeKey, RoutineLog>` |

#### routineImageRepository.ts
**File**: `src/server/repositories/routineImageRepository.ts`

| Operation | Method | Details |
|-----------|--------|---------|
| Upsert | `findOneAndUpdate()` | Unique index on `routineId` (one image per routine) |
| Get | `findOne()` | `{ routineId }`, converts Binary → Buffer |
| Delete | `deleteOne()` | `{ routineId }` |

Image constraints: Max 5MB, JPEG/PNG/WebP only. Stored as MongoDB Binary BSON.

### 3.3 API Endpoints

**File**: `src/server/routes/routines.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/routines` | GET | Fetch all routines for user |
| `/api/routines/:id` | GET | Fetch single routine |
| `/api/routines` | POST | Create routine |
| `/api/routines/:id` | PATCH | Update routine |
| `/api/routines/:id` | DELETE | Delete routine |
| `/api/routines/:id/submit` | POST | Complete routine + optionally log habits |
| `/api/routines/:routineId/image` | GET | Retrieve routine image |
| `/api/routines/:routineId/image` | POST | Upload routine image |
| `/api/routines/:routineId/image` | DELETE | Delete routine image |

**File**: `src/server/routes/routineLogs.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/routineLogs` | GET | Fetch all routine logs for user |

**File**: `src/server/routes/habitPotentialEvidence.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/evidence/step-reached` | POST | Record step evidence |

**File**: `src/server/routes/habitEntries.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/entries/batch` | POST | Batch create entries (supports `source: 'routine'`) |

### 3.4 Frontend API Client

**File**: `src/lib/persistenceClient.ts`

Key routine functions:
- `fetchRoutines()` → `GET /routines`
- `fetchRoutine(id)` → `GET /routines/:id`
- `createRoutine(data)` → `POST /routines`
- `updateRoutine(id, patch)` → `PATCH /routines/:id`
- `deleteRoutine(id)` → `DELETE /routines/:id`
- `submitRoutine(id, payload)` → `POST /routines/:id/submit`
- `uploadRoutineImage(routineId, file)` → `POST /routines/:routineId/image`
- `deleteRoutineImage(routineId)` → `DELETE /routines/:routineId/image`
- `fetchRoutineLogs()` → `GET /routineLogs`
- `recordRoutineStepReached(routineId, stepId, date)` → `POST /evidence/step-reached`
- `batchCreateEntries(payload)` → `POST /entries/batch`

### 3.5 State Management

**File**: `src/store/RoutineContext.tsx`

The `RoutineProvider` wraps the entire app and provides:
- **Persistent data**: `routines`, `routineLogs`, `loading`, `error`
- **CRUD operations**: `addRoutine`, `updateRoutine`, `deleteRoutine`, `refreshRoutines` (with optimistic updates)
- **Execution state**: `activeRoutine`, `executionState` (`browse` | `preview` | `execute`), `currentStepIndex`, `stepStates`
- **Execution actions**: `selectRoutine`, `startRoutine`, `exitRoutine`, `nextStep`, `prevStep`, `skipStep`, `setStepState`

Data is loaded from API on mount via `fetchRoutines()` and `fetchRoutineLogs()`.

---

## 4 — Routine Creation Flow

### 4.1 User Action

User navigates to the Routines page and clicks "+ New Routine", which triggers `onCreateRoutine()` in `App.tsx`, setting `routineEditorState` to `{ isOpen: true, mode: 'create' }`.

### 4.2 UI Component: RoutineEditorModal

**File**: `src/components/RoutineEditorModal.tsx`

The editor provides:
- **Title input** (required)
- **Category selector** (optional, filters linked habits)
- **Steps list** — each step has:
  - Title (required)
  - Instructions (optional)
  - Timer in minutes (optional, converted to seconds)
  - Image URL (optional, uses object URLs for step images)
  - Linked Habit selector (optional, filtered by category)
- **Routine image upload** (edit mode only; image stored in MongoDB)

### 4.3 Step Management

Steps are managed entirely in local component state:
```
addStep() → generates UUID → appends to steps array
updateStep(id, updates) → merges updates into matching step
removeStep(id) → filters step out of array
```

Step IDs are generated client-side via `crypto.randomUUID()`. The backend also auto-generates IDs for any steps missing them.

### 4.4 Validation

**Client-side** (RoutineEditorModal):
- Title must be non-empty after trimming
- At least one step is implied (no explicit enforcement found)

**Server-side** (`src/server/routes/routines.ts`):
- `validateSteps(steps)`: Validates steps is an array; each step must have non-empty `id` (string) and `title` (string); optional fields validated for type.
- `validateRoutineStep(step, index)`: Per-step validation of field types and constraints (e.g., `durationSeconds` must be non-negative).

### 4.5 API Call

**Create**: `POST /api/routines` with body:
```json
{
  "title": "Morning Workout",
  "categoryId": "cat-fitness",
  "steps": [...],
  "linkedHabitIds": ["habit-1", "habit-2"]
}
```

`linkedHabitIds` is derived from the unique set of `step.linkedHabitId` values across all steps.

### 4.6 Bi-Directional Linking

On save, the editor syncs habit↔routine links:
1. For each newly linked habit: adds `routine.id` to `habit.linkedRoutineIds`
2. For each unlinked habit (edit mode): removes `routine.id` from `habit.linkedRoutineIds`

This is done via individual `updateHabit()` calls from the frontend — there is no server-side cascade.

### 4.7 Duration Estimation

Duration is calculated at display time:
```typescript
const totalDuration = routine.steps.reduce(
  (acc, step) => acc + (step.timerSeconds || 60), 0
);
const durationMinutes = Math.max(1, Math.ceil(totalDuration / 60));
```

Steps without a `timerSeconds` value default to 60 seconds for estimation purposes.

### 4.8 Files Responsible

| Step | File |
|------|------|
| User action | `src/App.tsx` (routineEditorState) |
| UI form | `src/components/RoutineEditorModal.tsx` |
| State management | `src/store/RoutineContext.tsx` (addRoutine) |
| API client | `src/lib/persistenceClient.ts` (createRoutine) |
| Route handler | `src/server/routes/routines.ts` (createRoutineRoute) |
| Database | `src/server/repositories/routineRepository.ts` (createRoutine) |

---

## 5 — Routine Execution Flow

### 5.1 Step 1: User Selects Routine

Entry points:
- **RoutineList** → click card → `RoutinePreviewModal` opens
- **PinnedRoutinesCard** → click pinned routine → runner opens directly
- **TrackerGrid** → click play button on habit row → runner opens for linked routine

### 5.2 Step 2: Preview (Optional)

**Component**: `RoutinePreviewModal`

Displays routine title, image, step count, estimated duration, linked habits, and step list. User clicks "Start Routine" to proceed.

### 5.3 Step 3: Routine Begins

**Component**: `RoutineRunnerModal`

On open:
1. `currentStepIndex` resets to 0
2. `isCompletionView` resets to false
3. Timer initializes to first step's `timerSeconds` (if present)
4. Context: `selectRoutine(routineId)` → `startRoutine()` → sets `executionState: 'execute'`, initializes all step states to `'neutral'`

### 5.4 Step 4: Steps Are Completed

For each step, the user can:
- **Mark Done**: Sets step state to `'done'`, advances to next step
- **Skip**: Sets step state to `'skipped'`, advances to next step
- **Navigate**: Back/Next buttons for step traversal

Timer behavior:
- If step has `timerSeconds`, countdown timer displays
- Play/Pause/Reset controls
- Timer does not auto-advance — user must manually proceed

**Evidence generation**: When `executionState === 'execute'` and current step has `linkedHabitId`, `RoutineContext` fires `POST /api/evidence/step-reached` to create `HabitPotentialEvidence`. This is a side effect in `useEffect`, not a user action.

### 5.5 Step 5: Execution State Updates

Step states are tracked in `RoutineContext.stepStates`:
```typescript
type StepStatus = 'neutral' | 'done' | 'skipped';
type StepStates = Record<string, StepStatus>;
```

State transitions are deterministic and immediate (no server round-trips during execution). The execution state machine is:

```
browse → preview → execute → (completion view) → browse
```

### 5.6 Step 6: Completion Recorded

When the user reaches the last step and clicks Next:
1. `isCompletionView` becomes true
2. User sees completion screen with options:
   - **"Complete Routine"** → `handleFinish(false)` — creates `RoutineLog` only
   - **"Complete + Log Habits"** → opens `CompletedHabitsModal` for habit selection

### 5.7 Submit Flow

```
handleFinish(logHabits) →
  POST /api/routines/:id/submit {
    submittedAt,
    habitIdsToComplete (if logging habits)
  } →
  Server:
    1. Validate routine exists and is owned by user
    2. Resolve logDate from dateOverride or submittedAt + timezone
    3. For each habitId in habitIdsToComplete:
       - Upsert HabitEntry (source: 'routine', routineId)
       - Recompute DayLog for habit
    4. Save RoutineLog (routineId + date composite key)
  →
  Client:
    refreshDayLogs() → exitRoutine() → close modal
```

### 5.8 CompletedHabitsModal Flow

When the user chooses to log habits:
1. `CompletedHabitsModal` opens with checkboxes for linked habits
2. User selects/deselects specific habits
3. On confirm: `submitRoutine()` called with selected habit IDs only
4. Only selected habits get `HabitEntry` records

### 5.9 Files Responsible

| Phase | File |
|-------|------|
| Preview | `src/components/RoutinePreviewModal.tsx` |
| Execution UI | `src/components/RoutineRunnerModal.tsx` |
| Step state management | `src/store/RoutineContext.tsx` |
| Habit selection | `src/components/CompletedHabitsModal.tsx` |
| API client | `src/lib/persistenceClient.ts` (submitRoutine) |
| Submit handler | `src/server/routes/routines.ts` (submitRoutineRoute) |
| Log persistence | `src/server/repositories/routineLogRepository.ts` |
| Entry creation | `src/server/routes/routines.ts` (within submitRoutineRoute) |
| Evidence recording | `src/server/routes/habitPotentialEvidence.ts` |

---

## 6 — UI Architecture

### 6.1 RoutineList

**File**: `src/components/RoutineList.tsx`
**Responsibility**: Main routines management page. Displays all routines grouped by category with collapsible sections in a grid layout.
**Key Props**: `onCreate`, `onEdit`, `onStart`, `onPreview` callbacks
**Key State**: `expandedCategories` (persisted in localStorage)
**Sub-components**: `RoutineCard` (individual routine tile), `CategorySection` (collapsible group)

### 6.2 RoutineEditorModal

**File**: `src/components/RoutineEditorModal.tsx`
**Responsibility**: Create and edit routines with full step management, category selection, image upload, and bi-directional habit linking.
**Key Props**: `isOpen`, `mode` (`'create'` | `'edit'`), `initialRoutine`, `onClose`
**Key State**: `title`, `categoryId`, `steps`, `validationError`, `uploadingStepId`, `expandedStepId`, `currentRoutineImageUrl`
**Context**: `useRoutineStore()` (CRUD), `useHabitStore()` (categories, habits, updateHabit)

### 6.3 RoutineRunnerModal

**File**: `src/components/RoutineRunnerModal.tsx`
**Responsibility**: Step-by-step execution with timer support, step status tracking (done/skipped), and completion flow with optional habit logging.
**Key Props**: `isOpen`, `routine`, `onClose`
**Key State**: `currentStepIndex`, `isCompletionView`, `timeLeft`, `isTimerRunning`, `submitting`, `showCompletedHabitsModal`
**Context**: `useRoutineStore()` (execution actions), `useHabitStore()` (refreshDayLogs, habits)

### 6.4 RoutinePreviewModal

**File**: `src/components/RoutinePreviewModal.tsx`
**Responsibility**: Read-only preview of routine details before starting. Shows step list, duration estimate, linked habits, and routine image.
**Key Props**: `isOpen`, `routine`, `onClose`, `onStart`
**Context**: `useHabitStore()` (habits for displaying linked habit names)

### 6.5 PinnedRoutinesCard

**File**: `src/components/dashboard/PinnedRoutinesCard.tsx`
**Responsibility**: Dashboard widget showing user-pinned routines with completion status, custom icons/colors, and quick-start button.
**Key Props**: `onStartRoutine`, `onViewAllRoutines`
**Key State**: `showManage`, `customizingId`
**Custom Hook**: `usePinnedRoutines()` — manages pin state in localStorage (`hf_pinned_routines`)
**Context**: `useRoutineStore()` (routines, routineLogs, updateRoutine)

### 6.6 CompletedHabitsModal

**File**: `src/components/CompletedHabitsModal.tsx`
**Responsibility**: Post-completion modal allowing users to select which linked habits to log as complete.
**Key Props**: `isOpen`, `routine`, `onLogSelected`, `onClose`

### 6.7 TrackerGrid Integration

**File**: `src/components/TrackerGrid.tsx`
**Responsibility**: Shows play buttons on habits with linked routines; context menu lists linked routines for quick start.
**Context**: `useRoutineStore()` (routines)

### 6.8 ProgressDashboard

**File**: `src/components/ProgressDashboard.tsx`
**Responsibility**: Contains `PinnedRoutinesCard` widget. Passes `onStartRoutine` callback.

### 6.9 App-Level Orchestration

**File**: `src/App.tsx`

Three modal state buckets:
- `routineEditorState: { isOpen, mode, routine? }`
- `routineRunnerState: { isOpen, routine? }`
- `routinePreviewState: { isOpen, routine? }`

The `<RoutineProvider>` wraps the entire application (line 542).

---

## 7 — Analytics Dependencies

### 7.1 Completion Tracking

**RoutineLog** records a completion event per routine per day. The `routineLogs` state (keyed by `${routineId}-${date}`) enables:
- `PinnedRoutinesCard` to show check marks on completed routines today
- Potential future streak/frequency analysis (not currently implemented)

### 7.2 Habit Entry Source Attribution

Every `HabitEntry` created from a routine carries:
- `source: 'routine'` — distinguishes from manual, quick, import entries
- `routineId: string` — FK to originating routine

This propagates through:
- **DaySummary** (`src/server/routes/daySummary.ts`): `AggregatedDayEntry` tracks `latestRoutineId` and `latestSource`
- **TruthQuery** (`src/server/services/truthQuery.ts`): `EntryView.provenance.routineId` carries routine attribution for charts/progress
- **DayLog**: `source` and `routineId` fields visible to frontend

### 7.3 Duration Tracking

Duration is estimated but not measured. The system calculates expected duration from step timers but does not record actual execution time. `RoutineLog.completedAt` timestamp is the only time marker — there is no `startedAt` field in the current `RoutineLog` model.

### 7.4 Streaks

Routine-specific streaks are **not implemented**. Streaks are computed at the habit level via `streakService.ts`, which operates on `HabitEntry` records. Routine completions (via `RoutineLog`) do not feed into streak calculations.

### 7.5 Evidence Tracking

`HabitPotentialEvidence` records are created when steps with `linkedHabitId` are reached during execution. These are informational only — they do not contribute to any analytics, progress, or streak calculations.

### 7.6 Key Analytics Files

| File | Routine Relevance |
|------|------------------|
| `src/server/routes/daySummary.ts` | Includes `routineId` and `source` in aggregated day entries |
| `src/server/services/truthQuery.ts` | Maps entry `routineId` to `provenance.routineId` |
| `src/server/services/streakService.ts` | No direct routine dependency (operates on HabitEntry) |
| `src/server/routes/progress.ts` | No direct routine dependency |

---

## 8 — Architectural Assumptions

The following assumptions are embedded in the current codebase. **Each is a potential breakpoint for Routine Variants.**

### 8.1 A Routine Has Exactly One Step List

The `Routine` interface has a single `steps: RoutineStep[]` field. Every component — editor, runner, preview, list — reads from this single array. There is no concept of alternative step sequences.

**Impact**: Variants would require either multiple `steps` arrays or a separate `RoutineVariant` entity with its own step list.

### 8.2 A Routine Has One Set of Linked Habits

`Routine.linkedHabitIds` is a flat array. All linked habits are presented equally at completion. Different variants might need different habit associations.

**Impact**: `linkedHabitIds` may need to move to the variant level, or be computed from variant-specific steps.

### 8.3 RoutineLog Records One Completion Per Day

The composite key `${routineId}-${date}` allows exactly one log per routine per day. There is no field to indicate which variant was executed.

**Impact**: Variants would require adding a `variantId` to `RoutineLog`, or changing the composite key to include variant.

### 8.4 Duration Is Derived from a Single Step List

Duration estimation sums `timerSeconds` across the single step list with a 60-second default per step. Variants with different step counts would need per-variant duration calculation.

### 8.5 Routine Images Are 1:1

The `routine_images` collection has a unique index on `routineId` — exactly one image per routine. Variants might want different images.

### 8.6 Execution State Assumes One Active Configuration

`RoutineContext` execution state (`activeRoutine`, `stepStates`, `currentStepIndex`) assumes a single step list. The runner modal navigates `steps[currentStepIndex]` directly.

### 8.7 Evidence Is Tied to Fixed Step IDs

`HabitPotentialEvidence` references `stepId` from the single step list. If variants have different steps, evidence records need to know which variant's steps are being referenced.

### 8.8 Pinned Routine Cards Show One State

`PinnedRoutinesCard` checks completion via `routineLogs[${routineId}-${today}]`. With variants, the UI would need to distinguish "which variant was completed today."

### 8.9 Bi-Directional Linking Is Flat

`RoutineEditorModal` syncs `habit.linkedRoutineIds` based on `routine.linkedHabitIds`. If variants have different linked habits, the sync logic would need to account for variant-level links.

---

## 9 — Coupling Risks

### 9.1 Habits ↔ Routines (HIGH RISK)

**Coupling points**:
- `Routine.linkedHabitIds` ↔ `Habit.linkedRoutineIds` — bi-directional sync in `RoutineEditorModal`
- `RoutineStep.linkedHabitId` — step-level habit linking
- `HabitEntry.routineId` — provenance tracking
- `TrackerGrid` — shows play buttons based on `routine.linkedHabitIds.includes(habit.id)`
- `submitRoutineRoute` — creates `HabitEntry` records from `habitIdsToComplete`

**Why risky**: If variants have different linked habits, every one of these coupling points must be updated. The bi-directional sync in the editor is particularly fragile — it's done client-side with individual API calls.

### 9.2 Analytics ↔ Routines (MEDIUM RISK)

**Coupling points**:
- `HabitEntry.source: 'routine'` and `HabitEntry.routineId`
- `DaySummary` aggregates `latestRoutineId`
- `TruthQuery` maps to `provenance.routineId`

**Why risky**: Analytics currently attributes entries to a routine but has no variant concept. Adding `variantId` to provenance means updating `DaySummary` aggregation, `TruthQuery` mapping, and any UI that displays entry sources.

### 9.3 UI Structure ↔ Single Step List (HIGH RISK)

**Coupling points**:
- `RoutineRunnerModal` — iterates `routine.steps[currentStepIndex]`
- `RoutinePreviewModal` — lists `routine.steps` and computes duration from them
- `RoutineEditorModal` — manages `steps` as local state array
- `RoutineList` — computes step count and duration from `routine.steps`

**Why risky**: Every UI component directly accesses `routine.steps`. Variants would mean the runner must know which variant's steps to use, the preview must show variant-specific details, and the editor must manage multiple step lists.

### 9.4 Execution Logic ↔ Fixed Model (MEDIUM RISK)

**Coupling points**:
- `RoutineContext.startRoutine()` — initializes step states from `activeRoutine.steps`
- `RoutineContext.stepStates` — keyed by step IDs from the single step list
- Evidence generation effect — fires based on `activeRoutine.steps[currentStepIndex]`

**Why risky**: The execution state machine has no concept of variant selection. Introducing variants requires a variant selection step before execution begins, and the step state initialization must use the selected variant's steps.

### 9.5 RoutineLog ↔ Composite Key (MEDIUM RISK)

**Coupling point**: `routineLogRepository` uses `${routineId}-${date}` as composite key.

**Why risky**: If a user can run different variants of the same routine on the same day, the current composite key cannot distinguish between them. This either needs to become `${routineId}-${variantId}-${date}` or allow multiple logs per routine per day.

---

## 10 — Key Files Map

### Data Models & Types

| File | Purpose |
|------|---------|
| `src/models/persistenceTypes.ts` | `Routine`, `RoutineStep`, `RoutineLog`, `HabitPotentialEvidence` type definitions; `MONGO_COLLECTIONS` constants |
| `src/types/index.ts` | Re-exports `Routine`, `RoutineStep` types |
| `src/server/domain/canonicalTypes.ts` | `EntrySource` type including `'routine'`; `HabitEntryRecord` with `routineId` |
| `src/server/domain/canonicalValidators.ts` | Entry payload validation (validates `source: 'routine'`) |

### Persistence Layer

| File | Purpose |
|------|---------|
| `src/server/repositories/routineRepository.ts` | Routine CRUD operations against MongoDB |
| `src/server/repositories/routineLogRepository.ts` | RoutineLog upsert and retrieval |
| `src/server/repositories/routineImageRepository.ts` | Binary image storage (one per routine) |

### API Routes

| File | Purpose |
|------|---------|
| `src/server/routes/routines.ts` | All routine CRUD endpoints + submit + image endpoints |
| `src/server/routes/routineLogs.ts` | RoutineLog retrieval endpoint |
| `src/server/routes/habitPotentialEvidence.ts` | Evidence recording for step-reached events |
| `src/server/routes/habitEntries.ts` | Batch entry creation (supports `source: 'routine'`) |
| `src/server/routes/daySummary.ts` | Aggregates routine source and routineId into day summaries |
| `src/server/routes/dashboardPrefs.ts` | Pinned routine IDs in dashboard preferences |

### Frontend State

| File | Purpose |
|------|---------|
| `src/store/RoutineContext.tsx` | Global routine state, CRUD operations, execution state machine |
| `src/lib/persistenceClient.ts` | API client for all routine operations |

### UI Components

| File | Purpose |
|------|---------|
| `src/components/RoutineList.tsx` | Main routines page — lists, groups by category |
| `src/components/RoutineEditorModal.tsx` | Create/edit routines with step management |
| `src/components/RoutineRunnerModal.tsx` | Step-by-step execution with timer |
| `src/components/RoutinePreviewModal.tsx` | Read-only routine preview before starting |
| `src/components/CompletedHabitsModal.tsx` | Post-completion habit logging selection |
| `src/components/dashboard/PinnedRoutinesCard.tsx` | Dashboard widget for pinned routines |
| `src/components/TrackerGrid.tsx` | Play buttons and context menus for linked routines |
| `src/components/ProgressDashboard.tsx` | Dashboard container with PinnedRoutinesCard |
| `src/App.tsx` | App-level routing and modal state orchestration |

### Tests

| File | Purpose |
|------|---------|
| `src/server/routes/__tests__/routines.validation.test.ts` | DayKey validation for submit |
| `src/server/routes/__tests__/routines.submit.test.ts` | Submit route integration tests |
| `src/server/routes/__tests__/routines.completion-guardrail.test.ts` | Guardrail: routine alone doesn't create HabitEntries |
| `src/store/RoutineContext.test.tsx` | Execution state management unit tests |
| `src/server/repositories/__tests__/routineImageRepository.test.ts` | Image repo integration tests |

### Documentation

| File | Purpose |
|------|---------|
| `docs/reference/V2 (Current - iOS focus)/03_Routine.md` | Canonical routine architecture and invariants |
| `docs/audits/m3_routines_map.md` | Previous routines execution flow audit |
| `docs/audits/m3_routines_semantics.md` | Semantic rules (routines never imply completion) |
| `docs/reference/V1/03_ROUTINE_EXECUTION.md` | V1 routine execution reference |

---

## 11 — Technical Debt

### 11.1 Duplicated Execution State

`RoutineRunnerModal` manages its own `currentStepIndex` and step completion state locally, while `RoutineContext` also provides `currentStepIndex`, `stepStates`, and navigation functions (`nextStep`, `prevStep`, `skipStep`). The modal calls context methods (`selectRoutine`, `startRoutine`, `exitRoutine`, `setStepState`) but also maintains parallel local state. This creates confusion about which state is authoritative during execution.

### 11.2 Client-Side Bi-Directional Sync

The `RoutineEditorModal` syncs `habit.linkedRoutineIds` with `routine.linkedHabitIds` via individual `updateHabit()` API calls from the frontend. This is fragile: if any call fails mid-sync, the links become inconsistent. This should ideally be a server-side transaction.

### 11.3 Step Image vs Routine Image Inconsistency

Routine-level images are persisted to MongoDB via the `routineImages` collection. Step-level images use `URL.createObjectURL()` — they are local object URLs that are not persisted to the backend. This means step images are lost on refresh.

### 11.4 Pin State in localStorage

`PinnedRoutinesCard` stores pinned routine IDs in `localStorage` (`hf_pinned_routines`). `dashboardPrefs` has a `pinnedRoutineIds` field server-side, but the frontend widget reads from localStorage. This means pinned routines don't sync across devices.

### 11.5 Missing `startedAt` on RoutineLog

`RoutineLog` only has `completedAt`. There is no `startedAt` timestamp, so actual execution duration cannot be computed. The canonical docs mention `RoutineExecution.startedAtUtc` as a concept, but it's not implemented.

### 11.6 Unused Context Execution Methods

`RoutineContext` provides `nextStep()`, `prevStep()`, `skipStep()` methods, but `RoutineRunnerModal` manages navigation via its own local `currentStepIndex` state. The context navigation methods appear to be under-utilized or redundant.

### 11.7 No Cascade on Routine Deletion

Deleting a routine via `deleteRoutine()` removes the routine document but does not clean up:
- `RoutineLog` entries referencing the routine
- `HabitPotentialEvidence` records referencing the routine
- `habit.linkedRoutineIds` references on linked habits
- Routine images in the `routineImages` collection

### 11.8 Inconsistent Timer Field Naming

The `RoutineStep` type uses `timerSeconds`, but the validation function in `routines.ts` checks for `durationSeconds`. The `persistenceTypes.ts` comment notes this was renamed but the validation may not have been fully updated.

### 11.9 No Optimistic Revert on Failure

`RoutineContext` performs optimistic updates (immediately updating local state on CRUD), but does not revert state if the API call fails. A failed `addRoutine()` throws, but the routine has already been added to local state.

---

## 12 — Summary

### Overall Architecture

HabitFlow's routines system is a well-designed support structure built around a clear philosophical principle: **routines enable habits but never own completion**. The architecture separates routine definitions (templates with steps), execution (ephemeral step-by-step state), and truth (HabitEntry records). This separation is enforced by a guardrail test and documented in canonical reference materials.

The system spans 4 MongoDB collections (`routines`, `routineLogs`, `routineImages`, `habitPotentialEvidence`), 7 primary UI components, a React context for state management, and ~10 API endpoints.

### Major Risks for Introducing Routine Variants

1. **Single Step List Assumption (CRITICAL)**: Every component — editor, runner, preview, list, context — assumes `routine.steps` is the one and only step list. This is the single most pervasive assumption in the codebase and touches the most files.

2. **RoutineLog Composite Key (HIGH)**: The `${routineId}-${date}` key prevents logging multiple variant completions per day and carries no variant information.

3. **Habit Linking at Routine Level (HIGH)**: `linkedHabitIds` and bi-directional sync operate at the routine level. Variants with different habits would require re-architecting the linking model.

4. **Analytics Provenance (MEDIUM)**: `HabitEntry.routineId` and `DaySummary.latestRoutineId` lack variant attribution. Adding variant tracking requires updating the entry creation flow and aggregation logic.

5. **Evidence System (MEDIUM)**: `HabitPotentialEvidence.stepId` references steps from the single list. Variant-specific steps need variant context.

6. **Duplicated State (LOW)**: The runner modal's local state vs. context state duplication will become more complex with variant selection added to the execution flow.

### Most Critical Areas of the Codebase

1. **`src/models/persistenceTypes.ts`** — Where the data model must be extended
2. **`src/server/routes/routines.ts`** — Submit route and CRUD must handle variants
3. **`src/store/RoutineContext.tsx`** — State machine needs variant selection phase
4. **`src/components/RoutineRunnerModal.tsx`** — Execution UI must use variant steps
5. **`src/components/RoutineEditorModal.tsx`** — Editor must manage multiple step lists
6. **`src/server/repositories/routineLogRepository.ts`** — Composite key needs variant dimension
