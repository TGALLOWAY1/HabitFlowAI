# M3: Routine execution flow + confirmed habit logging

Branch: `221-milestone-m3-routine-2-step-logging-ux-semantics`

## Summary

This branch implements end-to-end routine execution UX with **per-step completion state**, a **completion modal** that lets users choose which habits to log, and **batch HabitEntry creation** via a new API. It adds guardrails and docs so that **routine completion alone never counts as habit completion**—only explicit user confirmation creates entries.

---

## 1. Audit & map (docs)

- **`docs/audits/m3_routines_map.md`**  
  Maps routine execution: frontend components/routes (start, steps, complete/cancel), state (RoutineContext + RoutineRunnerModal), backend endpoints (routine submit, evidence step-reached). Notes that step-reached evidence was not wired from the runner modal; documents minimal insertion points for M3 and a smallest-diff plan.

---

## 2. Per-step completion state (no habit logging)

- **`src/store/RoutineContext.tsx`**  
  - Added `stepStates: Record<stepId, "neutral" | "done" | "skipped">` and `setStepState(stepId, status)`.
  - `startRoutine()` initializes all steps to `"neutral"`; `exitRoutine()` clears `stepStates`.
  - Exported types: `StepStatus`, `StepStates`.

- **`src/components/RoutineRunnerModal.tsx`**  
  - Syncs with context on open (`selectRoutine` + `startRoutine`) and on close (`exitRoutine`).
  - Step indicators show done/skipped/neutral per step; "Mark done" and "Skip step" buttons call `setStepState`.
  - No HabitEntries created in this step.

- **`src/store/RoutineContext.test.tsx`**  
  Unit tests: start initializes neutral; setStepState updates deterministically; exit clears state.

---

## 3. Completed Habits modal (UI only)

- **`src/components/CompletedHabitsModal.tsx`**  
  - Shown when user clicks "Complete Routine" (instead of closing immediately).
  - Lists only **habit-linked steps** (steps with `linkedHabitId`); each row is habit title + checkbox.
  - Default checked: step is checked iff `stepStates[step.id] === "done"`.
  - Controls: "Check all", "Uncheck all", "Cancel" (closes modal, no logging), "Log selected habits" (wired in next step).
  - Touch-friendly; no double-click.

- **`src/components/CompletedHabitsModal.test.tsx`**  
  Tests default checked behaviour from `stepStates` (e.g. two done → two checked).

---

## 4. Batch HabitEntry creation (backend)

- **`POST /api/entries/batch`** (`src/server/routes/habitEntries.ts`)  
  - Body: `{ timezone?, dayKey?, entries: [{ habitId, source?, routineId? }] }`.
  - Uses `req.userId`; if `dayKey` omitted, uses canonical `getNowDayKey(timezone)` (default America/New_York).
  - For each entry: atomic upsert via `upsertHabitEntry(habitId, dayKey, userId, { source: 'routine', routineId, value: 1 })`, then `recomputeDayLogForHabit`. Same write path as single-entry creation (M2).
  - Response: `{ created, updated, results }`.

- **`src/server/index.ts`**  
  Registered `app.post('/api/entries/batch', batchCreateEntriesRoute)`.

- **`src/server/routes/__tests__/entries.batch.test.ts`**  
  - Batch with two habits creates two entries for today’s dayKey.
  - Batch called twice does not create duplicates (still one entry per habit per day).
  - User-scoped: user B cannot create entries for user A’s habits (404 Habit not found).

---

## 5. Wire modal to batch + refresh

- **`src/lib/persistenceClient.ts`**  
  - `batchCreateEntries({ habitIds, routineId?, timezone?, dayKey? })` → `POST /api/entries/batch`.

- **`src/components/RoutineRunnerModal.tsx`**  
  - "Log selected habits" calls `batchCreateEntries` with selected habit IDs and `routineId`; timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` when available.
  - On success: close modal, `refreshDayLogs()`, `exitRoutine()`, `onClose()` (runner closes; day view/progress refresh).
  - On failure: `showToast(message, 'error')`; modal stays open.
  - Cancel / X only closes modal; no API call.

- **`src/components/CompletedHabitsModal.tsx`**  
  - Added `submitting` prop; parent closes modal on success (no auto-close inside modal).

- **`docs/qa/routine-log-habits-qa.md`**  
  Manual QA checklist: mark 2 done → confirm → day view shows entries; mark none → confirm → no entries; cancel does not log; error toast on failure.

---

## 6. Guardrail: routine completion never auto-logs

- **`docs/audits/m3_routines_semantics.md`**  
  Documents rule: **"Routines never imply completion; only HabitEntries do."** Day view/progress/goals derive only from HabitEntries; evidence is separate and never used for completion.

- **`src/server/routes/routines.ts`**  
  Comment in `submitRoutineRoute`: only create HabitEntries when `habitIdsToComplete` is explicitly provided.

- **`src/server/routes/__tests__/routines.completion-guardrail.test.ts`**  
  Regression test: submit routine with `habitIdsToComplete: []` → no new HabitEntries; day view and progress unchanged.

---

## Files changed (by commit)

| Commit | Files |
|--------|--------|
| docs(routines): map routine execution flow for M3 | `docs/audits/m3_routines_map.md` |
| feat(routines): track per-step completion state without logging | `src/store/RoutineContext.tsx`, `src/components/RoutineRunnerModal.tsx`, `src/store/RoutineContext.test.tsx` |
| feat(routines): completion modal selects done habits by default | `src/components/CompletedHabitsModal.tsx`, `src/components/CompletedHabitsModal.test.tsx`, `src/components/RoutineRunnerModal.tsx` |
| feat(entries): batch create endpoint for routine-confirmed habits | `src/server/routes/habitEntries.ts`, `src/server/index.ts`, `src/server/routes/__tests__/entries.batch.test.ts` |
| feat(routines): confirm selected habits and log as HabitEntries | `src/lib/persistenceClient.ts`, `src/components/RoutineRunnerModal.tsx`, `src/components/CompletedHabitsModal.tsx`, `docs/qa/routine-log-habits-qa.md` |
| test(routines): routine completion does not auto-log habits | `src/server/routes/__tests__/routines.completion-guardrail.test.ts`, `docs/audits/m3_routines_semantics.md`, `src/server/routes/routines.ts` |

---

## Verification

- **Tests:** `entriesOnly.invariants`, `entries.batch`, `RoutineContext`, `CompletedHabitsModal`, `routines.completion-guardrail`, `progress.overview` (and related) all passing.
- **Manual QA:** See `docs/qa/routine-log-habits-qa.md`.
