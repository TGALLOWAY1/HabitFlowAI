/**
 * Pre-configured server-side cache instances.
 * Each cache targets a specific high-traffic read path.
 * Invalidation is called from write routes via invalidateUserCaches().
 */

import { TTLCache } from './cache.js';

/** Progress overview responses — 30s TTL. Key: `${userId}:${dayKey}` */
export const progressCache = new TTLCache<unknown>(30_000);

/** Consolidated analytics responses — 60s TTL. Key: `${userId}:${days}:${heatmapDays}` */
export const analyticsCache = new TTLCache<unknown>(60_000);

/**
 * Invalidate all cached data for a user across all route caches.
 * Called from write routes (habitEntries, habits, goals, bundleMemberships).
 */
export function invalidateUserCaches(userId: string): void {
  progressCache.invalidateByPrefix(`${userId}:`);
  analyticsCache.invalidateByPrefix(`${userId}:`);
}
