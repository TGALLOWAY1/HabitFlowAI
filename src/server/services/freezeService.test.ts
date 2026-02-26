import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Habit } from '../../types';
import { processAutoFreezes } from './freezeService';

vi.mock('../repositories/habitEntryRepository', () => ({
  getHabitEntriesForDay: vi.fn(),
  createHabitEntry: vi.fn(),
}));

vi.mock('../repositories/habitRepository', () => ({
  updateHabit: vi.fn(),
}));

import { getHabitEntriesForDay, createHabitEntry } from '../repositories/habitEntryRepository';
import { updateHabit } from '../repositories/habitRepository';

function dailyHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    categoryId: 'cat-1',
    name: 'Daily Habit',
    goal: { type: 'boolean', frequency: 'daily', target: 1 },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    freezeCount: 2,
    ...overrides,
  };
}

describe('processAutoFreezes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates freeze marker entry and decrements inventory when streak needs protection', async () => {
    vi.mocked(getHabitEntriesForDay)
      .mockResolvedValueOnce([]) // yesterday: no entries
      .mockResolvedValueOnce([{
        id: 'entry-prev',
        habitId: 'habit-1',
        dayKey: '2026-02-24',
        timestamp: '2026-02-24T10:00:00.000Z',
        value: 1,
        source: 'manual',
        createdAt: '2026-02-24T10:00:00.000Z',
        updatedAt: '2026-02-24T10:00:00.000Z',
      }]); // day-2: streak exists

    await processAutoFreezes([dailyHabit()], {}, 'test-user');

    expect(createHabitEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        habitId: 'habit-1',
        dayKey: '2026-02-25',
        value: 0,
        note: 'freeze:auto',
      }),
      'test-user'
    );
    expect(updateHabit).toHaveBeenCalledWith('habit-1', 'test-user', { freezeCount: 1 });
  });

  it('skips freeze when yesterday already has entries', async () => {
    vi.mocked(getHabitEntriesForDay).mockResolvedValueOnce([{
      id: 'entry-yesterday',
      habitId: 'habit-1',
      dayKey: '2026-02-25',
      timestamp: '2026-02-25T10:00:00.000Z',
      value: 1,
      source: 'manual',
      createdAt: '2026-02-25T10:00:00.000Z',
      updatedAt: '2026-02-25T10:00:00.000Z',
    }]);

    await processAutoFreezes([dailyHabit()], {}, 'test-user');

    expect(createHabitEntry).not.toHaveBeenCalled();
    expect(updateHabit).not.toHaveBeenCalled();
  });
});

