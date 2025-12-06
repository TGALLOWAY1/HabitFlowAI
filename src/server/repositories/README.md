# Repository Layer

Data access layer for persistent entities. The app uses MongoDB as the only persistence layer.

## Category Repository

The Category repository provides CRUD operations for Category entities.

### Functions

- **`createCategory(data, userId)`** - Create a new category
- **`getCategoriesByUser(userId)`** - Get all categories for a user
- **`getCategoryById(id, userId)`** - Get a single category by ID
- **`updateCategory(id, userId, patch)`** - Update a category (partial update)
- **`deleteCategory(id, userId)`** - Delete a category
- **`reorderCategories(userId, categories)`** - Replace all categories with new order

### MongoDB Requirement

All repository functions use MongoDB via `getDb()`. MongoDB is the only persistence layer and is required for the app to function.

### Usage

```typescript
import { createCategory, getCategoriesByUser } from './repositories/categoryRepository';

// MongoDB is required (asserted at startup)

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

