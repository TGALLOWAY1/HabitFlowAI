# Double-Click Delete Fix

## What Changed

1. **Fixed API URL Format Mismatch** (`src/lib/persistenceClient.ts`)
   - Changed from path parameters: `/entries/key/${habitId}/${dateKey}`
   - To query parameters: `/entries/key?habitId=${habitId}&dateKey=${dateKey}`
   - This matches the server route expectation

2. **Implemented Double-Click Detection** (`src/components/TrackerGrid.tsx`)
   - Added click timeout mechanism to prevent single-click from firing when double-click is intended
   - Double-click handler now properly detects and handles deletion
   - Single-click actions are delayed by 300ms to allow double-click detection

3. **Entry Resolution** (`src/components/TrackerGrid.tsx`)
   - Uses authoritative `(habitId, dayKey)` from the `logs` map for entry existence
   - Checks `log?.completed` for boolean habits
   - Checks `log?.value > 0` for numeric habits
   - Uses canonical `dayKey` format (YYYY-MM-DD) from `dateStr`

4. **Event Handling** (`src/components/TrackerGrid.tsx`)
   - Double-click prevents default and stops propagation
   - Double-click cancels any pending single-click timeout
   - Proper cleanup of timeouts on unmount

5. **Debug Logs** (all files)
   - Guarded behind `DEBUG_ENTRY_DELETE` flag (defaults to `false`)
   - Can be enabled by setting flag to `true` for debugging

## Why It Fixes It

**Root Cause #1: URL Format Mismatch**
- The frontend was calling the API with path parameters, but the server expected query parameters
- This caused 404/400 errors, preventing deletion from working
- **Fix**: Changed to use query parameters matching server route

**Root Cause #2: Event Conflict**
- Both `onClick` and `onDoubleClick` called the same handler
- Single-click would fire before double-click could be detected
- **Fix**: Added timeout mechanism - single-click delays action, double-click cancels timeout and executes immediately

**Root Cause #3: Entry Resolution**
- The cell now uses the authoritative `logs` map to check for entry existence
- Uses canonical `dayKey` format (YYYY-MM-DD) consistently
- **Fix**: Proper entry resolution using `(habitId, dayKey)` from logs

## How to Manually Verify

1. **Test Double-Click Deletion on Boolean Habit:**
   - Complete a boolean habit for today
   - Double-click the completed cell
   - Verify the entry is deleted (cell becomes empty)
   - Check browser console for any errors

2. **Test Double-Click Deletion on Numeric Habit:**
   - Log a value for a numeric habit (e.g., "8 hours")
   - Double-click the cell showing the value
   - Verify the entry is deleted (cell becomes empty)
   - Check browser console for any errors

3. **Test Double-Click on Empty Cell:**
   - Double-click an empty cell
   - Verify nothing happens (no error, no action)

4. **Test Single-Click Still Works:**
   - Single-click an empty cell → should toggle/add entry
   - Single-click a completed cell → should toggle/remove entry
   - Single-click a numeric cell → should open popover

5. **Test No Conflicts:**
   - Rapidly single-click → should work normally
   - Double-click → should delete without triggering single-click action

6. **Test Network Request:**
   - Open browser DevTools → Network tab
   - Double-click to delete an entry
   - Verify DELETE request to `/api/entries/key?habitId=...&dateKey=...`
   - Verify response is successful (200 OK)

## Edge Cases Handled

- ✅ Double-click on empty cell does nothing
- ✅ Double-click on numeric habit deletes regardless of value
- ✅ Single-click and double-click don't conflict
- ✅ Proper cleanup of timeouts on unmount
- ✅ Uses canonical dayKey format (YYYY-MM-DD)
- ✅ Error handling - doesn't throw, allows retry
- ✅ State updates properly after deletion

