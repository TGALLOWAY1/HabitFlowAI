# Debug Category Creation

## Step 1: Check Browser Console

1. Open your browser to http://localhost:5173
2. Open DevTools (F12)
3. Go to **Console** tab
4. Try to create a category
5. Look for any red error messages

**Common errors to look for:**
- `Failed to fetch` - Backend server not running or CORS issue
- `Failed to save category to API` - API request failed
- Network errors - Check Network tab

## Step 2: Check Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Try to create a category
4. Look for a request to `/api/categories` (POST)

**What to check:**
- Is the request being made?
- What's the status code? (200 = success, 400/500 = error)
- Click on the request → Response tab to see the error message

## Step 3: Check Backend Server Logs

Look at the terminal where you ran `npm run dev:server`

**You should see:**
- When you create a category, you should see the request logged
- Any errors will appear here

## Step 4: Verify Environment Variables

Make sure your `.env` file has:

```env
VITE_USE_MONGO_PERSISTENCE=true
USE_MONGO_PERSISTENCE=true
MONGODB_URI=your-actual-connection-string
MONGODB_DB_NAME=habitflowai
```

**Important:** After changing `.env`, restart both servers!

## Step 5: Test API Directly

You can test if the API works by running this in your browser console:

```javascript
// Test creating a category
fetch('/api/categories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Category', color: 'bg-blue-500' })
})
  .then(r => r.json())
  .then(data => console.log('Success:', data))
  .catch(err => console.error('Error:', err));
```

If this works, the API is fine. If it fails, check the error message.

