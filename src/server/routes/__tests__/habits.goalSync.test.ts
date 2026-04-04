/**
 * Tests for habit-side goal sync (INC-1).
 * When a habit's linkedGoalId changes, the corresponding goal's linkedHabitIds
 * should be updated atomically.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createHabitRoute, updateHabitRoute } from '../habits';

vi.mock('../../repositories/habitRepository', () => ({
  createHabit: vi.fn(),
  getHabitById: vi.fn(),
  updateHabit: vi.fn(),
  getHabitsByUser: vi.fn(),
  getHabitsByCategory: vi.fn(),
  deleteHabit: vi.fn(),
  reorderHabits: vi.fn(),
  recoverCategoryDeletedHabits: vi.fn(),
}));

vi.mock('../../repositories/categoryRepository', () => ({
  createCategory: vi.fn(),
  getCategoriesByUser: vi.fn(),
  getCategoryById: vi.fn(),
}));

vi.mock('../../repositories/goalRepository', () => ({
  addHabitToGoalLinkedIds: vi.fn(),
  removeHabitFromGoalLinkedIds: vi.fn(),
}));

vi.mock('../../repositories/bundleMembershipRepository', () => ({
  endMembership: vi.fn(),
}));

vi.mock('../../services/habitConversionService', () => ({
  convertHabitToBundle: vi.fn(),
  ConversionError: class extends Error {},
}));

vi.mock('../../middleware/identity', () => ({
  getRequestIdentity: (req: any) => ({
    householdId: req.householdId,
    userId: req.userId,
  }),
}));

import { createHabit, getHabitById, updateHabit } from '../../repositories/habitRepository';
import { addHabitToGoalLinkedIds, removeHabitFromGoalLinkedIds } from '../../repositories/goalRepository';

function createRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('Habit-Goal bidirectional sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createHabitRoute', () => {
    it('syncs goal linkedHabitIds when habit is created with linkedGoalId', async () => {
      vi.mocked(createHabit).mockResolvedValue({
        id: 'habit-1',
        name: 'Test Habit',
        categoryId: 'cat-1',
        goal: { type: 'boolean', frequency: 'daily' },
        linkedGoalId: 'goal-1',
        createdAt: '2026-01-01T00:00:00Z',
      } as any);

      const req = {
        body: {
          name: 'Test Habit',
          categoryId: 'cat-1',
          goal: { type: 'boolean', frequency: 'daily' },
          linkedGoalId: 'goal-1',
        },
        householdId: 'hh-1',
        userId: 'user-1',
      } as unknown as Request;
      const res = createRes();

      await createHabitRoute(req, res);

      expect(addHabitToGoalLinkedIds).toHaveBeenCalledWith('goal-1', 'habit-1', 'hh-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('does not sync goal when habit is created without linkedGoalId', async () => {
      vi.mocked(createHabit).mockResolvedValue({
        id: 'habit-2',
        name: 'Test Habit',
        categoryId: 'cat-1',
        goal: { type: 'boolean', frequency: 'daily' },
        createdAt: '2026-01-01T00:00:00Z',
      } as any);

      const req = {
        body: {
          name: 'Test Habit',
          categoryId: 'cat-1',
          goal: { type: 'boolean', frequency: 'daily' },
        },
        householdId: 'hh-1',
        userId: 'user-1',
      } as unknown as Request;
      const res = createRes();

      await createHabitRoute(req, res);

      expect(addHabitToGoalLinkedIds).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateHabitRoute', () => {
    it('syncs both old and new goal when linkedGoalId changes', async () => {
      vi.mocked(getHabitById).mockResolvedValue({
        id: 'habit-1',
        linkedGoalId: 'old-goal',
      } as any);
      vi.mocked(updateHabit).mockResolvedValue({
        id: 'habit-1',
        linkedGoalId: 'new-goal',
      } as any);

      const req = {
        params: { id: 'habit-1' },
        body: { linkedGoalId: 'new-goal' },
        householdId: 'hh-1',
        userId: 'user-1',
      } as unknown as Request;
      const res = createRes();

      await updateHabitRoute(req, res);

      expect(removeHabitFromGoalLinkedIds).toHaveBeenCalledWith('old-goal', 'habit-1', 'hh-1', 'user-1');
      expect(addHabitToGoalLinkedIds).toHaveBeenCalledWith('new-goal', 'habit-1', 'hh-1', 'user-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('only removes from old goal when linkedGoalId is cleared', async () => {
      vi.mocked(getHabitById).mockResolvedValue({
        id: 'habit-1',
        linkedGoalId: 'old-goal',
      } as any);
      vi.mocked(updateHabit).mockResolvedValue({
        id: 'habit-1',
        linkedGoalId: null,
      } as any);

      const req = {
        params: { id: 'habit-1' },
        body: { linkedGoalId: null },
        householdId: 'hh-1',
        userId: 'user-1',
      } as unknown as Request;
      const res = createRes();

      await updateHabitRoute(req, res);

      expect(removeHabitFromGoalLinkedIds).toHaveBeenCalledWith('old-goal', 'habit-1', 'hh-1', 'user-1');
      expect(addHabitToGoalLinkedIds).not.toHaveBeenCalled();
    });

    it('only adds to new goal when previously unlinked', async () => {
      vi.mocked(getHabitById).mockResolvedValue({
        id: 'habit-1',
        linkedGoalId: null,
      } as any);
      vi.mocked(updateHabit).mockResolvedValue({
        id: 'habit-1',
        linkedGoalId: 'new-goal',
      } as any);

      const req = {
        params: { id: 'habit-1' },
        body: { linkedGoalId: 'new-goal' },
        householdId: 'hh-1',
        userId: 'user-1',
      } as unknown as Request;
      const res = createRes();

      await updateHabitRoute(req, res);

      expect(removeHabitFromGoalLinkedIds).not.toHaveBeenCalled();
      expect(addHabitToGoalLinkedIds).toHaveBeenCalledWith('new-goal', 'habit-1', 'hh-1', 'user-1');
    });

    it('does not sync when linkedGoalId is not in patch', async () => {
      vi.mocked(updateHabit).mockResolvedValue({
        id: 'habit-1',
        name: 'Updated Name',
      } as any);

      const req = {
        params: { id: 'habit-1' },
        body: { name: 'Updated Name' },
        householdId: 'hh-1',
        userId: 'user-1',
      } as unknown as Request;
      const res = createRes();

      await updateHabitRoute(req, res);

      expect(getHabitById).not.toHaveBeenCalled();
      expect(addHabitToGoalLinkedIds).not.toHaveBeenCalled();
      expect(removeHabitFromGoalLinkedIds).not.toHaveBeenCalled();
    });
  });
});
