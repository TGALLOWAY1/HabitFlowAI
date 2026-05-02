import { useEffect } from 'react';
import { useGoalsWithProgress } from './useGoalsWithProgress';
import { useGoalCompletion, type PendingMilestone } from '../store/GoalCompletionContext';

/**
 * Watches goals-with-progress for milestones that have been crossed but never
 * acknowledged, and enqueues them as celebrations. The context dedupes by
 * milestoneId so re-fetches before the server-side acknowledgedAt arrives don't
 * re-trigger.
 */
export function useMilestoneCelebrationWatcher(): void {
    const { data: goalsWithProgress } = useGoalsWithProgress();
    const { enqueuePendingMilestones } = useGoalCompletion();

    useEffect(() => {
        if (!goalsWithProgress || goalsWithProgress.length === 0) return;

        const pending: PendingMilestone[] = [];
        for (const { goal, progress } of goalsWithProgress) {
            const states = progress.milestoneStates;
            if (!states || states.length === 0) continue;
            const milestonesById = new Map((goal.milestones ?? []).map((m) => [m.id, m]));
            for (const state of states) {
                if (!state.completed) continue;
                if (state.acknowledgedAt) continue;
                if (milestonesById.get(state.id)?.acknowledgedAt) continue;
                pending.push({
                    goalId: goal.id,
                    milestoneId: state.id,
                    value: state.value,
                    unit: goal.unit,
                    goalTitle: goal.title,
                    badgeImageUrl: goal.badgeImageUrl,
                });
            }
        }

        if (pending.length > 0) {
            enqueuePendingMilestones(pending);
        }
    }, [goalsWithProgress, enqueuePendingMilestones]);
}
