/**
 * Health Auto-Log Processing Service
 *
 * Called after health data sync to evaluate all active rules for a user
 * and either auto-log entries or create suggestions.
 */

import type { HealthMetricDaily, Habit } from '../../models/persistenceTypes';
import { evaluateHealthRule } from './healthRuleEvaluationService';
import { getActiveRulesByUser } from '../repositories/habitHealthRuleRepository';
import { getHabitEntriesForDay, upsertHabitEntry } from '../repositories/habitEntryRepository';
import { getHabitById } from '../repositories/habitRepository';
import { createSuggestion, suggestionExistsForDayAndHabit } from '../repositories/healthSuggestionRepository';

export interface ProcessSyncResult {
  autoLogged: string[];   // habit IDs that were auto-logged
  suggested: string[];    // habit IDs that received suggestions
}

/**
 * Determine the entry value based on habit type and metric value.
 */
function resolveEntryValue(habit: Habit, metricValue: number | null): number {
  if (habit.goal?.type === 'number' && metricValue != null) {
    return metricValue;
  }
  return 1;
}

/**
 * Process a health data sync for a user.
 * Evaluates all active rules against the synced metric and creates
 * entries (auto_log) or suggestions (suggest) as appropriate.
 */
export async function processHealthSync(
  dayKey: string,
  metric: HealthMetricDaily,
  householdId: string,
  userId: string
): Promise<ProcessSyncResult> {
  const result: ProcessSyncResult = { autoLogged: [], suggested: [] };

  const rules = await getActiveRulesByUser(householdId, userId);
  if (rules.length === 0) return result;

  for (const rule of rules) {
    const evaluation = evaluateHealthRule(rule, metric);
    if (!evaluation.satisfied) continue;

    const habit = await getHabitById(rule.habitId, householdId, userId);
    if (!habit || habit.archived) continue;

    if (rule.behavior === 'auto_log') {
      // Check if entry already exists
      const existing = await getHabitEntriesForDay(
        rule.habitId, dayKey, householdId, userId
      );
      if (existing.length > 0) continue;

      const value = resolveEntryValue(habit, evaluation.metricValue);
      await upsertHabitEntry(
        rule.habitId, dayKey, householdId, userId,
        {
          value,
          source: 'apple_health',
          sourceRuleId: rule.id,
          importedMetricValue: evaluation.metricValue ?? undefined,
          importedMetricType: rule.metricType,
          timestamp: new Date().toISOString(),
        }
      );
      result.autoLogged.push(rule.habitId);

    } else if (rule.behavior === 'suggest') {
      // Check if suggestion already exists
      const exists = await suggestionExistsForDayAndHabit(
        rule.habitId, dayKey, householdId, userId
      );
      if (exists) continue;

      await createSuggestion(
        {
          userId,
          habitId: rule.habitId,
          ruleId: rule.id,
          dayKey,
          metricType: rule.metricType,
          metricValue: evaluation.metricValue ?? 0,
          status: 'pending',
        },
        householdId,
        userId
      );
      result.suggested.push(rule.habitId);
    }
  }

  return result;
}
