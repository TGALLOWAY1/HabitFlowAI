# Test MongoDB Connection

## Quick Test Methods

### Method 1: Check Your .env File

Your connection string should be in `.env`:

```bash
cat .env | grep MONGODB_URI
```

This will show your actual connection string (with credentials).

### Method 2: Connect via mongosh

**For MongoDB Atlas:**

1. **Get your connection string from Atlas:**
   - Go to https://cloud.mongodb.com
   - Click "Connect" on your cluster
   - Choose "Drivers"
   - Copy the connection string (looks like `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`)

2. **Connect:**
   ```bash
   mongosh "mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/"
   ```

3. **Check your database:**
   ```bash
   use habitflowai
   db.categories.find().pretty()
   ```

**For Local MongoDB:**

```bash
mongosh
use habitflowai
db.categories.find().pretty()
```

### Method 3: Use MongoDB Compass (Easiest)

1. Download MongoDB Compass: https://www.mongodb.com/try/download/compass
2. Open Compass
3. Paste your connection string from `.env` (the `MONGODB_URI` value)
4. Click "Connect"
5. Browse to `habitflowai` → `categories` collection

### Method 4: Test via Backend Server

The easiest way is to just start your backend server and check the logs:

```bash
npm run dev:server
```

If you see:
```
Successfully connected to MongoDB database: habitflowai
```

Then your connection is working!

## What You Should See

When you query `db.categories.find().pretty()`, you should see documents like:

```json
{
  "_id": ObjectId("..."),
  "id": "abc-123-def-456",
  "name": "Physical Health",
  "color": "bg-emerald-500",
  "userId": "anonymous-user"
}
```

If the collection is empty, that's fine - it means no categories have been created yet via the API.

## Test Creating Data

1. Start backend: `npm run dev:server`
2. Start frontend: `npm run dev` (in another terminal)
3. Create a category in the browser
4. Then check MongoDB - you should see it there!

