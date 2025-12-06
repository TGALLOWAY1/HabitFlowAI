# Quick MongoDB Verification Guide

## Quick Start

### 1. Start Backend Server

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

### 2. Start Frontend (in another terminal)

```bash
npm run dev
```

### 3. Test in Browser

1. Open http://localhost:5173
2. Open DevTools (F12) → Network tab
3. Create a new category
4. Check Network tab - should see `POST /api/categories` request
5. Check Response - should see created category with `id`

### 4. Verify in MongoDB

**Option A: MongoDB Compass**
- Connect to your Atlas cluster
- Browse `habitflowai` database → `categories` collection
- See your category there

**Option B: mongosh**

**For MongoDB Atlas:**
1. Get your connection string from Atlas dashboard (click "Connect" → "Drivers")
2. It will look like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`
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

### 5. Test Persistence

1. Refresh browser (F5)
2. Category should still be there
3. Check Network tab - should see `GET /api/categories` request
4. Data loaded from MongoDB!

## Quick Checklist

- [ ] Backend server starts: `npm run dev:server`
- [ ] Frontend server starts: `npm run dev`
- [ ] Create category → appears in MongoDB
- [ ] Refresh page → category still there (from MongoDB)
- [ ] Check MongoDB Atlas → see your data

## If Something Fails

1. **Server won't start?**
   - Check `.env` has `MONGODB_URI` and `USE_MONGO_PERSISTENCE=true`
   - Verify MongoDB connection string is correct

2. **No data in MongoDB?**
   - Check browser console for errors
   - Verify `VITE_USE_MONGO_PERSISTENCE=true` in `.env`
   - Check Network tab - are API requests being made?

3. **API requests failing?**
   - Make sure backend server is running on port 3000
   - Check CORS errors in browser console
   - Verify `VITE_API_BASE_URL=/api` in `.env`

For detailed troubleshooting, see `docs/verify-mongodb-persistence.md`.

