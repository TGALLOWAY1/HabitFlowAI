/**
 * Goal Auto-Completion Service
 *
 * When a habit entry is created or updated, any cumulative goal whose progress
 * has crossed 100% should be marked complete automatically. This service
 * encapsulates that check so all entry-mutation routes share one implementation.
 *
 * Returns the IDs of goals that were newly marked complete by the call. Callers
 * surface this list to the client so the UI can pop the celebration page.
 */

import { getGoalsByUser, updateGoal } from '../repositories/goalRepository';
import { computeGoalProgressV2 } from '../utils/goalProgressUtilsV2';

/**
 * Check goals linked to the given habit IDs and mark any that have reached 100%
 * as complete. Returns IDs of goals that transitioned to completed during this call.
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

    // Active cumulative goals linked to any of the touched habits.
    const candidates = goals.filter(g =>
        !g.completedAt &&
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
            if (progress.percent >= 100) {
                const updated = await updateGoal(goal.id, householdId, userId, {
                    completedAt: new Date().toISOString(),
                });
                if (updated) completed.push(goal.id);
            }
        } catch (err) {
            // Per-goal failure must not break entry persistence. Log and continue.
            console.error(`Auto-completion check failed for goal ${goal.id}:`, err);
        }
    }

    return completed;
}
