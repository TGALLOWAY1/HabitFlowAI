import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { deleteHabitRoute } from '../habits';

vi.mock('../../repositories/habitRepository', () => ({
  getHabitById: vi.fn(),
  deleteHabit: vi.fn(),
}));

import { getHabitById, deleteHabit } from '../../repositories/habitRepository';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('deleteHabitRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes habit without cascade-deleting entries (entries persist for goal progress)', async () => {
    vi.mocked(getHabitById).mockResolvedValue({
      id: 'habit-1',
      categoryId: 'cat-1',
      name: 'Walk',
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(deleteHabit).mockResolvedValue(true);

    const req = {
      params: { id: 'habit-1' },
      householdId: 'household-1',
      userId: 'test-user',
    } as unknown as Request;
    const res = createRes();

    await deleteHabitRoute(req, res);

    expect(deleteHabit).toHaveBeenCalledWith('habit-1', 'household-1', 'test-user');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(vi.mocked(res.json).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        message: 'Habit deleted successfully',
      })
    );
  });

  it('returns 404 when habit does not exist', async () => {
    vi.mocked(getHabitById).mockResolvedValue(null);

    const req = {
      params: { id: 'habit-missing' },
      householdId: 'household-1',
      userId: 'test-user',
    } as unknown as Request;
    const res = createRes();

    await deleteHabitRoute(req, res);

    expect(deleteHabit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
