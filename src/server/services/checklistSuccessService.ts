/**
 * Checklist Success Service
 *
 * Evaluates whether a checklist bundle meets its success rule on a given day.
 * Used by dayViewService and progress.ts to determine bundle completion.
 */

import type { ChecklistSuccessRule } from '../domain/canonicalTypes';

/**
 * Evaluate whether a checklist bundle's success rule is met.
 *
 * @param completedCount - Number of checklist items completed
 * @param totalCount - Total number of scheduled checklist items
 * @param rule - The success rule to evaluate (default: 'full')
 * @returns meetsSuccessRule and isFullyComplete
 */
export function evaluateChecklistSuccess(
  completedCount: number,
  totalCount: number,
  rule?: ChecklistSuccessRule | null
): { meetsSuccessRule: boolean; isFullyComplete: boolean } {
  const isFullyComplete = totalCount > 0 && completedCount === totalCount;

  if (totalCount === 0) {
    return { meetsSuccessRule: false, isFullyComplete: false };
  }

  // Default to 'full' if no rule specified
  const type = rule?.type ?? 'full';

  let meetsSuccessRule: boolean;
  switch (type) {
    case 'any':
      meetsSuccessRule = completedCount >= 1;
      break;
    case 'threshold':
      meetsSuccessRule = completedCount >= (rule?.threshold ?? totalCount);
      break;
    case 'percent':
      meetsSuccessRule = (completedCount / totalCount) * 100 >= (rule?.percent ?? 100);
      break;
    case 'full':
    default:
      meetsSuccessRule = isFullyComplete;
      break;
  }

  return { meetsSuccessRule, isFullyComplete };
}
