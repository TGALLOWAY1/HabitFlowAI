/**
 * Shared Checklist Success Rule Evaluation
 *
 * Single source of truth for evaluating whether a checklist bundle's
 * success rule is met. Used by both frontend (habitAggregation) and
 * backend (dayViewService, progress).
 */

export interface ChecklistSuccessRule {
  type: 'any' | 'threshold' | 'percent' | 'full';
  /** Minimum number of items required (for 'threshold' type) */
  threshold?: number;
  /** Minimum percentage required (for 'percent' type, 0-100) */
  percent?: number;
}

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
