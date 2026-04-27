import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';

/**
 * Goal Completion Context
 *
 * Holds the id of the goal whose celebration screen should be shown next.
 * Sits above HabitProvider so HabitContext can dispatch into it when a server-side
 * entry mutation reports a newly-completed goal, and below the consumer
 * (HabitTrackerContent) which renders the GoalCompletedPage.
 */
interface GoalCompletionContextValue {
    completedGoalId: string | null;
    setCompletedGoalId: (id: string | null) => void;
}

const GoalCompletionContext = createContext<GoalCompletionContextValue | undefined>(undefined);

export const GoalCompletionProvider = ({ children }: { children: ReactNode }) => {
    const [completedGoalId, setCompletedGoalIdState] = useState<string | null>(null);
    const setCompletedGoalId = useCallback((id: string | null) => {
        setCompletedGoalIdState(id);
    }, []);
    const value = useMemo(() => ({ completedGoalId, setCompletedGoalId }), [completedGoalId, setCompletedGoalId]);
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
