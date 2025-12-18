# MongoDB Persistence Verification Guide

Complete guide for verifying that MongoDB persistence is working correctly.

## Prerequisites

1. ✅ MongoDB is set up (see `docs/mongodb-setup.md`)
2. ✅ `.env` file configured with MongoDB connection string
3. ✅ Environment variables set correctly

## Quick Verification

### Step 1: Start Backend Server

```bash
npm run dev:server
```

**Expected output:**
```
🚀 Server running on http://localhost:3000
📡 API endpoints available at http://localhost:3000/api
💾 MongoDB persistence: ENABLED
Connecting to MongoDB: mongodb+srv://***@...
Successfully connected to MongoDB database: habitflowai
```

If you see "Successfully connected", MongoDB is working!

### Step 2: Start Frontend Server

In another terminal:

```bash
npm run dev
```

**Expected output:**
```
  VITE v7.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### Step 3: Test in Browser

1. Open http://localhost:5173
2. Open DevTools (F12) → **Console** tab
3. Create a new category
4. Check **Network** tab - should see `POST /api/categories` request

### Step 4: Verify in MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Click your cluster → **"Browse Collections"**
3. Click **`habitflowai`** → **`categories`** collection
4. **You should see your category!**

## Detailed Verification Steps

### Test 1: Health Check

Test if the backend server is responding:

```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-01-27T..."}
```

Or in browser console:
```javascript
fetch('/api/health').then(r => r.json()).then(console.log);
```

### Test 2: Create Category via UI

1. Open http://localhost:5173
2. Click the "+" button to add a category
3. Enter a name and submit
4. Category should appear immediately

**Check:**
- Browser Console (F12) - no errors
- Network tab - `POST /api/categories` request with status 200
- MongoDB Atlas - category appears in `categories` collection

### Test 3: Create Category via API (Browser Console)

Paste this in browser console (F12):

```javascript
(async () => {
  try {
    console.log('Creating category...');
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Category', color: 'bg-blue-500' })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Category created:', data.category);
      console.log('Category ID:', data.category.id);
      console.log('Now check MongoDB Atlas - you should see it!');
    } else {
      console.error('❌ ERROR:', response.status, data);
    }
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.log('Make sure backend server is running: npm run dev:server');
  }
})();
```

**Expected:** `✅ SUCCESS! Category created: {...}`

### Test 4: Read Categories from MongoDB

```javascript
// Read all categories
fetch('/api/categories')
  .then(r => r.json())
  .then(data => {
    console.log('Categories from MongoDB:', data.categories);
    console.log('Count:', data.categories.length);
  });
```

### Test 5: Verify Persistence

1. Create a category in the UI
2. Verify it appears in MongoDB Atlas
3. **Refresh the browser** (F5)
4. Category should still be there (loaded from MongoDB)
5. Check Network tab - should see `GET /api/categories` request

### Test 6: Test Fallback Behavior

1. **Stop the backend server** (Ctrl+C)
2. Try to create a category in the UI
3. Check browser console - should see warning:
   ```
   Failed to save category to API, using localStorage fallback
   ```
4. Category should still be created (saved to localStorage)
5. **Restart backend server**
6. Refresh browser - category should still be there (from localStorage)

## View Data in MongoDB Atlas

### Using Atlas Web Interface (No Compass Needed)

1. Go to https://cloud.mongodb.com
2. Click your **cluster**
3. Click **"Browse Collections"** button
4. Click **`habitflowai`** database
5. Click **`categories`** collection
6. View your data!

**What you'll see:**
- Each document has: `_id`, `id`, `name`, `color`, `userId`
- If collection is empty, no categories have been created yet via the API

### Using mongosh (Command Line)

**For Atlas:**
```bash
mongosh "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/"
use habitflowai
db.categories.find().pretty()
```

**For Local:**
```bash
mongosh
use habitflowai
db.categories.find().pretty()
```

## Troubleshooting

### Issue: "Nothing happens when I create a category"

**Check:**
1. Is backend server running? (`npm run dev:server`)
2. Check browser console (F12) for errors
3. Check Network tab - do you see `/api/categories` request?
4. Is `VITE_USE_MONGO_PERSISTENCE=true` in `.env`?
5. Restart both servers after changing `.env`

### Issue: "Failed to fetch" in browser

**This means:**
- Backend server not running, OR
- CORS issue, OR
- Wrong API URL

**Fix:**
- Make sure backend is running on port 3000
- Check `VITE_API_BASE_URL=/api` in `.env`
- Restart both servers

### Issue: "Failed to save category to API"

**Check:**
1. Backend server logs - any errors?
2. MongoDB connection successful? (check server startup logs)
3. Network tab - what's the error response?

### Issue: Data not appearing in MongoDB

**Check:**
1. Browser console for errors
2. Verify `VITE_USE_MONGO_PERSISTENCE=true` in `.env`
3. Check Network tab - are API requests being made?
4. Check backend server logs for errors
5. Verify MongoDB connection (check server startup)

### Issue: Categories appear but habits don't

**Note:** Currently, only **categories** are implemented for MongoDB persistence. Habits, logs, and wellbeing logs still use localStorage only. This is expected behavior for this PR.

## Verification Checklist

Before creating your PR, verify:

- [ ] Backend server starts without errors
- [ ] MongoDB connection successful (see server logs)
- [ ] Can create category via UI → appears in MongoDB
- [ ] Can delete category via UI → removed from MongoDB
- [ ] Refresh page → categories load from MongoDB
- [ ] Stop backend → fallback to localStorage works
- [ ] Data appears in both MongoDB and localStorage (dual-write)
- [ ] All tests pass: `npm test`

## Quick Test Script

Paste this in browser console to test everything at once:

```javascript
(async () => {
  console.log('=== Testing MongoDB Persistence ===');
  
  // Test 1: Health check
  try {
    const health = await fetch('/api/health').then(r => r.json());
    console.log('✅ Backend server is running:', health);
  } catch (e) {
    console.error('❌ Backend server NOT running:', e.message);
    return;
  }
  
  // Test 2: Create category
  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Category', color: 'bg-blue-500' })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Category created successfully:', data.category);
      console.log('Now check MongoDB Atlas - you should see it!');
    } else {
      const error = await response.json();
      console.error('❌ Failed to create category:', error);
    }
  } catch (e) {
    console.error('❌ Error creating category:', e.message);
  }
  
  // Test 3: Read categories
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();
    console.log('✅ Categories from MongoDB:', data.categories.length, 'categories');
    console.log('Categories:', data.categories);
  } catch (e) {
    console.error('❌ Error reading categories:', e.message);
  }
})();
```

## Recovering Lost Data

If your habits/categories disappeared:

1. **Check browser localStorage:**
   - DevTools (F12) → Application → Local Storage → `http://localhost:5173`
   - Look for `categories`, `habits`, `logs` keys
   - If data exists, it's still there!

2. **Temporarily disable MongoDB:**
   - Set `VITE_USE_MONGO_PERSISTENCE=false` in `.env`
   - Restart dev server
   - Your data should appear

3. **Export data for backup:**
   ```javascript
   // In browser console
   const data = {
     categories: JSON.parse(localStorage.getItem('categories') || '[]'),
     habits: JSON.parse(localStorage.getItem('habits') || '[]'),
     logs: JSON.parse(localStorage.getItem('logs') || '{}'),
   };
   navigator.clipboard.writeText(JSON.stringify(data, null, 2));
   console.log('Data copied to clipboard!');
   ```

## What's NOT Included in This PR

- Habits persistence (still localStorage only)
- Logs persistence (still localStorage only)
- Wellbeing logs persistence (still localStorage only)
- User authentication (using "anonymous-user" placeholder)

These will be added in future PRs.

