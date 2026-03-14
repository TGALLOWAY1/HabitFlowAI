# HabitFlow Routine Variants — Implementation Plan

**Date**: 2026-03-14
**Status**: Proposed
**Author**: Architecture Review
**Scope**: Full-stack implementation of Routine Variants across schema, API, UI, analytics, and AI integration

---

## Table of Contents

1. [Codebase Audit](#1--codebase-audit)
2. [Architectural Assessment](#2--architectural-assessment)
3. [Proposed Data Model](#3--proposed-data-model)
4. [Migration Strategy](#4--migration-strategy)
5. [UI Architecture Changes](#5--ui-architecture-changes)
6. [Execution Flow](#6--execution-flow)
7. [AI Integration (Gemini)](#7--ai-integration-gemini)
8. [Implementation Plan](#8--implementation-plan)
9. [Risks and Edge Cases](#9--risks-and-edge-cases)

---

## 1 — Codebase Audit

### 1.1 Current Data Models

#### Routine (`src/models/persistenceTypes.ts:376-420`)

The core entity. Contains an embedded `steps: RoutineStep[]` array, a flat `linkedHabitIds: string[]`, and display metadata (`icon`, `color`, `imageId`). Scoped by `userId`. No concept of variants or alternative step sequences.

#### RoutineStep (`src/models/persistenceTypes.ts:338-365`)

Embedded within `Routine.steps`. Each step has `id`, `title`, optional `instruction`, `imageUrl`, `timerSeconds`, and `linkedHabitId`. Steps are not independent entities — they exist only as part of the parent routine's single step array.

#### RoutineLog (`src/models/persistenceTypes.ts:432-441`)

Completion record keyed by composite `${routineId}-${date}`. Fields: `routineId`, `date`, `completedAt`. No `variantId`, no `startedAt`, no step-level completion data.

#### HabitPotentialEvidence (`src/models/persistenceTypes.ts:1268-1294`)

Generated when a step with `linkedHabitId` is reached during execution. References `routineId` and `stepId` but has no variant context.

#### Related Fields on Other Models

| Model | Field | Purpose |
|-------|-------|---------|
| `HabitEntry` | `source: 'routine'` | Provenance tracking |
| `HabitEntry` | `routineId?: string` | FK to originating routine |
| `Habit` | `linkedRoutineIds?: string[]` | Reverse lookup for UI play buttons |
| `DayLog` | `source?: 'routine'` | Entry source indicator |
| `DayLog` | `routineId?: string` | FK to originating routine |

### 1.2 How Routines Are Created, Edited, Executed, and Persisted

#### Creation Flow

```
User clicks "+ New Routine" (App.tsx)
  → RoutineEditorModal opens (mode: 'create')
    → User fills title, category, steps, linked habits
    → Client validates (title non-empty)
    → POST /api/routines (persistenceClient.ts → routines.ts → routineRepository.ts)
    → Server validates steps, auto-generates IDs, inserts into MongoDB `routines` collection
    → Client syncs habit.linkedRoutineIds via individual updateHabit() calls
```

**Files**: `App.tsx` (modal state), `RoutineEditorModal.tsx` (form UI), `persistenceClient.ts` (API client), `routines.ts` (route handler), `routineRepository.ts` (MongoDB CRUD)

#### Edit Flow

Same as creation but with `mode: 'edit'` and `PATCH /api/routines/:id`. The editor diffs `linkedHabitIds` to sync bi-directional links.

#### Execution Flow

```
User selects routine → RoutinePreviewModal → "Start Routine"
  → RoutineRunnerModal opens
    → Steps navigated one by one (done/skip)
    → Evidence generated for steps with linkedHabitId
    → Completion screen: "Complete" or "Complete + Log Habits"
    → POST /api/routines/:id/submit
    → Server creates HabitEntries (if requested) + RoutineLog
```

**Files**: `RoutinePreviewModal.tsx`, `RoutineRunnerModal.tsx`, `RoutineContext.tsx` (execution state machine), `CompletedHabitsModal.tsx`, `routines.ts:submitRoutineRoute`

#### Persistence

| Collection | Repository | Key Pattern |
|-----------|-----------|-------------|
| `routines` | `routineRepository.ts` | `{ householdId, userId, id }` |
| `routineLogs` | `routineLogRepository.ts` | `${routineId}-${date}` composite |
| `routineImages` | `routineImageRepository.ts` | Unique index on `routineId` (1:1) |
| `habitPotentialEvidence` | via `habitPotentialEvidence.ts` route | `{ habitId, routineId, stepId, date }` |

### 1.3 UI Components

| Component | File | Role |
|-----------|------|------|
| `RoutineList` | `src/components/RoutineList.tsx` | Dashboard — lists routines grouped by category |
| `RoutineEditorModal` | `src/components/RoutineEditorModal.tsx` | Create/edit form with step management |
| `RoutineRunnerModal` | `src/components/RoutineRunnerModal.tsx` | Step-by-step execution with timers |
| `RoutinePreviewModal` | `src/components/RoutinePreviewModal.tsx` | Read-only preview before starting |
| `CompletedHabitsModal` | `src/components/CompletedHabitsModal.tsx` | Post-completion habit selection |
| `PinnedRoutinesCard` | `src/components/dashboard/PinnedRoutinesCard.tsx` | Dashboard widget |
| `TrackerGrid` | `src/components/TrackerGrid.tsx` | Play buttons on habit rows |
| `ProgressDashboard` | `src/components/ProgressDashboard.tsx` | Dashboard container |
| `App` | `src/App.tsx` | Modal orchestration |

### 1.4 "Single Version" Coupling Points

Every file below assumes a routine has exactly one step list and one configuration:

| Location | Assumption | Impact |
|----------|------------|--------|
| `persistenceTypes.ts:401` | `steps: RoutineStep[]` — single array | Every consumer reads from this one array |
| `persistenceTypes.ts:398` | `linkedHabitIds: string[]` — flat, routine-level | No per-variant habit associations |
| `routineLogRepository.ts:29` | Composite key `${routineId}-${date}` | Cannot distinguish variant completions |
| `RoutineContext.tsx:174-179` | `startRoutine()` initializes from `activeRoutine.steps` | No variant selection step |
| `RoutineRunnerModal.tsx` | Navigates `routine.steps[currentStepIndex]` | Reads single step list directly |
| `RoutinePreviewModal.tsx` | Displays `routine.steps` and derives duration | Single step list for preview |
| `RoutineEditorModal.tsx` | Manages `steps` as single local state array | No concept of multiple step lists |
| `RoutineList.tsx` | Computes step count/duration from `routine.steps` | Single step list |
| `PinnedRoutinesCard.tsx` | Checks `routineLogs[${routineId}-${today}]` | No variant dimension |
| `routineImageRepository.ts` | Unique index on `routineId` | One image per routine |
| `routines.ts:810` | `submitRoutineRoute` writes `routineId` to HabitEntry | No variant attribution |
| `daySummary.ts` | Aggregates `latestRoutineId` | No variant in provenance |
| `truthQuery.ts` | Maps `provenance.routineId` | No variant in truth query |

---

## 2 — Architectural Assessment

### 2.1 Schema Constraints

| Constraint | Description | Severity |
|-----------|-------------|----------|
| Single `steps` array | `Routine.steps` is the only step container. Variants need separate step lists. | **CRITICAL** |
| Flat `linkedHabitIds` | Routine-level habit links. Variants may link to different habits. | **HIGH** |
| `RoutineLog` composite key | `${routineId}-${date}` allows one completion per routine per day. Cannot track which variant was run. | **HIGH** |
| No `estimatedDuration` field | Duration is computed from steps at display time. Variants need explicit duration metadata. | **MEDIUM** |
| 1:1 routine images | `routineImages` has unique index on `routineId`. Variants might want distinct images. | **LOW** |

### 2.2 Logic Assumptions

| Assumption | Location | Impact |
|-----------|----------|--------|
| Execution initializes from `activeRoutine.steps` | `RoutineContext.tsx:174-179` | Must resolve variant steps before execution start |
| Evidence references step IDs from single list | `habitPotentialEvidence.ts` | Step IDs from different variants could collide or be meaningless without variant context |
| Submit writes `routine.id` as provenance | `routines.ts:810` | No variant attribution in HabitEntry or analytics |
| Duration = sum of `step.timerSeconds` | Multiple UI components | Must compute per-variant |

### 2.3 UI Constraints

| Constraint | Description |
|-----------|-------------|
| Editor manages one step list | `RoutineEditorModal` has a single `steps` state variable and renders one sortable list |
| Runner iterates single array | `RoutineRunnerModal` uses `routine.steps[currentStepIndex]` |
| Preview shows one configuration | `RoutinePreviewModal` displays a single step list, step count, and total duration |
| No variant selector exists | There is no UI for choosing between variants before starting |

### 2.4 Analytics Limitations

| Limitation | Description |
|-----------|-------------|
| No variant in RoutineLog | Cannot query "how often does user run Quick vs Deep?" |
| No variant in HabitEntry provenance | Cannot attribute habit completions to specific variants |
| No actual duration tracking | `RoutineLog` has `completedAt` but no `startedAt` — cannot compare variant execution times |
| No step-level completion data | Cannot analyze which steps users skip in which variants |

---

## 3 — Proposed Data Model

### 3.1 Design Principles

1. **Additive, not destructive**: New types extend the existing model; existing fields remain for backwards compatibility during migration.
2. **Variants are owned by routines**: A `RoutineVariant` always belongs to one `Routine`.
3. **Steps move to variants**: The `steps` array migrates from `Routine` to `RoutineVariant`. The routine becomes a container.
4. **Linked habits derive from variant steps**: `linkedHabitIds` on a variant is computed from its steps' `linkedHabitId` fields.
5. **Execution records track variants**: `RoutineLog` gains a `variantId` field.

### 3.2 Entity Definitions

#### Routine (Updated)

```json
{
  "id": "routine-abc",
  "userId": "user-123",
  "title": "Meal Prep",
  "categoryId": "cat-cooking",
  "icon": "ChefHat",
  "color": "bg-amber-500",
  "imageId": "img-routine-abc",
  "imageUrl": "/api/routines/routine-abc/image",
  "defaultVariantId": "variant-standard",
  "variants": [
    { "$ref": "RoutineVariant" }
  ],
  "linkedHabitIds": ["habit-cooking", "habit-mealplan"],
  "steps": [],
  "createdAt": "2026-01-15T08:00:00.000Z",
  "updatedAt": "2026-03-14T10:00:00.000Z"
}
```

**Changes**:
- Added `defaultVariantId: string` — the variant to pre-select when starting
- Added `variants: RoutineVariant[]` — embedded array of variants (mirrors how steps are currently embedded)
- `steps` becomes empty array for migrated routines (kept for backwards compatibility during transition)
- `linkedHabitIds` becomes the **union** of all variant-level linked habits (computed on save, used for reverse lookup on `Habit.linkedRoutineIds`)

#### RoutineVariant (New)

```json
{
  "id": "variant-quick",
  "name": "Quick",
  "description": "Minimal prep — sandwiches and salads",
  "estimatedDurationMinutes": 15,
  "sortOrder": 0,
  "steps": [
    {
      "id": "step-q1",
      "title": "Wash produce",
      "instruction": "Quick rinse of lettuce and tomatoes",
      "timerSeconds": 120,
      "linkedHabitId": null
    },
    {
      "id": "step-q2",
      "title": "Assemble meals",
      "instruction": "Prepare 3 sandwiches and 2 salads",
      "timerSeconds": 600,
      "linkedHabitId": "habit-mealplan"
    }
  ],
  "linkedHabitIds": ["habit-mealplan"],
  "icon": "Zap",
  "color": "bg-yellow-500",
  "isAiGenerated": false,
  "createdAt": "2026-03-14T10:00:00.000Z",
  "updatedAt": "2026-03-14T10:00:00.000Z"
}
```

**TypeScript Interface**:

```typescript
export interface RoutineVariant {
  /** Unique identifier within the routine */
  id: string;
  /** Display name (e.g., "Quick", "Standard", "Deep") */
  name: string;
  /** Optional description of what this variant covers */
  description?: string;
  /** Estimated duration in minutes (explicit, not computed) */
  estimatedDurationMinutes: number;
  /** Sort order for display (0 = first) */
  sortOrder: number;
  /** Steps specific to this variant */
  steps: RoutineStep[];
  /** Habit IDs linked via this variant's steps (computed on save) */
  linkedHabitIds: string[];
  /** Optional variant-specific icon */
  icon?: string;
  /** Optional variant-specific color */
  color?: string;
  /** Whether this variant was AI-generated */
  isAiGenerated: boolean;
  /** ISO 8601 timestamps */
  createdAt: string;
  updatedAt: string;
}
```

#### RoutineStep (Unchanged)

The `RoutineStep` interface remains identical. Steps are now embedded within `RoutineVariant.steps` instead of `Routine.steps`.

#### RoutineLog (Updated)

```json
{
  "routineId": "routine-abc",
  "variantId": "variant-quick",
  "date": "2026-03-14",
  "startedAt": "2026-03-14T07:30:00.000Z",
  "completedAt": "2026-03-14T07:45:00.000Z",
  "stepResults": {
    "step-q1": "done",
    "step-q2": "done"
  },
  "actualDurationSeconds": 900
}
```

**Updated Interface**:

```typescript
export interface RoutineLog {
  /** FK to Routine.id */
  routineId: string;
  /** FK to RoutineVariant.id (null for legacy logs pre-migration) */
  variantId?: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  /** ISO 8601 timestamp when execution started */
  startedAt?: string;
  /** ISO 8601 timestamp when routine was completed */
  completedAt: string;
  /** Per-step completion results */
  stepResults?: Record<string, StepStatus>;
  /** Actual execution duration in seconds (completedAt - startedAt) */
  actualDurationSeconds?: number;
}
```

**Composite key change**: `${routineId}-${variantId}-${date}` for variant-aware routines, falling back to `${routineId}-${date}` for legacy.

#### HabitEntry (Updated — minimal change)

```typescript
// Existing fields preserved, one addition:
export interface HabitEntry {
  // ... existing fields ...
  source: 'manual' | 'routine' | 'quick' | 'import' | 'test';
  routineId?: string;
  /** NEW: variant that generated this entry */
  variantId?: string;
}
```

#### HabitPotentialEvidence (Updated — minimal change)

```typescript
export interface HabitPotentialEvidence {
  // ... existing fields ...
  /** NEW: variant context for the step */
  variantId?: string;
}
```

### 3.3 Entity Relationship Diagram

```
┌─────────────────────────────────────────────┐
│                  Routine                     │
│  id, title, categoryId, defaultVariantId     │
│  linkedHabitIds (union of all variants)      │
│  variants: RoutineVariant[]                  │
├─────────────────────────────────────────────┤
│ Has many                                     │
│    ┌─────────────────────────────────────┐   │
│    │         RoutineVariant              │   │
│    │  id, name, estimatedDurationMinutes │   │
│    │  steps: RoutineStep[]              │   │
│    │  linkedHabitIds (from steps)        │   │
│    ├─────────────────────────────────────┤   │
│    │ Has many                            │   │
│    │    ┌───────────────────────────┐    │   │
│    │    │      RoutineStep          │    │   │
│    │    │  id, title, timerSeconds  │    │   │
│    │    │  linkedHabitId?           │    │   │
│    │    └───────────────────────────┘    │   │
│    └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
         │                        │
         │ logs                   │ creates
         ▼                        ▼
┌──────────────────┐   ┌──────────────────┐
│   RoutineLog     │   │   HabitEntry     │
│  routineId       │   │  routineId?      │
│  variantId?      │   │  variantId?      │
│  date            │   │  source:'routine'│
│  startedAt?      │   └──────────────────┘
│  completedAt     │
│  stepResults?    │
└──────────────────┘
```

### 3.4 Why Embedded (Not a Separate Collection)

Variants are embedded inside the `Routine` document (same pattern as current `steps`) because:

1. **Consistency**: Steps are already embedded. Variants containing steps follows the same pattern.
2. **Atomic operations**: Creating/updating a routine with its variants is a single document write — no cross-collection transactions needed.
3. **Read efficiency**: Fetching a routine returns all variants in one query. The UI needs all variants for preview/selection.
4. **Document size**: Even with 5 variants × 20 steps each, the document stays well under MongoDB's 16MB limit.

---

## 4 — Migration Strategy

### 4.1 Conversion Plan

Every existing routine becomes a routine with a single "Default" variant. This is **lossless** and **backwards compatible**.

**Migration logic (server-side script)**:

```typescript
async function migrateRoutineToVariants(routine: Routine): RoutineWithVariants {
  const now = new Date().toISOString();
  const defaultVariantId = randomUUID();

  // Compute duration from existing steps
  const totalSeconds = routine.steps.reduce(
    (acc, step) => acc + (step.timerSeconds || 60), 0
  );
  const estimatedMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

  return {
    ...routine,
    defaultVariantId,
    variants: [{
      id: defaultVariantId,
      name: 'Default',
      description: undefined,
      estimatedDurationMinutes: estimatedMinutes,
      sortOrder: 0,
      steps: routine.steps,           // Move steps into variant
      linkedHabitIds: routine.linkedHabitIds,
      isAiGenerated: false,
      createdAt: routine.createdAt,
      updatedAt: now,
    }],
    steps: [],                         // Clear root-level steps
    updatedAt: now,
  };
}
```

### 4.2 Backwards Compatibility

| Concern | Strategy |
|---------|----------|
| Clients reading `routine.steps` | Keep `steps` field (empty array post-migration). Add a computed getter `getActiveSteps(routine, variantId?)` that resolves to variant steps or falls back to root steps. |
| `RoutineLog` without `variantId` | `variantId` is optional. Existing logs remain valid. Analytics queries handle `variantId: null` as "pre-variant era." |
| `HabitEntry.variantId` missing | Optional field. Existing entries unaffected. |
| Frontend without variant support | Deploy backend migration first. Frontend reads `routine.variants[0].steps` instead of `routine.steps`. Feature-flag variant UI separately. |

### 4.3 Database Migrations

**Migration 1: Add `variants` and `defaultVariantId` to all routines**

```javascript
// MongoDB migration script
db.routines.find({ variants: { $exists: false } }).forEach(routine => {
  const variantId = UUID();
  const totalSeconds = (routine.steps || []).reduce(
    (acc, step) => acc + (step.timerSeconds || 60), 0
  );

  db.routines.updateOne(
    { _id: routine._id },
    {
      $set: {
        defaultVariantId: variantId,
        variants: [{
          id: variantId,
          name: 'Default',
          estimatedDurationMinutes: Math.max(1, Math.ceil(totalSeconds / 60)),
          sortOrder: 0,
          steps: routine.steps || [],
          linkedHabitIds: routine.linkedHabitIds || [],
          isAiGenerated: false,
          createdAt: routine.createdAt,
          updatedAt: new Date().toISOString()
        }],
        steps: [],
        updatedAt: new Date().toISOString()
      }
    }
  );
});
```

**Migration 2: Update RoutineLog composite key index**

```javascript
// Add variantId-aware index (non-breaking — old docs just have variantId: null)
db.routineLogs.createIndex(
  { userId: 1, routineId: 1, variantId: 1, date: 1 },
  { unique: true, sparse: true }
);
```

### 4.4 Data Integrity Risks

| Risk | Mitigation |
|------|-----------|
| Migration fails mid-batch | Run idempotently: skip routines that already have `variants`. Use `$exists: false` guard. |
| Steps duplicated (both in root and variant) | Migration clears `routine.steps` after copying to variant. Verify with count assertion. |
| Orphaned RoutineLogs after variant deletion | RoutineLogs with deleted `variantId` are preserved but flagged in analytics as "unknown variant." |
| Concurrent writes during migration | Run migration during low-traffic window. Use `bulkWrite` with ordered operations. |

---

## 5 — UI Architecture Changes

### 5.1 Routines Dashboard (`RoutineList.tsx`)

**Current state**: Displays routines in category-grouped cards. Each card shows title, step count, duration, icon, color.

**Required changes**:
- Show variant count badge on routine cards (e.g., "3 variants")
- Display default variant's duration and step count
- Optional: expand card to show variant list with durations
- Quick-start button should use `defaultVariantId`

**State needed**: `routine.variants.length`, `routine.defaultVariantId`, `routine.variants[].estimatedDurationMinutes`

**Component changes**:
- `RoutineCard` sub-component: add variant count indicator
- Duration computation: use `variant.estimatedDurationMinutes` instead of computing from steps

### 5.2 Routine Creation (`RoutineEditorModal.tsx`)

**Current state**: Single form with title, category, and one step list.

**Required changes**:
- Add "Variants" tab/section below the title
- Default: create with one variant (backwards-compatible with current UX)
- "Add Variant" button creates a new variant with empty steps
- Each variant has: name, description, estimated duration, its own step list
- Variant-level step management (add/remove/reorder steps per variant)
- Copy variant functionality (duplicate an existing variant as starting point)
- Delete variant (with confirmation if variant has been executed)

**State needed**:
```typescript
const [activeVariantIndex, setActiveVariantIndex] = useState(0);
const [variants, setVariants] = useState<RoutineVariant[]>([{
  id: crypto.randomUUID(),
  name: 'Default',
  steps: [],
  // ...
}]);
```

**Component changes**:
- Add `VariantTabBar` component (horizontal tabs for variant names)
- Step list renders `variants[activeVariantIndex].steps`
- Linked habits computed from active variant's steps
- "Add Variant" / "Copy Variant" / "Delete Variant" buttons
- Variant name input field per tab

### 5.3 Variant Editor (New Sub-Component)

**New component**: `VariantEditor.tsx`

A reusable sub-component within `RoutineEditorModal` that manages a single variant's configuration:
- Variant name input
- Description textarea
- Estimated duration input (minutes)
- Step list (same as current step management, scoped to this variant)
- AI suggest button (Phase 6)

**Props**:
```typescript
interface VariantEditorProps {
  variant: RoutineVariant;
  onChange: (updated: RoutineVariant) => void;
  onDelete?: () => void;
  habits: Habit[];
  categoryId?: string;
}
```

### 5.4 Routine Start Flow (Variant Selection)

**Current state**: `RoutinePreviewModal` shows routine details → "Start Routine" button.

**Required changes**:
- If routine has **1 variant**: behave exactly as today (no variant picker)
- If routine has **2+ variants**: show variant selector before "Start Routine"
  - Display variant cards with: name, description, step count, estimated duration, icon/color
  - Pre-select `defaultVariantId`
  - "Start [Variant Name]" button
- Selected variant ID passed to execution context

**State needed**: `selectedVariantId`, `routine.variants`

**Component changes**:
- `RoutinePreviewModal.tsx`: add `VariantSelector` section
- New sub-component: `VariantCard` (name, description, duration, step count)
- `onStart` callback now passes `(routineId, variantId)`

### 5.5 Routine Execution (`RoutineRunnerModal.tsx`)

**Current state**: Iterates `routine.steps[currentStepIndex]`.

**Required changes**:
- Runner receives `variantId` from preview/selection step
- Resolves steps from `routine.variants.find(v => v.id === variantId).steps`
- Header shows variant name alongside routine title
- Completion payload includes `variantId`
- Step count and progress bar use variant-specific step count

**State needed**: `selectedVariantId`, resolved `variantSteps`

**Component changes**:
- Accept `variantId` prop
- Replace `routine.steps` references with resolved variant steps
- Display variant name in header (e.g., "Meal Prep — Quick")
- Pass `variantId` to `submitRoutine()` call

### 5.6 Analytics (Future)

**Current state**: `PinnedRoutinesCard` shows completion status. No dedicated analytics page.

**Required changes** (Phase 5):
- `PinnedRoutinesCard`: show which variant was completed today (if any)
- New analytics widgets:
  - **Variant usage breakdown**: pie/bar chart of variant frequency per routine
  - **Completion rate by variant**: percentage of started vs completed per variant
  - **Duration comparison**: estimated vs actual duration per variant
  - **Habit attribution**: which variants drive the most habit completions

**State needed**: `RoutineLog[]` with `variantId`, `startedAt`, `actualDurationSeconds`, `stepResults`

**Component changes**:
- `PinnedRoutinesCard.tsx`: update completion check to consider variant dimension
- New component: `RoutineAnalyticsPanel.tsx`
- Update `daySummary.ts` and `truthQuery.ts` to include `variantId` in provenance

---

## 6 — Execution Flow

### 6.1 Lifecycle Sequence

```
┌──────────┐     ┌───────────────┐     ┌─────────────────┐
│  Browse   │────▶│   Preview     │────▶│ Variant Select  │
│           │     │ (single var:  │     │ (multi-variant  │
│RoutineList│     │  skip to exec)│     │  routines only) │
└──────────┘     └───────────────┘     └────────┬────────┘
                                                 │
                                     selectedVariantId
                                                 │
                                                 ▼
                                    ┌─────────────────────┐
                                    │     Execute          │
                                    │                      │
                                    │ 1. Init step states  │
                                    │    from variant.steps│
                                    │ 2. Record startedAt  │
                                    │ 3. Step-by-step nav  │
                                    │ 4. Evidence per step │
                                    │ 5. Completion screen │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │    Submit            │
                                    │                      │
                                    │ POST /routines/:id/  │
                                    │   submit             │
                                    │ Body:                │
                                    │  { variantId,        │
                                    │    habitIdsToComplete,│
                                    │    submittedAt,      │
                                    │    startedAt,        │
                                    │    stepResults }     │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Server Processing   │
                                    │                      │
                                    │ 1. Validate routine  │
                                    │ 2. Validate variant  │
                                    │ 3. Upsert HabitEntry │
                                    │    (w/ variantId)    │
                                    │ 4. Save RoutineLog   │
                                    │    (w/ variantId,    │
                                    │     startedAt,       │
                                    │     stepResults)     │
                                    └─────────────────────┘
```

### 6.2 Detailed Step-by-Step

**1. User selects routine** (`RoutineList` or `PinnedRoutinesCard`):
- `selectRoutine(routineId)` → sets `activeRoutine`, `executionState: 'preview'`

**2. User selects variant** (`RoutinePreviewModal` with variant selector):
- If `routine.variants.length === 1`: auto-select the single variant, proceed directly
- If `routine.variants.length > 1`: show variant cards, user picks one
- `selectVariant(variantId)` → stores `activeVariantId` in context

**3. Routine execution begins** (`RoutineRunnerModal`):
- Resolve `activeVariant = activeRoutine.variants.find(v => v.id === activeVariantId)`
- `startRoutine()` → `executionState: 'execute'`, `currentStepIndex: 0`
- Initialize `stepStates` from `activeVariant.steps` (all `'neutral'`)
- Record `startedAt = new Date().toISOString()`

**4. Steps are completed**:
- Navigate through `activeVariant.steps[currentStepIndex]`
- Each step: mark done or skip → update `stepStates[step.id]`
- Evidence generated for steps with `linkedHabitId` (include `variantId`)

**5. Execution record stored**:
- User clicks "Complete" or "Complete + Log Habits"
- `POST /api/routines/:id/submit`:
  ```json
  {
    "variantId": "variant-quick",
    "habitIdsToComplete": ["habit-mealplan"],
    "submittedAt": "2026-03-14T07:45:00.000Z",
    "startedAt": "2026-03-14T07:30:00.000Z",
    "stepResults": { "step-q1": "done", "step-q2": "done" }
  }
  ```
- Server creates `RoutineLog` with `variantId`, `startedAt`, `stepResults`, `actualDurationSeconds`
- Server creates `HabitEntry` records with `variantId` provenance

### 6.3 Context State Machine Update

```typescript
// Updated RoutineContext execution state
interface RoutineExecutionState {
  activeRoutine: Routine | null;
  activeVariantId: string | null;     // NEW
  executionState: 'browse' | 'preview' | 'variant-select' | 'execute';  // NEW state
  currentStepIndex: number;
  stepStates: StepStates;
  startedAt: string | null;           // NEW
}
```

New action: `selectVariant(variantId: string)`:
```typescript
const selectVariant = (variantId: string) => {
  setActiveVariantId(variantId);
  // If single variant, can auto-transition to execute
};
```

---

## 7 — AI Integration (Gemini)

### 7.1 Feature Description

Users can request AI-generated variant suggestions for a routine. The AI analyzes the routine's context and the user's habits to propose meaningful variants at different intensity levels.

### 7.2 Inputs

| Input | Source | Purpose |
|-------|--------|---------|
| Routine name | `routine.title` | Context for what the routine is about |
| Category | `routine.categoryId` → category name | Domain context (fitness, cooking, etc.) |
| Existing steps | `routine.variants[0].steps` (or current steps) | Understand what the routine currently does |
| User habits | `habit.title`, `habit.categoryId` for habits in same category | Suggest relevant habit links |
| User preferences | Optional: preferred variant count, time constraints | Customize suggestions |

### 7.3 Outputs

```json
{
  "suggestedVariants": [
    {
      "name": "Quick",
      "description": "Minimal version for busy days",
      "estimatedDurationMinutes": 15,
      "steps": [
        {
          "title": "Quick wash",
          "instruction": "Rinse pre-cut vegetables",
          "timerSeconds": 120,
          "suggestedHabitLink": "habit-mealplan"
        }
      ]
    },
    {
      "name": "Standard",
      "description": "Balanced prep for the week",
      "estimatedDurationMinutes": 45,
      "steps": [/* ... */]
    },
    {
      "name": "Deep",
      "description": "Full batch cooking session",
      "estimatedDurationMinutes": 90,
      "steps": [/* ... */]
    }
  ]
}
```

### 7.4 Architecture

```
┌───────────────┐      ┌────────────────────┐      ┌──────────────┐
│  RoutineEditor │─────▶│  AI Suggest Button  │─────▶│ Gemini API   │
│  Modal         │      │  "Generate Variants"│      │              │
│                │◀─────│  Loading spinner     │◀─────│ Structured   │
│  Receives      │      │                     │      │ JSON output  │
│  suggestions   │      └────────────────────┘      └──────────────┘
│  User reviews  │
│  & edits       │
└───────────────┘
```

**Files involved**:

| Layer | File | Responsibility |
|-------|------|----------------|
| UI | `RoutineEditorModal.tsx` | "Generate Variants" button, suggestion review UI |
| API Route | `src/server/routes/ai.ts` (new or existing) | `POST /api/ai/suggest-variants` |
| Service | `src/server/services/aiVariantService.ts` (new) | Prompt construction, Gemini API call, response parsing |
| Config | Environment variables | `GEMINI_API_KEY`, model selection |

### 7.5 Prompt Strategy

```
System: You are a habit and routine optimization assistant. Generate routine
variants at different intensity levels.

User: Generate variants for the routine "{title}" in the "{category}" category.
Current steps: {JSON steps}
User's related habits: {habit titles}
Generate 3 variants: Quick (minimal), Standard (balanced), Deep (comprehensive).
For each variant, provide a name, description, estimated duration in minutes,
and an ordered list of steps with titles, instructions, and optional timer
durations in seconds.
Return valid JSON matching the schema: {schema}
```

### 7.6 User Experience

1. User creates a routine with at least a title and category
2. User clicks "Suggest Variants with AI" button
3. Loading state shown while Gemini processes
4. Suggested variants appear in a review panel
5. User can: accept all, accept individually, edit suggestions, or dismiss
6. Accepted variants are added to the routine's variant list
7. Variants are marked `isAiGenerated: true` for analytics

### 7.7 Guardrails

- AI suggestions are **always** reviewed by the user before saving
- Steps from AI never auto-link to habits (user must explicitly confirm links)
- Rate limiting: max 3 AI suggestion requests per routine per hour
- Fallback: if Gemini API is unavailable, show error and allow manual variant creation
- AI-generated variants respect the core semantic rule: routines never imply completion

---

## 8 — Implementation Plan

### Phase 1 — Backend Schema Changes

**Goal**: Extend data model to support variants. Migrate existing data. All existing functionality continues to work.

**Files to modify**:
| File | Changes |
|------|---------|
| `src/models/persistenceTypes.ts` | Add `RoutineVariant` interface. Update `Routine` with `variants`, `defaultVariantId`. Update `RoutineLog` with `variantId`, `startedAt`, `stepResults`, `actualDurationSeconds`. Add `variantId` to `HabitEntry` and `HabitPotentialEvidence`. |
| `src/types/index.ts` | Re-export `RoutineVariant` type |
| `src/server/repositories/routineRepository.ts` | Update `createRoutine` and `updateRoutine` to handle `variants` array. Auto-generate variant IDs. Compute root-level `linkedHabitIds` as union of variant-level links. |
| `src/server/repositories/routineLogRepository.ts` | Update composite key to `${routineId}-${variantId || 'default'}-${date}`. Add `variantId` to stored document. Support new fields (`startedAt`, `stepResults`, `actualDurationSeconds`). |
| `src/server/routes/routines.ts` | Update validation to accept `variants` array. Update `submitRoutineRoute` to accept and store `variantId`, `startedAt`, `stepResults`. Add `variantId` to HabitEntry creation. |
| New: `src/server/migrations/001_add_routine_variants.ts` | Migration script to convert existing routines to single-variant format. |

**Testing**:
- Unit tests for migration function (lossless conversion)
- Update `routines.validation.test.ts` for variant validation
- Update `routines.submit.test.ts` for variant-aware submission
- Verify `routines.completion-guardrail.test.ts` still passes
- Test backwards compatibility: routines without `variants` field still work

### Phase 2 — Routine Editor Changes

**Goal**: Allow creating and editing multiple variants per routine.

**Files to modify**:
| File | Changes |
|------|---------|
| `src/components/RoutineEditorModal.tsx` | Replace single `steps` state with `variants` array state. Add variant tabs/selector. Default to single "Default" variant for new routines. Step management scoped to active variant. Compute `linkedHabitIds` from variant steps. |
| New: `src/components/VariantEditor.tsx` | Reusable variant configuration sub-component (name, description, duration, steps). |
| `src/store/RoutineContext.tsx` | Update `addRoutine` and `updateRoutine` types to accept `variants`. |
| `src/lib/persistenceClient.ts` | Update `createRoutine` and `updateRoutine` payload types to include `variants`. |

**Testing**:
- Manual testing: create routine with 1 variant (same as today)
- Manual testing: create routine with 3 variants
- Manual testing: edit existing migrated routine
- Verify bi-directional habit linking works with variant-level linked habits

### Phase 3 — Variant Selection UI

**Goal**: Users can choose a variant when starting a multi-variant routine.

**Files to modify**:
| File | Changes |
|------|---------|
| `src/components/RoutinePreviewModal.tsx` | Add `VariantSelector` section for multi-variant routines. Show variant cards with name, description, duration, step count. Pre-select `defaultVariantId`. Pass `variantId` to `onStart`. |
| New: `src/components/VariantCard.tsx` | Variant display card for selection UI (name, duration, step count, description). |
| `src/components/RoutineList.tsx` | Update routine cards to show variant count badge. Duration display from default variant. |
| `src/components/dashboard/PinnedRoutinesCard.tsx` | Update to show variant name in completion status. |
| `src/App.tsx` | Update `routineRunnerState` to include `variantId`. Pass `variantId` through modal props. |

**Testing**:
- Single-variant routine: no variant selector shown (same as today)
- Multi-variant routine: variant selector displayed, default pre-selected
- Variant selection persists through to runner modal
- Quick-start from dashboard/tracker uses default variant

### Phase 4 — Execution Logic

**Goal**: Runner executes variant-specific steps. Completion records variant context.

**Files to modify**:
| File | Changes |
|------|---------|
| `src/components/RoutineRunnerModal.tsx` | Accept `variantId` prop. Resolve steps from `routine.variants.find(v => v.id === variantId).steps`. Display variant name in header. Record `startedAt` on execution begin. Pass `variantId`, `startedAt`, `stepResults` to submit. |
| `src/store/RoutineContext.tsx` | Add `activeVariantId` to execution state. Update `startRoutine()` to accept `variantId`. Initialize `stepStates` from variant steps. Add `startedAt` tracking. |
| `src/components/CompletedHabitsModal.tsx` | Use variant-specific `linkedHabitIds` for habit selection. |
| `src/server/routes/habitPotentialEvidence.ts` | Accept and store `variantId` in evidence records. |

**Testing**:
- Execute single-variant routine (backwards compatible)
- Execute specific variant of multi-variant routine
- Verify correct steps are shown for selected variant
- Verify HabitEntry and RoutineLog include `variantId`
- Verify evidence includes `variantId`
- Run completion guardrail test

### Phase 5 — Analytics

**Goal**: Track and display variant usage patterns.

**Files to modify**:
| File | Changes |
|------|---------|
| `src/server/routes/daySummary.ts` | Include `variantId` in `AggregatedDayEntry`. |
| `src/server/services/truthQuery.ts` | Add `variantId` to `EntryView.provenance`. |
| `src/components/dashboard/PinnedRoutinesCard.tsx` | Show variant name in completion indicator. |
| New: `src/components/RoutineAnalyticsPanel.tsx` | Variant usage chart, completion rates, duration comparison. |
| `src/server/routes/routineLogs.ts` | Add query support for filtering by `variantId`, date range. |

**Testing**:
- Verify variant attribution flows through to day summary
- Verify truth query includes variant provenance
- Test analytics panel with mixed legacy (no variant) and new logs

### Phase 6 — AI Integration

**Goal**: Gemini-powered variant suggestions.

**Files to modify/create**:
| File | Changes |
|------|---------|
| New: `src/server/services/aiVariantService.ts` | Gemini API integration. Prompt construction. Response parsing and validation. |
| New or existing: `src/server/routes/ai.ts` | `POST /api/ai/suggest-variants` endpoint. |
| `src/components/RoutineEditorModal.tsx` | "Suggest Variants" button. Suggestion review/accept UI. |
| `src/lib/persistenceClient.ts` | `suggestVariants(routineId, context)` API client function. |

**Testing**:
- Mock Gemini API for unit tests
- Test prompt construction with various routine types
- Test suggestion parsing and validation
- Test UI flow: request → loading → review → accept/reject
- Test error handling: API unavailable, invalid response, rate limiting

---

## 9 — Risks and Edge Cases

### 9.1 Variant Deletion

**Risk**: Deleting a variant that has been executed leaves orphaned `RoutineLog` and `HabitEntry` records referencing a non-existent `variantId`.

**Mitigation**:
- Soft-delete: mark variant as `archived: true` instead of removing from the array
- Or: allow deletion but preserve `variantId` in logs as a historical reference (variant name stored in log at write time)
- Prevent deleting the last variant (routine must have at least one)
- Show warning if variant has execution history

### 9.2 Execution History Compatibility

**Risk**: Pre-migration `RoutineLog` entries have no `variantId`. Post-migration queries that filter by `variantId` could miss historical data.

**Mitigation**:
- `variantId` is optional in `RoutineLog`. Queries use `{ variantId: { $in: [targetId, null, undefined] } }` for backwards compatibility.
- Analytics displays "Legacy" or "Pre-variant" label for logs without `variantId`.
- Migration does NOT backfill `variantId` on existing logs (too risky, and the data is technically ambiguous).

### 9.3 Analytics Fragmentation

**Risk**: Adding variants splits analytics data across multiple variant IDs, making routine-level aggregation more complex.

**Mitigation**:
- Always support "all variants" aggregation (group by `routineId` only)
- Variant-level drill-down is an optional filter, not the default view
- `Routine.linkedHabitIds` remains the union — `Habit.linkedRoutineIds` reverse lookup still works at routine level

### 9.4 Incomplete Migrations

**Risk**: If migration fails partway, some routines have `variants` and some don't. Frontend code may break on inconsistent state.

**Mitigation**:
- All code that reads routines uses a resolver function:
  ```typescript
  function resolveSteps(routine: Routine, variantId?: string): RoutineStep[] {
    if (routine.variants?.length > 0) {
      const variant = variantId
        ? routine.variants.find(v => v.id === variantId)
        : routine.variants.find(v => v.id === routine.defaultVariantId) || routine.variants[0];
      return variant?.steps || [];
    }
    return routine.steps || [];  // Fallback to root-level steps
  }
  ```
- Migration is idempotent: running it again skips already-migrated routines
- Add health check endpoint to verify migration completeness

### 9.5 Concurrent Variant Editing

**Risk**: Two users in the same household could edit different variants of the same routine simultaneously, leading to last-write-wins data loss.

**Mitigation**:
- Routines are scoped by `userId` — only the owner can edit. This is a single-user concern (e.g., two browser tabs).
- Optimistic locking via `updatedAt` comparison (reject update if `updatedAt` has changed since last read).

### 9.6 Default Variant Deletion

**Risk**: User deletes the variant referenced by `defaultVariantId`.

**Mitigation**:
- If `defaultVariantId` references a deleted/archived variant, fall back to `variants[0]`
- UI prevents deleting the default variant without first reassigning the default

### 9.7 RoutineLog Composite Key Collision

**Risk**: Changing the composite key from `${routineId}-${date}` to `${routineId}-${variantId}-${date}` could break existing lookups.

**Mitigation**:
- New composite key format: `${routineId}-${variantId || 'legacy'}-${date}`
- Old logs retain their existing composite key (no backfill)
- Lookup function handles both formats:
  ```typescript
  function getLogKey(routineId: string, date: string, variantId?: string): string {
    return variantId
      ? `${routineId}-${variantId}-${date}`
      : `${routineId}-${date}`;
  }
  ```

### 9.8 Step ID Collisions Across Variants

**Risk**: Different variants could have steps with the same auto-generated UUID (extremely unlikely) or manually set IDs.

**Mitigation**:
- Step IDs are generated via `crypto.randomUUID()` — collision probability is negligible
- `HabitPotentialEvidence` now includes `variantId` to disambiguate step references
- Validation rejects duplicate step IDs within a single variant

### 9.9 Large Routine Documents

**Risk**: A routine with many variants, each with many steps, could approach MongoDB's 16MB document limit.

**Mitigation**:
- Practical limit: 10 variants × 50 steps each = ~500 step objects. At ~500 bytes per step, that's ~250KB — well under 16MB.
- Add server-side validation: max 10 variants per routine, max 50 steps per variant.
- If needed in the future, variants can be extracted to a separate collection.

### 9.10 Mobile/Offline Performance

**Risk**: Fetching all variants for all routines increases payload size.

**Mitigation**:
- `GET /api/routines` returns full routine documents (including variants). This is acceptable for typical usage (5-20 routines, 1-5 variants each).
- If performance becomes an issue, add a `GET /api/routines?fields=summary` endpoint that excludes variant steps.
- Execution only needs one variant's steps — the runner resolves locally from the cached routine document.

---

## Appendix A — File Change Summary

| File | Phase | Change Type |
|------|-------|-------------|
| `src/models/persistenceTypes.ts` | 1 | Add `RoutineVariant`, update `Routine`, `RoutineLog`, `HabitEntry` |
| `src/types/index.ts` | 1 | Re-export new types |
| `src/server/repositories/routineRepository.ts` | 1 | Handle `variants` in CRUD |
| `src/server/repositories/routineLogRepository.ts` | 1 | Update composite key, add `variantId` |
| `src/server/routes/routines.ts` | 1, 4 | Validate variants, update submit route |
| `src/server/migrations/001_add_routine_variants.ts` | 1 | New migration script |
| `src/server/domain/canonicalTypes.ts` | 1 | Add `variantId` to entry record |
| `src/components/RoutineEditorModal.tsx` | 2 | Multi-variant editing UI |
| `src/components/VariantEditor.tsx` | 2 | New component |
| `src/store/RoutineContext.tsx` | 2, 4 | Update types, add variant execution state |
| `src/lib/persistenceClient.ts` | 2, 6 | Update payload types, add AI client |
| `src/components/RoutinePreviewModal.tsx` | 3 | Add variant selector |
| `src/components/VariantCard.tsx` | 3 | New component |
| `src/components/RoutineList.tsx` | 3 | Variant count badge, duration from variant |
| `src/components/dashboard/PinnedRoutinesCard.tsx` | 3, 5 | Variant-aware completion display |
| `src/App.tsx` | 3 | Pass `variantId` through modal state |
| `src/components/RoutineRunnerModal.tsx` | 4 | Execute variant-specific steps |
| `src/components/CompletedHabitsModal.tsx` | 4 | Variant-specific habit list |
| `src/server/routes/habitPotentialEvidence.ts` | 4 | Accept `variantId` |
| `src/server/routes/daySummary.ts` | 5 | Include `variantId` in aggregation |
| `src/server/services/truthQuery.ts` | 5 | Add `variantId` to provenance |
| `src/components/RoutineAnalyticsPanel.tsx` | 5 | New component |
| `src/server/routes/routineLogs.ts` | 5 | Variant-filtered queries |
| `src/server/services/aiVariantService.ts` | 6 | New Gemini integration service |
| `src/server/routes/ai.ts` | 6 | New/updated AI endpoint |

## Appendix B — Resolver Utility

Central utility to safely resolve steps regardless of migration state:

```typescript
// src/lib/routineVariantUtils.ts

import type { Routine, RoutineStep, RoutineVariant } from '../models/persistenceTypes';

/**
 * Resolve the active variant for a routine.
 * Handles pre-migration routines (no variants) and post-migration routines.
 */
export function resolveVariant(
  routine: Routine,
  variantId?: string
): RoutineVariant | null {
  if (!routine.variants || routine.variants.length === 0) {
    // Pre-migration: synthesize a virtual variant from root-level steps
    return {
      id: 'legacy-default',
      name: 'Default',
      estimatedDurationMinutes: Math.max(
        1,
        Math.ceil(
          routine.steps.reduce((acc, s) => acc + (s.timerSeconds || 60), 0) / 60
        )
      ),
      sortOrder: 0,
      steps: routine.steps,
      linkedHabitIds: routine.linkedHabitIds,
      isAiGenerated: false,
      createdAt: routine.createdAt,
      updatedAt: routine.updatedAt,
    };
  }

  if (variantId) {
    return routine.variants.find(v => v.id === variantId) || routine.variants[0];
  }

  return (
    routine.variants.find(v => v.id === routine.defaultVariantId) ||
    routine.variants[0]
  );
}

/**
 * Resolve steps for execution, given a routine and optional variant ID.
 */
export function resolveSteps(
  routine: Routine,
  variantId?: string
): RoutineStep[] {
  const variant = resolveVariant(routine, variantId);
  return variant?.steps || routine.steps || [];
}

/**
 * Compute linked habit IDs across all variants (union).
 */
export function computeRoutineLevelLinkedHabits(routine: Routine): string[] {
  if (!routine.variants || routine.variants.length === 0) {
    return routine.linkedHabitIds || [];
  }
  const allHabitIds = new Set<string>();
  for (const variant of routine.variants) {
    for (const habitId of variant.linkedHabitIds || []) {
      allHabitIds.add(habitId);
    }
  }
  return Array.from(allHabitIds);
}
```

This utility should be used by **every** consumer of routine data (UI components, API routes, analytics) to ensure consistent behavior during and after migration.
