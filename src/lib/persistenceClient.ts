/**
 * Persistence Client
 * 
 * Frontend client for communicating with the MongoDB-backed REST API.
 * Uses feature flag to determine whether to use API or localStorage.
 */

import type { Category } from '../models/persistenceTypes';

import { USE_MONGO_PERSISTENCE, API_BASE_URL } from './persistenceConfig';

/**
 * Get the current user ID.
 * 
 * TODO: Replace with actual authentication token/session.
 * For now, returns a placeholder that should match backend expectations.
 */
function getUserId(): string {
  // TODO: Extract from auth token, session, or user context
  // For now, using a placeholder
  return 'anonymous-user';
}

/**
 * Make an API request with error handling.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle feature flag disabled (501)
      if (response.status === 501) {
        throw new Error(
          errorData.error?.message || 
          'MongoDB persistence is disabled on the server'
        );
      }

      // Handle validation errors (400)
      if (response.status === 400) {
        throw new Error(
          errorData.error?.message || 
          'Invalid request data'
        );
      }

      // Handle not found (404)
      if (response.status === 404) {
        throw new Error(
          errorData.error?.message || 
          'Resource not found'
        );
      }

      // Handle other errors
      throw new Error(
        errorData.error?.message || 
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred during API request');
  }
}

/**
 * Category Persistence Functions
 */

/**
 * Fetch all categories for the current user.
 * 
 * @returns Promise<Category[]> - Array of categories
 * @throws Error if API request fails
 */
export async function fetchCategories(): Promise<Category[]> {
  if (!USE_MONGO_PERSISTENCE) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.'
    );
  }

  const response = await apiRequest<{ categories: Category[] }>('/categories');
  return response.categories;
}

/**
 * Create a new category.
 * 
 * @param data - Category data (without id)
 * @returns Promise<Category> - Created category with generated ID
 * @throws Error if API request fails
 */
export async function saveCategory(
  data: Omit<Category, 'id'>
): Promise<Category> {
  if (!USE_MONGO_PERSISTENCE) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.'
    );
  }

  const response = await apiRequest<{ category: Category }>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.category;
}

/**
 * Get a single category by ID.
 * 
 * @param id - Category ID
 * @returns Promise<Category | null> - Category if found, null otherwise
 * @throws Error if API request fails
 */
export async function fetchCategoryById(id: string): Promise<Category | null> {
  if (!USE_MONGO_PERSISTENCE) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.'
    );
  }

  try {
    const response = await apiRequest<{ category: Category }>(`/categories/${id}`);
    return response.category;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Update a category.
 * 
 * @param id - Category ID
 * @param patch - Partial category data to update
 * @returns Promise<Category> - Updated category
 * @throws Error if API request fails or category not found
 */
export async function updateCategory(
  id: string,
  patch: Partial<Omit<Category, 'id'>>
): Promise<Category> {
  if (!USE_MONGO_PERSISTENCE) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.'
    );
  }

  const response = await apiRequest<{ category: Category }>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

  return response.category;
}

/**
 * Delete a category.
 * 
 * @param id - Category ID
 * @returns Promise<void>
 * @throws Error if API request fails or category not found
 */
export async function deleteCategory(id: string): Promise<void> {
  if (!USE_MONGO_PERSISTENCE) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.'
    );
  }

  await apiRequest<{ message: string }>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder categories.
 * 
 * @param categories - Array of categories in new order
 * @returns Promise<Category[]> - Updated categories array
 * @throws Error if API request fails
 */
export async function reorderCategories(categories: Category[]): Promise<Category[]> {
  if (!USE_MONGO_PERSISTENCE) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=true in .env to enable.'
    );
  }

  const response = await apiRequest<{ categories: Category[] }>('/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ categories }),
  });

  return response.categories;
}

// Re-export for convenience
export { isMongoPersistenceEnabled } from './persistenceConfig';

