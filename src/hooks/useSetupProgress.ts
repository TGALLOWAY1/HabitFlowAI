import { useMemo } from 'react';
import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useTasks } from '../context/TaskContext';

export type SetupPhase = 'zero' | 'early' | 'mature';

export interface SetupProgress {
  hasHabits: boolean;
  hasRoutines: boolean;
  hasTasks: boolean;
  hasEntries: boolean;
  setupPhase: SetupPhase;
  loading: boolean;
}

/**
 * Derives setup completeness from existing context data.
 * Used for dashboard progression and conditional UI.
 */
export function useSetupProgress(goalsCount: number = 0): SetupProgress {
  const { habits, logs, loading: habitsLoading } = useHabitStore();
  const { routines, loading: routinesLoading } = useRoutineStore();
  const { tasks, loading: tasksLoading } = useTasks();

  return useMemo(() => {
    const loading = habitsLoading || routinesLoading || tasksLoading;
    const hasHabits = habits.filter(h => !h.archived).length > 0;
    const hasRoutines = routines.length > 0;
    const hasTasks = tasks.filter(t => t.status !== 'deleted').length > 0;
    const hasEntries = Object.keys(logs).length > 0;

    let setupPhase: SetupPhase;

    if (!hasHabits && goalsCount === 0) {
      setupPhase = 'zero';
    } else if (
      habits.filter(h => !h.archived).length >= 3 ||
      goalsCount >= 2 ||
      hasRoutines
    ) {
      setupPhase = 'mature';
    } else {
      setupPhase = 'early';
    }

    return { hasHabits, hasRoutines, hasTasks, hasEntries, setupPhase, loading };
  }, [habits, routines, tasks, logs, goalsCount, habitsLoading, routinesLoading, tasksLoading]);
}
