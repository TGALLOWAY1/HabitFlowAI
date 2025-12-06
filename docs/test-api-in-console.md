# Test API in Browser Console

## Quick Test (Copy & Paste This)

Open your browser console (F12) and paste this:

```javascript
// Test creating a category - this will show the result
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
      console.log('✅ SUCCESS! Category created:', data);
      console.log('Category ID:', data.category.id);
      console.log('Now check MongoDB Atlas - you should see it!');
    } else {
      console.error('❌ ERROR:', response.status, data);
    }
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.log('This usually means:');
    console.log('1. Backend server not running (run: npm run dev:server)');
    console.log('2. CORS issue');
    console.log('3. Network error');
  }
})();
```

## What You Should See

**If it works:**
```
Creating category...
✅ SUCCESS! Category created: { category: { id: "...", name: "Test Category", ... } }
Category ID: abc-123-def-456
Now check MongoDB Atlas - you should see it!
```

**If it fails:**
```
❌ FAILED: Failed to fetch
```

## Test Reading Categories

```javascript
// Test reading categories
(async () => {
  try {
    const response = await fetch('/api/categories');
    const data = await response.json();
    console.log('Categories from MongoDB:', data.categories);
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

## Check What's Happening

After running the test, check:

1. **Browser Console** - Do you see success or error?
2. **Network Tab** (F12 → Network) - Do you see the `/api/categories` request?
3. **Backend Server Terminal** - Do you see any request logs or errors?

