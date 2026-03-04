# M4 Mobile Web Friction Map — Touch & Payload Audit

**Goal:** Identify double-click, delayed-click, and payload/schema drift that hurt touch safety and logging reliability.

---

## 1. Double-click and click-count logic

### 1.1 TrackerGrid — **FIXED**

| Status | Change |
|--------|--------|
| **Resolved** | Double-click delete removed; clear entry is via cell kebab menu ("…" → "Clear entry"). Single tap runs immediately (no 300ms delay). No `onDoubleClick` or click-delay refs. |

---

### 1.2 CategoryTabs — double-click to edit

| Location | Snippet / behavior |
|----------|--------------------|
| `src/components/CategoryTabs.tsx` | **onDoubleClick** on the tab wrapper toggles edit mode (`setIsEditing(true)`). Single-click selects the tab. |

**Relevant code:**

```131:134:src/components/CategoryTabs.tsx
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
```

**Impact:** Touch users have no obvious way to enter “edit category name” mode; double-tap is not a standard affordance for “edit” and is inconsistent with the rest of the app.

---

### 1.3 Tests

| File | Note |
|------|------|
| `src/components/TrackerGrid.clearEntry.test.tsx` | Replaces old double-click tests; asserts clear via menu, no delete on double-click, canonical dayKey. |

---

## 2. Delayed-click (300ms / setTimeout) logic — **FIXED**

| Status | Change |
|--------|--------|
| **Resolved** | No 300ms or other delayed-click logic remains. Grid cell tap runs synchronously in `handleCellClick`. |

**Tap responsiveness (current implementation):**

- **`touch-action: manipulation`** on grid cell buttons (`touch-manipulation` class) so mobile browsers do not add an extra ~300ms before firing `click`. Works with standard `onClick`; no pointer-event switch required.
- **Duplicate-event guard:** A short-lived ref (`lastHandledCellRef`) records the last handled `(habitId, dateStr)` and timestamp. If `handleCellClick` is invoked again for the same cell within **400ms**, the second invocation is ignored. This avoids double log when both a pointer event and a synthetic `click` fire (e.g. on some touch devices).
- **Gotcha:** Very fast double-tap on the same cell within 400ms is treated as one tap (second is ignored). Acceptable for habit logging; the window can be reduced (e.g. 300ms) if needed after validating on target devices.


---

## 3. Logging write payloads — forbidden fields and schema drift

### 3.1 Forbidden `completed` in TrackerGrid (virtual choice deselect)

| Location | Issue |
|----------|--------|
| `src/components/TrackerGrid.tsx` | For **virtual choice** boolean habits, when **deselecting** an option the code sends **`completed: false`** in the upsert payload. Server (repository) forbids completion/progress fields and throws. |

**Relevant code:**

```1045:1052:src/components/TrackerGrid.tsx
                if (isOptionCompleted) {
                    await upsertHabitEntry(habit.bundleParentId, dateStr, {
                        bundleOptionId: habit.associatedOptionId,
                        bundleOptionLabel: habit.name,
                        value: 0,
                        completed: false   // ← FORBIDDEN: server rejects
                    });
```

**Server side:**  
- `src/server/domain/canonicalValidators.ts`: `assertNoStoredCompletion` disallows `completed`, `isComplete`, `isCompleted`, `progress`, etc.  
- `src/server/repositories/habitEntryRepository.ts`: `assertNoStoredCompletionOrProgress(updates)` throws on `completed` and other derived fields.

**Impact:** Deselecting a choice-bundle option in the grid can trigger server error (500 from route catch); logging is unreliable for that path.

**Fix:** Send only allowed fields: e.g. `value: 0` (and optional `bundleOptionId`/`bundleOptionLabel`) and **omit `completed`**. Server derives completion from entries.

---

### 3.2 Other payload usage

- **QuickLog / DayView / HabitContext** call `upsertHabitEntry` with payloads that were not seen to include forbidden fields in this audit; worth a quick grep for `completed` / `isComplete` in any write path.
- **Server route** `PUT /api/entries` forwards `req.body` (minus `habitId`/`dateKey`) to the repository, which runs `assertNoStoredCompletionOrProgress`; no extra client-side validator strip.

---

## 4. Modules bypassing the shared API client (persistenceClient)

### 4.1 Evidence (step-reached) — RoutineContext

| Location | Behavior |
|----------|----------|
| `src/store/RoutineContext.tsx` | On routine step change in Execute mode, calls **`fetch('/api/evidence/step-reached', { method: 'POST', ... })`** directly with `X-User-Id: getActiveUserId()` and JSON body. **No** `persistenceClient` function is used. |

**Relevant code:**

```240:251:src/store/RoutineContext.tsx
                fetch('/api/evidence/step-reached', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Id': getActiveUserId(),
                    },
                    body: JSON.stringify({
                        routineId: activeRoutine.id,
                        stepId: step.id,
                        date: today
                    })
                }).catch(err => console.error('Failed to record potential evidence:', err));
```

**Note:** `persistenceClient` has `fetchPotentialEvidence(date)` (GET) but **no `recordRoutineStepReached`** (POST). So this path intentionally bypasses the client for the write.

**Impact:** Evidence writes are consistent with server contract but bypass shared client; error handling, base URL, and auth live only in this file. Any future retries or logging would need to be duplicated.

---

### 4.2 Tasks — TaskContext

| Location | Behavior |
|----------|----------|
| `src/context/TaskContext.tsx` | All task API calls use **raw `fetch('/api/tasks', ...)`** and **`fetch('/api/tasks/${id}', ...)`**. No `persistenceClient`, no `X-User-Id` (if tasks are user-scoped on the server, this may be a bug). |

**Relevant code:** Lines 32, 50, 75, 100 — `fetch('/api/tasks')`, POST, PATCH, DELETE.

**Impact:** Tasks path is fully outside the shared client; auth/headers/base URL may diverge from the rest of the app.

---

### 4.3 Goals badge upload — BadgeUploadModal

| Location | Behavior |
|----------|----------|
| `src/components/goals/BadgeUploadModal.tsx` | Uses **`fetch(\`/api/goals/${goalId}/badge\`, { method: 'POST', body: formData })`** for file upload. No `persistenceClient`. |

**Note:** `persistenceClient` uses JSON and `apiRequest`; badge upload is FormData. Acceptable to keep a dedicated upload helper, but it should live behind a single function (e.g. in persistenceClient or a small goals API module) so base URL and auth are centralized.

---

### 4.4 Routine image fetch — RoutineEditorModal

| Location | Behavior |
|----------|----------|
| `src/components/RoutineEditorModal.tsx` | Uses **`fetch(\`${API_BASE_URL}/routines/${initialRoutine.id}/image\`)`** for loading routine image. Uses `API_BASE_URL` and `uploadRoutineImage`/`getActiveUserId` from persistenceClient for upload, but **read** path is direct fetch. |

**Impact:** Minor; same base URL and no body, but still not going through a shared “get routine image” helper.

---

### 4.5 Journal

| Location | Behavior |
|----------|----------|
| `src/api/journal.ts` | Own **`apiRequest`** and journal endpoints; separate from `persistenceClient`. |

**Impact:** Journal is a separate domain module; not necessarily “bypass” if design is multi-client. Worth aligning auth (e.g. `X-User-Id`) and base URL with the rest of the app.

---

## 5. Prioritized list of fixes (quick wins first)

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | **TrackerGrid: remove `completed` from virtual choice deselect payload** — send only `value: 0` (and option ids/labels as needed). Omit `completed`. | Small | Stops 500s and restores reliable logging for choice-bundle deselect. |
| **P1** | **TrackerGrid: remove 300ms single-click delay** — use immediate single-tap for toggle/popover. | Small | Big perceived responsiveness gain on mobile. |
| **P2** | **TrackerGrid: replace double-click delete with an explicit action** — e.g. delete mode (already present) as primary, or long-press / inline “clear” control. Remove dependency on `dblclick`. | Medium | Touch-safe, discoverable delete; aligns with PRD “no double-click required for mobile”. |
| **P3** | **CategoryTabs: replace double-click edit with an explicit control** — e.g. “Edit” icon/button or long-press to enter edit mode. | Small | Touch-safe category editing. |
| **P4** | **RoutineContext: add `recordRoutineStepReached` to persistenceClient** — implement POST in client, call it from RoutineContext; remove raw `fetch('/api/evidence/step-reached')`. | Small | Single place for evidence writes, auth, and base URL. |
| **P5** | **TaskContext: route tasks through persistenceClient** — add task CRUD in `persistenceClient` (with same auth as other endpoints), use it in TaskContext. | Medium | Consistent auth and error handling for tasks. |
| **P6** | **Badge upload / routine image** — wrap in small helpers (e.g. in persistenceClient or goals/routines API) so base URL and auth are centralized. | Small | Consistency and easier env/config. |

---

## 6. Minimal refactor plan

### Phase A — Quick wins (no UX change to delete flow)

1. **Payload fix (P0)**  
   - In `TrackerGrid.tsx`, for the virtual choice boolean deselect branch, change the `upsertHabitEntry` call to pass only allowed fields (e.g. `bundleOptionId`, `bundleOptionLabel`, `value: 0`) and **remove `completed: false`**.  
   - Optionally add a small client-side strip of forbidden fields before any `upsertHabitEntry` if you want a single safeguard.

2. **Remove 300ms delay (P1)**  
   - In `handleCellClick`, remove the `setTimeout(..., 300)` for single-click.  
   - Run the single-click action (toggle or open popover) immediately on `click`.  
   - Keep double-click handler for now so desktop behavior is unchanged; touch will only get single-tap (no delete until P2).

### Phase B — Touch-safe interactions

3. **Explicit delete (P2)**  
   - Rely on existing **delete mode** as the primary way to delete entries (or add a long-press or per-cell “clear” action).  
   - Remove `onDoubleClick` and the double-click branch from `handleCellClick`; remove `clickTimeoutRef` and any remaining click-count logic.  
   - Update tests in `TrackerGrid.doubleClickDelete.test.tsx` to use the new delete path (e.g. delete mode or explicit clear).

4. **CategoryTabs edit (P3)**  
   - Add an explicit “Edit” control (icon/button) that sets `isEditing(true)`; remove `onDoubleClick` from the tab wrapper.

### Phase C — API client consistency

5. **Evidence write in client (P4)**  
   - In `persistenceClient.ts`, add `recordRoutineStepReached(routineId, stepId, date)` that POSTs to `/evidence/step-reached` with `apiRequest` (or same auth/headers as other calls).  
   - In `RoutineContext.tsx`, call that function instead of raw `fetch`.

6. **Tasks in persistenceClient (P5)**  
   - Add task CRUD to `persistenceClient` (GET/POST/PATCH/DELETE) with same base URL and `X-User-Id` (or app auth).  
   - Refactor `TaskContext` to use these functions.

7. **Badge / routine image (P6)**  
   - Add `uploadGoalBadge(goalId, file)` and optionally `getRoutineImage(routineId)` in persistenceClient (or a small goals/routines module) and use them from BadgeUploadModal and RoutineEditorModal.

---

## 7. Summary table

| Category | Location | Issue |
|----------|----------|--------|
| Double-click | `TrackerGrid.tsx` | Grid: double-click delete, single-click delayed 300ms. |
| Double-click | `CategoryTabs.tsx` | Double-click to enter category edit mode. |
| Delayed click | `TrackerGrid.tsx` | 300ms setTimeout before single-click action. |
| Payload drift | `TrackerGrid.tsx` | Virtual choice deselect sends `completed: false` → server rejects. |
| Bypass client | `RoutineContext.tsx` | Raw `fetch` to `/api/evidence/step-reached`. |
| Bypass client | `TaskContext.tsx` | All task API via raw `fetch`, no persistenceClient. |
| Bypass client | `BadgeUploadModal.tsx` | Raw `fetch` for goal badge upload. |
| Bypass client | `RoutineEditorModal.tsx` | Direct fetch for routine image URL. |

---

## 8. Manual QA checklist (after explicit clear-entry change)

After replacing double-click delete with the cell kebab menu:

- [ ] **Desktop:** Single tap on a habit cell toggles completion (boolean) or opens numeric popover; no 300ms delay.
- [ ] **Desktop:** On a cell that has an entry, the "…" (kebab) icon is visible (top-right of cell); click it → "Clear entry" → entry is removed and toast "Entry cleared" appears.
- [ ] **Desktop:** Double-click on a cell does **not** delete the entry; no accidental deletes.
- [ ] **iPhone / touch:** Same as above: tap to log, kebab to clear; no double-tap required.
- [ ] **Keyboard:** Focus a cell (Tab), then focus the kebab button; Enter/Space opens menu; "Clear entry" is focusable; Escape closes menu.
- [ ] **Delete mode:** Toolbar "Delete mode" (if present) still allows clicking a cell to clear that day’s entry.

---

*Audit completed for M4 kickoff. Suggested commit: `docs(ux): map touch friction + payload drift for M4`.*
