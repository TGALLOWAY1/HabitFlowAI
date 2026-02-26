import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEntryViewsForHabit,
  getEntryViewsForHabits,
  type EntryView,
} from './truthQuery';
import type { HabitEntry, DayLog } from '../../models/persistenceTypes';

// Mock repositories
vi.mock('../repositories/habitEntryRepository', () => ({
  getHabitEntriesByHabit: vi.fn(),
  getHabitEntriesByUser: vi.fn(),
}));

vi.mock('../repositories/dayLogRepository', () => ({
  getDayLogsByHabit: vi.fn(),
  getDayLogsByUser: vi.fn(),
}));

import { getHabitEntriesByHabit, getHabitEntriesByUser } from '../repositories/habitEntryRepository';
import { getDayLogsByHabit, getDayLogsByUser } from '../repositories/dayLogRepository';

describe('truthQuery', () => {
  const userId = 'test-user';
  const habitId = 'habit-1';
  const timeZone = 'UTC';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntryViewsForHabit - merge and dedupe', () => {
    it('should prefer HabitEntry over DayLog when both exist for same (habitId, dayKey)', async () => {
      const dayKey = '2025-01-15';

      // HabitEntry with value 10
      const entry: HabitEntry = {
        id: 'entry-1',
        habitId,
        timestamp: '2025-01-15T10:00:00.000Z',
        date: dayKey,
        dateKey: dayKey,
        value: 10,
        source: 'manual',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
      };

      // DayLog with different value 5 (should be ignored)
      const dayLog: DayLog = {
        habitId,
        date: dayKey,
        value: 5,
        completed: true,
        source: 'manual',
      };

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([entry]);
      vi.mocked(getDayLogsByHabit).mockResolvedValue({ [`${habitId}-${dayKey}`]: dayLog });

      const views = await getEntryViewsForHabit(habitId, userId, { timeZone });

      expect(views).toHaveLength(1);
      expect(views[0].value).toBe(10); // HabitEntry value wins
      expect(views[0].source).toBe('manual'); // From HabitEntry, not 'legacy'
      expect(views[0].conflict).toBe(true); // Conflict detected (values differ)
      expect(views[0].legacyValue).toBe(5); // Legacy value stored for debugging
    });

    it('should use DayLog when no HabitEntry exists for (habitId, dayKey)', async () => {
      const dayKey = '2025-01-15';

      // No HabitEntry
      const dayLog: DayLog = {
        habitId,
        date: dayKey,
        value: 8,
        completed: true,
        source: 'manual',
      };

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([]);
      vi.mocked(getDayLogsByHabit).mockResolvedValue({ [`${habitId}-${dayKey}`]: dayLog });

      const views = await getEntryViewsForHabit(habitId, userId, { timeZone });

      expect(views).toHaveLength(1);
      expect(views[0].value).toBe(8); // DayLog value used
      expect(views[0].source).toBe('legacy'); // Marked as legacy
      expect(views[0].conflict).toBe(false); // No conflict (only one source)
    });

    it('should not set conflict when values match', async () => {
      const dayKey = '2025-01-15';

      // HabitEntry with value 10
      const entry: HabitEntry = {
        id: 'entry-1',
        habitId,
        timestamp: '2025-01-15T10:00:00.000Z',
        date: dayKey,
        dateKey: dayKey,
        value: 10,
        source: 'manual',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
      };

      // DayLog with same value 10
      const dayLog: DayLog = {
        habitId,
        date: dayKey,
        value: 10,
        completed: true,
        source: 'manual',
      };

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([entry]);
      vi.mocked(getDayLogsByHabit).mockResolvedValue({ [`${habitId}-${dayKey}`]: dayLog });

      const views = await getEntryViewsForHabit(habitId, userId, { timeZone });

      expect(views).toHaveLength(1);
      expect(views[0].value).toBe(10);
      expect(views[0].conflict).toBe(false); // No conflict (values match)
    });

    it('should handle boolean completion (value null) correctly', async () => {
      const dayKey = '2025-01-15';

      // HabitEntry with value 1 (boolean completion)
      const entry: HabitEntry = {
        id: 'entry-1',
        habitId,
        timestamp: '2025-01-15T10:00:00.000Z',
        date: dayKey,
        dateKey: dayKey,
        value: 1,
        source: 'manual',
        createdAt: '2025-01-15T10:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
      };

      // DayLog with completed=true, value=0 (boolean completion)
      // This gets mapped to value=null, but legacyValue=0
      const dayLog: DayLog = {
        habitId,
        date: dayKey,
        value: 0,
        completed: true,
        source: 'manual',
      };

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([entry]);
      vi.mocked(getDayLogsByHabit).mockResolvedValue({ [`${habitId}-${dayKey}`]: dayLog });

      const views = await getEntryViewsForHabit(habitId, userId, { timeZone });

      expect(views).toHaveLength(1);
      expect(views[0].value).toBe(1); // HabitEntry value wins
      // Conflict: entry value=1 vs legacy originalValue=0 (stored in legacyValue)
      expect(views[0].conflict).toBe(true);
      expect(views[0].legacyValue).toBe(0); // Original legacy value was 0
    });

    it('should sort by dayKey asc, then timestampUtc asc', async () => {
      const dayKey1 = '2025-01-15';
      const dayKey2 = '2025-01-16';
      const dayKey3 = '2025-01-15'; // Same day as dayKey1

      const entries: HabitEntry[] = [
        {
          id: 'entry-2',
          habitId,
          timestamp: '2025-01-16T10:00:00.000Z',
          date: dayKey2,
          dateKey: dayKey2,
          value: 5,
          source: 'manual',
          createdAt: '2025-01-16T10:00:00.000Z',
          updatedAt: '2025-01-16T10:00:00.000Z',
        },
        {
          id: 'entry-3',
          habitId,
          timestamp: '2025-01-15T15:00:00.000Z', // Later timestamp
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
          timestamp: '2025-01-15T10:00:00.000Z', // Earlier timestamp
          date: dayKey1,
          dateKey: dayKey1,
          value: 1,
          source: 'manual',
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z',
        },
      ];

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue(entries);
      vi.mocked(getDayLogsByHabit).mockResolvedValue({});

      const views = await getEntryViewsForHabit(habitId, userId, { timeZone });

      expect(views).toHaveLength(3);
      // First: dayKey 2025-01-15, timestamp 10:00
      expect(views[0].dayKey).toBe('2025-01-15');
      expect(views[0].timestampUtc).toBe('2025-01-15T10:00:00.000Z');
      expect(views[0].value).toBe(1);
      // Second: dayKey 2025-01-15, timestamp 15:00
      expect(views[1].dayKey).toBe('2025-01-15');
      expect(views[1].timestampUtc).toBe('2025-01-15T15:00:00.000Z');
      expect(views[1].value).toBe(3);
      // Third: dayKey 2025-01-16
      expect(views[2].dayKey).toBe('2025-01-16');
      expect(views[2].timestampUtc).toBe('2025-01-16T10:00:00.000Z');
      expect(views[2].value).toBe(5);
    });

    it('should filter by date range when provided', async () => {
      const entries: HabitEntry[] = [
        {
          id: 'entry-1',
          habitId,
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
      vi.mocked(getDayLogsByHabit).mockResolvedValue({});

      const views = await getEntryViewsForHabit(habitId, userId, {
        startDayKey: '2025-01-12',
        endDayKey: '2025-01-18',
        timeZone,
      });

      expect(views).toHaveLength(1);
      expect(views[0].dayKey).toBe('2025-01-15');
      expect(views[0].value).toBe(2);
    });

    it('should ignore legacy DayLog fallback when includeLegacyFallback=false', async () => {
      const dayKey = '2025-01-15';
      const dayLog: DayLog = {
        habitId,
        date: dayKey,
        value: 1,
        completed: true,
        source: 'manual',
      };

      vi.mocked(getHabitEntriesByHabit).mockResolvedValue([]);
      vi.mocked(getDayLogsByHabit).mockResolvedValue({ [`${habitId}-${dayKey}`]: dayLog });

      const views = await getEntryViewsForHabit(habitId, userId, {
        timeZone,
        includeLegacyFallback: false,
      });

      expect(views).toHaveLength(0);
      expect(getDayLogsByHabit).not.toHaveBeenCalled();
    });
  });

  describe('getEntryViewsForHabits - batch merge', () => {
    it('should merge entries from multiple habits correctly', async () => {
      const habitId2 = 'habit-2';
      const dayKey = '2025-01-15';

      const entries: HabitEntry[] = [
        {
          id: 'entry-1',
          habitId,
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
          timestamp: '2025-01-15T11:00:00.000Z',
          date: dayKey,
          dateKey: dayKey,
          value: 20,
          source: 'manual',
          createdAt: '2025-01-15T11:00:00.000Z',
          updatedAt: '2025-01-15T11:00:00.000Z',
        },
      ];

      const dayLogs: Record<string, DayLog> = {
        [`${habitId}-${dayKey}`]: {
          habitId,
          date: dayKey,
          value: 5,
          completed: true,
          source: 'manual',
        },
      };

      vi.mocked(getHabitEntriesByUser).mockResolvedValue(entries);
      vi.mocked(getDayLogsByUser).mockResolvedValue(dayLogs);

      const views = await getEntryViewsForHabits([habitId, habitId2], userId, { timeZone });

      expect(views).toHaveLength(2);
      
      // Habit 1: Has entry (value 10) and legacy (value 5) - entry wins, conflict detected
      const habit1View = views.find(v => v.habitId === habitId);
      expect(habit1View).toBeDefined();
      expect(habit1View?.value).toBe(10);
      expect(habit1View?.conflict).toBe(true);
      
      // Habit 2: Only entry (value 20), no legacy
      const habit2View = views.find(v => v.habitId === habitId2);
      expect(habit2View).toBeDefined();
      expect(habit2View?.value).toBe(20);
      expect(habit2View?.conflict).toBe(false);
    });
  });
});
