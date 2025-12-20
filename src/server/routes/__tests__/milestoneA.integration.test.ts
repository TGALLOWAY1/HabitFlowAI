/**
 * Milestone A Integration Tests
 * 
 * End-to-end tests for truthQuery-backed endpoints.
 * Verifies that endpoints return correct data derived from EntryViews.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { getHabitEntriesRoute } from '../habitEntries';
import { getGoalProgress } from '../goals';
import { getDayView } from '../dayView';

// Mock repositories
vi.mock('../../repositories/habitEntryRepository', () => ({
  getHabitEntriesByHabit: vi.fn(),
  getHabitEntriesByUser: vi.fn(),
}));

vi.mock('../../repositories/dayLogRepository', () => ({
  getDayLogsByHabit: vi.fn(),
  getDayLogsByUser: vi.fn(),
}));

vi.mock('../../repositories/habitRepository', () => ({
  getHabitsByUser: vi.fn(),
}));

vi.mock('../../repositories/goalRepository', () => ({
  getGoalById: vi.fn(),
}));

vi.mock('../../repositories/goalManualLogRepository', () => ({
  getGoalManualLogsByGoal: vi.fn(),
}));

vi.mock('../../services/truthQuery', () => ({
  getEntryViewsForHabits: vi.fn(),
  getEntryViewsForHabit: vi.fn(),
}));

import { getEntryViewsForHabit as getEntryViewsForHabitMock } from '../../services/truthQuery';

import { getHabitEntriesByHabit } from '../../repositories/habitEntryRepository';
import { getDayLogsByHabit } from '../../repositories/dayLogRepository';
import { getHabitsByUser } from '../../repositories/habitRepository';
import { getGoalById } from '../../repositories/goalRepository';
import { getGoalManualLogsByGoal } from '../../repositories/goalManualLogRepository';
import { getEntryViewsForHabits, getEntryViewsForHabit } from '../../services/truthQuery';
import type { HabitEntry, DayLog, Habit, Goal } from '../../../models/persistenceTypes';

describe('Milestone A Integration Tests', () => {
  const userId = 'test-user';
  const habitId = 'habit-1';
  const dayKey = '2025-01-15';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/entries endpoint', () => {
    it('should return EntryViews with conflict detection', async () => {
      const entryView = {
        habitId,
        dayKey,
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 10,
        source: 'manual' as const,
        provenance: {},
        deletedAt: null,
        conflict: true, // Conflict detected
        legacyValue: 5,
      };

      // Mock truthQuery - route dynamically imports getEntryViewsForHabit
      vi.mocked(getEntryViewsForHabit).mockResolvedValue([entryView]);

      const req = {
        query: { habitId, timeZone: 'UTC' },
        userId: userId,
      } as unknown as Request;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await getHabitEntriesRoute(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = (res.json as any).mock.calls[0][0];
      expect(response).toBeDefined();
      expect(response.entries).toBeDefined();
      expect(Array.isArray(response.entries)).toBe(true);
      expect(response.entries.length).toBeGreaterThan(0);
      
      const returnedEntryView = response.entries[0];
      expect(returnedEntryView.value).toBe(10); // HabitEntry wins
      expect(returnedEntryView.conflict).toBe(true); // Conflict detected
    });
  });

  describe('/api/dayView endpoint', () => {
    it('should derive completion from EntryViews', async () => {
      const habit: Habit = {
        id: habitId,
        categoryId: 'cat-1',
        name: 'Daily Habit',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryView = {
        habitId,
        dayKey,
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 1,
        source: 'manual' as const,
        provenance: {},
        deletedAt: null,
        conflict: false,
      };

      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([entryView]);

      const req = {
        query: { dayKey, timeZone: 'UTC' },
        userId: userId,
      } as unknown as Request;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await getDayView(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = (res.json as any).mock.calls[0][0];
      expect(response.habits).toHaveLength(1);
      expect(response.habits[0].isComplete).toBe(true);
    });
  });

  describe('/api/goalProgress endpoint', () => {
    it('should compute progress from EntryViews only', async () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: [habitId],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const habit: Habit = {
        id: habitId,
        categoryId: 'cat-1',
        name: 'Running',
        goal: {
          type: 'number',
          frequency: 'daily',
          target: 5,
          unit: 'miles',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryView = {
        habitId,
        dayKey,
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 10,
        source: 'manual' as const,
        provenance: {},
        deletedAt: null,
        conflict: false,
      };

      vi.mocked(getGoalById).mockResolvedValue(goal);
      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([entryView]);
      vi.mocked(getGoalManualLogsByGoal).mockResolvedValue([]);

      const req = {
        params: { id: 'goal-1' },
        query: { timeZone: 'UTC' },
        userId: userId,
      } as unknown as Request;
      const res = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      await getGoalProgress(req, res);

      expect(res.json).toHaveBeenCalled();
      const response = (res.json as any).mock.calls[0][0];
      expect(response.progress.currentValue).toBe(10); // Sum of entry values
      expect(response.progress.percent).toBe(10); // 10/100 * 100
    });
  });
});

