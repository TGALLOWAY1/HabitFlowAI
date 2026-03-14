# Routine Variants — Implementation Tasks

**Date**: 2026-03-14
**Status**: Ready for execution
**Source documents**: `HABITFLOW_ROUTINES_FEATURE_AUDIT.md`, `HABITFLOW_ROUTINE_VARIANTS_IMPLEMENTATION_PLAN.md`
**Scope**: Full-stack implementation of Routine Variants — schema through AI integration

---

# 1. Executive Summary

## What is being implemented

A Routine can have multiple user-labeled **variants** (e.g., Quick / Standard / Deep). Each variant owns its own ordered step list, linked habits, estimated duration, name, and optional metadata. Users create variants inside the routine editor, choose a variant before starting a routine, execute the selected variant's steps, and view per-variant analytics. An optional Gemini AI integration suggests variant configurations.

## Recommended implementation order

1. **Data model & types** — define `RoutineVariant`, update `Routine`, `RoutineLog`, `HabitEntry`, `HabitPotentialEvidence`
2. **Persistence & API** — repository changes, validation, submit route, migration script
3. **Resolver utility** — centralized `resolveVariant` / `resolveSteps` used by every consumer
4. **Routine editor UX** — multi-variant editing with tab UI
5. **Variant selection UX** — preview modal with variant selector
6. **Execution flow** — runner uses variant steps, passes `variantId` through submit
7. **Analytics** — provenance tracking, per-variant analytics panel
8. **Gemini AI** — variant suggestion service and editor integration
9. **Migration & backfill** — convert legacy routines, update composite keys
10. **QA & cleanup** — end-to-end validation, test updates, tech debt reduction

## Highest-risk areas

| Risk | Severity | Why |
|------|----------|-----|
| Single step list assumption | **CRITICAL** | Every UI component, context method, and API route reads `routine.steps` directly. Must be replaced with variant-aware resolution everywhere. |
| `RoutineLog` composite key | **HIGH** | `${routineId}-${date}` prevents multiple variant completions per day and carries no variant info. Key format change has cascading effects on lookups and `PinnedRoutinesCard`. |
| Bi-directional habit linking | **HIGH** | Client-side sync in `RoutineEditorModal` is fragile. Moving `linkedHabitIds` to variant level multiplies complexity. |
| Analytics provenance | **MEDIUM** | `HabitEntry.routineId`, `DaySummary`, and `TruthQuery` lack variant dimension. Every analytics consumer needs update. |

---

# 2. Assumptions and Scope

## In-scope functionality

- [ ] `RoutineVariant` data model (embedded in `Routine` document)
- [ ] CRUD for variants within a routine (create, edit, reorder, copy, delete)
- [ ] Variant selection before routine execution (skip for single-variant routines)
- [ ] Variant-aware step execution in `RoutineRunnerModal`
- [ ] `RoutineLog` with `variantId`, `startedAt`, `stepResults`, `actualDurationSeconds`
- [ ] `HabitEntry` and `HabitPotentialEvidence` with `variantId` provenance
- [ ] Per-variant analytics (usage frequency, completion rates, duration comparison)
- [ ] Gemini AI variant suggestions (generate, review, accept/reject)
- [ ] Migration of existing routines to single-variant format
- [ ] Backwards compatibility for pre-migration data

## Out-of-scope functionality

- Per-variant images (images remain 1:1 with routine, not per-variant)
- Variant-level pinning on dashboard (pinned routines remain at routine level)
- Variant-specific streaks (streaks remain at the habit level via `HabitEntry`)
- Offline-first/PWA caching of variant data
- Variant templates or cross-routine variant sharing
- Step image persistence (existing tech debt — step images use `URL.createObjectURL` and are not persisted)

## Assumptions

1. Variants are **embedded** inside the `Routine` MongoDB document (same pattern as steps). This avoids cross-collection transactions and aligns with the existing architecture.
2. A routine must always have **at least one variant**. The last variant cannot be deleted.
3. `Routine.linkedHabitIds` becomes a **computed union** of all variant-level `linkedHabitIds`, maintained on save. This preserves the `Habit.linkedRoutineIds` reverse lookup without changes to the habit model.
4. `Routine.steps` is kept as an empty array post-migration for backwards compatibility. All new reads go through `resolveSteps()`.
5. Legacy `RoutineLog` entries (no `variantId`) are preserved as-is. Analytics queries handle `null` variant gracefully.
6. Max constraints: 10 variants per routine, 50 steps per variant. Well within MongoDB's 16MB document limit.
7. The Gemini API key is available via environment variable (`GEMINI_API_KEY`).

---

# 3. Task Breakdown by Phase

---

## Phase 1 — Data Model and Schema

### Objective

Extend TypeScript interfaces and MongoDB document shapes to support routine variants. All existing functionality must continue to work unchanged after this phase.

### Tasks

#### Task 1.1 — Define `RoutineVariant` interface

**Purpose**: Introduce the first-class variant entity that owns steps, duration, and linked habits.

**Affected areas**:
- `src/models/persistenceTypes.ts` (add new interface near `RoutineStep` definition, ~line 365)

**Dependencies**: None

**Acceptance criteria**:
- [ ] `RoutineVariant` interface exists with fields: `id`, `name`, `description?`, `estimatedDurationMinutes`, `sortOrder`, `steps: RoutineStep[]`, `linkedHabitIds: string[]`, `icon?`, `color?`, `isAiGenerated: boolean`, `createdAt`, `updatedAt`
- [ ] Interface is exported from `persistenceTypes.ts`

---

#### Task 1.2 — Update `Routine` interface

**Purpose**: Add `variants` array and `defaultVariantId` to the routine entity.

**Affected areas**:
- `src/models/persistenceTypes.ts` (update `Routine` interface, ~lines 368–420)

**Dependencies**: Task 1.1

**Acceptance criteria**:
- [ ] `Routine` gains `variants: RoutineVariant[]` (defaults to empty array for compatibility)
- [ ] `Routine` gains `defaultVariantId: string` (optional — missing means legacy)
- [ ] Existing `steps` and `linkedHabitIds` fields remain (will be empty post-migration, kept for fallback)
- [ ] No runtime breakage for existing code reading `routine.steps`

---

#### Task 1.3 — Update `RoutineLog` interface

**Purpose**: Add variant tracking and execution timing to completion records.

**Affected areas**:
- `src/models/persistenceTypes.ts` (update `RoutineLog` interface, ~lines 422–441)

**Dependencies**: None

**Acceptance criteria**:
- [ ] `RoutineLog` gains `variantId?: string`
- [ ] `RoutineLog` gains `startedAt?: string` (ISO 8601)
- [ ] `RoutineLog` gains `stepResults?: Record<string, StepStatus>` (maps step ID to `'done'` | `'skipped'` | `'neutral'`)
- [ ] `RoutineLog` gains `actualDurationSeconds?: number`
- [ ] All new fields are optional (existing logs remain valid)

---

#### Task 1.4 — Add `variantId` to `HabitEntry` and `HabitPotentialEvidence`

**Purpose**: Enable variant-level provenance tracking in habit completion and evidence records.

**Affected areas**:
- `src/models/persistenceTypes.ts` — `HabitEntry` type (add `variantId?: string`)
- `src/models/persistenceTypes.ts` — `HabitPotentialEvidence` type (~lines 1268–1294, add `variantId?: string`)
- `src/server/domain/canonicalTypes.ts` — `HabitEntryRecord` (add `variantId?: string`)

**Dependencies**: None

**Acceptance criteria**:
- [ ] `HabitEntry.variantId` exists as optional string
- [ ] `HabitPotentialEvidence.variantId` exists as optional string
- [ ] `HabitEntryRecord` in canonical types includes `variantId`
- [ ] Existing entries without `variantId` are unaffected

---

#### Task 1.5 — Re-export new types

**Purpose**: Ensure `RoutineVariant` is accessible from the shared types barrel.

**Affected areas**:
- `src/types/index.ts`

**Dependencies**: Task 1.1

**Acceptance criteria**:
- [ ] `RoutineVariant` is re-exported alongside `Routine` and `RoutineStep`

---

### Risks / Notes
- Adding optional fields to existing interfaces is non-breaking. No runtime changes occur until persistence and API layers adopt the new fields.
- `StepStatus` type (`'neutral' | 'done' | 'skipped'`) already exists in `RoutineContext.tsx` — consider moving it to `persistenceTypes.ts` so `RoutineLog.stepResults` can reference it.

---

## Phase 2 — Persistence and API

### Objective

Update repositories, API routes, and validation to accept, store, and serve routine variants. The migration script is written but not executed until Phase 8.

### Tasks

#### Task 2.1 — Create `resolveVariant` / `resolveSteps` utility

**Purpose**: Centralized resolver that all consumers use to get the correct steps regardless of migration state. This is the safety net for the entire migration.

**Affected areas**:
- New file: `src/lib/routineVariantUtils.ts`

**Dependencies**: Task 1.1, 1.2

**Acceptance criteria**:
- [ ] `resolveVariant(routine, variantId?)` returns the correct `RoutineVariant` — by `variantId` if provided, by `defaultVariantId` if available, by first variant if exists, or synthesizes a virtual variant from `routine.steps` as fallback
- [ ] `resolveSteps(routine, variantId?)` returns `RoutineStep[]` from the resolved variant
- [ ] `computeRoutineLevelLinkedHabits(routine)` returns the union of all variant-level `linkedHabitIds`
- [ ] Unit tests cover: pre-migration routine (no variants), single-variant routine, multi-variant routine, missing `variantId` fallback, empty variants array

---

#### Task 2.2 — Update `routineRepository.ts` for variant CRUD

**Purpose**: Repository must persist and retrieve variants as part of the routine document.

**Affected areas**:
- `src/server/repositories/routineRepository.ts`

**Dependencies**: Task 1.1, 1.2

**Acceptance criteria**:
- [ ] `createRoutine()` accepts `variants` array; auto-generates variant `id` and step `id` values if missing; computes root-level `linkedHabitIds` as union of variant-level links
- [ ] `updateRoutine()` accepts `variants` in the patch; re-computes `linkedHabitIds` union on save
- [ ] Server-side validation: max 10 variants, max 50 steps per variant, at least one variant required (if `variants` field is present)
- [ ] Routines without `variants` field continue to work (backwards compatibility)
- [ ] `findOne()` and `find()` return variant data as stored

---

#### Task 2.3 — Update `routineLogRepository.ts` composite key

**Purpose**: Allow per-variant completion tracking while preserving legacy log compatibility.

**Affected areas**:
- `src/server/repositories/routineLogRepository.ts`

**Dependencies**: Task 1.3

**Acceptance criteria**:
- [ ] New composite key format: `${routineId}-${variantId || 'legacy'}-${date}`
- [ ] `upsertLog()` accepts `variantId`, `startedAt`, `stepResults`, `actualDurationSeconds`
- [ ] Lookup function handles both old (`${routineId}-${date}`) and new key formats
- [ ] `findByUser()` returns logs with new fields when present
- [ ] New MongoDB index: `{ userId: 1, routineId: 1, variantId: 1, date: 1 }` (unique, sparse)

---

#### Task 2.4 — Update route validation in `routines.ts`

**Purpose**: Validate variant data on create and update. Reject malformed variants.

**Affected areas**:
- `src/server/routes/routines.ts` — `createRoutineRoute`, `updateRoutineRoute`, validation functions

**Dependencies**: Task 1.1, 2.2

**Acceptance criteria**:
- [ ] `validateVariants(variants)` function checks: array of objects, each has non-empty `name` (string), valid `steps` (reuse existing `validateSteps`), `estimatedDurationMinutes` ≥ 1, `sortOrder` is number
- [ ] Create route accepts `variants` in request body and passes to repository
- [ ] Update route accepts `variants` in patch body
- [ ] Variant count capped at 10; step count per variant capped at 50
- [ ] Error messages are specific (e.g., "Variant 2 step 3 is missing a title")
- [ ] Routines without `variants` in the body still work (create with legacy shape)

---

#### Task 2.5 — Update `submitRoutineRoute` for variant context

**Purpose**: Completion submissions must carry variant attribution through to `RoutineLog` and `HabitEntry`.

**Affected areas**:
- `src/server/routes/routines.ts` — `submitRoutineRoute` handler

**Dependencies**: Task 1.3, 1.4, 2.3

**Acceptance criteria**:
- [ ] Submit body accepts `variantId` (optional), `startedAt` (optional), `stepResults` (optional)
- [ ] If `variantId` is provided, server validates it exists in `routine.variants`
- [ ] `RoutineLog` is created with `variantId`, `startedAt`, `stepResults`, `actualDurationSeconds` (computed from `startedAt` and `submittedAt`)
- [ ] `HabitEntry` records created with `variantId` provenance
- [ ] Legacy submissions without `variantId` continue to work
- [ ] Completion guardrail test still passes (routine completion alone does not create `HabitEntry`)

---

#### Task 2.6 — Update evidence route for variant context

**Purpose**: `HabitPotentialEvidence` records must know which variant's step was reached.

**Affected areas**:
- `src/server/routes/habitPotentialEvidence.ts`

**Dependencies**: Task 1.4

**Acceptance criteria**:
- [ ] `POST /api/evidence/step-reached` accepts `variantId` in body
- [ ] Evidence record stored with `variantId` field
- [ ] Requests without `variantId` still work (backwards compatible)

---

#### Task 2.7 — Update `persistenceClient.ts` API client

**Purpose**: Frontend API client must send and receive variant data.

**Affected areas**:
- `src/lib/persistenceClient.ts`

**Dependencies**: Task 2.4, 2.5, 2.6

**Acceptance criteria**:
- [ ] `createRoutine(data)` payload type includes `variants`
- [ ] `updateRoutine(id, patch)` payload type includes `variants`
- [ ] `submitRoutine(id, payload)` payload type includes `variantId`, `startedAt`, `stepResults`
- [ ] `recordRoutineStepReached()` accepts `variantId` parameter
- [ ] Return types reflect variant data in routine responses

---

#### Task 2.8 — Write migration script (do not execute yet)

**Purpose**: Script to convert every existing routine into single-variant format. Will be executed in Phase 8.

**Affected areas**:
- New file: `src/server/migrations/001_add_routine_variants.ts`

**Dependencies**: Task 1.1, 1.2

**Acceptance criteria**:
- [ ] Script finds all routines where `variants` field does not exist
- [ ] For each: creates a single "Default" variant containing the routine's existing `steps` and `linkedHabitIds`, computes `estimatedDurationMinutes` from step timers, sets `defaultVariantId` to the new variant's ID, clears `routine.steps` to empty array
- [ ] Script is **idempotent**: skips routines that already have `variants`
- [ ] Script includes a dry-run mode that logs what would change without writing
- [ ] Script includes a count verification (number of routines before vs after)
- [ ] Unit test validates lossless round-trip: original steps match variant steps

---

### Risks / Notes
- The composite key change in `routineLogRepository` is the most sensitive change. The `getLogKey()` helper function must be used consistently. Old key format must remain queryable.
- Validation for `durationSeconds` vs `timerSeconds` naming inconsistency (see audit tech debt 11.8) should be resolved as part of Task 2.4.

---

## Phase 3 — Routine Creation / Editing UX

### Objective

Users can create and edit routines with multiple variants. The editor defaults to a single "Default" variant for new routines, preserving the current UX for simple cases.

### Tasks

#### Task 3.1 — Add variant tab bar to `RoutineEditorModal`

**Purpose**: Replace the single-step-list editor with a tabbed interface where each tab is a variant.

**Affected areas**:
- `src/components/RoutineEditorModal.tsx`

**Dependencies**: Task 1.1, 1.2

**Acceptance criteria**:
- [ ] New state: `variants: RoutineVariant[]` replaces `steps: RoutineStep[]`
- [ ] New state: `activeVariantIndex: number` (default 0)
- [ ] Horizontal tab bar shows variant names; clicking a tab switches the active variant
- [ ] When creating a new routine, a single "Default" variant is auto-created
- [ ] When editing an existing routine, tabs populate from `routine.variants` (or synthesize one from `routine.steps` for pre-migration routines)
- [ ] The existing step list UI renders `variants[activeVariantIndex].steps`

---

#### Task 3.2 — Create `VariantEditor` sub-component

**Purpose**: Encapsulate per-variant configuration (name, description, duration, steps) in a reusable component.

**Affected areas**:
- New file: `src/components/VariantEditor.tsx`

**Dependencies**: Task 1.1

**Acceptance criteria**:
- [ ] Props: `variant: RoutineVariant`, `onChange: (updated) => void`, `onDelete?: () => void`, `habits: Habit[]`, `categoryId?: string`
- [ ] Renders: variant name input, description textarea (optional), estimated duration input (minutes), step list with add/remove/reorder
- [ ] Step management is scoped to this variant — identical to current step management behavior but operating on `variant.steps`
- [ ] Linked habit selector per step (filtered by `categoryId` if set)
- [ ] `linkedHabitIds` is auto-computed from step `linkedHabitId` values on change

---

#### Task 3.3 — Add variant management actions

**Purpose**: Users need to add, copy, and delete variants within the editor.

**Affected areas**:
- `src/components/RoutineEditorModal.tsx`

**Dependencies**: Task 3.1, 3.2

**Acceptance criteria**:
- [ ] "Add Variant" button creates a new variant with empty steps and focuses its tab
- [ ] "Copy Variant" duplicates the active variant (new ID, name suffixed with " (Copy)")
- [ ] "Delete Variant" removes the active variant with confirmation dialog
- [ ] Cannot delete the last remaining variant (button disabled + tooltip)
- [ ] Variant count capped at 10 with appropriate feedback
- [ ] Reordering variants (drag or move up/down) updates `sortOrder`

---

#### Task 3.4 — Update save flow for variants

**Purpose**: When the user saves a routine, the editor must persist variant data and sync habit links correctly.

**Affected areas**:
- `src/components/RoutineEditorModal.tsx` — save handler
- `src/store/RoutineContext.tsx` — `addRoutine`, `updateRoutine` action types

**Dependencies**: Task 2.2, 2.7, 3.1

**Acceptance criteria**:
- [ ] On save, the editor sends `variants` array in the create/update payload
- [ ] `Routine.linkedHabitIds` is set to the union of all variants' `linkedHabitIds`
- [ ] Bi-directional habit linking (`Habit.linkedRoutineIds`) syncs based on the union
- [ ] `defaultVariantId` is set to the first variant's ID if not explicitly set
- [ ] `RoutineContext.addRoutine()` and `updateRoutine()` accept `variants` in their payloads

---

#### Task 3.5 — Update editor validation

**Purpose**: Enforce variant-level validation before save.

**Affected areas**:
- `src/components/RoutineEditorModal.tsx` — validation logic

**Dependencies**: Task 3.1

**Acceptance criteria**:
- [ ] Every variant must have a non-empty name
- [ ] Every variant must have at least one step
- [ ] Every step must have a non-empty title
- [ ] `estimatedDurationMinutes` must be ≥ 1 (or auto-computed if not set)
- [ ] Validation errors reference the variant name (e.g., "Quick: Step 2 is missing a title")
- [ ] Tab for the variant with errors is highlighted / auto-focused

---

### Risks / Notes
- The existing step management logic (add/remove/reorder) is tightly coupled to component-local state in `RoutineEditorModal`. Extracting it into `VariantEditor` is a refactor with moderate risk of regressions.
- Bi-directional habit linking is currently done client-side with individual `updateHabit()` API calls. This is a known tech debt item (audit 11.2). For this phase, preserve the existing approach but operate on the union of variant-level `linkedHabitIds`.

---

## Phase 4 — Variant Selection UX

### Objective

When a user starts a multi-variant routine, they see a variant selector. Single-variant routines skip directly to execution (preserving current behavior).

### Tasks

#### Task 4.1 — Add variant selector to `RoutinePreviewModal`

**Purpose**: Users must choose which variant to run before starting execution.

**Affected areas**:
- `src/components/RoutinePreviewModal.tsx`

**Dependencies**: Task 1.1, 2.1

**Acceptance criteria**:
- [ ] If `routine.variants.length === 1`: no selector shown, behaves exactly as today
- [ ] If `routine.variants.length > 1`: display variant cards below routine details
- [ ] Each card shows: variant name, description (truncated), step count, estimated duration, icon/color if set
- [ ] `defaultVariantId` is pre-selected
- [ ] "Start Routine" button label updates to "Start [Variant Name]"
- [ ] `onStart` callback passes `(routineId, variantId)`

---

#### Task 4.2 — Create `VariantCard` component

**Purpose**: Reusable card component for displaying a variant's summary in selection contexts.

**Affected areas**:
- New file: `src/components/VariantCard.tsx`

**Dependencies**: Task 1.1

**Acceptance criteria**:
- [ ] Props: `variant: RoutineVariant`, `isSelected: boolean`, `onClick: () => void`
- [ ] Displays: name, description (optional, truncated at 2 lines), step count, estimated duration in minutes, icon/color badge
- [ ] Visual selected state (border highlight or background change)
- [ ] Accessible: keyboard navigable, ARIA selected state

---

#### Task 4.3 — Update `RoutineList` cards for variant info

**Purpose**: Routine cards on the main list should indicate how many variants exist and show the default variant's duration.

**Affected areas**:
- `src/components/RoutineList.tsx`

**Dependencies**: Task 2.1

**Acceptance criteria**:
- [ ] Routine card shows variant count badge (e.g., "3 variants") if > 1
- [ ] Duration display uses `resolveVariant(routine).estimatedDurationMinutes` instead of computing from `routine.steps`
- [ ] Step count uses `resolveSteps(routine).length`
- [ ] Single-variant routines look identical to current design (no badge)

---

#### Task 4.4 — Update `PinnedRoutinesCard` for variant awareness

**Purpose**: Pinned routine cards should indicate which variant was completed today (if any).

**Affected areas**:
- `src/components/dashboard/PinnedRoutinesCard.tsx`

**Dependencies**: Task 2.3

**Acceptance criteria**:
- [ ] Completion check uses updated log key lookup: searches for any log matching `routineId` and today's date (regardless of variant)
- [ ] If completed, shows variant name alongside the checkmark (e.g., "Quick completed")
- [ ] Quick-start button uses `defaultVariantId` for the routine
- [ ] Pre-migration routines (no variant in log) display as "Completed" without variant name

---

#### Task 4.5 — Update `App.tsx` modal state for variant

**Purpose**: The app-level modal orchestration must pass `variantId` through to the runner.

**Affected areas**:
- `src/App.tsx` — `routineRunnerState`

**Dependencies**: Task 4.1

**Acceptance criteria**:
- [ ] `routineRunnerState` gains `variantId?: string`
- [ ] When preview modal fires `onStart(routineId, variantId)`, the app passes `variantId` to `RoutineRunnerModal`
- [ ] Quick-start paths (dashboard, tracker grid) resolve `defaultVariantId` and pass it through

---

### Risks / Notes
- `TrackerGrid.tsx` has play buttons on habit rows that launch linked routines. These should continue to work by using `defaultVariantId`. No variant selector is shown for quick-start paths — the user can change the default in the editor if needed.
- `PinnedRoutinesCard` currently checks `routineLogs[${routineId}-${today}]` for completion. The key format change means this lookup must be updated to scan logs by `routineId` + `date` fields rather than relying on the composite string key.

---

## Phase 5 — Routine Execution Flow

### Objective

The runner modal executes the selected variant's steps, records `startedAt` timing, and submits variant-aware completion data.

### Tasks

#### Task 5.1 — Update `RoutineContext` execution state

**Purpose**: The context state machine must track which variant is being executed and when execution started.

**Affected areas**:
- `src/store/RoutineContext.tsx`

**Dependencies**: Task 1.1, 2.1

**Acceptance criteria**:
- [ ] New state field: `activeVariantId: string | null`
- [ ] New state field: `startedAt: string | null`
- [ ] New action: `selectVariant(variantId: string)` — stores the active variant ID
- [ ] `startRoutine()` accepts optional `variantId` parameter; initializes `stepStates` from `resolveSteps(activeRoutine, variantId)` instead of `activeRoutine.steps`
- [ ] `exitRoutine()` clears `activeVariantId` and `startedAt`
- [ ] `executionState` enum gains `'variant-select'` value (used between `'preview'` and `'execute'`)
- [ ] Single-variant routines can skip `'variant-select'` and go directly to `'execute'`

---

#### Task 5.2 — Update `RoutineRunnerModal` for variant execution

**Purpose**: The runner must execute the selected variant's steps, not the root-level steps.

**Affected areas**:
- `src/components/RoutineRunnerModal.tsx`

**Dependencies**: Task 5.1, 2.1

**Acceptance criteria**:
- [ ] Runner accepts `variantId` prop
- [ ] Steps resolved via `resolveSteps(routine, variantId)` — replaces all `routine.steps` references
- [ ] Header displays variant name alongside routine title (e.g., "Meal Prep — Quick")
- [ ] `startedAt` is recorded when execution begins (stored in context)
- [ ] Progress bar and step counter use variant step count
- [ ] Timer initializes from variant step's `timerSeconds`
- [ ] On completion, submit payload includes `variantId`, `startedAt`, `stepResults` (from context `stepStates`)

---

#### Task 5.3 — Update `CompletedHabitsModal` for variant habits

**Purpose**: The habit logging modal must show habits linked to the executed variant, not the routine-level union.

**Affected areas**:
- `src/components/CompletedHabitsModal.tsx`

**Dependencies**: Task 5.1

**Acceptance criteria**:
- [ ] Modal receives `variantId` (or the resolved variant's `linkedHabitIds`)
- [ ] Habit checkboxes reflect the variant's linked habits, not `routine.linkedHabitIds`
- [ ] If no `variantId` (legacy path), falls back to `routine.linkedHabitIds`

---

#### Task 5.4 — Update evidence generation for variant context

**Purpose**: `HabitPotentialEvidence` records generated during execution must include variant context.

**Affected areas**:
- `src/store/RoutineContext.tsx` — the `useEffect` that fires `POST /api/evidence/step-reached`

**Dependencies**: Task 2.6, 5.1

**Acceptance criteria**:
- [ ] Evidence request body includes `variantId` from `activeVariantId` in context
- [ ] Step references are from the active variant's steps, not `routine.steps`

---

### Risks / Notes
- The runner modal has duplicated execution state (local `currentStepIndex` + context `currentStepIndex`). This is existing tech debt (audit 11.1). For this phase, ensure the variant step resolution is consistent between both. Consider consolidating as a follow-up.
- The `startedAt` timestamp should be captured exactly once when the first step renders, not on modal open. This ensures accurate duration measurement.

---

## Phase 6 — Analytics

### Objective

Variant attribution flows through to analytics. Users can view per-variant usage patterns.

### Tasks

#### Task 6.1 — Update `daySummary.ts` for variant provenance

**Purpose**: Aggregated day entries must carry `variantId` so analytics can distinguish variant contributions.

**Affected areas**:
- `src/server/routes/daySummary.ts`

**Dependencies**: Task 1.4

**Acceptance criteria**:
- [ ] `AggregatedDayEntry` type gains `latestVariantId?: string`
- [ ] Aggregation logic populates `latestVariantId` from `HabitEntry.variantId`
- [ ] Entries without `variantId` (legacy) produce `latestVariantId: undefined`

---

#### Task 6.2 — Update `truthQuery.ts` for variant provenance

**Purpose**: Truth query results must expose variant provenance for charts and progress views.

**Affected areas**:
- `src/server/services/truthQuery.ts`

**Dependencies**: Task 1.4

**Acceptance criteria**:
- [ ] `EntryView.provenance` gains `variantId?: string`
- [ ] Mapping logic reads `variantId` from the source entry
- [ ] No breaking changes to existing provenance consumers

---

#### Task 6.3 — Update `routineLogs.ts` for variant-filtered queries

**Purpose**: The logs endpoint must support filtering by variant for analytics.

**Affected areas**:
- `src/server/routes/routineLogs.ts`

**Dependencies**: Task 2.3

**Acceptance criteria**:
- [ ] `GET /api/routineLogs` accepts optional `variantId` query parameter
- [ ] `GET /api/routineLogs` accepts optional `routineId` query parameter
- [ ] Returns logs matching the filter criteria
- [ ] Without filters, returns all logs (existing behavior)

---

#### Task 6.4 — Update `PinnedRoutinesCard` analytics display

**Purpose**: Show variant-aware completion information on pinned routine cards.

**Affected areas**:
- `src/components/dashboard/PinnedRoutinesCard.tsx`

**Dependencies**: Task 4.4 (may be combined with Task 4.4)

**Acceptance criteria**:
- [ ] Card shows which variant was completed today (if multi-variant routine)
- [ ] Tooltip or subtitle displays variant name
- [ ] Legacy logs without variant display as "Completed"

---

#### Task 6.5 — Create `RoutineAnalyticsPanel` component

**Purpose**: New analytics view showing per-variant usage breakdown.

**Affected areas**:
- New file: `src/components/RoutineAnalyticsPanel.tsx`

**Dependencies**: Task 6.3

**Acceptance criteria**:
- [ ] Variant usage frequency chart (bar or pie) — how often each variant is run
- [ ] Completion rate by variant — percentage of started vs completed (requires `startedAt` data)
- [ ] Duration comparison — estimated vs actual duration per variant
- [ ] Graceful handling of legacy logs (grouped as "Pre-variant" or "Default")
- [ ] Empty state for routines with no execution history
- [ ] Panel is accessible from the routine detail view or list

---

### Risks / Notes
- Analytics will initially be sparse for newly created variants. The panel should show meaningful information even with 1-2 data points per variant.
- `truthQuery.ts` is a core service — changes must not affect habit-level analytics. Test thoroughly with existing data patterns.

---

## Phase 7 — Gemini AI Suggestions

### Objective

Users can request AI-generated variant suggestions. Suggestions are reviewed, edited, and accepted/rejected before being saved.

### Tasks

#### Task 7.1 — Create `aiVariantService.ts`

**Purpose**: Server-side service that constructs prompts, calls Gemini, and parses variant suggestions.

**Affected areas**:
- New file: `src/server/services/aiVariantService.ts`

**Dependencies**: Task 1.1

**Acceptance criteria**:
- [ ] Function: `suggestVariants(input: { routineTitle, categoryName, existingSteps, userHabits, variantCount? })` returns `SuggestedVariant[]`
- [ ] Prompt instructs Gemini to generate Quick/Standard/Deep variants (or custom count)
- [ ] Response parsed and validated against `RoutineVariant` shape (minus `id`, `createdAt`, `updatedAt`, `isAiGenerated` which are set server-side)
- [ ] Step `timerSeconds` values are present and reasonable
- [ ] Suggested habit links (`suggestedHabitLink`) reference actual habit IDs from the input
- [ ] Error handling: API timeout, invalid JSON response, rate limiting (max 3 requests per routine per hour)
- [ ] Fallback: returns empty array if Gemini is unavailable, caller shows error UI

---

#### Task 7.2 — Create API endpoint for variant suggestions

**Purpose**: Frontend calls this endpoint to request AI suggestions.

**Affected areas**:
- New or existing: `src/server/routes/ai.ts` — `POST /api/ai/suggest-variants`

**Dependencies**: Task 7.1

**Acceptance criteria**:
- [ ] Accepts body: `{ routineId, routineTitle, categoryId, existingSteps, variantCount? }`
- [ ] Resolves category name from `categoryId`
- [ ] Fetches user's habits in the same category
- [ ] Calls `suggestVariants()` service
- [ ] Returns `{ suggestedVariants: RoutineVariant[] }` (with `isAiGenerated: true`)
- [ ] Validates user owns the routine (if `routineId` provided)
- [ ] Rate limit: 3 requests per routine per hour

---

#### Task 7.3 — Add API client function for suggestions

**Purpose**: Frontend needs a function to call the suggestion endpoint.

**Affected areas**:
- `src/lib/persistenceClient.ts`

**Dependencies**: Task 7.2

**Acceptance criteria**:
- [ ] `suggestVariants(params)` function sends `POST /api/ai/suggest-variants`
- [ ] Returns typed `SuggestedVariant[]` response
- [ ] Handles error responses (rate limit, API errors)

---

#### Task 7.4 — Add "Suggest Variants" UI to editor

**Purpose**: Users trigger AI suggestions from the routine editor and review them before accepting.

**Affected areas**:
- `src/components/RoutineEditorModal.tsx`

**Dependencies**: Task 3.1, 7.3

**Acceptance criteria**:
- [ ] "Suggest Variants with AI" button visible in editor (enabled when title and category are set)
- [ ] Loading state during Gemini processing (spinner or skeleton cards)
- [ ] Suggested variants appear in a review panel below the editor
- [ ] Each suggestion shows: name, description, step count, duration
- [ ] User can: accept individual suggestions, accept all, dismiss all
- [ ] Accepting a suggestion adds it to the variants list as a new tab with `isAiGenerated: true`
- [ ] User can edit accepted suggestions normally (they become regular variants)
- [ ] AI suggestions do NOT auto-link habits — `linkedHabitId` on steps is left empty for user to confirm
- [ ] Error state: shows toast/banner if Gemini is unavailable or rate limited

---

### Risks / Notes
- AI suggestions are advisory only. The user must explicitly review and accept them. This is a guardrail against bad AI outputs.
- Rate limiting (3/routine/hour) prevents abuse and excessive API costs. Implement server-side with an in-memory or Redis-backed counter.
- The Gemini response must be validated strictly. Malformed JSON should not crash the editor.

---

## Phase 8 — Migration / Backfill

### Objective

Convert all existing routines to single-variant format. Verify data integrity. Ensure rollback is possible.

### Tasks

#### Task 8.1 — Run migration in staging/development

**Purpose**: Validate migration script on real-ish data before production.

**Affected areas**:
- `src/server/migrations/001_add_routine_variants.ts` (written in Task 2.8)

**Dependencies**: Task 2.8, all Phase 1–2 tasks

**Acceptance criteria**:
- [ ] Dry-run mode executes without errors
- [ ] Dry-run output shows correct routine count and planned changes
- [ ] Actual run converts all routines
- [ ] Verification query confirms: every routine has `variants.length >= 1`, `defaultVariantId` is set, `steps` is empty array, variant steps match original steps
- [ ] No routines were skipped unexpectedly

---

#### Task 8.2 — Create RoutineLog index migration

**Purpose**: Add the variant-aware index to the `routineLogs` collection.

**Affected areas**:
- MongoDB index on `routineLogs`

**Dependencies**: Task 2.3

**Acceptance criteria**:
- [ ] Index `{ userId: 1, routineId: 1, variantId: 1, date: 1 }` created (unique, sparse)
- [ ] Existing logs (without `variantId`) are not affected by the new index
- [ ] Old composite key field still queryable

---

#### Task 8.3 — Verify backwards compatibility post-migration

**Purpose**: All existing functionality must work identically after migration.

**Affected areas**:
- Full application stack

**Dependencies**: Task 8.1

**Acceptance criteria**:
- [ ] Existing routines display correctly in `RoutineList` (same title, step count, duration)
- [ ] Existing routines can be previewed and started
- [ ] Existing routines can be executed and completed
- [ ] `PinnedRoutinesCard` shows correct completion status for today
- [ ] Existing `RoutineLog` entries are queryable and display correctly
- [ ] `TrackerGrid` play buttons still work
- [ ] Habit entries with `source: 'routine'` still have correct provenance

---

#### Task 8.4 — Document rollback procedure

**Purpose**: If migration causes issues, there must be a clear rollback path.

**Affected areas**:
- Documentation / runbook

**Dependencies**: Task 8.1

**Acceptance criteria**:
- [ ] Rollback script exists that: restores `routine.steps` from `variants[0].steps`, removes `variants` and `defaultVariantId` fields
- [ ] Rollback script is idempotent
- [ ] Rollback procedure is documented with commands and verification steps
- [ ] Database backup recommendation is documented (snapshot before migration)

---

### Risks / Notes
- Migration MUST be run during a low-traffic window. The `$set` operations are per-document and not atomic across the collection.
- The migration does NOT backfill `variantId` on existing `RoutineLog` or `HabitEntry` records. This is intentional — historical data predates the variant concept.
- Keep `routine.steps` as an empty array (not deleted) for backwards compatibility with any cached or offline-first clients.

---

## Phase 9 — QA / Validation / Cleanup

### Objective

Comprehensive testing, test suite updates, and tech debt cleanup.

### Tasks

#### Task 9.1 — Update existing test suites

**Purpose**: Existing tests must pass with variant-aware code paths.

**Affected areas**:
- `src/server/routes/__tests__/routines.validation.test.ts`
- `src/server/routes/__tests__/routines.submit.test.ts`
- `src/server/routes/__tests__/routines.completion-guardrail.test.ts`
- `src/store/RoutineContext.test.tsx`
- `src/server/repositories/__tests__/routineImageRepository.test.ts`

**Dependencies**: All previous phases

**Acceptance criteria**:
- [ ] All existing tests pass without modification where possible
- [ ] Tests updated to create routines with `variants` array
- [ ] Submit tests include `variantId` in payloads
- [ ] Completion guardrail test verifies variant-aware submissions still don't auto-create entries
- [ ] Context tests verify `activeVariantId`, `startedAt` state management
- [ ] Image repo tests unchanged (images remain 1:1 with routine)

---

#### Task 9.2 — Write new variant-specific tests

**Purpose**: Cover new code paths introduced by the variant feature.

**Affected areas**:
- New test files or additions to existing test files

**Dependencies**: All previous phases

**Acceptance criteria**:
- [ ] Test: create routine with multiple variants via API
- [ ] Test: update routine variants (add, modify, remove variant)
- [ ] Test: submit routine with `variantId` — verify `RoutineLog` and `HabitEntry` have `variantId`
- [ ] Test: submit routine without `variantId` — backwards compatible
- [ ] Test: migration script converts legacy routine correctly
- [ ] Test: `resolveVariant` / `resolveSteps` utility handles all edge cases
- [ ] Test: validation rejects malformed variants (missing name, too many variants, etc.)
- [ ] Test: composite key produces unique keys for different variants on same day

---

#### Task 9.3 — End-to-end smoke test

**Purpose**: Manual or automated walkthrough of the complete feature.

**Affected areas**:
- Full application

**Dependencies**: All previous phases

**Acceptance criteria**:
- [ ] Create a new routine with 3 variants (Quick, Standard, Deep)
- [ ] Verify each variant has different steps, durations, and linked habits
- [ ] Preview the routine — variant selector appears
- [ ] Start and complete each variant on different days
- [ ] Verify `RoutineLog` entries have correct `variantId`
- [ ] Verify habit entries from routine completion have `variantId`
- [ ] Edit the routine — modify a variant's steps, save
- [ ] Delete a variant (not the last one) — verify the routine still works
- [ ] Check analytics panel shows per-variant data
- [ ] Request AI suggestions — verify review/accept flow

---

#### Task 9.4 — Clean up resolver usage

**Purpose**: Audit all consumers of `routine.steps` and ensure they use `resolveSteps()` or `resolveVariant()`.

**Affected areas**:
- All files that reference `routine.steps` directly

**Dependencies**: Task 2.1, all UI tasks

**Acceptance criteria**:
- [ ] `grep -r "routine\.steps" src/` returns zero direct accesses outside of `resolveSteps()` and the migration script
- [ ] `grep -r "routine.steps" src/` in UI components returns zero hits
- [ ] All step count / duration computations go through the resolver

---

#### Task 9.5 — Update canonical documentation

**Purpose**: Reference documentation must reflect the new architecture.

**Affected areas**:
- `docs/reference/V2 (Current - iOS focus)/03_Routine.md`

**Dependencies**: All previous phases

**Acceptance criteria**:
- [ ] Routine entity documentation updated with `variants`, `defaultVariantId`
- [ ] `RoutineVariant` entity documented
- [ ] `RoutineLog` fields documented (including new `variantId`, `startedAt`, etc.)
- [ ] Execution flow diagram updated to include variant selection step
- [ ] Semantic rules verified: "routines never imply completion" still holds

---

# 4. File/Area Mapping

| Implementation Area | Files / Directories |
|---------------------|---------------------|
| **Type definitions** | `src/models/persistenceTypes.ts`, `src/types/index.ts`, `src/server/domain/canonicalTypes.ts` |
| **Resolver utility** | `src/lib/routineVariantUtils.ts` (new) |
| **Routine repository** | `src/server/repositories/routineRepository.ts` |
| **Log repository** | `src/server/repositories/routineLogRepository.ts` |
| **Image repository** | `src/server/repositories/routineImageRepository.ts` (no changes expected) |
| **API routes — routines** | `src/server/routes/routines.ts` |
| **API routes — logs** | `src/server/routes/routineLogs.ts` |
| **API routes — evidence** | `src/server/routes/habitPotentialEvidence.ts` |
| **API routes — AI** | `src/server/routes/ai.ts` (new or existing) |
| **API client** | `src/lib/persistenceClient.ts` |
| **State management** | `src/store/RoutineContext.tsx` |
| **Routine list page** | `src/components/RoutineList.tsx` |
| **Routine editor** | `src/components/RoutineEditorModal.tsx` |
| **Variant editor** | `src/components/VariantEditor.tsx` (new) |
| **Variant card** | `src/components/VariantCard.tsx` (new) |
| **Routine preview** | `src/components/RoutinePreviewModal.tsx` |
| **Routine runner** | `src/components/RoutineRunnerModal.tsx` |
| **Habit logging modal** | `src/components/CompletedHabitsModal.tsx` |
| **Pinned routines** | `src/components/dashboard/PinnedRoutinesCard.tsx` |
| **Tracker grid** | `src/components/TrackerGrid.tsx` |
| **App orchestration** | `src/App.tsx` |
| **Analytics — day summary** | `src/server/routes/daySummary.ts` |
| **Analytics — truth query** | `src/server/services/truthQuery.ts` |
| **Analytics panel** | `src/components/RoutineAnalyticsPanel.tsx` (new) |
| **AI service** | `src/server/services/aiVariantService.ts` (new) |
| **Migration** | `src/server/migrations/001_add_routine_variants.ts` (new) |
| **Validation** | `src/server/domain/canonicalValidators.ts`, `src/server/routes/routines.ts` |
| **Tests** | `src/server/routes/__tests__/routines.*.test.ts`, `src/store/RoutineContext.test.tsx` |
| **Documentation** | `docs/reference/V2 (Current - iOS focus)/03_Routine.md` |

---

# 5. Migration Tasks

## Step-by-step migration plan

### Pre-migration

1. **Backup**: Take a MongoDB snapshot/dump of the `routines` and `routineLogs` collections
2. **Deploy backend**: Deploy all Phase 1–2 changes. The backend must handle both variant-aware and legacy routine shapes before migration runs
3. **Verify resolver**: Confirm `resolveSteps()` correctly synthesizes a virtual variant for legacy routines (no migration needed for reads to work)

### Migration execution

4. **Dry run**: Execute `001_add_routine_variants.ts` with `--dry-run` flag
   - Log: total routine count, count to migrate, count already migrated
   - Verify: no errors, expected counts match
5. **Execute migration**: Run script without dry-run flag
   - For each routine without `variants` field:
     - Create a "Default" variant with `id: randomUUID()`
     - Set `variant.steps = routine.steps`
     - Set `variant.linkedHabitIds = routine.linkedHabitIds`
     - Compute `variant.estimatedDurationMinutes` from step timers
     - Set `routine.defaultVariantId = variant.id`
     - Set `routine.variants = [variant]`
     - Set `routine.steps = []`
6. **Create index**: Add `{ userId: 1, routineId: 1, variantId: 1, date: 1 }` index on `routineLogs`

### Post-migration verification

7. **Count check**: `db.routines.countDocuments({ variants: { $exists: true, $not: { $size: 0 } } })` equals total routine count
8. **Spot check**: Sample 5 routines manually — verify variant steps match original steps
9. **Functional test**: Create, preview, execute, and complete a migrated routine through the UI
10. **Log check**: Verify existing `RoutineLog` entries are still queryable and display correctly

### Legacy routine handling

- **If a routine has no `variants`**: `resolveSteps()` falls back to `routine.steps`. All UI paths work.
- **If a routine has `variants` but `steps` is non-empty**: Migration clears `steps` after copying to variant. This should not happen post-migration.
- **`RoutineLog` entries without `variantId`**: Preserved as-is. Analytics queries include `variantId: null` results under "Legacy" label.

### Rollback procedure

1. Run rollback script: for each routine with `variants`, copy `variants[0].steps` back to `routine.steps`, copy `variants[0].linkedHabitIds` to `routine.linkedHabitIds`, remove `variants` and `defaultVariantId` fields
2. Drop the new `routineLogs` index
3. Redeploy previous backend version (pre-variant code)
4. Verify: routines display and execute correctly with root-level `steps`

---

# 6. QA Checklist

## Routine creation

- [ ] Create a routine with no explicit variants → auto-creates single "Default" variant
- [ ] Create a routine with 1 manually named variant → works correctly
- [ ] Create a routine with 3 variants (Quick, Standard, Deep) → all saved
- [ ] Verify each variant has independent steps, linked habits, and duration
- [ ] Attempt to create > 10 variants → appropriate error shown
- [ ] Attempt to save a variant with no name → validation error
- [ ] Attempt to save a variant with no steps → validation error

## Variant editing

- [ ] Edit a variant's name → persists after save
- [ ] Add steps to a variant → persists correctly
- [ ] Remove steps from a variant → persists correctly
- [ ] Reorder steps within a variant → order preserved
- [ ] Copy a variant → creates duplicate with "(Copy)" suffix
- [ ] Delete a non-default variant → removed, routine still works
- [ ] Attempt to delete the last variant → prevented
- [ ] Change default variant → new default pre-selected on next start

## Variant selection

- [ ] Start a single-variant routine → no variant selector shown
- [ ] Start a multi-variant routine → variant selector displayed
- [ ] Default variant is pre-selected
- [ ] Select a different variant → "Start [name]" button updates
- [ ] Quick-start from dashboard → uses default variant (no selector)
- [ ] Quick-start from tracker grid → uses default variant (no selector)

## Routine execution

- [ ] Executing a variant shows that variant's steps only
- [ ] Header shows "Routine Title — Variant Name"
- [ ] Step count and progress reflect variant's step count
- [ ] Timer uses variant step's `timerSeconds`
- [ ] Mark step done / skip step → updates step state correctly
- [ ] Evidence generated with correct `variantId`

## Routine completion

- [ ] Complete routine without logging habits → `RoutineLog` has `variantId`
- [ ] Complete routine + log habits → `HabitEntry` records have `variantId`
- [ ] `RoutineLog` has `startedAt`, `completedAt`, `actualDurationSeconds`, `stepResults`
- [ ] Same routine, different variants completed on same day → separate log entries
- [ ] Completion guardrail: completing a routine without selecting habits creates NO `HabitEntry` records

## Legacy compatibility

- [ ] Pre-migration routines display correctly (fallback to `routine.steps`)
- [ ] Pre-migration routines can be executed and completed
- [ ] Migrated routines (single "Default" variant) work identically to before
- [ ] Pre-migration `RoutineLog` entries display correctly
- [ ] `HabitEntry` records without `variantId` show correct provenance

## Analytics

- [ ] `PinnedRoutinesCard` shows which variant was completed today
- [ ] Analytics panel shows variant usage breakdown
- [ ] Legacy logs appear under "Pre-variant" / "Default" label
- [ ] Duration comparison shows estimated vs actual per variant

## Gemini AI suggestions

- [ ] "Suggest Variants" button appears in editor (requires title + category)
- [ ] Loading state shown during API call
- [ ] Suggestions displayed for review
- [ ] Accept individual suggestion → added as new variant tab
- [ ] Accept all suggestions → all added as variant tabs
- [ ] Dismiss suggestions → no changes made
- [ ] Accepted suggestions marked `isAiGenerated: true`
- [ ] AI suggestions do NOT auto-link habits
- [ ] Rate limit reached → appropriate error message
- [ ] Gemini API unavailable → graceful error, manual creation still works

---

# 7. Suggested Implementation Sequence

## Critical path (sequential)

```
Phase 1 (Tasks 1.1–1.5)     ← Type definitions first, everything depends on these
    │
    ▼
Phase 2 (Tasks 2.1–2.8)     ← Resolver + persistence, enables all downstream work
    │
    ├──── Phase 3 (Tasks 3.1–3.5)    ← Editor UX (can start after 2.1–2.4)
    │
    ├──── Phase 4 (Tasks 4.1–4.5)    ← Selection UX (can start after 2.1)
    │
    └──── Phase 8 (Tasks 8.1–8.4)    ← Migration (can start after 2.8, run after all phases)
              │
              ▼
         Phase 5 (Tasks 5.1–5.4)     ← Execution (depends on Phase 2 + 4)
              │
              ▼
         Phase 6 (Tasks 6.1–6.5)     ← Analytics (depends on Phase 5)
              │
              ▼
         Phase 7 (Tasks 7.1–7.4)     ← AI (depends on Phase 3 editor)
              │
              ▼
         Phase 9 (Tasks 9.1–9.5)     ← QA (depends on everything)
```

## What can be parallelized

| Track A (Backend) | Track B (Frontend) |
|---|---|
| Phase 1: Type definitions | — |
| Task 2.1: Resolver utility | — |
| Tasks 2.2–2.6: Repositories + routes | Tasks 3.1–3.5: Editor UX (after types + resolver) |
| Task 2.7: API client updates | Tasks 4.1–4.5: Selection UX |
| Task 2.8: Migration script | Task 5.2: Runner modal |
| Tasks 6.1–6.3: Analytics backend | Tasks 5.3–5.4: Completion + evidence |
| Tasks 7.1–7.2: AI service + endpoint | Task 6.4–6.5: Analytics frontend |
| Task 8.1–8.2: Migration execution | Task 7.4: AI editor UI |

## What should wait

- **Phase 8 (Migration)**: Run only after Phases 1–5 are deployed and stable. Never run in production during active development.
- **Phase 9 (QA)**: Final validation after all phases complete. Test suite updates can happen incrementally.
- **Task 6.5 (Analytics panel)**: Can be deferred to a follow-up release if time is constrained. Core variant functionality works without it.
- **Phase 7 (AI)**: Entirely independent feature. Can be shipped as a separate release after core variants are stable.

---

# 8. Open Questions

1. **Variant deletion strategy**: Should deleted variants be **soft-deleted** (`archived: true`) to preserve historical references in `RoutineLog`, or **hard-deleted** with the variant name snapshotted into the log at write time? Soft-delete is safer but increases document size over time.

2. **Multiple completions per day**: The new composite key `${routineId}-${variantId}-${date}` allows one completion per variant per day. Should a user be able to complete the **same variant** multiple times in one day (e.g., a meditation routine done morning and evening)? If yes, the key needs a sequence counter or timestamp component.

3. **Default variant auto-selection**: When a user quick-starts a routine from the dashboard or tracker grid, should it always use `defaultVariantId`, or remember the last-used variant? Remembering last-used requires additional state (localStorage or user preferences).

4. **Variant-specific images**: The current plan keeps images at the routine level (1:1). Should variants support their own icons/colors but not images? Or should per-variant images be added later?

5. **AI suggestion count**: The plan defaults to 3 suggestions (Quick/Standard/Deep). Should users be able to specify how many variants they want generated? What's the maximum?

6. **`estimatedDurationMinutes` source**: Should this be user-editable or always computed from step timers? The implementation plan says "explicit, not computed" but this could drift from actual step timers if the user adds/removes steps without updating duration.

7. **Bi-directional linking scope**: When a variant is deleted, should the routine's habit links be re-synced (removing habits that are no longer linked in any variant)? This affects `Habit.linkedRoutineIds`.

8. **Analytics granularity**: Should the analytics panel be accessible per-routine (drill down from `RoutineList`) or as a global analytics page showing all routines with variant breakdowns?

9. **`stepResults` storage**: Storing step results (`done`/`skipped`/`neutral`) per log increases document size. Is this data valuable enough to store on every completion, or should it be opt-in / configurable?

10. **Timer field naming**: The audit identified a naming inconsistency (`timerSeconds` vs `durationSeconds` in validation). Should this be resolved as part of the variant work, or tracked separately to minimize scope?
