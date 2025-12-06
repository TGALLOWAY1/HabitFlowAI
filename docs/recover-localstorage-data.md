# Recover Your localStorage Data

If your habits and categories disappeared, your data is likely still in your browser's localStorage. Here's how to check and recover it.

## Quick Check: Is Your Data Still There?

### Option 1: Check Browser DevTools

1. **Open your browser** (Chrome, Firefox, Safari, etc.)
2. **Open DevTools:**
   - Chrome/Edge: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Safari: Press `Cmd+Option+I` (need to enable Developer menu first)

3. **Go to Application tab** (Chrome/Edge) or **Storage tab** (Firefox)
4. **Click on "Local Storage"** in the left sidebar
5. **Click on your site** (usually `http://localhost:5173`)
6. **Look for these keys:**
   - `categories` - Your categories
   - `habits` - Your habits
   - `logs` - Your habit logs
   - `wellbeingLogs` - Your wellbeing logs

### Option 2: Check via Console

1. Open DevTools Console (same as above)
2. Type these commands:

```javascript
// Check if data exists
console.log('Categories:', localStorage.getItem('categories'));
console.log('Habits:', localStorage.getItem('habits'));
console.log('Logs:', localStorage.getItem('logs'));
```

If you see data, it's still there!

## Why Did This Happen?

The issue was a bug in the code: when MongoDB persistence was enabled but the API returned empty data, the app checked localStorage but didn't actually use it. This has been fixed.

## How to Recover Your Data

### Step 1: Disable MongoDB Persistence (Temporary)

If `VITE_USE_MONGO_PERSISTENCE=true` is set in your `.env`, temporarily disable it:

1. Open `.env` file in your project root
2. Change:
   ```env
   VITE_USE_MONGO_PERSISTENCE=false
   ```
3. Restart your dev server (stop with `Ctrl+C` and run `npm run dev` again)

This will make the app use localStorage directly, and your data should appear.

### Step 2: Verify Your Data is Back

After restarting, your habits and categories should appear. If they do, your data is safe!

### Step 3: Re-enable MongoDB (Optional)

Once you've verified your data is back, you can:
1. Keep `VITE_USE_MONGO_PERSISTENCE=false` to continue using localStorage
2. Or set it back to `true` - the fix I made will now properly use localStorage as a fallback

## Export Your Data (Backup)

To be extra safe, you can export your data:

1. Open DevTools Console
2. Run this to export all your data:

```javascript
// Export all data
const data = {
  categories: JSON.parse(localStorage.getItem('categories') || '[]'),
  habits: JSON.parse(localStorage.getItem('habits') || '[]'),
  logs: JSON.parse(localStorage.getItem('logs') || '{}'),
  wellbeingLogs: JSON.parse(localStorage.getItem('wellbeingLogs') || '{}')
};

// Copy to clipboard
navigator.clipboard.writeText(JSON.stringify(data, null, 2));
console.log('Data copied to clipboard!');
```

3. Paste it into a text file and save it as a backup.

## Import Your Data (If Needed)

If you have a backup and need to restore:

```javascript
// Replace with your actual data
const data = {
  categories: [...],
  habits: [...],
  logs: {...},
  wellbeingLogs: {...}
};

// Restore to localStorage
localStorage.setItem('categories', JSON.stringify(data.categories));
localStorage.setItem('habits', JSON.stringify(data.habits));
localStorage.setItem('logs', JSON.stringify(data.logs));
localStorage.setItem('wellbeingLogs', JSON.stringify(data.wellbeingLogs));

// Refresh the page
location.reload();
```

## Prevention

The fix I made ensures that:
- If MongoDB API returns empty, localStorage data will be used
- If MongoDB API fails, localStorage data will be used
- Your data is safe and won't disappear

Your data should be safe now!

