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

import type { GoalWithProgress, GoalTrack } from '../models/persistenceTypes';
import type { GoalDetail, CompletedGoal, ProgressOverview, GoalTrackWithGoals } from '../types';

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

// Event-based cache invalidation listeners (replaces 100ms polling)
type CacheListener = () => void;
const listeners = new Set<CacheListener>();

/**
 * Subscribe to cache invalidation events.
 * Returns an unsubscribe function.
 */
export function subscribeToCacheInvalidation(listener: CacheListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Check if a specific cache key has fresh (non-expired) data.
 * Use this to skip redundant background refetches when cached data is still within TTL.
 */
function isCacheFresh(key: string): boolean {
    const entry = cache.get(key);
    if (!entry) return false;
    return (Date.now() - entry.timestamp) < CACHE_TTL;
}

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
    // Notify all subscribed hooks
    listeners.forEach(listener => listener());
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
    // Invalidate completed goals cache (goal may have been completed or deleted)
    invalidateCache('completed-goals');
    cacheVersion++;
    // Notify all subscribed hooks
    listeners.forEach(listener => listener());
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
 * Check if goals-with-progress cache is fresh (within TTL).
 */
export function isGoalsWithProgressFresh(): boolean {
    return isCacheFresh(CACHE_KEY_GOALS_WITH_PROGRESS);
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
 * Check if progress-overview cache is fresh (within TTL).
 */
export function isProgressOverviewFresh(): boolean {
    return isCacheFresh(CACHE_KEY_PROGRESS_OVERVIEW);
}

/**
 * Set cached progress overview.
 * Also cross-populates the goals-with-progress cache to avoid redundant fetches (C5/M10).
 */
export function setCachedProgressOverview(data: ProgressOverview): void {
    setCached(CACHE_KEY_PROGRESS_OVERVIEW, data);
    // Cross-populate: progress overview includes goalsWithProgress data
    if (data.goalsWithProgress) {
        setCached(CACHE_KEY_GOALS_WITH_PROGRESS, data.goalsWithProgress);
    }
}

/**
 * Get cached completed goals, or null if not cached/stale.
 */
export function getCachedCompletedGoals(): CompletedGoal[] | null {
    return getCached<CompletedGoal[]>(CACHE_KEY_COMPLETED_GOALS);
}

/**
 * Check if completed-goals cache is fresh (within TTL).
 */
export function isCompletedGoalsFresh(): boolean {
    return isCacheFresh(CACHE_KEY_COMPLETED_GOALS);
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
 * Check if goal-detail cache is fresh for a specific goal (within TTL).
 */
export function isGoalDetailFresh(goalId: string): boolean {
    return isCacheFresh(getGoalDetailCacheKey(goalId));
}

/**
 * Set cached goal detail.
 */
export function setCachedGoalDetail(goalId: string, data: GoalDetail): void {
    setCached(getGoalDetailCacheKey(goalId), data);
}

// ─── Goal Tracks Cache ──────────────────────────────────

const CACHE_KEY_GOAL_TRACKS = 'goal-tracks';

function getGoalTrackDetailCacheKey(trackId: string): string {
    return `goal-track-detail-${trackId}`;
}

export function getCachedGoalTracks(): GoalTrack[] | null {
    return getCached<GoalTrack[]>(CACHE_KEY_GOAL_TRACKS);
}

export function isGoalTracksFresh(): boolean {
    return isCacheFresh(CACHE_KEY_GOAL_TRACKS);
}

export function setCachedGoalTracks(data: GoalTrack[]): void {
    setCached(CACHE_KEY_GOAL_TRACKS, data);
}

export function getCachedGoalTrackDetail(trackId: string): GoalTrackWithGoals | null {
    return getCached<GoalTrackWithGoals>(getGoalTrackDetailCacheKey(trackId));
}

export function setCachedGoalTrackDetail(trackId: string, data: GoalTrackWithGoals): void {
    setCached(getGoalTrackDetailCacheKey(trackId), data);
}
