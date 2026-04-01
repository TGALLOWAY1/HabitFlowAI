/**
 * Health Rule Evaluation Service
 *
 * Pure function that evaluates whether a health metric satisfies a habit health rule.
 * No database calls — takes rule and metric as inputs.
 */

import type { HabitHealthRule, HealthMetricDaily, HealthMetricType } from '../../models/persistenceTypes';

export interface RuleEvaluationResult {
  satisfied: boolean;
  metricValue: number | null;
}

/**
 * Extract the relevant metric value from a HealthMetricDaily based on metric type.
 */
function getMetricValue(metric: HealthMetricDaily, metricType: HealthMetricType): number | null | undefined {
  switch (metricType) {
    case 'steps': return metric.steps;
    case 'sleep_hours': return metric.sleepHours;
    case 'workout_minutes': return metric.workoutMinutes;
    case 'active_calories': return metric.activeCalories;
    case 'weight': return metric.weight;
    default: return undefined;
  }
}

/**
 * Evaluate whether a health metric satisfies a habit health rule.
 *
 * For comparison operators (>=, <=, >, <): returns false if metric value is null/undefined.
 * For 'exists' operator: returns true if metric value is not null/undefined and > 0.
 */
export function evaluateHealthRule(
  rule: HabitHealthRule,
  metric: HealthMetricDaily
): RuleEvaluationResult {
  const raw = getMetricValue(metric, rule.metricType);
  const metricValue = raw ?? null;

  if (rule.operator === 'exists') {
    return {
      satisfied: metricValue != null && metricValue > 0,
      metricValue,
    };
  }

  // Numeric comparison — need both a value and a threshold
  if (metricValue == null || rule.thresholdValue == null) {
    return { satisfied: false, metricValue };
  }

  let satisfied: boolean;
  switch (rule.operator) {
    case '>=': satisfied = metricValue >= rule.thresholdValue; break;
    case '<=': satisfied = metricValue <= rule.thresholdValue; break;
    case '>':  satisfied = metricValue > rule.thresholdValue; break;
    case '<':  satisfied = metricValue < rule.thresholdValue; break;
    default:   satisfied = false;
  }

  return { satisfied, metricValue };
}
