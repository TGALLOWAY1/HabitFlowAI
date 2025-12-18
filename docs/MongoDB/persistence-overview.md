# Persistence Overview

**Last Updated:** 2025-01-27

## Summary

HabitFlowAI uses MongoDB as the single source of truth for all persistent data. The frontend never writes to localStorage for persistence.

## Architecture

### Data Storage

All persistent data is stored in MongoDB via the Node.js backend API:

- **Categories** → `categories` collection
- **Habits** → `habits` collection
- **Day Logs** → `dayLogs` collection
- **Wellbeing Logs** → `wellbeingLogs` collection

### Frontend Behavior

- All state starts empty on mount
- Data is loaded from MongoDB via API calls in `useEffect` hooks
- All writes go directly to MongoDB via API calls
- Optimistic updates are used for logs and wellbeing logs (UI updates immediately, API call happens in background)
- No localStorage persistence is used

### Configuration

The `VITE_USE_MONGO_PERSISTENCE` environment variable can be used to disable MongoDB persistence for special dev/testing scenarios:

- **Default:** `true` (MongoDB enabled)
- **To disable:** Set `VITE_USE_MONGO_PERSISTENCE=false` in `.env`

In normal usage, this should always be `true`.

## Migration History

The app previously supported localStorage-based persistence and a migration mode that dual-wrote to both localStorage and MongoDB. As of 2025-01-27, all localStorage persistence has been removed and the app runs exclusively in Mongo-primary mode.

For historical context, see:
- `docs/mongo-migration-plan.md` - Original migration plan
- `docs/runtime-persistence-map.md` - Historical runtime behavior analysis
