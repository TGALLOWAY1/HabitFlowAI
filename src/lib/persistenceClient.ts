/**
 * Persistence Client
 * 
 * Frontend client for communicating with the MongoDB-backed REST API.
 * All persistent data is stored in MongoDB via this client.
 */

import type { Category, Habit, DayLog, DailyWellbeing, Goal, GoalWithProgress, GoalManualLog, Routine, RoutineLog, HabitEntry } from '../models/persistenceTypes';

import type { GoalDetail, CompletedGoal, ProgressOverview } from '../types';

import { API_BASE_URL } from './persistenceConfig';
import { invalidateGoalDataCache } from './goalDataCache';



/**
 * Get or create a persistent user ID.
 * 
 * Generates a UUID and stores it in localStorage to ensure the same user ID
 * is used across browser sessions and refreshes.
 */
function getOrCreateUserId(): string {
  if (typeof window === 'undefined') {
    return 'server-side-rendering-placeholder';
  }

  const STORAGE_KEY = 'habitflow_user_id';
  let userId = localStorage.getItem(STORAGE_KEY);

  if (!userId) {
    // Generate new ID if none exists
    userId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, userId);
    console.log('[Auth] Generated new persistent User ID:', userId);
  } else {
    // console.debug('[Auth] Using existing User ID:', userId);
  }

  return userId;
}

/**
 * Make an API request with error handling.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get persistent user ID
  const userId = getOrCreateUserId();

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId, // Send identity header
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

  await apiRequest<{ message: string }>(`/habits/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder habits.
 * 
 * @param habitIds - Array of habit IDs in new order
 * @returns Promise<void>
 * @throws Error if API request fails
 */
export async function reorderHabits(habitIds: string[]): Promise<void> {

  await apiRequest<{ message: string }>('/habits/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ habits: habitIds }),
  });
}

/**
 * Manual Freeze.
 * 
 * POST /api/habits/:id/freeze
 * 
 * @param id - Habit ID
 * @param date - Date to freeze (YYYY-MM-DD)
 * @returns Promise<{ habit: Habit, log: DayLog, message: string }>
 */
export async function freezeHabit(id: string, date: string): Promise<{ habit: Habit, log: DayLog, message: string }> {
  const response = await apiRequest<{ habit: Habit, log: DayLog, message: string }>(`/habits/${id}/freeze`, {
    method: 'POST',
    body: JSON.stringify({ date }),
  });
  return response;
}

/**
 * Fetch all day logs for the current user.
 * 
 * @param habitId - Optional habit ID to filter logs
 * @returns Promise<Record<string, DayLog>> - Record of day logs keyed by `${habitId}-${date}`
 * @throws Error if API request fails
 */
export async function fetchDayLogs(habitId?: string): Promise<Record<string, DayLog>> {

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
  console.log('[fetchWellbeingLogs] Sending GET request to /wellbeingLogs');

  const response = await apiRequest<{ wellbeingLogs: Record<string, DailyWellbeing> }>('/wellbeingLogs');

  console.log('[fetchWellbeingLogs] Received response:', response);
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
  console.log('[saveWellbeingLog] Sending POST request to /wellbeingLogs with:', log);

  const response = await apiRequest<{ wellbeingLog: DailyWellbeing }>('/wellbeingLogs', {
    method: 'POST',
    body: JSON.stringify(log),
  });

  console.log('[saveWellbeingLog] Received response:', response);
  return response.wellbeingLog;
}

/**
 * Routine Persistence Functions
 */

/**
 * Fetch all routines for the current user.
 * 
 * @returns Promise<Routine[]> - Array of routines
 * @throws Error if API request fails
 */
export async function fetchRoutines(): Promise<Routine[]> {

  const response = await apiRequest<{ routines: Routine[] }>('/routines');
  return response.routines;
}

/**
 * Get a single routine by ID.
 * 
 * @param id - Routine ID
 * @returns Promise<Routine> - Routine if found
 * @throws Error if API request fails or routine not found
 */
export async function fetchRoutine(id: string): Promise<Routine> {

  const response = await apiRequest<{ routine: Routine }>(`/routines/${id}`);
  return response.routine;
}

/**
 * Create a new routine.
 * 
 * @param routine - Routine data (without id, createdAt, updatedAt)
 * @returns Promise<Routine> - Created routine with generated ID
 * @throws Error if API request fails
 */
export async function createRoutine(
  routine: Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): Promise<Routine> {

  const response = await apiRequest<{ routine: Routine }>('/routines', {
    method: 'POST',
    body: JSON.stringify(routine),
  });

  return response.routine;
}

/**
 * Update a routine.
 * 
 * @param id - Routine ID
 * @param patch - Partial routine data to update
 * @returns Promise<Routine> - Updated routine
 * @throws Error if API request fails or routine not found
 */
export async function updateRoutine(
  id: string,
  patch: Partial<Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
): Promise<Routine> {

  const response = await apiRequest<{ routine: Routine }>(`/routines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

  return response.routine;
}

/**
 * Upload a routine image.
 * 
 * @param file - The image file to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadRoutineImage(file: File): Promise<string> {
  const url = `${API_BASE_URL}/upload/routine-image`;
  const userId = getOrCreateUserId();

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-User-Id': userId,
        // Content-Type is left undefined so browser sets it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error uploading routine image:', error);
    throw error;
  }
}

/**
 * Delete a routine.
 * 
 * @param id - Routine ID
 * @returns Promise<void>
 * @throws Error if API request fails or routine not found
 */
export async function deleteRoutine(id: string): Promise<void> {

  await apiRequest<{ message: string }>(`/routines/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Submit routine completion and possibly complete linked habits.
 * 
 * @param id - Routine ID
 * @param payload - Submission payload with habitIdsToComplete, and optional fields
 * @returns Promise<SubmitRoutineResponse> - Response with created/updated count and step IDs
 * @throws Error if API request fails or routine not found
 */
export interface SubmitRoutineResponse {
  createdOrUpdatedCount: number;
  completedHabitIds: string[];
}

export async function submitRoutine(
  id: string,
  payload: {
    habitIdsToComplete?: string[];
    submittedAt?: string;
    dateOverride?: string;
  }
): Promise<SubmitRoutineResponse> {

  const response = await apiRequest<SubmitRoutineResponse>(`/routines/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response;
}

/**
 * Fetch all routine logs for the current user.
 * 
 * @returns Promise<Record<string, RoutineLog>> - Record of routine logs keyed by `${routineId}-${date}`
 * @throws Error if API request fails
 */
export async function fetchRoutineLogs(): Promise<Record<string, RoutineLog>> {
  const response = await apiRequest<{ routineLogs: Record<string, RoutineLog> }>('/routineLogs');
  return response.routineLogs;
}

/**
 * Goal Persistence Functions
 * 
 * Note: Mutations (create, update, delete) should invalidate the goal data cache
 * to ensure fresh data on subsequent fetches. Cache invalidation is handled
 * by the calling code after successful mutations.
 */

/**
 * Fetch all goals for the current user.
 * 
 * @returns Promise<Goal[]> - Array of goals
 * @throws Error if API request fails
 */
export async function fetchGoals(): Promise<Goal[]> {
  const response = await apiRequest<{ goals: Goal[] }>('/goals');
  return response.goals;
}

/**
 * Get a single goal by ID.
 * 
 * @param id - Goal ID
 * @returns Promise<Goal> - Goal if found
 * @throws Error if API request fails or goal not found
 */
export async function fetchGoal(id: string): Promise<Goal> {
  const response = await apiRequest<{ goal: Goal }>(`/goals/${id}`);
  return response.goal;
}

/**
 * Create a new goal.
 * 
 * @param data - Goal data (without id, createdAt)
 * @returns Promise<Goal> - Created goal with generated ID
 * @throws Error if API request fails
 */
export async function createGoal(
  data: Omit<Goal, 'id' | 'createdAt'>
): Promise<Goal> {
  const response = await apiRequest<{ goal: Goal }>('/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  // Invalidate cache after successful creation
  invalidateGoalDataCache();

  return response.goal;
}

/**
 * Update a goal.
 * 
 * @param id - Goal ID
 * @param patch - Partial goal data to update
 * @returns Promise<Goal> - Updated goal
 * @throws Error if API request fails or goal not found
 */
export async function updateGoal(
  id: string,
  patch: Partial<Omit<Goal, 'id' | 'createdAt'>>
): Promise<Goal> {
  const response = await apiRequest<{ goal: Goal }>(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });

  // Invalidate cache after successful update
  invalidateGoalDataCache();

  return response.goal;
}

/**
 * Mark a goal as completed by setting completedAt to the current timestamp.
 * 
 * @param id - Goal ID
 * @returns Promise<Goal> - Updated goal with completedAt set
 * @throws Error if API request fails or goal not found
 */
export async function markGoalAsCompleted(id: string): Promise<Goal> {
  const now = new Date().toISOString();
  return updateGoal(id, { completedAt: now });
}

/**
 * Delete a goal.
 * 
 * @param id - Goal ID
 * @returns Promise<void>
 * @throws Error if API request fails or goal not found
 */
export async function deleteGoal(id: string): Promise<void> {
  await apiRequest(`/goals/${id}`, {
    method: 'DELETE',
  });

  // Invalidate cache after successful deletion
  invalidateGoalDataCache();
}

/**
 * Fetch all goals with progress information for the current user.
 * 
 * Efficiently fetches all goals with their progress data in a single request,
 * avoiding N+1 query patterns.
 * 
 * @returns Promise<GoalWithProgress[]> - Array of goals with progress
 * @throws Error if API request fails
 */
export async function fetchGoalsWithProgress(): Promise<GoalWithProgress[]> {
  const response = await apiRequest<{ goals: GoalWithProgress[] }>('/goals-with-progress');
  return response.goals;
}

/**
 * Fetch progress overview combining habits and goals for today.
 * 
 * GET /api/progress/overview
 * 
 * Returns today's date, habit completion summaries, and all goals with progress.
 * 
 * @returns Promise<ProgressOverview> - Combined progress data
 * @throws Error if API request fails
 */
export async function fetchProgressOverview(): Promise<ProgressOverview> {
  const response = await apiRequest<ProgressOverview>('/progress/overview');
  return response;
}

/**
 * Fetch goal detail with progress, manual logs, and history.
 * 
 * GET /api/goals/:id/detail
 * 
 * @param goalId - Goal ID to fetch
 * @returns Promise<GoalDetail> - Goal with progress and manual logs
 * @throws Error if API request fails or goal not found
 */
export async function fetchGoalDetail(goalId: string): Promise<GoalDetail> {
  const response = await apiRequest<GoalDetail>(`/goals/${goalId}/detail`);
  return response;
}

/**
 * Fetch all completed goals for the Win Archive.
 * 
 * GET /api/goals/completed
 * 
 * Returns all goals where completedAt is not null, sorted by completedAt descending.
 * 
 * @returns Promise<CompletedGoal[]> - Array of completed goals
 * @throws Error if API request fails
 */
export async function fetchCompletedGoals(): Promise<CompletedGoal[]> {
  const response = await apiRequest<Array<{ goal: Goal }>>('/goals/completed');
  // Extract goal from each response item
  return response.map(item => item.goal);
}

/**
 * Create a manual log for a goal.
 * 
 * POST /api/goals/:id/manual-logs
 * 
 * @param goalId - Goal ID
 * @param data - Manual log data: { value: number; loggedAt?: string }
 * @returns Promise<GoalManualLog> - Created manual log
 * @throws Error if API request fails
 */
export async function createGoalManualLog(
  goalId: string,
  data: { value: number; loggedAt?: string }
): Promise<GoalManualLog> {
  const response = await apiRequest<{ log: GoalManualLog }>(
    `/goals/${goalId}/manual-logs`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response.log;
}
/**
 * Habit Entry (History) Persistence Functions
 */

/**
 * Fetch entries for a habit.
 * 
 * @param habitId - Habit ID
 * @param date - Optional date filter
 * @returns Promise<HabitEntry[]>
 */
export async function fetchHabitEntries(habitId: string, date?: string): Promise<HabitEntry[]> {
  const url = date
    ? `/entries?habitId=${habitId}&date=${date}`
    : `/entries?habitId=${habitId}`;

  const response = await apiRequest<{ entries: HabitEntry[] }>(url);
  return response.entries;
}

/**
 * Create a new habit entry.
 * 
 * @param data - Entry data
 * @returns Promise<{ entry: HabitEntry, dayLog: DayLog | null }>
 */
export async function createHabitEntry(data: Partial<HabitEntry>): Promise<{ entry: HabitEntry, dayLog: DayLog | null }> {
  const response = await apiRequest<{ entry: HabitEntry, dayLog: DayLog | null }>('/entries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response;
}

/**
 * Update a habit entry.
 * 
 * @param id - Entry ID
 * @param patch - Data to update
 * @returns Promise<{ entry: HabitEntry, dayLog: DayLog | null }>
 */
export async function updateHabitEntry(id: string, patch: Partial<HabitEntry>): Promise<{ entry: HabitEntry, dayLog: DayLog | null }> {
  const response = await apiRequest<{ entry: HabitEntry, dayLog: DayLog | null }>(`/entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return response;
}

/**
 * Delete a habit entry.
 * 
 * @param id - Entry ID
 * @returns Promise<{ success: boolean, dayLog: DayLog | null }>
 */
export async function deleteHabitEntry(id: string): Promise<{ success: boolean, dayLog: DayLog | null }> {
  await apiRequest<{ message: string, dayLog: DayLog | null }>(`/entries/${id}`, {
    method: 'DELETE',
  });
  return { success: true, dayLog: null }; // API doesn't return dayLog on delete yet but might later
}

/**
 * Habit Potential Evidence Persistence Functions
 */
import type { HabitPotentialEvidence } from '../models/persistenceTypes';

/**
 * Fetch potential evidence for a given date.
 * 
 * @param date - Date in YYYY-MM-DD format
 * @returns Promise<HabitPotentialEvidence[]>
 */
export async function fetchPotentialEvidence(date: string): Promise<HabitPotentialEvidence[]> {
  const response = await apiRequest<{ evidence: HabitPotentialEvidence[] }>(`/evidence?date=${date}`);
  return response.evidence || [];
}

/**
 * Delete all entries for a habit on a specific day (Clear Day).
 * 
 * @param habitId 
 * @param date 
 * @returns Promise<{ success: boolean, dayLog: DayLog | null }>
 */
export async function clearHabitEntriesForDay(habitId: string, date: string): Promise<{ success: boolean, dayLog: DayLog | null }> {
  const response = await apiRequest<{ success: boolean, dayLog: DayLog | null }>(`/entries?habitId=${habitId}&date=${date}`, {
    method: 'DELETE',
  });
  return response;
}

