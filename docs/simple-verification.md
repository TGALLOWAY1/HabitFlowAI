# Simple MongoDB Verification

## The Easiest Way to Verify

### Step 1: Make Sure Backend is Running

Look at the terminal where you ran `npm run dev:server`. You should see:

```
🚀 Server running on http://localhost:3000
Successfully connected to MongoDB database: habitflowai
```

**If you DON'T see this:**
- The server might be stuck connecting to MongoDB
- Check your `.env` file has the correct `MONGODB_URI`
- Check MongoDB Atlas network access

### Step 2: Test in Browser Console

Open browser console (F12) and paste this **complete script**:

```javascript
(async () => {
  console.log('=== Testing API ===');
  
  // Test health endpoint
  try {
    const health = await fetch('/api/health');
    const healthData = await health.json();
    console.log('✅ Backend is running:', healthData);
  } catch (e) {
    console.error('❌ Backend NOT running. Start it with: npm run dev:server');
    return;
  }
  
  // Test creating a category
  console.log('Creating category...');
  try {
    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test from Console', color: 'bg-purple-500' })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Category created:', data.category);
      console.log('📝 Category ID:', data.category.id);
      console.log('🌐 Now check MongoDB Atlas - Browse Collections → habitflowai → categories');
    } else {
      console.error('❌ Failed:', response.status, data);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
})();
```

**What you should see:**
- ✅ `Backend is running: {status: "ok", ...}`
- ✅ `SUCCESS! Category created: {...}`
- Then check MongoDB Atlas!

### Step 3: View in MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Click your cluster
3. Click **"Browse Collections"** button
4. Click **`habitflowai`** database
5. Click **`categories`** collection
6. **You should see your test category!**

## If Category Creation Still Doesn't Work in UI

The issue might be that `addCategory` is async but the component isn't handling it. Let me check the component code...

## Quick Fix: Check Browser Console

When you try to create a category in the UI:

1. Open DevTools (F12)
2. Go to **Console** tab
3. Try to create a category
4. **Look for any red error messages**

Common errors:
- `Failed to fetch` → Backend not running
- `Failed to save category to API` → API error (check Network tab)
- No error but nothing happens → Check if category appears in localStorage

## Check Network Tab

1. Open DevTools (F12) → **Network** tab
2. Try to create a category
3. Look for `/api/categories` request
4. Click on it to see:
   - Status code (200 = success, 400/500 = error)
   - Response tab (see the error message)

This will tell you exactly what's wrong!

