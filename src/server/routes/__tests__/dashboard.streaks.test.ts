import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Habit, HabitEntry } from '../../../models/persistenceTypes';
import { getDashboardStreaks } from '../dashboard';

vi.mock('../../repositories/habitRepository', () => ({
  getHabitsByUser: vi.fn(),
}));

vi.mock('../../repositories/habitEntryRepository', () => ({
  getHabitEntriesByUser: vi.fn(),
}));

import { getHabitsByUser } from '../../repositories/habitRepository';
import { getHabitEntriesByUser } from '../../repositories/habitEntryRepository';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function createEntry(habitId: string, dayKey: string, value = 1): HabitEntry {
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

describe('getDashboardStreaks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns canonical streak dashboard payload shape from HabitEntries', async () => {
    vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

    const dailyHabit: Habit = {
      id: 'habit-daily',
      categoryId: 'cat-1',
      name: 'Morning Walk',
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const weeklyHabit: Habit = {
      id: 'habit-weekly',
      categoryId: 'cat-1',
      name: 'Strength Sessions',
      goal: { type: 'boolean', frequency: 'weekly', target: 3 },
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(getHabitsByUser).mockResolvedValue([dailyHabit, weeklyHabit]);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue([
      createEntry('habit-daily', '2026-02-19'),
      createEntry('habit-daily', '2026-02-18'),
      createEntry('habit-weekly', '2026-02-03'),
      createEntry('habit-weekly', '2026-02-04'),
      createEntry('habit-weekly', '2026-02-05'),
      createEntry('habit-weekly', '2026-02-10'),
      createEntry('habit-weekly', '2026-02-11'),
      createEntry('habit-weekly', '2026-02-12'),
      createEntry('habit-weekly', '2026-02-17'),
    ]);

    const req = { userId: 'test-user' } as unknown as Request;
    const res = createRes();

    await getDashboardStreaks(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];

    expect(body.todayDayKey).toBe('2026-02-20');
    expect(body.todayStrip).toEqual(
      expect.objectContaining({
        totalHabits: 2,
        completedToday: 0,
        atRiskCount: 2,
      })
    );

    expect(Array.isArray(body.topStreaks)).toBe(true);
    expect(Array.isArray(body.atRiskHabits)).toBe(true);
    expect(Array.isArray(body.habits)).toBe(true);
    expect(Array.isArray(body.weeklyProgress)).toBe(true);
    expect(body.heatmap.dayKeys).toHaveLength(7);
    expect(body.heatmap.habits).toHaveLength(2);

    expect(body.habits[0]).toEqual(
      expect.objectContaining({
        currentStreak: expect.any(Number),
        bestStreak: expect.any(Number),
        lastCompletedDayKey: expect.any(String),
        atRisk: expect.any(Boolean),
        completedToday: expect.any(Boolean),
      })
    );
    expect(body.habits[0].last7Days).toHaveLength(7);

    const weeklySummary = body.weeklyProgress.find((item: { habitId: string }) => item.habitId === 'habit-weekly');
    expect(weeklySummary).toEqual(
      expect.objectContaining({
        habitId: 'habit-weekly',
        current: 1,
        target: 3,
        satisfied: false,
      })
    );
  });
});

