# Start Servers Step-by-Step

## The Problem

When you try to create a category and nothing happens, it's usually because:
1. Backend server isn't running
2. Backend server crashed (MongoDB connection issue)
3. Environment variables not set correctly

## Step-by-Step Solution

### Step 1: Check Your .env File

Make sure you have a `.env` file in the project root with:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=habitflowai
USE_MONGO_PERSISTENCE=true
VITE_USE_MONGO_PERSISTENCE=true
VITE_API_BASE_URL=/api
```

**Important:** Replace `username`, `password`, and `cluster0.xxxxx` with your actual Atlas credentials!

### Step 2: Start Backend Server

Open a terminal and run:

```bash
npm run dev:server
```

**What you should see:**
```
🚀 Server running on http://localhost:3000
📡 API endpoints available at http://localhost:3000/api
💾 MongoDB persistence: ENABLED
Connecting to MongoDB: mongodb+srv://***@...
Successfully connected to MongoDB database: habitflowai
```

**If you see an error:**
- "MONGODB_URI environment variable is not set" → Check your `.env` file
- "MongoDB connection failed" → Check your connection string
- Server crashes → Check the error message

### Step 3: Start Frontend Server (in another terminal)

Open a **new terminal** and run:

```bash
npm run dev
```

**What you should see:**
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### Step 4: Test in Browser

1. Open http://localhost:5173
2. Open DevTools (F12) → **Console** tab
3. Try to create a category
4. **Check the console for errors**

### Step 5: Test API Directly

In the browser console, paste this:

```javascript
(async () => {
  try {
    console.log('Testing API...');
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('✅ API is working!', data);
  } catch (error) {
    console.error('❌ API failed:', error.message);
    console.log('Make sure backend server is running: npm run dev:server');
  }
})();
```

If this fails, the backend server isn't running or isn't accessible.

## Common Issues

### Issue: "Nothing happens when I create a category"

**Check:**
1. Is backend server running? (`npm run dev:server`)
2. Check browser console (F12) for errors
3. Check Network tab - do you see `/api/categories` request?
4. Is `VITE_USE_MONGO_PERSISTENCE=true` in `.env`?

### Issue: Backend server won't start

**Check:**
1. MongoDB connection string is correct in `.env`
2. MongoDB Atlas network access allows your IP
3. Check server terminal for error messages

### Issue: "Failed to fetch" in browser

**This means:**
- Backend server not running, OR
- CORS issue, OR
- Wrong API URL

**Fix:**
- Make sure backend is running on port 3000
- Check `VITE_API_BASE_URL=/api` in `.env`
- Restart both servers

## Quick Test Script

Paste this in browser console to test everything:

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
      console.log('✅ Category created successfully:', data);
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
  } catch (e) {
    console.error('❌ Error reading categories:', e.message);
  }
})();
```

This will test everything and tell you what's working and what's not!

