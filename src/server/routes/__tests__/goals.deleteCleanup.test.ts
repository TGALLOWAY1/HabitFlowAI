import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { deleteGoalRoute } from '../goals';

vi.mock('../../repositories/goalRepository', () => ({
  deleteGoal: vi.fn(),
}));

vi.mock('../../repositories/habitRepository', () => ({
  unlinkHabitsFromGoal: vi.fn(),
  getHabitsByUser: vi.fn(),
}));

import { deleteGoal } from '../../repositories/goalRepository';
import { unlinkHabitsFromGoal } from '../../repositories/habitRepository';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('deleteGoalRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears linkedGoalId from habits when goal is deleted', async () => {
    vi.mocked(deleteGoal).mockResolvedValue(true);
    vi.mocked(unlinkHabitsFromGoal).mockResolvedValue(2);

    const req = {
      params: { id: 'goal-1' },
      householdId: 'household-1',
      userId: 'test-user',
    } as unknown as Request;
    const res = createRes();

    await deleteGoalRoute(req, res);

    expect(deleteGoal).toHaveBeenCalledWith('goal-1', 'household-1', 'test-user');
    expect(unlinkHabitsFromGoal).toHaveBeenCalledWith('goal-1', 'household-1', 'test-user');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 and skips cleanup when goal does not exist', async () => {
    vi.mocked(deleteGoal).mockResolvedValue(false);

    const req = {
      params: { id: 'goal-missing' },
      householdId: 'household-1',
      userId: 'test-user',
    } as unknown as Request;
    const res = createRes();

    await deleteGoalRoute(req, res);

    expect(unlinkHabitsFromGoal).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
