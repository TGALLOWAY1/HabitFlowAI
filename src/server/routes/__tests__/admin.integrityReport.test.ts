import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { getIntegrityReport } from '../admin';

vi.mock('../../lib/mongoClient', () => ({
  getDb: vi.fn(),
}));

import { getDb } from '../../lib/mongoClient';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

type Dataset = Record<string, unknown[]>;

function createMockDb(dataset: Dataset) {
  return {
    collection: (name: string) => ({
      find: () => ({
        toArray: async () => dataset[name] ?? [],
      }),
    }),
  };
}

describe('getIntegrityReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns duplicates, missing daykeys, and orphan counts', async () => {
    const dataset: Dataset = {
      habits: [{ id: 'habit-1' }],
      goals: [{
        id: 'goal-1',
        title: 'Test Goal',
        linkedHabitIds: ['habit-1', 'habit-missing'],
      }],
      habitEntries: [
        {
          id: 'entry-1',
          habitId: 'habit-1',
          dayKey: '2026-02-20',
          timestamp: '2026-02-20T10:00:00.000Z',
          source: 'manual',
          value: 1,
        },
        {
          id: 'entry-2',
          habitId: 'habit-1',
          dayKey: '2026-02-20',
          timestamp: '2026-02-20T10:00:00.000Z',
          source: 'manual',
          value: 1,
        },
        {
          id: 'entry-3',
          habitId: 'habit-1',
          source: 'manual',
          value: 1,
        },
        {
          id: 'entry-4',
          habitId: 'habit-orphan',
          dayKey: '2026-02-21',
          timestamp: '2026-02-21T10:00:00.000Z',
          source: 'manual',
          value: 1,
        },
      ],
      dayLogs: [
        { habitId: 'habit-1', date: '2026-02-20', compositeKey: 'habit-1-2026-02-20' },
        { habitId: 'habit-1', date: '2026-02-20', compositeKey: 'habit-1-2026-02-20' },
        { habitId: 'habit-orphan', date: '2026-02-20', compositeKey: 'habit-orphan-2026-02-20' },
      ],
    };

    vi.mocked(getDb).mockResolvedValue(createMockDb(dataset) as unknown as Awaited<ReturnType<typeof getDb>>);

    const req = { userId: 'test-user' } as unknown as Request;
    const res = createRes();

    await getIntegrityReport(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = vi.mocked(res.json).mock.calls[0][0];
    expect(body.summary.invalidDayKeys).toBe(1);
    expect(body.summary.missingDayKeys).toBe(1);
    expect(body.summary.duplicateHabitEntrySignatures).toBe(1);
    expect(body.summary.duplicateDayLogCompositeKeys).toBe(1);
    expect(body.summary.orphanHabitEntries).toBe(1);
    expect(body.summary.orphanDayLogs).toBe(1);
    expect(body.summary.goalLinksMissingHabits).toBe(1);
  });
});
