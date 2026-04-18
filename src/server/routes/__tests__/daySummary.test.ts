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

vi.mock('../../repositories/bundleMembershipRepository', () => ({
  getAllMembershipsByUser: vi.fn().mockResolvedValue([]),
}));

import { getHabitsByUser } from '../../repositories/habitRepository';
import { getHabitEntriesByUser } from '../../repositories/habitEntryRepository';
import { getAllMembershipsByUser } from '../../repositories/bundleMembershipRepository';

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
      createEntry({
        id: 'e-8',
        habitId: 'habit-daily',
        dayKey: '2026-02-21',
        timestamp: '2026-02-21T23:59:59.000Z',
        source: 'manual',
        value: 0,
        note: 'freeze:auto',
      }),
    ];

    vi.mocked(getHabitsByUser).mockResolvedValue(habits);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue(entries);

    const req = {
      householdId: 'test-household',
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

    expect(body.logs['habit-daily-2026-02-21']).toEqual(
      expect.objectContaining({
        completed: false,
        value: 0,
        isFrozen: true,
        freezeType: 'auto',
      })
    );

    expect(body.logs['habit-daily-2026-02-10']).toBeUndefined();
  });

  it('returns consistent dayKeys for a week window (all log keys in range and YYYY-MM-DD)', async () => {
    const habit: Habit = {
      id: 'habit-1',
      categoryId: 'cat-1',
      name: 'Daily',
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const entries: HabitEntry[] = [
      createEntry({
        id: 'e-1',
        habitId: 'habit-1',
        dayKey: '2026-02-17',
        timestamp: '2026-02-17T10:00:00.000Z',
        source: 'manual',
        value: 1,
      }),
      createEntry({
        id: 'e-2',
        habitId: 'habit-1',
        dayKey: '2026-02-20',
        timestamp: '2026-02-20T10:00:00.000Z',
        source: 'manual',
        value: 1,
      }),
    ];
    vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue(entries);

    const req = {
      householdId: 'test-household',
      userId: 'test-user',
      query: {
        startDayKey: '2026-02-17',
        endDayKey: '2026-02-23',
        timeZone: 'UTC',
      },
    } as unknown as Request;

    const res = createRes();
    await getDaySummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.startDayKey).toBe('2026-02-17');
    expect(body.endDayKey).toBe('2026-02-23');

    const dayKeyRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const log of Object.values(body.logs) as Array<{ date: string }>) {
      const dayKey = log.date;
      expect(dayKey).toMatch(dayKeyRegex);
      expect(dayKey >= body.startDayKey && dayKey <= body.endDayKey).toBe(true);
    }
  });

  it('derived bundle parent respects membership daysOfWeek filter', async () => {
    // 2026-01-07 is a Wednesday (day-of-week = 3).
    // 2026-01-08 is a Thursday (day-of-week = 4).
    const parent: Habit = {
      id: 'bundle-parent',
      categoryId: 'cat-1',
      name: 'Morning Routine',
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
      type: 'bundle',
      bundleType: 'checklist',
      subHabitIds: ['child-wed-only'],
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const child: Habit = {
      id: 'child-wed-only',
      categoryId: 'cat-1',
      name: 'Stretch (Wednesdays only)',
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
      bundleParentId: 'bundle-parent',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    vi.mocked(getHabitsByUser).mockResolvedValue([parent, child]);
    vi.mocked(getAllMembershipsByUser).mockResolvedValue([
      {
        id: 'm-1',
        parentHabitId: 'bundle-parent',
        childHabitId: 'child-wed-only',
        activeFromDayKey: '2026-01-01',
        activeToDayKey: null,
        daysOfWeek: [3], // Wednesday only
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(getHabitEntriesByUser).mockResolvedValue([
      createEntry({
        id: 'e-wed',
        habitId: 'child-wed-only',
        dayKey: '2026-01-07',
        timestamp: '2026-01-07T12:00:00.000Z',
        source: 'manual',
        value: 1,
      }),
      createEntry({
        id: 'e-thu',
        habitId: 'child-wed-only',
        dayKey: '2026-01-08',
        timestamp: '2026-01-08T12:00:00.000Z',
        source: 'manual',
        value: 1,
      }),
    ]);

    const req = {
      householdId: 'test-household',
      userId: 'test-user',
      query: {
        startDayKey: '2026-01-07',
        endDayKey: '2026-01-08',
        timeZone: 'UTC',
      },
    } as unknown as Request;

    const res = createRes();
    await getDaySummary(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];

    // Wednesday: child is active per membership, so parent log is derived and complete.
    expect(body.logs['bundle-parent-2026-01-07']).toEqual(
      expect.objectContaining({ completed: true })
    );

    // Thursday: child is NOT active per membership (daysOfWeek=[3]).
    // No active children => no derived parent log for that day.
    expect(body.logs['bundle-parent-2026-01-08']).toBeUndefined();
  });
});
