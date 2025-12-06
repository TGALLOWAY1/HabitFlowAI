# Server Library Utilities

## MongoDB Client

The MongoDB client (`mongoClient.ts`) provides a singleton connection to MongoDB.

### Important: Environment Setup

**Before using the MongoDB client, ensure environment variables are loaded:**

```typescript
// At the start of your application (e.g., in server entry point)
import './config/env';  // Loads .env file
import { getDb } from './lib/mongoClient';

// Now you can use getDb()
const db = await getDb();
```

### Usage Example

```typescript
import './config/env';  // Must be imported first
import { getDb } from './lib/mongoClient';

async function example() {
  try {
    // Get database instance (connects automatically)
    const db = await getDb();
    
    // Use collections
    const categories = db.collection('categories');
    const result = await categories.findOne({ name: 'Physical Health' });
    
    console.log('Found category:', result);
  } catch (error) {
    console.error('MongoDB error:', error);
  }
}
```

### Available Functions

- **`getDb(): Promise<Db>`** - Get MongoDB database instance (singleton)
- **`closeConnection(): Promise<void>`** - Close connection (for graceful shutdown)
- **`isConnected(): Promise<boolean>`** - Check if connection is active

### Connection Lifecycle

1. First call to `getDb()` creates and connects
2. Subsequent calls reuse the same connection
3. Connection health is verified before returning
4. Automatic reconnection if connection is lost
5. Call `closeConnection()` on application shutdown

