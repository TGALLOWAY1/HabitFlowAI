# Verify MongoDB Persistence

This guide helps you verify that MongoDB persistence is working correctly before creating a PR.

## Prerequisites

1. ✅ MongoDB Atlas is set up and connection string is in `.env`
2. ✅ `.env` file has the required variables (see below)
3. ✅ You have MongoDB Compass or `mongosh` to inspect the database

## Step 1: Configure Environment Variables

Make sure your `.env` file has:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=habitflowai

# Backend Feature Flag
USE_MONGO_PERSISTENCE=true

# Frontend Feature Flag
VITE_USE_MONGO_PERSISTENCE=true

# API Configuration
VITE_API_BASE_URL=/api
```

## Step 2: Start Both Servers

You need to run both the frontend (Vite) and backend (Express) servers.

### Option A: Run Both Separately (Recommended for Testing)

**Terminal 1 - Backend Server:**
```bash
npm run dev:server
```

You should see:
```
🚀 Server running on http://localhost:3000
📡 API endpoints available at http://localhost:3000/api
💾 MongoDB persistence: ENABLED
Connecting to MongoDB: mongodb+srv://***@...
Successfully connected to MongoDB database: habitflowai
```

**Terminal 2 - Frontend Server:**
```bash
npm run dev
```

You should see:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Option B: Run Both Together

```bash
npm run dev:all
```

This runs both servers concurrently.

## Step 3: Verify MongoDB Connection

### Check Server Logs

When the backend server starts, you should see:
- ✅ `Successfully connected to MongoDB database: habitflowai`
- ✅ `MongoDB persistence: ENABLED`

If you see errors, check:
- MongoDB URI is correct in `.env`
- Network access is configured in Atlas
- Database user has correct permissions

### Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-01-27T..."}
```

## Step 4: Test Category Operations

### 4.1 Create a Category via UI

1. Open http://localhost:5173 in your browser
2. Open DevTools Console (F12)
3. Create a new category in the UI
4. Check the console for:
   - Network request to `/api/categories` (POST)
   - Should see successful response

### 4.2 Verify in MongoDB

**Option A: Using MongoDB Compass**

1. Open MongoDB Compass
2. Connect using your connection string
3. Navigate to `habitflowai` database
4. Open `categories` collection
5. You should see your newly created category with:
   - `id` (UUID string)
   - `name` (category name)
   - `color` (Tailwind color class)
   - `userId` ("anonymous-user" until auth is implemented)

**Option B: Using mongosh**

**For MongoDB Atlas:**
1. Get your connection string from Atlas dashboard (Connect → Drivers)
2. It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`
3. Connect:
```bash
mongosh "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/"
use habitflowai
db.categories.find().pretty()
```

**For Local MongoDB:**
```bash
mongosh
use habitflowai
db.categories.find().pretty()
```

You should see documents like:
```json
{
  "_id": ObjectId("..."),
  "id": "abc-123-def-456",
  "name": "Test Category",
  "color": "bg-blue-500",
  "userId": "anonymous-user"
}
```

### 4.3 Test Refresh (Data Persistence)

1. Create a category in the UI
2. Verify it appears in MongoDB
3. **Refresh the browser** (F5)
4. The category should still be there (loaded from MongoDB)
5. Check Network tab - should see `GET /api/categories` request

### 4.4 Test Delete

1. Delete a category in the UI
2. Check MongoDB - the category should be removed
3. Refresh browser - category should still be gone

## Step 5: Test Fallback Behavior

### 5.1 Test API Failure Fallback

1. Stop the backend server (Ctrl+C)
2. Try to create a category in the UI
3. Check browser console - should see warning:
   ```
   Failed to save category to API, using localStorage fallback
   ```
4. Category should still be created (saved to localStorage)
5. Restart backend server
6. Refresh browser - category should still be there (from localStorage)

### 5.2 Test Empty API Response

1. Clear all categories in MongoDB:
   ```bash
   # For Atlas - use your actual connection string
   mongosh "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/"
   # For local
   # mongosh
   use habitflowai
   db.categories.deleteMany({})
   ```
2. Refresh browser
3. Check console - should see warning:
   ```
   MongoDB persistence enabled but API returned no categories. Using localStorage data.
   ```
4. Your localStorage categories should still appear

## Step 6: Verify Dual-Write

When MongoDB persistence is enabled, data should be saved to **both** MongoDB and localStorage:

1. Create a category
2. Check MongoDB - should be there
3. Check browser DevTools → Application → Local Storage → `categories`
4. Category should also be in localStorage

This ensures data safety during the transition period.

## Step 7: Test All Operations

Verify these operations work with MongoDB:

- ✅ **Create Category** - Saves to MongoDB
- ✅ **Delete Category** - Removes from MongoDB
- ✅ **Reorder Categories** - Updates order in MongoDB
- ✅ **Refresh Page** - Loads from MongoDB
- ✅ **API Failure** - Falls back to localStorage
- ✅ **Empty API** - Uses localStorage data

## Step 8: Check MongoDB Atlas Dashboard

1. Go to https://cloud.mongodb.com
2. Navigate to your cluster
3. Click "Browse Collections"
4. Select `habitflowai` database
5. View `categories` collection
6. You should see all your categories

## Troubleshooting

### Issue: "Failed to fetch categories from API"

**Causes:**
- Backend server not running
- Wrong API URL
- CORS issues

**Solutions:**
- Make sure backend server is running on port 3000
- Check `VITE_API_BASE_URL` in `.env` (should be `/api`)
- Check browser console for specific error

### Issue: "MongoDB connection failed"

**Causes:**
- Wrong connection string
- Network access not configured
- MongoDB not accessible

**Solutions:**
- Verify `MONGODB_URI` in `.env`
- Check Atlas Network Access (should allow your IP or `0.0.0.0/0`)
- Test connection with `mongosh`

### Issue: Data not appearing in MongoDB

**Causes:**
- Feature flag not enabled
- Wrong database name
- Data saved to different user

**Solutions:**
- Check `USE_MONGO_PERSISTENCE=true` in `.env`
- Verify `MONGODB_DB_NAME=habitflowai`
- Check `userId` field in documents (currently "anonymous-user")

### Issue: Categories appear but habits don't

**Note:** Currently, only **categories** are implemented for MongoDB persistence. Habits, logs, and wellbeing logs still use localStorage only. This is expected behavior for this PR.

## Verification Checklist

Before creating your PR, verify:

- [ ] Backend server starts without errors
- [ ] MongoDB connection successful
- [ ] Can create category via UI → appears in MongoDB
- [ ] Can delete category via UI → removed from MongoDB
- [ ] Refresh page → categories load from MongoDB
- [ ] Stop backend → fallback to localStorage works
- [ ] Data appears in both MongoDB and localStorage (dual-write)
- [ ] All tests pass: `npm test`

## Next Steps

Once verified:

1. ✅ All operations work correctly
2. ✅ Data persists in MongoDB
3. ✅ Fallback mechanisms work
4. ✅ Tests pass
5. ✅ Ready for PR!

## What's NOT Included in This PR

- Habits persistence (still localStorage only)
- Logs persistence (still localStorage only)
- Wellbeing logs persistence (still localStorage only)
- User authentication (using "anonymous-user" placeholder)

These will be added in future PRs.

