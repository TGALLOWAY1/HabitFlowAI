/**
 * Activity Utility Functions
 * 
 * Helper functions for working with Activity entities.
 */

import type { Activity } from '../types';

/**
 * Count the number of habit steps in an activity.
 * 
 * @param activity - Activity to count habit steps in (can be null/undefined)
 * @returns Number of steps with type === 'habit'
 */
export function countHabitSteps(activity?: Activity | null): number {
  const steps = activity?.steps ?? [];
  return steps.filter(step => step.type === 'habit').length;
}

/**
 * Count the number of task steps in an activity.
 * 
 * @param activity - Activity to count task steps in (can be null/undefined)
 * @returns Number of steps with type === 'task'
 */
export function countTaskSteps(activity?: Activity | null): number {
  const steps = activity?.steps ?? [];
  return steps.filter(step => step.type === 'task').length;
}
