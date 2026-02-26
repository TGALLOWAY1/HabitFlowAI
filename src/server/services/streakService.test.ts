import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import type { Habit } from '../../models/persistenceTypes';
import { calculateHabitStreakMetrics, type HabitDayState } from './streakService';

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    categoryId: 'category-1',
    name: 'Test Habit',
    goal: {
      type: 'boolean',
      frequency: 'daily',
      target: 1,
    },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('streakService', () => {
  it('calculates daily current/best/last and marks atRisk when today is incomplete', () => {
    const habit = createHabit({
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
    });
    const dayStates: HabitDayState[] = [
      { dayKey: '2026-02-24', value: 1, completed: true },
      { dayKey: '2026-02-25', value: 1, completed: true },
      { dayKey: '2026-02-22', value: 1, completed: true },
    ];

    const metrics = calculateHabitStreakMetrics(habit, dayStates, parseISO('2026-02-26'));

    expect(metrics.currentStreak).toBe(2);
    expect(metrics.bestStreak).toBe(2);
    expect(metrics.lastCompletedDayKey).toBe('2026-02-25');
    expect(metrics.completedToday).toBe(false);
    expect(metrics.atRisk).toBe(true);
  });

  it('updates daily streak when backfill closes a missing day gap', () => {
    const habit = createHabit({
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
    });

    const beforeBackfill: HabitDayState[] = [
      { dayKey: '2026-02-20', value: 1, completed: true },
      { dayKey: '2026-02-22', value: 1, completed: true },
      { dayKey: '2026-02-23', value: 1, completed: true },
    ];
    const before = calculateHabitStreakMetrics(habit, beforeBackfill, parseISO('2026-02-24'));
    expect(before.currentStreak).toBe(2);
    expect(before.bestStreak).toBe(2);

    const afterBackfill: HabitDayState[] = [
      ...beforeBackfill,
      { dayKey: '2026-02-21', value: 1, completed: true },
    ];
    const after = calculateHabitStreakMetrics(habit, afterBackfill, parseISO('2026-02-24'));

    expect(after.currentStreak).toBe(4);
    expect(after.bestStreak).toBe(4);
    expect(after.lastCompletedDayKey).toBe('2026-02-23');
  });

  it('calculates weekly streaks and weekly atRisk state from weekly progress', () => {
    const habit = createHabit({
      goal: { type: 'boolean', frequency: 'weekly', target: 3 },
    });
    const dayStates: HabitDayState[] = [
      // Week of 2026-02-02 (satisfied: 3 days)
      { dayKey: '2026-02-03', value: 1, completed: true },
      { dayKey: '2026-02-04', value: 1, completed: true },
      { dayKey: '2026-02-05', value: 1, completed: true },
      // Week of 2026-02-09 (satisfied: 3 days)
      { dayKey: '2026-02-10', value: 1, completed: true },
      { dayKey: '2026-02-11', value: 1, completed: true },
      { dayKey: '2026-02-12', value: 1, completed: true },
      // Week of 2026-02-16 (in progress, unsatisfied)
      { dayKey: '2026-02-17', value: 1, completed: true },
    ];

    const metrics = calculateHabitStreakMetrics(habit, dayStates, parseISO('2026-02-20'));

    expect(metrics.currentStreak).toBe(2);
    expect(metrics.bestStreak).toBe(2);
    expect(metrics.lastCompletedDayKey).toBe('2026-02-17');
    expect(metrics.weekSatisfied).toBe(false);
    expect(metrics.weekProgress).toBe(1);
    expect(metrics.weekTarget).toBe(3);
    expect(metrics.atRisk).toBe(true);
  });

  it('counts frozen days toward daily streak continuity', () => {
    const habit = createHabit({
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
    });
    const dayStates: HabitDayState[] = [
      { dayKey: '2026-02-24', value: 1, completed: true },
      { dayKey: '2026-02-25', value: 0, completed: false, isFrozen: true },
    ];

    const metrics = calculateHabitStreakMetrics(habit, dayStates, parseISO('2026-02-26'));

    expect(metrics.currentStreak).toBe(2);
    expect(metrics.bestStreak).toBe(2);
    expect(metrics.lastCompletedDayKey).toBe('2026-02-25');
    expect(metrics.completedToday).toBe(false);
    expect(metrics.atRisk).toBe(true);
  });
});
