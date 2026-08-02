import { describe, expect, it } from 'vitest';
import type { Habit } from '../../models/persistenceTypes';
import { validateHabitDefinition } from './definitionValidation';

function definition(overrides: Partial<Habit> = {}): Partial<Habit> {
  return {
    name: 'Read',
    categoryId: 'cat-1',
    goal: { type: 'boolean', frequency: 'daily' },
    assignedDays: [1, 3, 5],
    requiredDaysPerWeek: 2,
    ...overrides,
  };
}

describe('validateHabitDefinition', () => {
  it('accepts valid daily, numeric, weekly, and checklist definitions', () => {
    expect(validateHabitDefinition(definition()).valid).toBe(true);
    expect(validateHabitDefinition(definition({
      goal: { type: 'number', frequency: 'daily', target: 2.5, unit: 'miles' },
    })).valid).toBe(true);
    expect(validateHabitDefinition(definition({
      assignedDays: undefined,
      requiredDaysPerWeek: undefined,
      timesPerWeek: 3,
    })).valid).toBe(true);
    expect(validateHabitDefinition(definition({
      type: 'bundle',
      bundleType: 'checklist',
      subHabitIds: ['a', 'b'],
      checklistSuccessRule: { type: 'percent', percent: 50 },
    })).valid).toBe(true);
  });

  it.each([
    { goal: { type: 'number', frequency: 'daily' } },
    { goal: { type: 'number', frequency: 'daily', target: Number.NaN } },
    { assignedDays: [1, 1] },
    { assignedDays: [8] },
    { requiredDaysPerWeek: 4 },
    { timesPerWeek: 2, requiredDaysPerWeek: 2 },
    { type: 'bundle', bundleType: undefined },
    { checklistSuccessRule: { type: 'percent', percent: 101 } },
  ] as Array<Partial<Habit>>)('rejects invalid definition %#', override => {
    expect(validateHabitDefinition(definition(override)).valid).toBe(false);
  });
});
