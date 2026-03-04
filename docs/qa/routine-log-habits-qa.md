# Manual QA: Routine completion → Log selected habits

After wiring "Log selected habits" to the batch entries endpoint, use this checklist to verify behaviour.

## Prerequisites

- App running (dev server + API)
- At least one routine with **habit-linked steps** (steps that have a linked habit)
- Tracker / Day view available to confirm entries

## Cases

### 1. Mark 2 habits done → Complete → Confirm

1. Start a routine that has at least 2 steps linked to habits.
2. Mark **2 steps as done** (e.g. "Mark done" for step 1 and step 2).
3. Go through to the completion screen.
4. Tap **"Complete Routine"**.
5. **Completed Habits** modal opens.
6. **Check:** The 2 steps you marked done are **checked**; others (if any) unchecked.
7. Tap **"Log selected habits"**.
8. **Check:** Modal closes, runner closes.
9. **Check:** Day view / tracker shows **entries for those 2 habits** for today (or the selected day).

### 2. Mark nothing done → Complete → Confirm

1. Start a routine with habit-linked steps.
2. Do **not** mark any step as done (or mark all as skipped).
3. Go to completion screen → **"Complete Routine"**.
4. **Completed Habits** modal opens.
5. **Check:** All habit-step checkboxes are **unchecked**.
6. Tap **"Log selected habits"** (with none selected).
7. **Check:** Modal closes; **no** new habit entries are created for that routine’s habits for the day.

### 3. Cancel / Close does not log

1. Start a routine → completion screen → **"Complete Routine"**.
2. In the Completed Habits modal, leave one or more **checked**.
3. Tap **"Cancel"** or the **X** (close).
4. **Check:** Modal closes; **no** API call to create entries; day view unchanged.

### 4. Error handling

1. (Optional) Simulate failure, e.g. stop the API or use a bad network.
2. Complete routine → open modal → check some habits → **"Log selected habits"**.
3. **Check:** An **error toast/banner** appears; modal stays open (or closes without creating entries); user can retry or cancel.

---

**Backend coverage:** `src/server/routes/__tests__/entries.batch.test.ts` covers batch create, idempotency, and user-scoping.
