import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeDayView } from './dayViewService';
import type { Habit } from '../../models/persistenceTypes';
import type { EntryView } from './truthQuery';

// Mock repositories and services
vi.mock('../repositories/habitRepository', () => ({
  getHabitsByUser: vi.fn(),
}));

vi.mock('./truthQuery', () => ({
  getEntryViewsForHabits: vi.fn(),
}));

vi.mock('../repositories/bundleMembershipRepository', () => ({
  getMembershipsForDay: vi.fn().mockResolvedValue([]),
}));

import { getHabitsByUser } from '../repositories/habitRepository';
import { getMembershipsForDay } from '../repositories/bundleMembershipRepository';
import { getEntryViewsForHabits } from './truthQuery';

describe('dayViewService', () => {
  const userId = 'test-user';
  const dayKey = '2025-01-15' as const; // Wednesday
  const timeZone = 'UTC';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMembershipsForDay).mockResolvedValue([]);
  });

  describe('computeDayView', () => {
    it('should derive daily completion from EntryViews existence', async () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Daily Habit',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryView: EntryView = {
        habitId: 'habit-1',
        dayKey: '2025-01-15',
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 1,
        source: 'manual',
        provenance: {},
        deletedAt: null,
        conflict: false,
      };

      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([entryView]);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);

      expect(result.dayKey).toBe(dayKey);
      expect(result.habits).toHaveLength(1);
      expect(result.habits[0].habit.id).toBe('habit-1');
      expect(result.habits[0].isComplete).toBe(true);
      expect(result.habits[0].currentValue).toBe(1);
      expect(result.habits[0].targetValue).toBe(1);
      expect(result.habits[0].progressPercent).toBe(100);
    });

    it('should not count deleted entries for completion', async () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Daily Habit',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const deletedEntryView: EntryView = {
        habitId: 'habit-1',
        dayKey: '2025-01-15',
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 1,
        source: 'manual',
        provenance: {},
        deletedAt: '2025-01-15T11:00:00.000Z', // Deleted
        conflict: false,
      };

      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([deletedEntryView]);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);

      expect(result.habits[0].isComplete).toBe(false);
      expect(result.habits[0].currentValue).toBe(0);
      expect(result.habits[0].progressPercent).toBe(0);
    });

    it('should derive weekly binary completion (any entry in week)', async () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Weekly Habit',
        goal: {
          type: 'boolean',
          frequency: 'daily',
          target: 1,
        },
        timesPerWeek: 1,
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      // Week window: 2025-01-13 (Mon) to 2025-01-19 (Sun)
      const entryView: EntryView = {
        habitId: 'habit-1',
        dayKey: '2025-01-14', // Tuesday in the week
        timestampUtc: '2025-01-14T10:00:00.000Z',
        value: 1,
        source: 'manual',
        provenance: {},
        deletedAt: null,
        conflict: false,
      };

      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([entryView]);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);

      expect(result.habits[0].isComplete).toBe(true);
      expect(result.habits[0].currentValue).toBe(1);
      expect(result.habits[0].targetValue).toBe(1);
      expect(result.habits[0].weekComplete).toBe(true);
    });

    it('should derive weekly frequency completion (count distinct days)', async () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Weekly Habit',
        goal: {
          type: 'boolean',
          frequency: 'daily',
          target: 1,
        },
        timesPerWeek: 3,
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      // Week window: 2025-01-13 (Mon) to 2025-01-19 (Sun)
      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-13', // Monday
          timestampUtc: '2025-01-13T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-14', // Tuesday
          timestampUtc: '2025-01-14T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-15', // Wednesday
          timestampUtc: '2025-01-15T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue(entryViews);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);

      expect(result.habits[0].isComplete).toBe(true);
      expect(result.habits[0].currentValue).toBe(3); // 3 distinct days
      expect(result.habits[0].targetValue).toBe(3);
      expect(result.habits[0].progressPercent).toBe(100);
    });

    it('should count completed numeric days toward a weekly occurrence quota', async () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Weekly Quantity Habit',
        goal: {
          type: 'number',
          frequency: 'daily',
          target: 10,
          unit: 'miles',
        },
        timesPerWeek: 2,
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      // Week window: 2025-01-13 (Mon) to 2025-01-19 (Sun)
      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-13',
          timestampUtc: '2025-01-13T10:00:00.000Z',
          value: 10,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-14',
          timestampUtc: '2025-01-14T10:00:00.000Z',
          value: 4,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-15',
          timestampUtc: '2025-01-15T10:00:00.000Z',
          value: 10,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue(entryViews);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);

      expect(result.habits[0].isComplete).toBe(true);
      expect(result.habits[0].currentValue).toBe(2); // Monday and Wednesday met the daily target
      expect(result.habits[0].targetValue).toBe(2);
      expect(result.habits[0].progressPercent).toBe(100);
    });

    it('should derive bundle parent completion from children', async () => {
      const childHabit1: Habit = {
        id: 'child-1',
        categoryId: 'cat-1',
        name: 'Child 1',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const childHabit2: Habit = {
        id: 'child-2',
        categoryId: 'cat-1',
        name: 'Child 2',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const bundleHabit: Habit = {
        id: 'bundle-1',
        categoryId: 'cat-1',
        name: 'Bundle',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        type: 'bundle',
        subHabitIds: ['child-1', 'child-2'],
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      // Child 1 has entry, child 2 does not
      const entryView: EntryView = {
        habitId: 'child-1',
        dayKey: '2025-01-15',
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 1,
        source: 'manual',
        provenance: {},
        deletedAt: null,
        conflict: false,
      };

      vi.mocked(getHabitsByUser).mockResolvedValue([bundleHabit, childHabit1, childHabit2]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([entryView]);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);

      const bundleStatus = result.habits.find(h => h.habit.id === 'bundle-1');
      expect(bundleStatus).toBeDefined();
      expect(bundleStatus?.isComplete).toBe(true); // Any child complete
      expect(bundleStatus?.completedChildrenCount).toBe(1);
      expect(bundleStatus?.totalChildrenCount).toBe(2);
      expect(bundleStatus?.progressPercent).toBe(50);
    });

    it('does not treat partial numeric child progress as bundle completion', async () => {
      const numericChild: Habit = {
        id: 'numeric-child',
        categoryId: 'cat-1',
        name: 'Read pages',
        goal: { type: 'number', frequency: 'daily', target: 10, unit: 'pages' },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      const bundleHabit: Habit = {
        id: 'bundle-1',
        categoryId: 'cat-1',
        name: 'Evening routine',
        type: 'bundle',
        bundleType: 'choice',
        subHabitIds: ['numeric-child'],
        goal: { type: 'boolean', frequency: 'daily' },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      const partialEntry: EntryView = {
        habitId: numericChild.id,
        dayKey,
        timestampUtc: '2025-01-15T10:00:00.000Z',
        value: 5,
        source: 'manual',
        provenance: {},
        deletedAt: null,
        conflict: false,
      };

      vi.mocked(getHabitsByUser).mockResolvedValue([bundleHabit, numericChild]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([partialEntry]);

      const result = await computeDayView('household-1', userId, dayKey, timeZone);
      const bundleStatus = result.habits.find(status => status.habit.id === bundleHabit.id);

      expect(bundleStatus?.isComplete).toBe(false);
      expect(bundleStatus?.completedChildrenCount).toBe(0);
    });

    it('requests a week window (Mon-Sun) of dayKeys from truthQuery for the given dayKey', async () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Daily',
        goal: { type: 'boolean', frequency: 'daily' },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      vi.mocked(getHabitsByUser).mockResolvedValue([habit]);
      vi.mocked(getEntryViewsForHabits).mockResolvedValue([]);

      await computeDayView('household-1', userId, '2025-01-15', timeZone);

      const args = vi.mocked(getEntryViewsForHabits).mock.calls[0][3];
      expect(args.startDayKey).toBe('2025-01-13');
      expect(args.endDayKey).toBe('2025-01-19');
      expect(args.timeZone).toBe(timeZone);
    });
  });
});
