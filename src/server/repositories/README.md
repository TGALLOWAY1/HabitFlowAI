# Repository Layer

Data access layer for persistent entities. Uses feature flags to switch between MongoDB persistence and local storage (when implemented).

## Category Repository

The Category repository provides CRUD operations for Category entities.

### Functions

- **`createCategory(data, userId)`** - Create a new category
- **`getCategoriesByUser(userId)`** - Get all categories for a user
- **`getCategoryById(id, userId)`** - Get a single category by ID
- **`updateCategory(id, userId, patch)`** - Update a category (partial update)
- **`deleteCategory(id, userId)`** - Delete a category
- **`reorderCategories(userId, categories)`** - Replace all categories with new order

### Feature Flag

All repository functions check `USE_MONGO_PERSISTENCE` environment variable:

- **`true`** - Uses MongoDB via `getDb()`
- **`false`** - Throws "not implemented" error (local storage adapter to be added)

### Usage

```typescript
import { createCategory, getCategoriesByUser } from './repositories/categoryRepository';

// Ensure feature flag is enabled
process.env.USE_MONGO_PERSISTENCE = 'true';

// Create category
const category = await createCategory(
  { name: 'Physical Health', color: 'bg-emerald-500' },
  'user-123'
);

// Get all categories for user
const categories = await getCategoriesByUser('user-123');
```

### Testing

Run tests with:

```bash
npm test
```

Tests use a separate test database (`habitflowai_test`) and clean up after themselves.

### User Isolation

All repository functions require a `userId` parameter to ensure data isolation between users. This prepares the codebase for multi-user support.

