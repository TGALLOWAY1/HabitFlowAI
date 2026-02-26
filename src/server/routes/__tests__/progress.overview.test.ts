import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Habit, HabitEntry } from '../../../models/persistenceTypes';
import { getProgressOverview } from '../progress';

vi.mock('../../repositories/habitRepository', () => ({
  getHabitsByUser: vi.fn(),
}));

vi.mock('../../repositories/habitEntryRepository', () => ({
  getHabitEntriesByUser: vi.fn(),
}));

vi.mock('../../utils/goalProgressUtilsV2', () => ({
  computeGoalsWithProgressV2: vi.fn(),
}));

import { getHabitsByUser } from '../../repositories/habitRepository';
import { getHabitEntriesByUser } from '../../repositories/habitEntryRepository';
import { computeGoalsWithProgressV2 } from '../../utils/goalProgressUtilsV2';

function createRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  return res;
}

function dailyHabit(id: string): Habit {
  return {
    id,
    categoryId: 'cat-1',
    name: 'Daily Habit',
    goal: {
      type: 'boolean',
      frequency: 'daily',
      target: 1,
    },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function weeklyHabit(id: string, target = 3): Habit {
  return {
    id,
    categoryId: 'cat-1',
    name: 'Weekly Habit',
    goal: {
      type: 'boolean',
      frequency: 'weekly',
      target,
    },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function entry(habitId: string, dayKey: string, value = 1): HabitEntry {
  return {
    id: `${habitId}-${dayKey}`,
    habitId,
    timestamp: `${dayKey}T12:00:00.000Z`,
    dayKey,
    value,
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('getProgressOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(computeGoalsWithProgressV2).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes daily streak fields from HabitEntries only', async () => {
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));

    const habit = dailyHabit('habit-daily');
    vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue([
      entry(habit.id, '2026-02-24', 1),
      entry(habit.id, '2026-02-25', 1),
    ]);

    const req = { userId: 'test-user' } as unknown as Request;
    const res = createRes();

    await getProgressOverview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.todayDate).toBe('2026-02-26');
    expect(body.goalsWithProgress).toEqual([]);
    expect(body.habitsToday).toHaveLength(1);

    const habitToday = body.habitsToday[0];
    expect(habitToday.habit.id).toBe(habit.id);
    expect(habitToday.completed).toBe(false);
    expect(habitToday.streak).toBe(2);
    expect(habitToday.currentStreak).toBe(2);
    expect(habitToday.bestStreak).toBe(2);
    expect(habitToday.lastCompletedDayKey).toBe('2026-02-25');
    expect(habitToday.atRisk).toBe(true);
  });

  it('computes weekly streak and atRisk from weekly progress', async () => {
    vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

    const habit = weeklyHabit('habit-weekly', 3);
    vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue([
      // Week of 2026-02-02 (satisfied)
      entry(habit.id, '2026-02-03'),
      entry(habit.id, '2026-02-04'),
      entry(habit.id, '2026-02-05'),
      // Week of 2026-02-09 (satisfied)
      entry(habit.id, '2026-02-10'),
      entry(habit.id, '2026-02-11'),
      entry(habit.id, '2026-02-12'),
      // Week of 2026-02-16 (in progress, unsatisfied as of Fri)
      entry(habit.id, '2026-02-17'),
    ]);

    const req = { userId: 'test-user' } as unknown as Request;
    const res = createRes();

    await getProgressOverview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.todayDate).toBe('2026-02-20');
    expect(body.habitsToday).toHaveLength(1);

    const habitToday = body.habitsToday[0];
    expect(habitToday.currentStreak).toBe(2);
    expect(habitToday.bestStreak).toBe(2);
    expect(habitToday.lastCompletedDayKey).toBe('2026-02-17');
    expect(habitToday.weekSatisfied).toBe(false);
    expect(habitToday.weekProgress).toBe(1);
    expect(habitToday.weekTarget).toBe(3);
    expect(habitToday.atRisk).toBe(true);
  });
});
