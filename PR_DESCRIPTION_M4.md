# M4: iPhone/PWA friction cleanup + API consistency

Branch: `222-milestone-m4-iphonepwa-friction-cleanup`

## Summary

This branch addresses touch safety, payload/schema alignment, API client consistency, and mobile/PWA polish for iPhone Safari. It also adds a migration path for habit entries that still use the legacy `date` field so the unique index on `(userId, habitId, dayKey)` can be created.

---

## 1. Docs & audit

- **`docs/audits/m4_mobile_web_friction_map.md`**
  - Maps double-click vs single-tap behavior, delayed-click logic, payload drift (e.g. `completed` in TrackerGrid), and modules bypassing the shared API client.
  - **§9. Mobile QA Checklist** added: manual checklist for modals, tap targets, layout, and input focus on iPhone Safari/PWA.

---

## 2. Touch & logging fixes

- **`src/components/TrackerGrid.tsx`**
  - **Double-click delete removed.** Clear entry is via cell kebab menu ("…" → "Clear entry"); single tap toggles completion or opens popover (no 300ms delay).
  - **Virtual choice deselect:** removed `completed: false` from upsert payload; server forbids completion fields and derives from entries.
  - Duplicate-event guard (400ms) retained to avoid double fire on touch devices.

- **`src/components/CategoryTabs.tsx`**
  - Replaced double-click-to-edit with an explicit "Edit" control so touch users can enter edit mode.

- **Tests**
  - `TrackerGrid.clearEntry.test.tsx` updated for clear-via-menu; old double-click tests removed/replaced.

---

## 3. API client consistency (identity headers)

- **`src/lib/persistenceClient.ts`**
  - **Evidence:** `recordRoutineStepReached(routineId, stepId, date)` — POST `/evidence/step-reached`.
  - **Tasks:** `fetchTasks()`, `createTask()`, `updateTask()`, `deleteTask()` — GET/POST/PATCH/DELETE `/tasks` with `{ tasks }` / `{ task }` envelopes.
  - **Goals:** `uploadGoalBadge(goalId, file)` — FormData POST with `X-User-Id`; `invalidateGoalCaches(goalId)`.
  - **Routines:** `deleteRoutineImage(routineId)` — DELETE `/routines/:id/image`.
  - `uploadRoutineImage` now uses `getActiveUserId()` for consistency.

- **Call sites updated to use shared client**
  - **RoutineContext:** step-reached uses `recordRoutineStepReached()` instead of raw `fetch`.
  - **TaskContext:** all task CRUD via persistenceClient (sends `X-User-Id`).
  - **BadgeUploadModal:** badge upload via `uploadGoalBadge()`.
  - **RoutineEditorModal:** image delete via `deleteRoutineImage()`.

- **`src/lib/__tests__/persistenceClient.identityHeaders.test.ts`**
  - Asserts that GET and POST requests from the client include a non-empty `X-User-Id` header.

---

## 4. Mobile/PWA polish (modals, tap targets, Safari)

- **`src/index.css`**
  - `.modal-scroll`: `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `overscroll-behavior: contain`.
  - `.modal-overlay`: `overflow: hidden` so only the inner panel scrolls (avoids body scroll lock bugs).

- **Modals (scroll + overlay)**
  - CompletedHabitsModal, RoutineRunnerModal, DailyCheckInModal, CategoryPickerModal, AddHabitModal, EditGoalModal, HabitHistoryModal, HabitLogModal, RoutineEditorModal, BadgeUploadModal, GoalManualProgressModal, DeleteGoalConfirmModal: use `modal-overlay` and `modal-scroll`; many use `max-h-[90dvh]` where needed.

- **Tap targets (~44px)**
  - Layout: Settings and User buttons.
  - Goal detail: Edit and Delete header buttons.
  - Modal close (X) buttons and RoutineRunnerModal reset timer button.

- **Layout**
  - Main content: `pt-[max(5rem,env(safe-area-inset-top))]` for notched devices.

- **Mobile QA Checklist** in `docs/audits/m4_mobile_web_friction_map.md` (§9).

---

## 5. Migrations: dayKey backfill

- **`scripts/migrations/backfillDayKey.ts`**
  - Backfills `habitEntries.dayKey` from legacy `date` / `dateKey` / `timestamp` so the unique index `(userId, habitId, dayKey)` can be created.
  - Usage: `--dry-run` then `--apply --i-understand-this-will-modify-data`.
  - Reports: `docs/migrations/backfill-dayKey-<timestamp>.json`.

- **`docs/migrations/README.md`**
  - Section: run backfill when E11000 dup key on `dayKey: null` appears; then dedupe if needed; restart server.
  - Note on legacy "date" console warnings and clearing them via backfill.

---

## Commits (7)

| Commit     | Description |
|-----------|-------------|
| `3cf5d74` | docs(ux): map touch friction + payload drift for M4 |
| `54720f1` | ux(logging): replace double-click delete with explicit actions |
| `b72d482` | perf(ux): remove delayed click logic; prefer pointer-safe events |
| `17094e6` | fix(api): align habit entry mutation payloads with server schema |
| `aedc406` | refactor(api): route all requests through shared persistence client |
| `7d20d3b` | ux(mobile): improve modal scroll + tap targets + safari quirks |
| `603bcf8` | chore(migrations): add dayKey backfill script and update README |

---

## Verification

- **Tests:** `npx vitest run src/server/routes/__tests__/evidence.userScoping.test.ts src/server/routes/__tests__/goals.entriesDerived.test.ts` and `src/lib/__tests__/persistenceClient.identityHeaders.test.ts`.
- **Manual:** iPhone Safari/PWA — Today logging, routine completion modal, goals detail, daily check-in; modals scroll, tap targets usable, no body scroll lock.
