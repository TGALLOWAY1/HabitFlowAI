# Double-Click Delete Regression Analysis

## Summary
Double-clicking a habit grid cell should delete the existing HabitEntry, but it no longer works.

## Debug Logs Added

Debug logs have been added at each hop in the deletion path:

1. **Cell Render** (`src/components/TrackerGrid.tsx:368-440`)
   - Logs: `habitId`, `dayKey`, `logExists`, `logCompleted`, `logValue`
   - Tag: `[DEBUG_ENTRY_DELETE] Cell render:`

2. **Double-Click Handler** (`src/components/TrackerGrid.tsx:375`)
   - Logs: Confirms double-click event fires
   - Tag: `[DEBUG_ENTRY_DELETE] Double-click handler fired:`

3. **handleCellClick Function** (`src/components/TrackerGrid.tsx:910`)
   - Logs: Event type, detail, whether double-click is detected
   - Tag: `[DEBUG_ENTRY_DELETE] handleCellClick called:`

4. **Standard Habit Logic** (`src/components/TrackerGrid.tsx:1000-1020`)
   - Logs: Double-click detection, existing entry check, deletion attempt
   - Tag: `[DEBUG_ENTRY_DELETE] Standard habit logic check:`
   - Tag: `[DEBUG_ENTRY_DELETE] Attempting deletion via deleteHabitEntryByKey:`

5. **HabitContext.deleteHabitEntryByKeyContext** (`src/store/HabitContext.tsx:628`)
   - Logs: Request payload, API response, local state update
   - Tag: `[DEBUG_ENTRY_DELETE] deleteHabitEntryByKeyContext called:`

6. **persistenceClient.deleteHabitEntryByKey** (`src/lib/persistenceClient.ts:932`)
   - Logs: API URL, method, request/response details
   - Tag: `[DEBUG_ENTRY_DELETE] deleteHabitEntryByKey API call:`

All debug logs are behind the flag: `const DEBUG_ENTRY_DELETE = true`

## Root Cause Candidates (Ranked)

### 🔴 **#1: URL Format Mismatch (MOST LIKELY)**

**Location:**
- Frontend: `src/lib/persistenceClient.ts:944`
- Server: `src/server/index.ts:172` and `src/server/routes/habitEntries.ts:459`

**Issue:**
- **Frontend calls:** `DELETE /api/entries/key/${habitId}/${dateKey}` (path parameters)
- **Server expects:** `DELETE /api/entries/key?habitId=...&dateKey=...` (query parameters)

**Evidence:**
- Server route registration: `app.delete('/api/entries/key', deleteHabitEntryByKeyRoute)`
- Server handler reads: `const { habitId, dateKey } = req.query;`
- Frontend constructs URL: `` `/entries/key/${habitId}/${dateKey}` ``

**Impact:** The API call will fail with 404 or 400 because the route doesn't match.

**Files:**
- `src/lib/persistenceClient.ts:944` - Frontend URL construction
- `src/server/routes/habitEntries.ts:462` - Server query parameter reading

---

### 🟡 **#2: Double-Click Detection Not Working**

**Location:**
- `src/components/TrackerGrid.tsx:375` and `src/components/TrackerGrid.tsx:1000`

**Issue:**
- `handleCellClick` is called for both single-click (`onClick`) and double-click (`onDoubleClick`)
- Double-click detection relies on `e.type === 'dblclick' || e.detail === 2`
- React's synthetic events may not set `e.detail` correctly
- Single-click handler may fire before double-click, preventing deletion

**Evidence:**
- Both handlers call the same function: `handleCellClick(e, habit, dateStr, log)`
- No prevention of single-click when double-click is intended

**Impact:** Double-click may trigger single-click behavior (toggle/add) instead of delete.

**Files:**
- `src/components/TrackerGrid.tsx:374-375` - Event handlers
- `src/components/TrackerGrid.tsx:1000-1020` - Double-click detection logic

---

### 🟡 **#3: Missing Entry Lookup / DayKey Normalization**

**Location:**
- `src/components/TrackerGrid.tsx:325` - Log lookup
- `src/components/TrackerGrid.tsx:1000` - Entry existence check

**Issue:**
- Cell uses `logs[${habit.id}-${dateStr}]` to check for existing entry
- If `dateStr` format doesn't match what's stored (e.g., timezone issues, format differences), lookup fails
- DayLog is a derived cache - if it's stale, the cell won't see the entry

**Evidence:**
- DayLog doesn't contain entry IDs (it's a derived cache)
- Deletion uses `deleteHabitEntryByKey(habitId, dateKey)` which requires exact key match
- If `dateStr` doesn't match the stored `dayKey`, deletion won't find the entry

**Impact:** Cell thinks there's no entry when one exists, or can't resolve the correct key to delete.

**Files:**
- `src/components/TrackerGrid.tsx:325` - Log lookup
- `src/components/TrackerGrid.tsx:1000` - Entry existence check

---

### 🟢 **#4: Quick Add Path Stores Entries Differently**

**Location:**
- Any "quick add" or persona-specific entry creation paths

**Issue:**
- If entries are created via a different path (e.g., QuickLog component, persona dashboards), they might:
  - Use different `dayKey` format
  - Store entries with different structure
  - Not update DayLog cache correctly

**Evidence:**
- `src/components/personas/fitness/QuickLog.tsx` exists (recently viewed)
- Persona-specific entry creation might bypass normal flow

**Impact:** Entries created via quick-add might not be deletable via the standard path.

**Files to Check:**
- `src/components/personas/fitness/QuickLog.tsx`
- Any persona-specific entry creation logic

---

## Next Steps

1. **Test with debug logs enabled** - Double-click a cell and check console output
2. **Verify URL format** - Check network tab to see if API call is made and what URL is used
3. **Check double-click detection** - Verify `e.type === 'dblclick'` or `e.detail === 2` works
4. **Verify dayKey format** - Ensure `dateStr` matches stored `dayKey` format exactly

## Files Modified

1. `src/components/TrackerGrid.tsx` - Added debug logs and double-click deletion logic
2. `src/store/HabitContext.tsx` - Added debug logs to deletion context function
3. `src/lib/persistenceClient.ts` - Added debug logs to API call function

