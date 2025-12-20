/**
 * Goal Progress Utils V2 Tests
 * 
 * Unit tests for goal progress aggregation using EntryViews.
 * Tests that goal progress derives from GoalLinks + EntryViews only.
 */

import { describe, it, expect } from 'vitest';
import { computeFullGoalProgressV2 } from './goalProgressUtilsV2';
import type { Goal, GoalManualLog, Habit } from '../../models/persistenceTypes';
import type { EntryView } from '../services/truthQuery';

describe('goalProgressUtilsV2', () => {
  describe('computeFullGoalProgressV2', () => {
    const timeZone = 'UTC';

    it('should count EntryViews for count mode (frequency goal)', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'frequency',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11',
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-12',
          timestampUtc: '2025-01-12T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, [], undefined, timeZone);

      // Frequency goal counts distinct dayKeys
      expect(progress.currentValue).toBe(3);
      expect(progress.percent).toBe(60); // 3/5 * 100
    });

    it('should sum EntryView values for cumulative goal', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: ['habit-1'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const habit: Habit = {
        id: 'habit-1',
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

      const habitMap = new Map<string, Habit>([['habit-1', habit]]);

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 3,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11',
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 5,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-12',
          timestampUtc: '2025-01-12T10:00:00.000Z',
          value: 2,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, [], habitMap, timeZone);

      expect(progress.currentValue).toBe(10); // 3 + 5 + 2
      expect(progress.percent).toBe(10); // 10/100 * 100
    });

    it('should treat null values as 0 for sum mode', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: ['habit-1'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const habit: Habit = {
        id: 'habit-1',
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

      const habitMap = new Map<string, Habit>([['habit-1', habit]]);

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 5,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11',
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: null, // Null value
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, [], habitMap, timeZone);

      expect(progress.currentValue).toBe(5); // 5 + 0 (null treated as 0)
    });

    it('should exclude deleted entries from progress', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'frequency',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11',
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: '2025-01-11T11:00:00.000Z', // Deleted
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-12',
          timestampUtc: '2025-01-12T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      // Filter out deleted entries before passing to function
      // (The function expects pre-filtered entries, but we test the filtering logic here)
      const activeEntries = entryViews.filter(entry => !entry.deletedAt);
      const progress = computeFullGoalProgressV2(goal, activeEntries, [], undefined, timeZone);

      // Only non-deleted entries count
      expect(progress.currentValue).toBe(2); // 2 distinct dayKeys (deleted one excluded)
    });

    it('should include manual logs for cumulative goals', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: ['habit-1'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const habit: Habit = {
        id: 'habit-1',
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

      const habitMap = new Map<string, Habit>([['habit-1', habit]]);

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 5,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const manualLogs: GoalManualLog[] = [
        {
          id: 'manual-1',
          goalId: 'goal-1',
          value: 10,
          loggedAt: '2025-01-10T12:00:00.000Z',
          createdAt: '2025-01-10T12:00:00.000Z',
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, manualLogs, habitMap, timeZone);

      expect(progress.currentValue).toBe(15); // 5 (entry) + 10 (manual)
    });

    it('should exclude boolean habits from cumulative numeric goals', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: ['habit-1', 'habit-2'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const numericHabit: Habit = {
        id: 'habit-1',
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

      const booleanHabit: Habit = {
        id: 'habit-2',
        categoryId: 'cat-1',
        name: 'Meditation',
        goal: {
          type: 'boolean',
          frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const habitMap = new Map<string, Habit>([
        ['habit-1', numericHabit],
        ['habit-2', booleanHabit],
      ]);

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 5,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-2',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 1, // Boolean habit value
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, [], habitMap, timeZone);

      // Only numeric habit contributes
      expect(progress.currentValue).toBe(5);
    });

    it('should handle onetime goals correctly', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'onetime',
        linkedHabitIds: ['habit-1'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, [], undefined, timeZone);

      // Onetime goals: percent is 0% or 100% based on completedAt
      expect(progress.percent).toBe(0); // Not completed
      expect(progress.currentValue).toBe(1); // Counts distinct dayKeys
    });

    it('should handle completed onetime goal', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'onetime',
        linkedHabitIds: ['habit-1'],
        completedAt: '2025-01-15T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const entryViews: EntryView[] = [];

      const progress = computeFullGoalProgressV2(goal, entryViews, [], undefined, timeZone);

      expect(progress.percent).toBe(100); // Completed
    });
  });
});

