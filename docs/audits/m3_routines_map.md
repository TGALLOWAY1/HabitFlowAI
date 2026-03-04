# M3 Routines Map — Routine Execution & Logging Audit

**Purpose:** Map routine execution end-to-end and current logging behavior for M3 (per-step completion, completion modal, batch HabitEntry creation).

---

## 1. Frontend: Components & Routes

### 1.1 Starting a routine

| Entry point | Component | Handler | Result |
|-------------|-----------|---------|--------|
| **Tracker** (habits view) | `TrackerGrid` | `onRunRoutine(routine)` → from habit card / context menu | `App`: `setRoutineRunnerState({ isOpen: true, routine })` |
| **Dashboard** | `ProgressDashboard` → Fitness / Emotional Wellbeing `ActionCards` | `onStartRoutine(routine)` | Same: `setRoutineRunnerState({ isOpen: true, routine })` |
| **Routines tab** | `RoutineList` | `onStart(routine)` or card click → `onPreview(routine)` then "Start" | Start: `setRoutineRunnerState({ isOpen: true, routine })`; Preview: `setRoutinePreviewState(...)` then "Start" → close preview, open runner |

**Relevant files:**
- `src/App.tsx` — `routineRunnerState`, `routinePreviewState`; passes `onStartRoutine` / `onRunRoutine` / `onStart` that set runner state.
- `src/components/RoutineRunnerModal.tsx` — receives `isOpen`, `routine`, `onClose`; **owns** step index and completion view locally.
- `src/components/RoutinePreviewModal.tsx` — preview UI; `onStart(routine)` closes preview and opens runner (via App state).
- `src/components/RoutineList.tsx` — list + cards; `onStart`, `onPreview` from props.
- `src/components/TrackerGrid.tsx` — `onRunRoutine` prop; used from habit card and context menu (e.g. line ~1415).
- `src/components/ProgressDashboard.tsx` — forwards `onStartRoutine` to persona dashboards.
- `src/components/personas/fitness/ActionCards.tsx` — `onStartRoutine(routine)` on card click.
- `src/components/personas/emotionalWellbeing/EmotionalWellbeingDashboard.tsx` — same; `ActionCards` with `onStartRoutine`.
- `src/components/personas/fitness/FitnessDashboard.tsx` — `onStartRoutine(routine)`; also `RoutinePreviewModal` with `onStart` → runner.

### 1.2 Marking steps done

- **Single source of step progress:** `RoutineRunnerModal` only.
- **State:** Local `useState`: `currentStepIndex`, `isCompletionView` (no per-step “done” set).
- **Actions:**
  - **Next:** `handleNext()` — if last step → `setIsCompletionView(true)`; else `setCurrentStepIndex(prev => prev + 1)`.
  - **Back:** `handlePrevious()` — from completion view → back to last step; else decrement index.
- **File:** `src/components/RoutineRunnerModal.tsx` (lines 19–21, 74–88).

**Important:** `RoutineContext` has execution state (`activeRoutine`, `executionState`, `currentStepIndex`, `nextStep`, `prevStep`, `skipStep`) and an effect that calls `POST /api/evidence/step-reached` when `executionState === 'execute'` and the current step has `linkedHabitId`. The **runner flow does not use this context**: the modal is driven by App’s `routineRunnerState` and its own local state. So **step-reached evidence is not triggered** by the current runner modal flow.

### 1.3 Completing / canceling a routine

- **Complete (from completion screen):**
  - **Complete Routine:** `handleFinish(false)` → `submitRoutine(routine.id, { submittedAt, habitIdsToComplete: undefined })` → no HabitEntries.
  - **Complete + Log Habits:** `handleFinish(true)` → `submitRoutine(..., habitIdsToComplete: routine.linkedHabitIds)` → backend creates HabitEntries + RoutineLog.
- **Cancel:** Header X → `onClose()` → `setRoutineRunnerState({ isOpen: false })` in App. No submit, no RoutineLog, no HabitEntries.
- **File:** `src/components/RoutineRunnerModal.tsx` — `handleFinish(logHabits)` (lines 90–106), footer buttons (261–278), header close (144).

---

## 2. State Management

### 2.1 Where routine execution state lives

| State | Location | Used by |
|-------|----------|--------|
| **Modal open + routine** | `App` (`HabitTrackerContent`): `routineRunnerState` = `{ isOpen, routine }` | `RoutineRunnerModal` |
| **Current step index** | `RoutineRunnerModal`: local `currentStepIndex` | Same component |
| **Completion screen** | `RoutineRunnerModal`: local `isCompletionView` | Same component |
| **Timer** | `RoutineRunnerModal`: local `timeLeft`, `isTimerRunning`, `timerRef` | Same component |
| **Context execution** | `RoutineContext`: `activeRoutine`, `executionState`, `currentStepIndex` | Not used by runner modal; used by `RoutineList` / store for list data only |

So **execution** is: App (which routine, open/close) + `RoutineRunnerModal` (steps, completion, timer). Context holds list data and an unused execution path.

### 2.2 How step completion is represented today

- **No explicit “step completed” model.** Progress is implied by `currentStepIndex`: “we are on step N.” Moving to next step does not record which steps are “done” (no `Set<stepId>` or `completedStepIds`).
- **RoutineLog** (backend) is created only on **submit** (routine completion), and stores `routineId`, `date`, `completedAt` — no step-level data.
- **HabitPotentialEvidence** is created by `POST /api/evidence/step-reached` (when step has `linkedHabitId`), but that endpoint is only invoked from `RoutineContext`’s effect, which the current runner flow never triggers.

---

## 3. Backend: Endpoints & HabitEntry Creation

### 3.1 Endpoints used by the flow

| Endpoint | When | Creates HabitEntries? |
|----------|------|------------------------|
| **GET /api/routines** | Load routine list (e.g. `RoutineContext`, dashboards) | No |
| **GET /api/routineLogs** | Load logs (e.g. `RoutineContext`, ActionCards) | No |
| **POST /api/routines/:id/submit** | User taps “Complete Routine” or “Complete + Log Habits” in `RoutineRunnerModal` | **Yes**, only when `habitIdsToComplete` is sent (i.e. “Complete + Log Habits”). One HabitEntry per habit ID; then `saveRoutineLog`. |
| **POST /api/evidence/step-reached** | Intended when reaching a step with `linkedHabitId` | No. Creates **HabitPotentialEvidence** only. Not called in current runner flow (see above). |

### 3.2 Submit route behavior (HabitEntry creation)

- **File:** `src/server/routes/routines.ts` — `submitRoutineRoute` (lines 504–567).
- **Logic:**
  - Validates `id`, optional `habitIdsToComplete`, `submittedAt`, `dateOverride`, `timeZone`.
  - Resolves `logDate` (dayKey) from `dateOverride` or `submittedAt`/timeZone.
  - For each `habitId` in `habitIdsToComplete` (default `[]`): `upsertHabitEntry(..., { source: 'routine', routineId, ... })` then `recomputeDayLogForHabit`.
  - Saves **RoutineLog** (`routineId`, `date`, `completedAt`).
- **HabitEntry creation:** Only in this route; only when frontend sends `habitIdsToComplete` (e.g. “Complete + Log Habits”). No HabitEntry is created by evidence routes.

### 3.3 Evidence route (step-reached)

- **File:** `src/server/routes/habitPotentialEvidence.ts` — `POST /step-reached`.
- **Behavior:** Creates `HabitPotentialEvidence` (habitId, routineId, stepId, date, timestamp) when step has `linkedHabitId`. Does **not** create HabitEntry. (Evidence → HabitEntry is a separate confirmation flow.)

---

## 4. Minimal Insertion Points for M3

### 4.1 Per-step completion state

- **Representation:** Add a set of completed step IDs (or equivalent) for the current run, e.g. `completedStepIds: Set<string>` or `completedStepIds: string[]`.
- **Where:**
  - **Option A (local only):** `RoutineRunnerModal`: new state `completedStepIds`; in `handleNext()`, add `currentStep.id` to the set when advancing. No backend change for “display only” step completion.
  - **Option B (if persisting):** Same state in modal; on submit, optionally send `completedStepIds` in the submit payload and extend `RoutineLog` or a related type to store step-level completion (backend change).
- **Smallest diff:** Option A — add state and update `handleNext` (and optionally `handlePrevious` if you want to unmark) in `src/components/RoutineRunnerModal.tsx`. Optionally show checkmarks in a step strip or list from `completedStepIds`.

### 4.2 Routine completion modal

- **Current:** Completion is already a **view** inside `RoutineRunnerModal` (`isCompletionView`): “All Done!”, “Complete Routine” / “Complete + Log Habits” (lines 153–161, 255–279).
- **Gap for M3:** If “routine completion modal” means a **post-close** modal (e.g. “You completed X; N habits logged”), that would be a separate modal or toast, opened after `submitRoutine` + `onClose()` in `handleFinish`.
- **Insertion:** In `RoutineRunnerModal.handleFinish`, after successful `submitRoutine` and `refreshDayLogs`, either: call a new callback e.g. `onComplete?.(routine, { loggedHabitIds })` so App can show a completion modal/toast, or open a small in-modal “Success” state before calling `onClose()`. Smallest diff: add `onComplete` callback from App and a lightweight success modal or toast in App.

### 4.3 Confirmed batch HabitEntry creation

- **Current:** Batch creation already exists in `submitRoutineRoute`: when `habitIdsToComplete` is provided, it creates one HabitEntry per habit and saves RoutineLog.
- **Gap:** The “confirm” step is the user choosing “Complete + Log Habits” vs “Complete Routine” in the modal. If M3 means “confirm which habits to log” (e.g. pre-selected from evidence or linked habits with checkboxes), then:
  - **Frontend:** Completion view could show linked habits with checkboxes; `handleFinish(true)` would pass the selected IDs (e.g. `habitIdsToComplete: selectedHabitIds`) instead of `routine.linkedHabitIds`. Minimal change in `RoutineRunnerModal`: state `selectedHabitIdsForLog: string[]`, init from `routine.linkedHabitIds`, checkboxes in completion view, pass to `submitRoutine`.
  - **Backend:** No change if payload remains `habitIdsToComplete: string[]`; optional validation that IDs are in `routine.linkedHabitIds` for security.
- **Smallest diff:** Add optional checkbox UI and `selectedHabitIdsForLog` in `RoutineRunnerModal` completion view; pass that array to `submitRoutine` when user taps “Complete + Log Habits” (or a single “Complete” that logs selected habits).

---

## 5. File & Function Reference

| Area | File | Functions / state |
|------|------|-------------------|
| **App routing / runner state** | `src/App.tsx` | `routineRunnerState`, `routinePreviewState`, `setRoutineRunnerState`; `onStartRoutine` / `onRunRoutine` / `onStart` handlers |
| **Runner UI & step flow** | `src/components/RoutineRunnerModal.tsx` | `currentStepIndex`, `isCompletionView`, `handleNext`, `handlePrevious`, `handleFinish(logHabits)` |
| **Preview** | `src/components/RoutinePreviewModal.tsx` | `onStart(routine)` |
| **Routine list** | `src/components/RoutineList.tsx` | `onStart`, `onPreview` (props) |
| **Tracker** | `src/components/TrackerGrid.tsx` | `onRunRoutine` (prop) |
| **Context (list + unused execution)** | `src/store/RoutineContext.tsx` | `activeRoutine`, `executionState`, `currentStepIndex`, `selectRoutine`, `startRoutine`, `nextStep`, `prevStep`, `skipStep`; effect calling `POST /api/evidence/step-reached` |
| **Submit API (client)** | `src/lib/persistenceClient.ts` | `submitRoutine(id, { habitIdsToComplete?, submittedAt?, dateOverride? })` |
| **Submit API (server)** | `src/server/routes/routines.ts` | `submitRoutineRoute` — `upsertHabitEntry` per habit, `saveRoutineLog` |
| **Routine log read** | `src/server/routes/routineLogs.ts` | `getRoutineLogs` |
| **Evidence** | `src/server/routes/habitPotentialEvidence.ts` | `POST /step-reached` → `createPotentialEvidence` (no HabitEntry) |

---

## 6. Smallest-Diff Plan (Summary)

1. **Per-step completion state (UI only)**  
   In `RoutineRunnerModal`: add `completedStepIds` (e.g. `Set<string>` or `string[]`), update in `handleNext` (and optionally `handlePrevious`). Use it to show step progress (e.g. checkmarks). No backend change.

2. **Routine completion modal / feedback**  
   Add optional `onComplete(routine, { loggedHabitIds })` from App to `RoutineRunnerModal`; in `handleFinish` after success, call it then `onClose()`. In App, show a short-lived completion modal or toast. Alternatively keep current in-modal completion view and only add a toast on “Complete + Log Habits”.

3. **Confirmed batch HabitEntry creation**  
   In `RoutineRunnerModal` completion view: add `selectedHabitIdsForLog` (default `routine.linkedHabitIds`), render checkboxes for linked habits; pass `selectedHabitIdsForLog` as `habitIdsToComplete` in `submitRoutine`. Backend can stay as-is; optionally restrict `habitIdsToComplete` to `routine.linkedHabitIds`.

4. **(Optional) Wire step-reached evidence to runner**  
   When advancing steps in `RoutineRunnerModal`, if current step has `linkedHabitId`, call `POST /api/evidence/step-reached` (e.g. via a small helper in `persistenceClient`) so potential evidence is created for the actual runner flow. Keeps design consistent with “evidence → user confirms → HabitEntry” without changing submit behavior.

---

*Audit date: 2026-03-03. M3 kickoff.*
