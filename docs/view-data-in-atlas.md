# View Data in MongoDB Atlas (No Compass Needed!)

You don't need MongoDB Compass - you can view your data directly in the Atlas web interface!

## Step-by-Step: View Your Categories in Atlas

### 1. Log into MongoDB Atlas

1. Go to https://cloud.mongodb.com
2. Log in with your account

### 2. Navigate to Your Database

1. Click on your **cluster** (the one you created)
2. Click the **"Browse Collections"** button (or "Collections" tab)
3. You should see your database listed

### 3. View Your Data

1. Click on the **`habitflowai`** database
2. Click on the **`categories`** collection
3. You should see all your categories!

**What you'll see:**
- Each document has: `_id`, `id`, `name`, `color`, `userId`
- If the collection is empty, no categories have been created yet via the API

### 4. Test Creating Data

1. Create a category in your app (http://localhost:5173)
2. Refresh the Atlas page (or click the refresh button)
3. Your new category should appear!

## What If I Don't See the Database?

If you don't see `habitflowai` database:

1. **Check your connection string** - Make sure `MONGODB_DB_NAME=habitflowai` in `.env`
2. **Create data first** - The database is created automatically when you first save data
3. **Check the correct cluster** - Make sure you're looking at the right cluster

## What If I Don't See Any Categories?

1. **Check if backend is running:**
   ```bash
   npm run dev:server
   ```
   Should see: "Successfully connected to MongoDB database: habitflowai"

2. **Check browser console for errors:**
   - Open DevTools (F12) → Console tab
   - Try creating a category
   - Look for error messages

3. **Check Network tab:**
   - Open DevTools (F12) → Network tab
   - Try creating a category
   - Look for `/api/categories` request
   - Check if it succeeded (status 200) or failed (status 400/500)

4. **Verify environment variables:**
   - Make sure `VITE_USE_MONGO_PERSISTENCE=true` in `.env`
   - Restart both servers after changing `.env`

## Quick Test: Create Category via Browser Console

Open browser console (F12) and run:

```javascript
fetch('/api/categories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test from Console', color: 'bg-purple-500' })
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ Category created:', data);
    console.log('Now check Atlas - you should see it!');
  })
  .catch(err => console.error('❌ Error:', err));
```

If this works, check Atlas - you should see the category appear!

