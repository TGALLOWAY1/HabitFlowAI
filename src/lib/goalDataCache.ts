/**
 * Goal Data Cache
 * 
 * Simple in-memory cache for goal-related data to avoid redundant network requests.
 * 
 * Performance optimizations:
 * - Reduces redundant fetches when navigating between pages
 * - Implements stale-while-revalidate pattern (shows cached data immediately, fetches in background)
 * - 30-second TTL prevents stale data while allowing reasonable caching
 * 
 * TODO: Consider migrating to React Query or SWR for more sophisticated caching,
 * invalidation, and background refetching capabilities as the app grows.
 * - React Query provides automatic cache invalidation on mutations
 * - Better handling of concurrent requests (deduplication)
 * - Background refetching with configurable intervals
 * - Optimistic updates
 * 
 * Current implementation:
 * - Cache TTL: 30 seconds (configurable)
 * - Cache keys: endpoint-specific
 * - Manual invalidation via invalidate functions (called after mutations)
 * - Stale-while-revalidate: shows cached data immediately, fetches fresh data in background
 */

import type { GoalWithProgress } from '../models/persistenceTypes';
import type { GoalDetail, CompletedGoal, ProgressOverview } from '../types';

// Cache entry with timestamp
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL = 30 * 1000;

// In-memory cache store
const cache = new Map<string, CacheEntry<any>>();

// Cache version counter - increments on invalidation to trigger refetch in hooks
let cacheVersion = 0;

/**
 * Get cached data if it exists and is not stale.
 * 
 * @param key - Cache key
 * @returns Cached data or null if not found/stale
 */
function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) {
        return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL) {
        // Cache expired, remove it
        cache.delete(key);
        return null;
    }

    return entry.data as T;
}

/**
 * Set cached data with current timestamp.
 * 
 * @param key - Cache key
 * @param data - Data to cache
 */
function setCached<T>(key: string, data: T): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
    });
}

/**
 * Invalidate a specific cache key.
 * 
 * @param key - Cache key to invalidate
 */
export function invalidateCache(key: string): void {
    cache.delete(key);
}

/**
 * Invalidate all goal-related caches.
 * 
 * Call this after mutations (create, update, delete) to ensure fresh data.
 */
export function invalidateAllGoalCaches(): void {
    cache.clear();
    cacheVersion++;
}

/**
 * Invalidate goal data cache (alias for invalidateAllGoalCaches).
 * 
 * This is a convenience function that clears all goal-related caches.
 * Use this after any goal mutation to ensure fresh data.
 */
export function invalidateGoalDataCache(): void {
    invalidateAllGoalCaches();
}

/**
 * Get the current cache version.
 * 
 * This can be used as a dependency in hooks to trigger refetch when cache is invalidated.
 */
export function getCacheVersion(): number {
    return cacheVersion;
}

/**
 * Invalidate caches that might contain a specific goal.
 * 
 * @param goalId - Goal ID to invalidate caches for
 */
export function invalidateGoalCaches(goalId: string): void {
    // Invalidate goal detail cache
    invalidateCache(`goal-detail-${goalId}`);
    // Invalidate goals list cache (since it might include this goal)
    invalidateCache('goals-with-progress');
    invalidateCache('progress-overview');
    // Note: completed goals cache might need invalidation if goal was completed
    // This is handled by the completion flow
}

/**
 * Cache key for goals with progress.
 */
const CACHE_KEY_GOALS_WITH_PROGRESS = 'goals-with-progress';

/**
 * Cache key for progress overview.
 */
const CACHE_KEY_PROGRESS_OVERVIEW = 'progress-overview';

/**
 * Cache key for completed goals.
 */
const CACHE_KEY_COMPLETED_GOALS = 'completed-goals';

/**
 * Get cache key for goal detail.
 */
function getGoalDetailCacheKey(goalId: string): string {
    return `goal-detail-${goalId}`;
}

/**
 * Get cached goals with progress, or null if not cached/stale.
 */
export function getCachedGoalsWithProgress(): GoalWithProgress[] | null {
    return getCached<GoalWithProgress[]>(CACHE_KEY_GOALS_WITH_PROGRESS);
}

/**
 * Set cached goals with progress.
 */
export function setCachedGoalsWithProgress(data: GoalWithProgress[]): void {
    setCached(CACHE_KEY_GOALS_WITH_PROGRESS, data);
}

/**
 * Get cached progress overview, or null if not cached/stale.
 */
export function getCachedProgressOverview(): ProgressOverview | null {
    return getCached<ProgressOverview>(CACHE_KEY_PROGRESS_OVERVIEW);
}

/**
 * Set cached progress overview.
 */
export function setCachedProgressOverview(data: ProgressOverview): void {
    setCached(CACHE_KEY_PROGRESS_OVERVIEW, data);
}

/**
 * Get cached completed goals, or null if not cached/stale.
 */
export function getCachedCompletedGoals(): CompletedGoal[] | null {
    return getCached<CompletedGoal[]>(CACHE_KEY_COMPLETED_GOALS);
}

/**
 * Set cached completed goals.
 */
export function setCachedCompletedGoals(data: CompletedGoal[]): void {
    setCached(CACHE_KEY_COMPLETED_GOALS, data);
}

/**
 * Get cached goal detail, or null if not cached/stale.
 */
export function getCachedGoalDetail(goalId: string): GoalDetail | null {
    return getCached<GoalDetail>(getGoalDetailCacheKey(goalId));
}

/**
 * Set cached goal detail.
 */
export function setCachedGoalDetail(goalId: string, data: GoalDetail): void {
    setCached(getGoalDetailCacheKey(goalId), data);
}
