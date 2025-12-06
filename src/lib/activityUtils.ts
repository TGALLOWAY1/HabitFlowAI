/**
 * Activity Utility Functions
 * 
 * Helper functions for working with Activity entities.
 */

import type { Activity } from '../types';

/**
 * Count the number of habit steps in an activity.
 * 
 * @param activity - Activity to count habit steps in
 * @returns Number of steps with type === 'habit'
 */
export function countHabitSteps(activity: Activity): number {
  return activity.steps.filter(step => step.type === 'habit').length;
}
