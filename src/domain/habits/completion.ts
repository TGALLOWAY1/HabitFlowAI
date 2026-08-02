import type { Habit } from '../../models/persistenceTypes';
import type { HabitTrackingRevision } from '../../shared/habitTracking';
import { resolveHabitTrackingForDay } from './trackingHistory';

export interface CompletionEntry {
  value?: number | null;
}

export interface HabitCompletionState {
  currentValue: number;
  targetValue: number;
  isComplete: boolean;
  isPartial: boolean;
  hasProgress: boolean;
  progressPercent: number;
}

type HabitWithGoal = Pick<Habit, 'goal'> & { trackingRevisions?: HabitTrackingRevision[] };

/** A numeric habit cannot have a meaningful completion state without a positive target. */
export function hasValidNumericTarget(habit: HabitWithGoal, dayKey?: string): boolean {
  const { goal } = resolveHabitTrackingForDay(habit, dayKey);
  return goal.type === 'number'
    && typeof goal.target === 'number'
    && Number.isFinite(goal.target)
    && goal.target > 0;
}

/** Value used when an interaction explicitly means "complete this habit". */
export function getCompletionEntryValue(habit: HabitWithGoal, dayKey?: string): number | null {
  const { goal } = resolveHabitTrackingForDay(habit, dayKey);
  if (goal.type === 'boolean') return 1;
  return hasValidNumericTarget(habit, dayKey) ? goal.target! : null;
}

function sumNonNegativeFiniteValues(entries: readonly CompletionEntry[]): number {
  return entries.reduce((sum, entry) => {
    const value = entry.value;
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? sum + value
      : sum;
  }, 0);
}

/**
 * Canonical completion rule for one habit on one calendar day.
 *
 * Callers must pass only active, non-freeze entries for that day. Boolean
 * habits complete by entry existence. Numeric habits complete only when their
 * summed value reaches a valid positive target; below-target values are
 * progress, never completion.
 */
export function deriveDailyHabitCompletion(
  habit: HabitWithGoal,
  entries: readonly CompletionEntry[],
  dayKey?: string,
): HabitCompletionState {
  const { goal } = resolveHabitTrackingForDay(habit, dayKey);

  if (goal.type === 'boolean') {
    const isComplete = entries.length > 0;
    return {
      currentValue: isComplete ? 1 : 0,
      targetValue: 1,
      isComplete,
      isPartial: false,
      hasProgress: isComplete,
      progressPercent: isComplete ? 100 : 0,
    };
  }

  const currentValue = sumNonNegativeFiniteValues(entries);
  const targetValue = hasValidNumericTarget(habit, dayKey) ? goal.target! : 0;
  const isComplete = targetValue > 0 && currentValue >= targetValue;
  const hasProgress = currentValue > 0;

  return {
    currentValue,
    targetValue,
    isComplete,
    isPartial: hasProgress && !isComplete,
    hasProgress,
    progressPercent: targetValue > 0
      ? Math.min(100, Math.round((currentValue / targetValue) * 100))
      : 0,
  };
}
