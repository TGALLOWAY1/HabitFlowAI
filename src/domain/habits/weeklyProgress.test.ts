import { describe, expect, it } from 'vitest';
import type { Habit } from '../../models/persistenceTypes';
import { deriveWeeklyHabitProgress } from './weeklyProgress';

function weeklyHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Exercise',
    categoryId: 'category-1',
    goal: { type: 'boolean', frequency: 'daily' },
    timesPerWeek: 3,
    archived: false,
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('deriveWeeklyHabitProgress', () => {
  it('counts distinct completed days rather than entries or raw quantity', () => {
    const result = deriveWeeklyHabitProgress(
      weeklyHabit(),
      '2026-02-16',
      '2026-02-22',
      [
        { habitId: 'habit-1', dayKey: '2026-02-16', value: 1 },
        { habitId: 'habit-1', dayKey: '2026-02-16', value: 1 },
        { habitId: 'habit-1', dayKey: '2026-02-18', value: 99 },
      ],
    );

    expect(result).toEqual({
      isComplete: false,
      isPartial: true,
      currentValue: 2,
      targetValue: 3,
    });
  });

  it('does not count partial numeric progress as a weekly occurrence', () => {
    const result = deriveWeeklyHabitProgress(
      weeklyHabit({ goal: { type: 'number', frequency: 'daily', target: 10 } }),
      '2026-02-16',
      '2026-02-22',
      [
        { habitId: 'habit-1', dayKey: '2026-02-16', value: 4 },
        { habitId: 'habit-1', dayKey: '2026-02-18', value: 10 },
      ],
    );

    expect(result.currentValue).toBe(1);
    expect(result.isComplete).toBe(false);
  });

  it('ignores entries outside the week and on unscheduled weekdays', () => {
    const result = deriveWeeklyHabitProgress(
      weeklyHabit({ timesPerWeek: 2, assignedDays: [1, 3, 5] }),
      '2026-02-16',
      '2026-02-22',
      [
        { habitId: 'habit-1', dayKey: '2026-02-15', value: 1 },
        { habitId: 'habit-1', dayKey: '2026-02-16', value: 1 },
        { habitId: 'habit-1', dayKey: '2026-02-17', value: 1 },
        { habitId: 'habit-1', dayKey: '2026-02-18', value: 1 },
      ],
    );

    expect(result.currentValue).toBe(2);
    expect(result.isComplete).toBe(true);
  });

  it('ignores deleted and frozen entries', () => {
    const result = deriveWeeklyHabitProgress(
      weeklyHabit({ timesPerWeek: 1 }),
      '2026-02-16',
      '2026-02-22',
      [
        { habitId: 'habit-1', dayKey: '2026-02-16', value: 1, deletedAt: '2026-02-17' },
        { habitId: 'habit-1', dayKey: '2026-02-18', value: 1, note: 'freeze:manual' },
      ],
    );

    expect(result.currentValue).toBe(0);
    expect(result.isComplete).toBe(false);
  });
});
