/**
 * Health Backfill Service
 *
 * Evaluates health metrics against a habit health rule for a date range,
 * creating HabitEntries for qualifying days that don't already have entries.
 *
 * Key invariants:
 * - NEVER overwrites existing HabitEntries
 * - Idempotent (running twice produces no additional entries)
 * - DayKey is the aggregation boundary
 */

import type { HabitHealthRule, Habit } from '../../models/persistenceTypes';
import { evaluateHealthRule } from './healthRuleEvaluationService';
import { getHealthMetricsForRange } from '../repositories/healthMetricDailyRepository';
import { getHabitEntriesForDay } from '../repositories/habitEntryRepository';
import { upsertHabitEntry } from '../repositories/habitEntryRepository';

export interface BackfillResult {
  created: number;
  skipped: number;
  evaluated: number;
}

/**
 * Generate all dayKeys in a range (inclusive).
 */
function generateDayKeyRange(startDayKey: string, endDayKey: string): string[] {
  const dayKeys: string[] = [];
  const current = new Date(startDayKey + 'T00:00:00Z');
  const end = new Date(endDayKey + 'T00:00:00Z');

  while (current <= end) {
    dayKeys.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dayKeys;
}

/**
 * Determine the entry value based on habit type and metric value.
 * Boolean habits get value=1, numeric habits get the metric value.
 */
function resolveEntryValue(habit: Habit, metricValue: number | null): number {
  if (habit.goal?.type === 'number' && metricValue != null) {
    return metricValue;
  }
  return 1;
}

/**
 * Run backfill for a habit based on its health rule and available metrics.
 *
 * For each day in [startDayKey, endDayKey]:
 * 1. Look up HealthMetricDaily
 * 2. Evaluate rule
 * 3. If satisfied AND no existing entry -> create HabitEntry
 * 4. If existing entry -> skip (NEVER overwrite)
 */
export async function runBackfill(
  habit: Habit,
  rule: HabitHealthRule,
  startDayKey: string,
  endDayKey: string,
  householdId: string,
  userId: string
): Promise<BackfillResult> {
  const result: BackfillResult = { created: 0, skipped: 0, evaluated: 0 };

  // Fetch all metrics for the range at once (efficient batch query)
  const metrics = await getHealthMetricsForRange(
    startDayKey, endDayKey, rule.sourceType, householdId, userId
  );
  const metricsByDay = new Map(metrics.map(m => [m.dayKey, m]));

  const dayKeys = generateDayKeyRange(startDayKey, endDayKey);

  for (const dayKey of dayKeys) {
    result.evaluated++;

    const metric = metricsByDay.get(dayKey);
    if (!metric) {
      result.skipped++;
      continue;
    }

    const evaluation = evaluateHealthRule(rule, metric);
    if (!evaluation.satisfied) {
      result.skipped++;
      continue;
    }

    // Check if entry already exists (NEVER overwrite)
    const existing = await getHabitEntriesForDay(
      habit.id, dayKey, householdId, userId
    );
    if (existing.length > 0) {
      result.skipped++;
      continue;
    }

    // Create entry
    const value = resolveEntryValue(habit, evaluation.metricValue);
    await upsertHabitEntry(
      habit.id,
      dayKey,
      householdId,
      userId,
      {
        value,
        source: 'apple_health',
        sourceRuleId: rule.id,
        importedMetricValue: evaluation.metricValue ?? undefined,
        importedMetricType: rule.metricType,
        timestamp: new Date().toISOString(),
      }
    );

    result.created++;
  }

  return result;
}
