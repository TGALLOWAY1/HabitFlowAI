import { describe, expect, it } from 'vitest';
import type { DayLog, Habit } from '../../types';
import { resolveLocalHabitStatuses, type DayViewHabitStatus } from './habitStatusResolution';

const numericHabit: Habit = {
  id: 'numeric-1',
  name: 'Read',
  categoryId: 'category-1',
  goal: { type: 'number', frequency: 'daily', target: 10, unit: 'pages' },
  archived: false,
  createdAt: '2026-02-01T00:00:00.000Z',
};

function log(value: number): DayLog {
  return { habitId: numericHabit.id, date: '2026-02-18', value, completed: false };
}

describe('resolveLocalHabitStatuses', () => {
  it.each([
    { value: 0, complete: false, partial: false },
    { value: 4, complete: false, partial: true },
    { value: 10, complete: true, partial: false },
    { value: 12.5, complete: true, partial: false },
  ])('keeps numeric value, target, and completion aligned for $value', ({ value, complete }) => {
    const base = new Map<string, DayViewHabitStatus>([[numericHabit.id, {
      habit: numericHabit,
      isComplete: false,
      currentValue: 0,
      targetValue: 10,
      progressPercent: 0,
    }]]);

    const result = resolveLocalHabitStatuses({
      baseStatuses: base,
      habits: [numericHabit],
      logs: { [`${numericHabit.id}-2026-02-18`]: log(value) },
      dayKey: '2026-02-18',
    }).get(numericHabit.id)!;

    expect(result.currentValue).toBe(value);
    expect(result.targetValue).toBe(10);
    expect(result.isComplete).toBe(complete);
  });

  it('uses the configured target when a newly-created habit is absent from the server snapshot', () => {
    const result = resolveLocalHabitStatuses({
      baseStatuses: new Map(),
      habits: [numericHabit],
      logs: {},
      dayKey: '2026-02-18',
    }).get(numericHabit.id)!;

    expect(result.currentValue).toBe(0);
    expect(result.targetValue).toBe(10);
    expect(result.isComplete).toBe(false);
  });
});
