# MongoDB Migration Test Plan

**Date:** 2025-01-27  
**Purpose:** Comprehensive test plan for verifying MongoDB migration works correctly without regressions

---

## Overview

This test plan covers both **localStorage-only mode** (existing behavior) and **MongoDB-enabled mode** (new persistence). The goal is to ensure:

1. Existing functionality continues to work when MongoDB is disabled
2. MongoDB persistence works correctly when enabled
3. Fallback mechanisms work when API fails
4. No data loss occurs during migration

---

## Prerequisites

### Required Tools

- **MongoDB** - Either:
  - Local MongoDB installation (default: `mongodb://localhost:27017`)
  - MongoDB Atlas account (cloud)
  - MongoDB Compass (GUI tool for inspecting database)
- **Node.js** and `npm` installed
- **Browser** (Chrome, Firefox, or Safari)
- **Browser DevTools** (for console inspection)

### Environment Setup

1. **Clone/checkout the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Ensure MongoDB is running** (for MongoDB-enabled tests):
   ```bash
   # Check if MongoDB is running
   mongosh
   # Or check service status
   # macOS: brew services list
   # Linux: sudo systemctl status mongod
   ```

---

## Test Mode 1: LocalStorage-Only Mode

**Purpose:** Verify existing localStorage behavior still works exactly as before.

### Configuration

1. **Create/update `.env` file** in project root:
   ```env
   # Backend (not needed for localStorage-only, but set for clarity)
   USE_MONGO_PERSISTENCE=false
   
   # Frontend
   VITE_USE_MONGO_PERSISTENCE=false
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open browser** to the app URL (typically `http://localhost:5173`)

### Test Checklist

#### ✅ Initial Load

- [ ] **App loads without errors**
  - Open browser console (F12 → Console tab)
  - Verify no red error messages
  - App should display normally

- [ ] **Categories load from localStorage**
  - If you have existing data: Categories should appear
  - If no existing data: Default categories should appear
  - Check browser DevTools → Application → Local Storage → `categories` key
  - Verify data exists in localStorage

#### ✅ Create Category

- [ ] **Add a new category:**
  1. Click the "+" button next to category tabs (or use "Add Category" feature)
  2. Enter name: "Test Category"
  3. Select/enter color: "bg-purple-500"
  4. Submit

- [ ] **Verify category appears:**
  - New category tab should appear in the UI
  - Category should be selectable

- [ ] **Verify saved to localStorage:**
  - Open DevTools → Application → Local Storage
  - Find `categories` key
  - Click to view value
  - Verify new category is in the JSON array
  - Category should have: `id`, `name`, `color` fields

#### ✅ View Categories

- [ ] **All categories visible:**
  - Scroll through category tabs
  - All categories should be visible and clickable
  - No missing or duplicate categories

#### ✅ Delete Category

- [ ] **Delete a category:**
  1. Click on a category tab to select it
  2. Click the "X" button on the category tab (if available)
  3. Or use delete functionality in the UI

- [ ] **Verify category removed:**
  - Category tab should disappear from UI
  - Category should no longer be selectable

- [ ] **Verify removed from localStorage:**
  - Check DevTools → Local Storage → `categories`
  - Deleted category should not be in the array

#### ✅ Reorder Categories

- [ ] **Reorder categories:**
  1. Drag and drop category tabs to reorder
  2. Or use reorder functionality if available

- [ ] **Verify order persisted:**
  - Refresh the page (F5)
  - Categories should appear in the new order
  - Check localStorage to verify order is saved

#### ✅ Reload Page

- [ ] **Refresh browser (F5):**
  - All categories should still be present
  - Order should be preserved
  - No data loss

- [ ] **Close and reopen browser:**
  - Close browser completely
  - Reopen and navigate to app
  - All data should still be present

#### ✅ Import Habits

- [ ] **Import predefined habits:**
  1. Use the import functionality (if available)
  2. Import should create categories and habits

- [ ] **Verify categories created:**
  - New category tabs should appear
  - Categories should be saved to localStorage

### Expected Results

- ✅ All operations work exactly as before
- ✅ No API calls are made (check Network tab in DevTools)
- ✅ All data persists in localStorage
- ✅ No console errors or warnings
- ✅ No data loss on refresh

---

## Test Mode 2: MongoDB-Enabled Mode

**Purpose:** Verify MongoDB persistence works correctly with fallback mechanisms.

### Configuration

1. **Ensure MongoDB is running:**
   ```bash
   # Test connection
   mongosh
   # Should connect successfully
   # Type 'exit' to leave
   ```

2. **Create/update `.env` file:**
   ```env
   # Backend
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=habitflowai
   USE_MONGO_PERSISTENCE=true
   
   # Frontend
   VITE_USE_MONGO_PERSISTENCE=true
   VITE_API_BASE_URL=/api  # Or your API server URL
   ```

3. **Start backend server** (if separate):
   ```bash
   # If you have a separate server process
   npm run server
   # Or start your Express/API server
   ```

4. **Start frontend development server:**
   ```bash
   npm run dev
   ```

5. **Open browser** to the app URL

### Test Checklist

#### ✅ Initial Load from MongoDB

- [ ] **App loads without errors**
  - Open browser console
  - Verify no red error messages
  - App should display normally

- [ ] **Categories load from API:**
  - Open DevTools → Network tab
  - Filter by "XHR" or "Fetch"
  - Refresh page (F5)
  - Should see a request to `/api/categories` (or your API base URL)
  - Request should return `200 OK`
  - Response should contain `{ categories: [...] }`

- [ ] **Verify categories appear in UI:**
  - Categories should load and display
  - If API returns empty array: Should show initial/default categories
  - If API returns data: Should show API data

- [ ] **Verify dual-write to localStorage:**
  - Check DevTools → Application → Local Storage → `categories`
  - Data should also be in localStorage (dual-write for safety)
  - This ensures fallback works if API fails later

#### ✅ Inspect MongoDB Database

- [ ] **Connect to MongoDB:**
  ```bash
  mongosh
  # Or use MongoDB Compass GUI
  ```

- [ ] **Switch to database:**
  ```javascript
  use habitflowai
  ```

- [ ] **View categories collection:**
  ```javascript
  db.categories.find().pretty()
  ```

- [ ] **Verify data structure:**
  - Each document should have: `id`, `name`, `color`, `userId` fields
  - `userId` should be present (currently "anonymous-user" until auth is implemented)

#### ✅ Create Category via API

- [ ] **Add a new category:**
  1. Click "+" button or use "Add Category" feature
  2. Enter name: "API Test Category"
  3. Enter color: "bg-orange-500"
  4. Submit

- [ ] **Verify API call made:**
  - Check Network tab in DevTools
  - Should see `POST /api/categories` request
  - Request body should contain: `{ name: "API Test Category", color: "bg-orange-500" }`
  - Response should be `201 Created`
  - Response body should contain created category with generated `id`

- [ ] **Verify category appears in UI:**
  - New category tab should appear immediately
  - Category should be selectable

- [ ] **Verify saved to MongoDB:**
  ```javascript
  // In mongosh
  db.categories.find({ name: "API Test Category" }).pretty()
  ```
  - Document should exist in database
  - Should have correct `name`, `color`, `id`, `userId` fields

- [ ] **Verify dual-write to localStorage:**
  - Check DevTools → Local Storage → `categories`
  - New category should also be in localStorage array

#### ✅ Refresh Page - Data from MongoDB

- [ ] **Clear localStorage** (to test MongoDB-only):
  - DevTools → Application → Local Storage
  - Right-click → Clear (or delete `categories` key)

- [ ] **Refresh page (F5):**
  - Categories should still load
  - Check Network tab: Should see `GET /api/categories` request
  - Data should come from MongoDB, not localStorage

- [ ] **Verify data matches:**
  - All categories should still be present
  - Order should be preserved (if reordered previously)
  - No data loss

#### ✅ Delete Category via API

- [ ] **Delete a category:**
  1. Select a category
  2. Click delete/X button
  3. Confirm deletion

- [ ] **Verify API call made:**
  - Check Network tab
  - Should see `DELETE /api/categories/:id` request
  - Response should be `200 OK`

- [ ] **Verify removed from UI:**
  - Category tab should disappear
  - Category should no longer be selectable

- [ ] **Verify removed from MongoDB:**
  ```javascript
  // In mongosh
  db.categories.find({ id: "deleted-category-id" })
  ```
  - Should return empty result (category deleted)

- [ ] **Verify removed from localStorage:**
  - Check Local Storage → `categories`
  - Deleted category should not be in array

#### ✅ Reorder Categories via API

- [ ] **Reorder categories:**
  1. Drag and drop category tabs
  2. Or use reorder functionality

- [ ] **Verify API call made:**
  - Check Network tab
  - Should see `PATCH /api/categories/reorder` request
  - Request body should contain `{ categories: [...] }` in new order
  - Response should be `200 OK`

- [ ] **Verify order persisted:**
  - Refresh page (F5)
  - Categories should appear in new order
  - Check MongoDB: Order should match

#### ✅ API Failure - Fallback to localStorage

- [ ] **Simulate API failure:**
  - Option A: Stop backend server
  - Option B: Disconnect from network
  - Option C: Block API requests in DevTools → Network → Right-click request → Block request URL

- [ ] **Attempt to create category:**
  1. Try to add a new category
  2. Should see warning in console: "Failed to save category to API, using localStorage fallback"
  3. Category should still be created (using localStorage)

- [ ] **Verify fallback worked:**
  - Category should appear in UI
  - Check Local Storage: Category should be saved there
  - Check console: Should see warning message (not error)

- [ ] **Restore API connection:**
  - Restart server or reconnect network

- [ ] **Refresh page:**
  - Should load from API (if API has data)
  - localStorage data should still be present as backup

#### ✅ Dual-Write Verification

- [ ] **Create category with API enabled:**
  1. Add a new category
  2. Check Network tab: Should see API call succeed

- [ ] **Verify both storages updated:**
  - MongoDB: Category should exist
  - localStorage: Category should also exist
  - Both should have same data (except `userId` field only in MongoDB)

- [ ] **Purpose of dual-write:**
  - Ensures data safety during transition period
  - If API fails, localStorage has backup
  - Once MongoDB is stable, dual-write can be removed

---

## Test Mode 3: Migration Scenario

**Purpose:** Test migrating from localStorage to MongoDB.

### Configuration

1. **Start with localStorage-only:**
   ```env
   VITE_USE_MONGO_PERSISTENCE=false
   ```

2. **Create some data:**
   - Add 3-5 categories
   - Add some habits
   - Create some logs

3. **Switch to MongoDB:**
   ```env
   VITE_USE_MONGO_PERSISTENCE=true
   USE_MONGO_PERSISTENCE=true
   ```

4. **Restart app**

### Test Checklist

- [ ] **Data migration:**
  - On first load with MongoDB enabled, app should:
    1. Load from localStorage (initial state)
    2. Attempt to fetch from API
    3. If API is empty but localStorage has data: Keep localStorage data
    4. If API has data: Use API data

- [ ] **Verify no data loss:**
  - All categories should still be present
  - Check MongoDB: Data should be synced
  - Check localStorage: Data should still be there (dual-write)

- [ ] **New operations use MongoDB:**
  - Create new category: Should go to MongoDB
  - Check Network tab: Should see API calls
  - Check MongoDB: New data should appear

---

## Common Issues & Troubleshooting

### Issue: "MongoDB persistence is disabled" error

**Cause:** Feature flag not set correctly

**Solution:**
1. Check `.env` file has `VITE_USE_MONGO_PERSISTENCE=true`
2. Restart dev server (Vite needs restart to pick up env changes)
3. Clear browser cache if needed

### Issue: API calls return 501 Not Implemented

**Cause:** Backend feature flag not enabled

**Solution:**
1. Check backend `.env` has `USE_MONGO_PERSISTENCE=true`
2. Restart backend server
3. Verify MongoDB connection is working

### Issue: API calls fail with network error

**Cause:** Backend server not running or wrong URL

**Solution:**
1. Verify backend server is running
2. Check `VITE_API_BASE_URL` in frontend `.env`
3. Test API endpoint directly: `curl http://localhost:3000/api/categories`

### Issue: Data not appearing in MongoDB

**Cause:** Wrong database or collection name

**Solution:**
1. Check `MONGODB_DB_NAME` in backend `.env`
2. Verify collection name is `categories` (not `category`)
3. Check `userId` field matches (currently "anonymous-user")

### Issue: localStorage fallback not working

**Cause:** localStorage cleared or API error not caught

**Solution:**
1. Check browser console for error messages
2. Verify localStorage has data: DevTools → Application → Local Storage
3. Check that error handling in code is working

---

## Test Results Template

### Test Run: [Date]

**Tester:** [Name]  
**Environment:** [Local/Staging/Production]  
**MongoDB:** [Local/Atlas/Other]

#### LocalStorage-Only Mode
- [ ] All tests passed
- [ ] Issues found: [List any issues]

#### MongoDB-Enabled Mode
- [ ] All tests passed
- [ ] Issues found: [List any issues]

#### Migration Scenario
- [ ] All tests passed
- [ ] Issues found: [List any issues]

**Notes:**
[Any additional observations or issues]

---

## Automated Tests

In addition to manual testing, run automated tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test HabitContext.categories.test.tsx

# Run in watch mode
npm test -- --watch
```

**Expected:** All tests should pass for both localStorage and MongoDB modes.

---

## Sign-Off

- [ ] **LocalStorage-only mode:** All tests passed, no regressions
- [ ] **MongoDB-enabled mode:** All tests passed, API integration working
- [ ] **Fallback mechanisms:** Verified to work correctly
- [ ] **No data loss:** Confirmed in all scenarios
- [ ] **Ready for production:** [Yes/No with notes]

**Tested by:** _________________  
**Date:** _________________  
**Approved by:** _________________

