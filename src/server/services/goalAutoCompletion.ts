/**
 * Goal Auto-Completion Service
 *
 * When a habit entry is created, updated, or deleted, the stored `completedAt`
 * flag of every linked cumulative goal must be reconciled against the entry
 * truth. Entries are the single source of truth, so this service keeps the
 * stored completion in sync in BOTH directions:
 *
 *   - incomplete -> complete when derived progress reaches 100%
 *   - complete -> incomplete when a later edit/delete drops derived progress
 *     back below 100% (e.g. a fat-fingered "105" corrected to "15")
 *
 * Without the reverse direction a stale "completed" goal survives a correction,
 * which violates the source-of-truth rule: the progress bar would read 15% while
 * the goal still claims it was achieved and lingers in the Win Archive.
 *
 * Returns the IDs of goals that were newly marked complete by the call. Callers
 * surface this list to the client so the UI can pop the celebration page.
 * Un-completions are not surfaced (there is nothing to celebrate); the routes
 * invalidate caches after the call, so the reopened state is read on next fetch.
 */

import { getGoalsByUser, updateGoal } from '../repositories/goalRepository';
import { computeGoalProgressV2 } from '../utils/goalProgressUtilsV2';

/**
 * Reconcile the `completedAt` flag of cumulative goals linked to the given habit
 * IDs against current entry-derived progress. Returns IDs of goals that
 * transitioned to completed during this call (for the celebration UI).
 */
export async function checkAndCompleteLinkedGoals(
    habitIds: string[],
    householdId: string,
    userId: string,
    timeZone: string
): Promise<string[]> {
    if (habitIds.length === 0) return [];

    const habitIdSet = new Set(habitIds);
    const goals = await getGoalsByUser(householdId, userId);

    // All cumulative goals linked to any touched habit — regardless of current
    // completion state, since we may need to either complete OR reopen them.
    const candidates = goals.filter(g =>
        g.type === 'cumulative' &&
        Array.isArray(g.linkedHabitIds) &&
        g.linkedHabitIds.some(id => habitIdSet.has(id))
    );

    if (candidates.length === 0) return [];

    const completed: string[] = [];

    for (const goal of candidates) {
        try {
            const progress = await computeGoalProgressV2(goal.id, householdId, userId, timeZone);
            if (!progress) continue;
            const reachedTarget = progress.percent >= 100;

            if (reachedTarget && !goal.completedAt) {
                const updated = await updateGoal(goal.id, householdId, userId, {
                    completedAt: new Date().toISOString(),
                });
                if (updated) completed.push(goal.id);
            } else if (!reachedTarget && goal.completedAt && !goal.trackId) {
                // Source-of-truth reconciliation: the entries no longer meet the
                // target, so the stored completion is stale — clear it and let the
                // goal return to its active state.
                //
                // Tracked goals are deliberately excluded: their completion is
                // bound to the track state machine (window close + advanceTrack),
                // so reversing it here would desync the track. Reopening those is
                // out of scope for entry-driven reconciliation.
                await updateGoal(goal.id, householdId, userId, { completedAt: null });
            }
        } catch (err) {
            // Per-goal failure must not break entry persistence. Log and continue.
            console.error(`Goal completion reconciliation failed for goal ${goal.id}:`, err);
        }
    }

    return completed;
}
