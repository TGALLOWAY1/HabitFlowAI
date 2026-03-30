/**
 * Persistence Client
 * 
 * Frontend client for communicating with the MongoDB-backed REST API.
 * All persistent data is stored in MongoDB via this client.
 */

import type { Category, Habit, DayLog, DailyWellbeing, Goal, GoalWithProgress, Routine, RoutineLog, HabitEntry } from '../models/persistenceTypes';
import type { WellbeingEntry, WellbeingMetricKey } from '../models/persistenceTypes';
import type { DashboardPrefs, HouseholdUser } from '../models/persistenceTypes';

import type { GoalDetail, CompletedGoal, ProgressOverview } from '../types';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../types/task';

import { API_BASE_URL } from './persistenceConfig';
import { buildHabitEntryUpsertPayload } from './habitEntryPayload';
import { invalidateGoalDataCache, invalidateGoalCaches } from './goalDataCache';
import { ACTIVE_USER_MODE_STORAGE_KEY, DEMO_USER_ID, type ActiveUserMode } from '../shared/demo';
import { warnIfPersonaLeaksIntoHabitEntryRequest } from '../shared/invariants/personaInvariants';



const USER_ID_STORAGE_KEY = 'habitflow_user_id';
const HOUSEHOLD_ID_STORAGE_KEY = 'habitflow_household_id';

const DEFAULT_HOUSEHOLD_ID = 'default-household';

/**
 * Get or create a persistent user ID.
 * On first visit a new UUID is generated and persisted (no shared hardcoded user).
 * To switch users use Settings > Switch User or setActiveRealUserId(newId).
 */
function getOrCreateUserId(): string {
  if (typeof window === 'undefined') {
    return 'server-side-rendering-placeholder';
  }

  let userId = localStorage.getItem(USER_ID_STORAGE_KEY);

  if (!userId || userId.trim() === '') {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    addKnownUserId(userId);
    console.log('[Auth] Initialized persistent User ID:', userId);
  }

  return userId;
}

/**
 * Explicitly switch the active real-mode userId.
 * Useful for reclaiming orphaned data or dev debugging.
 */
export function setActiveRealUserId(newUserId: string): void {
  if (typeof window === 'undefined') return;
  const id = newUserId.trim();
  if (!id) return;
  localStorage.setItem(USER_ID_STORAGE_KEY, id);
  addKnownUserId(id);
  console.log('[Auth] Switched User ID to:', id);
}

/**
 * Read the current real-mode userId without side-effects.
 */
export function getActiveRealUserId(): string {
  if (typeof window === 'undefined') return 'server-placeholder';
  return localStorage.getItem(USER_ID_STORAGE_KEY) || getOrCreateUserId();
}

/**
 * Active household ID for API scoping. Default "default-household".
 */
export function getActiveHouseholdId(): string {
  if (typeof window === 'undefined') return DEFAULT_HOUSEHOLD_ID;
  return localStorage.getItem(HOUSEHOLD_ID_STORAGE_KEY) || DEFAULT_HOUSEHOLD_ID;
}

export function setActiveHouseholdId(householdId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HOUSEHOLD_ID_STORAGE_KEY, householdId.trim() || DEFAULT_HOUSEHOLD_ID);
  console.log('[Auth] Switched Household ID to:', getActiveHouseholdId());
}

/**
 * Returns the identity headers to send with every API request.
 */
export function getIdentityHeaders(): Record<string, string> {
  return {
    'X-Household-Id': getActiveHouseholdId(),
    'X-User-Id': getActiveUserId(),
  };
}

const KNOWN_USER_IDS_STORAGE_KEY = 'habitflow_known_user_ids';
const MAX_KNOWN_USERS = 10;

/** List of userIds the user has used (for Switch User dropdown). */
export function getKnownUserIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KNOWN_USER_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Add a userId to the known list (e.g. after creating or switching to it). */
export function addKnownUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  const id = userId.trim();
  if (!id) return;
  const known = getKnownUserIds();
  const next = [id, ...known.filter((x) => x !== id)].slice(0, MAX_KNOWN_USERS);
  localStorage.setItem(KNOWN_USER_IDS_STORAGE_KEY, JSON.stringify(next));
}

export function getActiveUserMode(): ActiveUserMode {
  if (typeof window === 'undefined') return 'real';
  const raw = localStorage.getItem(ACTIVE_USER_MODE_STORAGE_KEY);
  return raw === 'demo' ? 'demo' : 'real';
}

export function setActiveUserMode(mode: ActiveUserMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_USER_MODE_STORAGE_KEY, mode);
}

/**
 * Single canonical place to determine the effective userId for all API calls.
 * - demo mode -> DEMO_USER_ID (separate dataset)
 * - real mode -> sticky persistent user id
 */
export function getActiveUserId(): string {
  return getActiveUserMode() === 'demo' ? DEMO_USER_ID : getOrCreateUserId();
}

const FALLBACK_TIMEZONE = 'UTC';

/**
 * Returns a valid IANA timezone for API calls and date formatting.
 * Uses the browser's resolved timezone when valid; otherwise UTC.
 * Never throws — invalid or missing timezone (e.g. garbage in localStorage) is handled.
 */
export function getLocalTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || typeof tz !== 'string' || !tz.trim()) return FALLBACK_TIMEZONE;
    // Validate that the timezone is usable (avoid "invalid timezone" from Intl/API)
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    if (import.meta.env?.DEV) {
      console.warn('[getLocalTimeZone] Invalid or unsupported timezone, using UTC');
    }
    return FALLBACK_TIMEZONE;
  }
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
    // Dev-only safety rail: persona must never leak into HabitEntry data-layer calls.
    warnIfPersonaLeaksIntoHabitEntryRequest({
      endpoint,
      headers: (options.headers as any) || {},
      body: options.body,
    });

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getIdentityHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle auth failure (401) — session expired or missing
      if (response.status === 401) {
        window.dispatchEvent(new Event('habitflow:session-expired'));
        throw new Error('Session expired. Please log in again.');
      }

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

      // Handle conflict (409)
      if (response.status === 409) {
        throw new Error(
          errorData.error?.message ||
          'Category already exists. Choose a different name.'
        );
      }

      // Handle deprecated endpoints (410 Gone)
      if (response.status === 410) {
        throw new Error(
          errorData.error?.message ||
          'This feature has been deprecated'
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
 * Demo (Dev-only) Seed/Reset endpoints
 */
export async function seedDemoEmotionalWellbeing(): Promise<void> {
  await apiRequest('/dev/seedDemoEmotionalWellbeing', { method: 'POST' });
}

export async function resetDemoEmotionalWellbeing(): Promise<void> {
  await apiRequest('/dev/resetDemoEmotionalWellbeing', { method: 'POST' });
}

/**
 * WellbeingEntry (Canonical) Persistence Functions
 */
export async function fetchWellbeingEntries(params: {
  startDayKey: string;
  endDayKey: string;
}): Promise<WellbeingEntry[]> {
  const qs = new URLSearchParams({
    startDayKey: params.startDayKey,
    endDayKey: params.endDayKey,
  }).toString();
  const response = await apiRequest<{ wellbeingEntries: WellbeingEntry[] }>(`/wellbeingEntries?${qs}`);
  return response.wellbeingEntries;
}

export async function upsertWellbeingEntries(params: {
  entries: Array<{
    dayKey: string;
    timeOfDay?: 'morning' | 'evening' | null;
    metricKey: WellbeingMetricKey;
    value: number | string | null;
    source?: 'checkin' | 'import' | 'test';
    timestampUtc?: string;
    timeZone?: string;
  }>;
  defaultTimeZone?: string;
}): Promise<WellbeingEntry[]> {
  const response = await apiRequest<{ wellbeingEntries: WellbeingEntry[] }>('/wellbeingEntries', {
    method: 'POST',
    body: JSON.stringify({
      entries: params.entries,
      defaultTimeZone: params.defaultTimeZone || 'UTC',
    }),
  });
  return response.wellbeingEntries;
}

/**
 * Dashboard Prefs (view-only)
 */
export async function fetchDashboardPrefs(): Promise<DashboardPrefs> {
  const response = await apiRequest<{ dashboardPrefs: DashboardPrefs }>('/dashboardPrefs');
  return response.dashboardPrefs;
}

export async function updateDashboardPrefs(patch: Partial<Pick<DashboardPrefs, 'pinnedRoutineIds' | 'checkinExtraMetricKeys'>>): Promise<DashboardPrefs> {
  const response = await apiRequest<{ dashboardPrefs: DashboardPrefs }>('/dashboardPrefs', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  return response.dashboardPrefs;
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
 * Fetch canonical day summary logs derived directly from HabitEntries.
 *
 * GET /api/daySummary?startDayKey=...&endDayKey=...&timeZone=...
 */
export async function fetchDaySummary(
  startDayKey: string,
  endDayKey: string,
  timeZone: string
): Promise<Record<string, DayLog>> {
  const params = new URLSearchParams({
    startDayKey,
    endDayKey,
    timeZone,
  });
  const response = await apiRequest<{ logs: Record<string, DayLog> }>(`/daySummary?${params.toString()}`);
  return response.logs;
}

// DayLog write functions removed:
// - saveDayLog() - REMOVED: DayLogs are derived caches and must not be written directly.
//   Use createHabitEntry() or upsertHabitEntry() instead.
// - deleteDayLog() - REMOVED: DayLogs are derived caches and must not be deleted directly.
//   Use deleteHabitEntryByKey() or clearHabitEntriesForDay() instead.
// 
// DayLogs will be automatically recomputed after HabitEntry mutations.

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
/**
 * Upload a routine-level image.
 * 
 * @param routineId - ID of the routine to upload image for
 * @param file - Image file to upload
 * @returns Promise<{ imageId: string, imageUrl: string }> - Upload result with image ID and URL
 * @throws Error if upload fails (network error, invalid file type, file too large, etc.)
 */
export async function uploadRoutineImage(
  routineId: string,
  file: File
): Promise<{ imageId: string; imageUrl: string }> {
  const url = `${API_BASE_URL}/routines/${routineId}/image`;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getIdentityHeaders(),
        // Content-Type is left undefined so browser sets it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `Upload failed: ${response.status} ${response.statusText}`;
      
      // Provide specific error messages for common cases
      if (response.status === 400) {
        if (errorMessage.includes('Invalid image type')) {
          throw new Error('Invalid image type. Only JPEG, PNG, and WebP images are allowed.');
        }
        if (errorMessage.includes('file size') || errorMessage.includes('5MB')) {
          throw new Error('Image file size exceeds 5MB limit.');
        }
        throw new Error(errorMessage);
      }
      
      if (response.status === 404) {
        throw new Error('Routine not found.');
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return {
      imageId: data.imageId,
      imageUrl: data.imageUrl,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw with the error message
      throw error;
    }
    // Network errors or other unexpected errors
    console.error('Error uploading routine image:', error);
    throw new Error('Network error. Please check your connection and try again.');
  }
}

/**
 * Delete a routine's image.
 * DELETE /api/routines/:id/image
 */
export async function deleteRoutineImage(routineId: string): Promise<void> {
  await apiRequest<{ message?: string }>(`/routines/${routineId}/image`, {
    method: 'DELETE',
  });
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
    variantId?: string;
    startedAt?: string;
    stepResults?: Record<string, string>;
    stepTrackingData?: Record<string, Record<string, string | number>>;
    stepTimingData?: Record<string, number>;
  }
): Promise<SubmitRoutineResponse> {

  const response = await apiRequest<SubmitRoutineResponse>(`/routines/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response;
}

/** Response from POST /api/entries/batch */
export interface BatchCreateEntriesResponse {
  created: number;
  updated: number;
  results: Array<{ habitId: string; dayKey: string; id: string }>;
}

/**
 * Batch create habit entries (e.g. routine-confirmed habits).
 * POST /api/entries/batch
 * Uses canonical dayKey; timezone optional (server fallback America/New_York).
 */
export async function batchCreateEntries(payload: {
  habitIds: string[];
  routineId?: string;
  timezone?: string;
  dayKey?: string;
}): Promise<BatchCreateEntriesResponse> {
  const { habitIds, routineId, timezone, dayKey } = payload;
  const body: { timezone?: string; dayKey?: string; entries: Array<{ habitId: string; source: 'routine'; routineId?: string }> } = {
    entries: habitIds.map((habitId) => ({
      habitId,
      source: 'routine' as const,
      ...(routineId ? { routineId } : {}),
    })),
  };
  if (timezone != null) body.timezone = timezone;
  if (dayKey != null) body.dayKey = dayKey;

  const response = await apiRequest<BatchCreateEntriesResponse>('/entries/batch', {
    method: 'POST',
    body: JSON.stringify(body),
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
 * Request AI-generated variant suggestions for a routine.
 * POST /api/ai/suggest-variants
 */
export async function suggestVariants(params: {
  routineId?: string;
  routineTitle: string;
  categoryId?: string;
  existingSteps: Array<{ title: string; instruction?: string; timerSeconds?: number }>;
  variantCount?: number;
  geminiApiKey: string;
}): Promise<{ suggestedVariants: import('../models/persistenceTypes').RoutineVariant[] }> {
  const response = await apiRequest<{ suggestedVariants: import('../models/persistenceTypes').RoutineVariant[] }>('/ai/suggest-variants', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return response;
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

  // Targeted invalidation: only this goal's detail + list caches
  invalidateGoalCaches(id);

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
 * Mark a goal as completed AND create an iterated follow-up goal with a higher target.
 * Used when the user explicitly chooses "Level Up" after completion.
 *
 * @param id - Goal ID
 * @returns Promise with the updated goal and the new iterated goal
 */
export async function iterateGoal(id: string): Promise<{ goal: Goal; iteratedGoal: Goal | null }> {
  const now = new Date().toISOString();
  const response = await apiRequest<{ goal: Goal; iteratedGoal: Goal | null }>(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ completedAt: now, iterate: true }),
  });
  // Iterate creates a new goal too, so clear all caches
  invalidateGoalDataCache();
  return response;
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

  // Targeted invalidation: this goal's detail + list caches
  invalidateGoalCaches(id);
}

/**
 * Reorder goals.
 * 
 * @param goalIds - Array of goal IDs in new order
 * @returns Promise<void>
 * @throws Error if API request fails
 */
export async function reorderGoals(goalIds: string[]): Promise<void> {
  await apiRequest<{ message: string }>('/goals/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ goalIds }),
  });

  // Invalidate cache after successful reorder
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
  const timeZone = getLocalTimeZone();
  const response = await apiRequest<ProgressOverview>(`/progress/overview?timeZone=${encodeURIComponent(timeZone)}`);
  return response;
}

/**
 * Fetch goal detail with progress and history.
 *
 * GET /api/goals/:id/detail
 *
 * @param goalId - Goal ID to fetch
 * @returns Promise<GoalDetail> - Goal with progress and history
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
 * @returns Promise<CompletedGoal[]> - Array of completed goals
 */
export async function fetchCompletedGoals(): Promise<CompletedGoal[]> {
  const response = await apiRequest<Array<{ goal: Goal }>>('/goals/completed');
  return response.map(item => item.goal);
}

/**
 * Habit Entry (History) Persistence Functions
 */

/**
 * Fetch entries for a habit (via truthQuery).
 * 
 * @param habitId - Habit ID
 * @param startDayKey - Optional start DayKey (YYYY-MM-DD)
 * @param endDayKey - Optional end DayKey (YYYY-MM-DD)
 * @param timeZone - User's timezone (defaults to UTC)
 * @returns Promise<EntryView[]> - EntryViews from truthQuery (unified HabitEntries + legacy DayLogs)
 */
export async function fetchHabitEntries(
  habitId: string,
  startDayKey?: string,
  endDayKey?: string,
  timeZone: string = getLocalTimeZone()
): Promise<any[]> {
  const params = new URLSearchParams({
    habitId,
    timeZone,
  });
  if (startDayKey) params.append('startDayKey', startDayKey);
  if (endDayKey) params.append('endDayKey', endDayKey);

  const response = await apiRequest<{ entries: any[] }>(`/entries?${params.toString()}`);
  return response.entries;
}

/**
 * Fetch day view for a specific dayKey (via truthQuery).
 * 
 * @param dayKey - DayKey in YYYY-MM-DD format
 * @param timeZone - User's timezone (defaults to UTC)
 * @returns Promise<DayViewResponse> - Day view with habit completion/progress derived from EntryViews
 */
export async function fetchDayView(dayKey: string, timeZone: string = getLocalTimeZone()): Promise<any> {
  const params = new URLSearchParams({
    dayKey,
    timeZone,
  });
  const response = await apiRequest<any>(`/dayView?${params.toString()}`);
  return response;
}

/**
 * Fetch goal progress (via truthQuery).
 * 
 * @param goalId - Goal ID
 * @param timeZone - User's timezone (defaults to UTC)
 * @returns Promise<GoalProgress> - Goal progress computed from EntryViews
 */
export async function fetchGoalProgress(goalId: string, timeZone: string = getLocalTimeZone()): Promise<any> {
  const params = new URLSearchParams({
    timeZone,
  });
  const response = await apiRequest<{ progress: any }>(`/goals/${goalId}/progress?${params.toString()}`);
  return response.progress;
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
 * Upsert a habit entry (Idempotent).
 * 
 * @param habitId - Habit ID
 * @param dateKey - Date Key (YYYY-MM-DD)
 * @param data - Entry data (value, optionKey, etc.)
 */
export async function upsertHabitEntry(habitId: string, dateKey: string, data: any = {}): Promise<{ entry: HabitEntry, dayLog: DayLog | null }> {
  const safe = buildHabitEntryUpsertPayload(typeof data === 'object' && data !== null ? data : {});
  const response = await apiRequest<{ entry: HabitEntry, dayLog: DayLog | null }>('/entries', {
    method: 'PUT',
    body: JSON.stringify({ habitId, dateKey, ...safe }),
  });
  return response;
}

/**
 * Delete a habit entry by key (habitId + date).
 * 
 * @param habitId - Habit ID
 * @param dateKey - Date Key
 */
export async function deleteHabitEntryByKey(habitId: string, dateKey: string): Promise<{ dayLog: DayLog | null }> {
  // [DEBUG_ENTRY_DELETE] Log API call
  const DEBUG_ENTRY_DELETE = false; // Set to true for debugging
  if (DEBUG_ENTRY_DELETE) {
    console.log('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKey API call:', {
      url: `/entries/key?habitId=${habitId}&dateKey=${dateKey}`,
      method: 'DELETE',
      habitId,
      dateKey
    });
  }
  try {
    // Fix: Use query parameters to match server route expectation
    const response = await apiRequest<{ dayLog: DayLog | null }>(`/entries/key?habitId=${encodeURIComponent(habitId)}&dateKey=${encodeURIComponent(dateKey)}`, {
      method: 'DELETE',
    });
    if (DEBUG_ENTRY_DELETE) {
      console.log('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKey API response received:', {
        success: true,
        dayLog: response.dayLog ? 'exists' : 'null',
        dayLogDetails: response.dayLog
      });
    }
    return response;
  } catch (error) {
    // 404 means no active entry exists — treat as successful deletion
    // (entry was already deleted or never created, e.g. race condition / double-click)
    if (error instanceof Error && (error.message.includes('No active entry found') || error.message === 'Resource not found')) {
      if (DEBUG_ENTRY_DELETE) {
        console.log('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKey: no active entry (already deleted), treating as success');
      }
      return { dayLog: null };
    }
    if (DEBUG_ENTRY_DELETE) {
      console.error('[DEBUG_ENTRY_DELETE] deleteHabitEntryByKey API call failed:', error);
    }
    throw error;
  }
}


/**
 * Skill Tree Persistence Functions
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
 * Record that a routine step was reached (creates potential evidence when step is linked to a habit).
 * POST /api/evidence/step-reached
 */
export async function recordRoutineStepReached(routineId: string, stepId: string, date: string, variantId?: string): Promise<void> {
  await apiRequest<{ data?: unknown }>('/evidence/step-reached', {
    method: 'POST',
    body: JSON.stringify({ routineId, stepId, date, ...(variantId ? { variantId } : {}) }),
  });
}

/**
 * Tasks API (all requests send X-User-Id via shared client).
 */
export async function fetchTasks(): Promise<Task[]> {
  const response = await apiRequest<{ tasks: Task[] }>('/tasks');
  return response.tasks ?? [];
}

export async function createTask(req: CreateTaskRequest): Promise<Task> {
  const response = await apiRequest<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return response.task;
}

export async function updateTask(id: string, req: UpdateTaskRequest): Promise<Task> {
  const response = await apiRequest<{ task: Task }>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(req),
  });
  return response.task;
}

export async function deleteTask(id: string): Promise<void> {
  await apiRequest(`/tasks/${id}`, { method: 'DELETE' });
}

/**
 * Household user registry (Switch User list/create).
 */
export async function fetchHouseholdUsers(): Promise<HouseholdUser[]> {
  const response = await apiRequest<{ users: HouseholdUser[] }>('/household/users');
  return response.users ?? [];
}

export async function createHouseholdUser(options: { displayName?: string } = {}): Promise<HouseholdUser> {
  const response = await apiRequest<{ user: HouseholdUser }>('/household/users', {
    method: 'POST',
    body: JSON.stringify({ displayName: options.displayName }),
  });
  return response.user;
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

/**
 * Permanently delete all user data (habits, entries, categories, goals, tasks, etc.).
 * The user account itself is preserved.
 */
export async function deleteAllUserData(): Promise<{ deleted: Record<string, number> }> {
  return apiRequest<{ deleted: Record<string, number> }>('/user/data', {
    method: 'DELETE',
  });
}

// ─── Bundle Membership API ──────────────────────────────────────────────

export interface BundleMembershipResponse {
  id: string;
  parentHabitId: string;
  childHabitId: string;
  activeFromDayKey: string;
  activeToDayKey?: string | null;
  daysOfWeek?: number[] | null;
  graduatedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getBundleMemberships(parentHabitId: string): Promise<BundleMembershipResponse[]> {
  return apiRequest<BundleMembershipResponse[]>(`/bundle-memberships?parentHabitId=${parentHabitId}`);
}

export async function createBundleMembership(data: {
  parentHabitId: string;
  childHabitId: string;
  activeFromDayKey: string;
  daysOfWeek?: number[] | null;
}): Promise<BundleMembershipResponse> {
  return apiRequest<BundleMembershipResponse>('/bundle-memberships', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function endBundleMembership(membershipId: string, activeToDayKey: string): Promise<BundleMembershipResponse> {
  return apiRequest<BundleMembershipResponse>(`/bundle-memberships/${membershipId}/end`, {
    method: 'PATCH',
    body: JSON.stringify({ activeToDayKey }),
  });
}
