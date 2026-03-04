import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEntryViewsForHabit,
  getEntryViewsForHabits,
} from './truthQuery';
import type { HabitEntry } from '../../models/persistenceTypes';

vi.mock('../repositories/habitEntryRepository', () => ({
  getHabitEntriesByHabit: vi.fn(),
  getHabitEntriesByUser: vi.fn(),
}));

import { getHabitEntriesByHabit, getHabitEntriesByUser } from '../repositories/habitEntryRepository';

describe('truthQuery', () => {
  const householdId = 'household-1';
  const userId = 'test-user';
  const habitId = 'habit-1';
  const timeZone = 'UTC';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntryViewsForHabit', () => {
    it('should return entry views from HabitEntries only', async () => {
      const dayKey = '2025-01-15';
      const entry: HabitEntry = {
        id: 'entry-1',
        habitId,
        dayKey,
        timestamp: '2025-01-15T10:00:00.000Z',
        date: dayKey,
        dateKey: dayKey,
        value: 10,
        source: 'manual',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
      };

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([entry]);

      const views = await getEntryViewsForHabit(habitId, householdId, userId, { timeZone });

      expect(views).toHaveLength(1);
      expect(views[0].value).toBe(10);
      expect(views[0].dayKey).toBe(dayKey);
      expect(views[0].source).toBe('manual');
    });

    it('should return empty when no entries', async () => {
      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([]);

      const views = await getEntryViewsForHabit(habitId, householdId, userId, { timeZone });

      expect(views).toHaveLength(0);
    });

    it('should sort by dayKey then timestampUtc', async () => {
      const dayKey1 = '2025-01-15';
      const dayKey2 = '2025-01-16';
      const dayKey3 = '2025-01-15';
      const entries: HabitEntry[] = [
        {
          id: 'entry-3',
          habitId,
          dayKey: dayKey3,
          timestamp: '2025-01-15T15:00:00.000Z',
          date: dayKey3,
          dateKey: dayKey3,
          value: 3,
          source: 'manual',
          createdAt: '2025-01-15T15:00:00.000Z',
          updatedAt: '2025-01-15T15:00:00.000Z',
        },
        {
          id: 'entry-1',
          habitId,
          dayKey: dayKey1,
          timestamp: '2025-01-15T10:00:00.000Z',
          date: dayKey1,
          dateKey: dayKey1,
          value: 1,
          source: 'manual',
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
        {
          id: 'entry-2',
          habitId,
          dayKey: dayKey2,
          timestamp: '2025-01-16T10:00:00.000Z',
          date: dayKey2,
          dateKey: dayKey2,
          value: 5,
          source: 'manual',
          createdAt: '2025-01-16T10:00:00.000Z',
          updatedAt: '2025-01-16T10:00:00.000Z',
        },
      ];

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue(entries);

      const views = await getEntryViewsForHabit(habitId, householdId, userId, { timeZone });

      expect(views).toHaveLength(3);
      expect(views[0].dayKey).toBe('2025-01-15');
      expect(views[0].timestampUtc).toBe('2025-01-15T10:00:00.000Z');
      expect(views[0].value).toBe(1);
      expect(views[1].dayKey).toBe('2025-01-15');
      expect(views[1].timestampUtc).toBe('2025-01-15T15:00:00.000Z');
      expect(views[1].value).toBe(3);
      expect(views[2].dayKey).toBe('2025-01-16');
      expect(views[2].value).toBe(5);
    });

    it('should filter by date range when provided', async () => {
      const entries: HabitEntry[] = [
        {
          id: 'entry-1',
          habitId,
          dayKey: '2025-01-10',
          timestamp: '2025-01-10T10:00:00.000Z',
          date: '2025-01-10',
          dateKey: '2025-01-10',
          value: 1,
          source: 'manual',
          createdAt: '2025-01-10T10:00:00.000Z',
          updatedAt: '2025-01-10T10:00:00.000Z',
        },
        {
          id: 'entry-2',
          habitId,
          dayKey: '2025-01-15',
          timestamp: '2025-01-15T10:00:00.000Z',
          date: '2025-01-15',
          dateKey: '2025-01-15',
          value: 2,
          source: 'manual',
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
        {
          id: 'entry-3',
          habitId,
          dayKey: '2025-01-20',
          timestamp: '2025-01-20T10:00:00.000Z',
          date: '2025-01-20',
          dateKey: '2025-01-20',
          value: 3,
          source: 'manual',
          createdAt: '2025-01-20T10:00:00.000Z',
          updatedAt: '2025-01-20T10:00:00.000Z',
        },
      ];

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue(entries);

      const views = await getEntryViewsForHabit(habitId, householdId, userId, {
        startDayKey: '2025-01-12',
        endDayKey: '2025-01-18',
        timeZone,
      });

      expect(views).toHaveLength(1);
      expect(views[0].dayKey).toBe('2025-01-15');
      expect(views[0].value).toBe(2);
    });
  });

  describe('getEntryViewsForHabits', () => {
    it('should merge entries from multiple habits', async () => {
      const habitId2 = 'habit-2';
      const dayKey = '2025-01-15';

      const entries: HabitEntry[] = [
        {
          id: 'entry-1',
          habitId,
          dayKey,
          timestamp: '2025-01-15T10:00:00.000Z',
          date: dayKey,
          dateKey: dayKey,
          value: 10,
          source: 'manual',
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
        {
          id: 'entry-2',
          habitId: habitId2,
          dayKey,
          timestamp: '2025-01-15T11:00:00.000Z',
          date: dayKey,
          dateKey: dayKey,
          value: 20,
          source: 'manual',
          createdAt: '2025-01-15T11:00:00.000Z',
          updatedAt: '2025-01-15T11:00:00.000Z',
        },
      ];

      vi.mocked(getHabitEntriesByUser).mockResolvedValue(entries);

      const views = await getEntryViewsForHabits([habitId, habitId2], householdId, userId, {
        timeZone,
      });

      expect(views).toHaveLength(2);
      const v1 = views.find(v => v.habitId === habitId);
      const v2 = views.find(v => v.habitId === habitId2);
      expect(v1?.value).toBe(10);
      expect(v2?.value).toBe(20);
    });
  });
});
