import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { Habit, HabitEntry } from '../../../models/persistenceTypes';
import { getDaySummary } from '../daySummary';

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

function createEntry(overrides: Partial<HabitEntry> & Pick<HabitEntry, 'id' | 'habitId' | 'dayKey' | 'timestamp' | 'source'>): HabitEntry {
  return {
    value: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getDaySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives canonical log map from HabitEntries without reading dayLogs', async () => {
    const habits: Habit[] = [
      {
        id: 'habit-daily',
        categoryId: 'cat-1',
        name: 'Daily Walk',
        goal: { type: 'boolean', frequency: 'daily', target: 1 },
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'habit-qty',
        categoryId: 'cat-1',
        name: 'Protein',
        goal: { type: 'number', frequency: 'daily', target: 5, unit: 'g' },
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'habit-choice',
        categoryId: 'cat-1',
        name: 'Workout Mode',
        goal: { type: 'boolean', frequency: 'daily', target: 1 },
        bundleType: 'choice',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const entries: HabitEntry[] = [
      createEntry({
        id: 'e-1',
        habitId: 'habit-daily',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T08:00:00.000Z',
        source: 'manual',
        value: 1,
      }),
      createEntry({
        id: 'e-2',
        habitId: 'habit-qty',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T09:00:00.000Z',
        source: 'manual',
        value: 3,
      }),
      createEntry({
        id: 'e-3',
        habitId: 'habit-qty',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T10:00:00.000Z',
        source: 'manual',
        value: 4,
      }),
      createEntry({
        id: 'e-4',
        habitId: 'habit-choice',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T11:00:00.000Z',
        source: 'manual',
        bundleOptionId: 'option-run',
      }),
      createEntry({
        id: 'e-5',
        habitId: 'habit-choice',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T11:30:00.000Z',
        source: 'routine',
        choiceChildHabitId: 'child-strength',
        value: 2,
      }),
      createEntry({
        id: 'e-6',
        habitId: 'habit-daily',
        dayKey: '2026-02-10',
        timestamp: '2026-02-10T08:00:00.000Z',
        source: 'manual',
        value: 1,
      }),
      createEntry({
        id: 'e-7',
        habitId: 'habit-daily',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T12:00:00.000Z',
        source: 'manual',
        value: 1,
        deletedAt: '2026-02-20T12:30:00.000Z',
      }),
    ];

    vi.mocked(getHabitsByUser).mockResolvedValue(habits);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue(entries);

    const req = {
      userId: 'test-user',
      query: {
        startDayKey: '2026-02-15',
        endDayKey: '2026-02-21',
        timeZone: 'UTC',
      },
    } as unknown as Request;

    const res = createRes();
    await getDaySummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.metadata.source).toBe('habitEntries');

    expect(body.logs['habit-daily-2026-02-20']).toEqual(
      expect.objectContaining({
        completed: true,
        value: 1,
      })
    );

    expect(body.logs['habit-qty-2026-02-20']).toEqual(
      expect.objectContaining({
        completed: true,
        value: 7,
      })
    );

    expect(body.logs['habit-choice-2026-02-20']).toEqual(
      expect.objectContaining({
        completed: true,
        value: undefined,
        source: 'routine',
        completedOptions: {
          'option-run': 1,
          'child-strength': 2,
        },
      })
    );

    expect(body.logs['habit-daily-2026-02-10']).toBeUndefined();
  });
});

