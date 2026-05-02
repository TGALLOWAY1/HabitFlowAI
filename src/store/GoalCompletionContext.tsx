import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * Goal Completion Context
 *
 * Holds the id of the goal whose celebration screen should be shown next, and
 * a queue of pending milestone celebrations. Sits above HabitProvider so
 * HabitContext can dispatch into it when a server-side entry mutation reports
 * a newly-completed goal, and below the consumer (HabitTrackerContent) which
 * renders the celebration UI.
 */
export interface PendingMilestone {
    goalId: string;
    milestoneId: string;
    value: number;
    unit?: string;
    goalTitle: string;
    badgeImageUrl?: string;
}

interface GoalCompletionContextValue {
    completedGoalId: string | null;
    setCompletedGoalId: (id: string | null) => void;

    pendingMilestone: PendingMilestone | null;
    /** Add new pending milestones to the queue. Deduped by milestoneId. */
    enqueuePendingMilestones: (next: PendingMilestone[]) => void;
    /** Pop the head of the queue. */
    dismissPendingMilestone: () => void;
}

const GoalCompletionContext = createContext<GoalCompletionContextValue | undefined>(undefined);

export const GoalCompletionProvider = ({ children }: { children: ReactNode }) => {
    const [completedGoalId, setCompletedGoalIdState] = useState<string | null>(null);
    const setCompletedGoalId = useCallback((id: string | null) => {
        setCompletedGoalIdState(id);
    }, []);

    const [pendingMilestones, setPendingMilestones] = useState<PendingMilestone[]>([]);

    const enqueuePendingMilestones = useCallback((next: PendingMilestone[]) => {
        if (next.length === 0) return;
        setPendingMilestones((current) => {
            const seen = new Set(current.map((m) => m.milestoneId));
            const additions = next.filter((m) => !seen.has(m.milestoneId));
            if (additions.length === 0) return current;
            return [...current, ...additions];
        });
    }, []);

    const dismissPendingMilestone = useCallback(() => {
        setPendingMilestones((current) => current.slice(1));
    }, []);

    const value = useMemo(
        () => ({
            completedGoalId,
            setCompletedGoalId,
            pendingMilestone: pendingMilestones[0] ?? null,
            enqueuePendingMilestones,
            dismissPendingMilestone,
        }),
        [completedGoalId, setCompletedGoalId, pendingMilestones, enqueuePendingMilestones, dismissPendingMilestone],
    );

    return (
        <GoalCompletionContext.Provider value={value}>
            {children}
        </GoalCompletionContext.Provider>
    );
};

export const useGoalCompletion = (): GoalCompletionContextValue => {
    const ctx = useContext(GoalCompletionContext);
    if (!ctx) throw new Error('useGoalCompletion must be used within a GoalCompletionProvider');
    return ctx;
};
