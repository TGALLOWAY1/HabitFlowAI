import type { Habit } from '../../models/persistenceTypes';

export interface HabitDefinitionValidationResult {
  valid: boolean;
  error?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function invalid(error: string): HabitDefinitionValidationResult {
  return { valid: false, error };
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validateDayList(value: unknown, fieldName: string): HabitDefinitionValidationResult {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid(`${fieldName} must contain at least one day`);
  }
  if (!value.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
    return invalid(`${fieldName} must contain only unique weekday numbers from 0 to 6`);
  }
  if (new Set(value).size !== value.length) {
    return invalid(`${fieldName} must not contain duplicate days`);
  }
  return { valid: true };
}

/** Validate the complete, merged habit definition at an API boundary. */
export function validateHabitDefinition(habit: Partial<Habit>): HabitDefinitionValidationResult {
  if (typeof habit.name !== 'string' || habit.name.trim().length === 0) {
    return invalid('Habit name is required and must be a non-empty string');
  }
  if (typeof habit.categoryId !== 'string' || habit.categoryId.trim().length === 0) {
    return invalid('Category ID is required');
  }

  const goal = habit.goal;
  if (!goal || typeof goal !== 'object') return invalid('Goal configuration is required');
  if (goal.type !== 'boolean' && goal.type !== 'number') {
    return invalid('goal.type must be "boolean" or "number"');
  }
  if (goal.frequency !== 'daily' && goal.frequency !== 'total') {
    return invalid('goal.frequency must be "daily" or "total"');
  }
  if (goal.type === 'number' && !isPositiveFiniteNumber(goal.target)) {
    return invalid('Numeric habits require a finite target greater than zero');
  }

  if (habit.type != null && !['boolean', 'number', 'time', 'bundle'].includes(habit.type)) {
    return invalid('Invalid habit type');
  }
  if (habit.type === 'bundle' && habit.bundleType !== 'choice' && habit.bundleType !== 'checklist') {
    return invalid('Bundle habits require bundleType "choice" or "checklist"');
  }

  if (habit.assignedDays != null) {
    const result = validateDayList(habit.assignedDays, 'assignedDays');
    if (!result.valid) return result;
  }
  if (habit.nonNegotiableDays != null) {
    const result = validateDayList(habit.nonNegotiableDays, 'nonNegotiableDays');
    if (!result.valid) return result;
  }

  if (habit.requiredDaysPerWeek !== undefined && habit.requiredDaysPerWeek !== null) {
    if (!Number.isInteger(habit.requiredDaysPerWeek) || habit.requiredDaysPerWeek < 1 || habit.requiredDaysPerWeek > 7) {
      return invalid('requiredDaysPerWeek must be an integer from 1 to 7');
    }
    if (!habit.assignedDays?.length) {
      return invalid('requiredDaysPerWeek requires assignedDays');
    }
    if (habit.requiredDaysPerWeek > habit.assignedDays.length) {
      return invalid('requiredDaysPerWeek cannot exceed the number of assignedDays');
    }
  }

  if (habit.timesPerWeek !== undefined && habit.timesPerWeek !== null) {
    if (!Number.isInteger(habit.timesPerWeek) || habit.timesPerWeek < 1 || habit.timesPerWeek > 7) {
      return invalid('timesPerWeek must be an integer from 1 to 7');
    }
  }
  if (habit.timesPerWeek != null && habit.requiredDaysPerWeek != null) {
    return invalid('Use either timesPerWeek or requiredDaysPerWeek, not both');
  }

  if (habit.durationMinutes != null && !isPositiveFiniteNumber(habit.durationMinutes)) {
    return invalid('durationMinutes must be a finite number greater than zero');
  }
  if (habit.timeEstimate != null && !isPositiveFiniteNumber(habit.timeEstimate)) {
    return invalid('timeEstimate must be a finite number greater than zero');
  }
  for (const [fieldName, value] of [
    ['scheduledTime', habit.scheduledTime],
    ['deadline', habit.deadline],
    ['reminderTime', habit.reminderTime],
  ] as const) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || !TIME_PATTERN.test(value))) {
      return invalid(`${fieldName} must be a 24h "HH:mm" string`);
    }
  }

  if (habit.subHabitIds != null) {
    if (!Array.isArray(habit.subHabitIds) || habit.subHabitIds.some(id => typeof id !== 'string' || !id.trim())) {
      return invalid('subHabitIds must contain non-empty strings');
    }
    if (new Set(habit.subHabitIds).size !== habit.subHabitIds.length) {
      return invalid('subHabitIds must not contain duplicates');
    }
  }

  const rule = habit.checklistSuccessRule;
  if (rule != null) {
    if (!['any', 'threshold', 'percent', 'full'].includes(rule.type)) {
      return invalid('Invalid checklist success rule');
    }
    if (rule.type === 'threshold') {
      if (!Number.isInteger(rule.threshold) || (rule.threshold ?? 0) < 1) {
        return invalid('Checklist threshold must be a positive integer');
      }
      if (habit.subHabitIds?.length && rule.threshold! > habit.subHabitIds.length) {
        return invalid('Checklist threshold cannot exceed the number of children');
      }
    }
    if (rule.type === 'percent' && (
      typeof rule.percent !== 'number'
      || !Number.isFinite(rule.percent)
      || rule.percent <= 0
      || rule.percent > 100
    )) {
      return invalid('Checklist percent must be greater than 0 and at most 100');
    }
  }
  if (habit.streakType != null && !['success', 'full', 'any'].includes(habit.streakType)) {
    return invalid('Invalid checklist streak type');
  }

  return { valid: true };
}
