/**
 * Persistence Client
 * 
 * Frontend client for communicating with the MongoDB-backed REST API.
 * All persistent data is stored in MongoDB via this client.
 */

import type { Category, Habit, DayLog, DailyWellbeing } from '../models/persistenceTypes';

import { MONGO_ENABLED, API_BASE_URL } from './persistenceConfig';

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
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
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
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
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
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
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
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
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
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
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
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const response = await apiRequest<{ categories: Category[] }>('/categories/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ categories }),
  });

  return response.categories;
}

/**
 * Habit Persistence Functions
 */

/**
 * Fetch all habits for the current user.
 * 
 * @param categoryId - Optional category ID to filter habits
 * @returns Promise<Habit[]> - Array of habits
 * @throws Error if API request fails
 */
export async function fetchHabits(categoryId?: string): Promise<Habit[]> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const url = categoryId ? `/habits?categoryId=${categoryId}` : '/habits';
  const response = await apiRequest<{ habits: Habit[] }>(url);
  return response.habits;
}

/**
 * Create a new habit.
 * 
 * @param data - Habit data (without id, createdAt, archived)
 * @returns Promise<Habit> - Created habit with generated ID
 * @throws Error if API request fails
 */
export async function saveHabit(
  data: Omit<Habit, 'id' | 'createdAt' | 'archived'>
): Promise<Habit> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const response = await apiRequest<{ habit: Habit }>('/habits', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.habit;
}

/**
 * Update a habit.
 * 
 * @param id - Habit ID
 * @param patch - Partial habit data to update
 * @returns Promise<Habit> - Updated habit
 * @throws Error if API request fails or habit not found
 */
export async function updateHabit(
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'createdAt'>>
): Promise<Habit> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const response = await apiRequest<{ habit: Habit }>(`/habits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

  return response.habit;
}

/**
 * Delete a habit.
 * 
 * @param id - Habit ID
 * @returns Promise<void>
 * @throws Error if API request fails or habit not found
 */
export async function deleteHabit(id: string): Promise<void> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  await apiRequest<{ message: string }>(`/habits/${id}`, {
    method: 'DELETE',
  });
}

/**
 * DayLog Persistence Functions
 */

/**
 * Fetch all day logs for the current user.
 * 
 * @param habitId - Optional habit ID to filter logs
 * @returns Promise<Record<string, DayLog>> - Record of day logs keyed by `${habitId}-${date}`
 * @throws Error if API request fails
 */
export async function fetchDayLogs(habitId?: string): Promise<Record<string, DayLog>> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const url = habitId ? `/dayLogs?habitId=${habitId}` : '/dayLogs';
  const response = await apiRequest<{ logs: Record<string, DayLog> }>(url);
  return response.logs;
}

/**
 * Create or update a day log.
 * 
 * @param log - DayLog data
 * @returns Promise<DayLog> - Created/updated day log
 * @throws Error if API request fails
 */
export async function saveDayLog(log: DayLog): Promise<DayLog> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const response = await apiRequest<{ log: DayLog }>('/dayLogs', {
    method: 'POST',
    body: JSON.stringify(log),
  });

  return response.log;
}

/**
 * Delete a day log.
 * 
 * @param habitId - Habit ID
 * @param date - Date in YYYY-MM-DD format
 * @returns Promise<void>
 * @throws Error if API request fails
 */
export async function deleteDayLog(habitId: string, date: string): Promise<void> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  await apiRequest<{ message: string }>(`/dayLogs/${habitId}/${date}`, {
    method: 'DELETE',
  });
}

/**
 * WellbeingLog Persistence Functions
 */

/**
 * Fetch all wellbeing logs for the current user.
 * 
 * @returns Promise<Record<string, DailyWellbeing>> - Record of wellbeing logs keyed by date
 * @throws Error if API request fails
 */
export async function fetchWellbeingLogs(): Promise<Record<string, DailyWellbeing>> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const response = await apiRequest<{ wellbeingLogs: Record<string, DailyWellbeing> }>('/wellbeingLogs');
  return response.wellbeingLogs;
}

/**
 * Create or update a wellbeing log.
 * 
 * @param log - DailyWellbeing data
 * @returns Promise<DailyWellbeing> - Created/updated wellbeing log
 * @throws Error if API request fails
 */
export async function saveWellbeingLog(log: DailyWellbeing): Promise<DailyWellbeing> {
  if (!MONGO_ENABLED) {
    throw new Error(
      'MongoDB persistence is disabled. Set VITE_USE_MONGO_PERSISTENCE=false in .env to disable (defaults to true).'
    );
  }

  const response = await apiRequest<{ wellbeingLog: DailyWellbeing }>('/wellbeingLogs', {
    method: 'POST',
    body: JSON.stringify(log),
  });

  return response.wellbeingLog;
}

