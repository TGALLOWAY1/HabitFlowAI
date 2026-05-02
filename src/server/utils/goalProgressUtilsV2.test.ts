/**
 * Goal Progress Utils V2 Tests
 * 
 * Unit tests for goal progress aggregation using EntryViews.
 * Tests that goal progress derives from GoalLinks + EntryViews only.
 */

import { describe, it, expect } from 'vitest';
import { computeFullGoalProgressV2, computeMilestoneStates } from './goalProgressUtilsV2';
import type { Goal, Habit } from '../../models/persistenceTypes';
import type { EntryView } from '../services/truthQuery';

describe('goalProgressUtilsV2', () => {
  describe('computeFullGoalProgressV2', () => {
    const timeZone = 'UTC';

    it('should count EntryViews for count mode (cumulative goal with count aggregation)', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'count',
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

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

      // Count mode counts distinct dayKeys
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

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

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

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

      expect(progress.currentValue).toBe(5); // 5 + 0 (null treated as 0)
    });

    it('should exclude deleted entries from progress', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'count',
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
      const progress = computeFullGoalProgressV2(goal, activeEntries, undefined, timeZone);

      // Only non-deleted entries count
      expect(progress.currentValue).toBe(2); // 2 distinct dayKeys (deleted one excluded)
    });

    it('cumulative goal sums entry values only', () => {
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

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

      expect(progress.currentValue).toBe(5);
    });

    it('should count boolean habits using their target value for cumulative goals', () => {
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

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

      // Numeric habit contributes 5, boolean habit contributes 1 (no target set, defaults to 1)
      expect(progress.currentValue).toBe(6);
    });

    it('should use boolean habit target value for cumulative goals', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Do 500 pull ups',
        type: 'cumulative',
        targetValue: 500,
        unit: 'reps',
        linkedHabitIds: ['habit-pullups'],
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const pullupHabit: Habit = {
        id: 'habit-pullups',
        categoryId: 'cat-1',
        name: 'Do 25 pull ups',
        goal: {
          type: 'boolean',
          frequency: 'daily',
          target: 25,
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const habitMap = new Map<string, Habit>([
        ['habit-pullups', pullupHabit],
      ]);

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-pullups',
          dayKey: '2025-01-10',
          timestampUtc: '2025-01-10T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-pullups',
          dayKey: '2025-01-11',
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-pullups',
          dayKey: '2025-01-12',
          timestampUtc: '2025-01-12T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

      // 3 entries × 25 (habit target) = 75
      expect(progress.currentValue).toBe(75);
      expect(progress.percent).toBe(15); // 75/500 = 15%
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

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

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

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

      expect(progress.percent).toBe(100); // Completed
    });

    it('should count distinct dayKeys when countMode is distinctDays (default)', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'count',
        countMode: 'distinctDays', // Explicit
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
          dayKey: '2025-01-10', // Same day, second entry
          timestampUtc: '2025-01-10T15:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11', // Different day
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

      // distinctDays: 2 entries on same day count as 1 day
      expect(progress.currentValue).toBe(2); // 2 distinct dayKeys
    });

    it('should count all entries when countMode is entries', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'count',
        countMode: 'entries', // Count all entries
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
          dayKey: '2025-01-10', // Same day, second entry
          timestampUtc: '2025-01-10T15:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11', // Different day
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

      // entries: count all entries, even on same day
      expect(progress.currentValue).toBe(3); // All 3 entries
    });

    it('should default to distinctDays for count goals without explicit countMode', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 5,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'count',
        // No countMode specified - should default to distinctDays
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
          dayKey: '2025-01-10', // Same day
          timestampUtc: '2025-01-10T15:00:00.000Z',
          value: 1,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

      // Default: distinctDays
      expect(progress.currentValue).toBe(1); // 1 distinct dayKey
    });

    it('should generate unit mismatch warnings for sum mode', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'sum',
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
          unit: 'kilometers', // Unit mismatch
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
        {
          habitId: 'habit-1',
          dayKey: '2025-01-11',
          timestampUtc: '2025-01-11T10:00:00.000Z',
          value: 3,
          unit: 'miles', // Matching unit
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

      // Value still included (deterministic: include with warning)
      expect(progress.currentValue).toBe(8); // 5 + 3
      expect(progress.warnings).toBeDefined();
      expect(progress.warnings?.length).toBe(1);
      expect(progress.warnings?.[0].type).toBe('UNIT_MISMATCH');
      expect(progress.warnings?.[0].habitId).toBe('habit-1');
      expect(progress.warnings?.[0].expectedUnit).toBe('miles');
      expect(progress.warnings?.[0].foundUnit).toBe('kilometers');
    });

    it('should not generate warnings when units match', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'sum',
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
          unit: 'miles', // Matching unit
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, habitMap, timeZone);

      expect(progress.currentValue).toBe(5);
      expect(progress.warnings).toBeUndefined(); // No warnings
    });

    it('should use explicit aggregationMode over goal.type inference', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'Test Goal',
        type: 'cumulative', // Would normally infer 'sum'
        targetValue: 100,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'count', // Explicit override
        countMode: 'distinctDays',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

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
          value: 3,
          source: 'manual',
          provenance: {},
          deletedAt: null,
          conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, timeZone);

      // Should count days, not sum values
      expect(progress.currentValue).toBe(2); // 2 distinct dayKeys
    });
  });

  describe('computeMilestoneStates', () => {
    function makeEntries(values: Array<{ dayKey: string; value: number }>): EntryView[] {
      return values.map(({ dayKey, value }, i) => ({
        habitId: 'habit-1',
        dayKey: dayKey as EntryView['dayKey'],
        timestampUtc: `${dayKey}T10:0${i}:00.000Z`,
        value,
        source: 'manual',
        provenance: {},
        deletedAt: null,
        conflict: false,
      }));
    }

    it('marks milestones completed when currentValue crosses their threshold (sum aggregation)', () => {
      const entries = makeEntries([
        { dayKey: '2025-01-01', value: 10 },
        { dayKey: '2025-01-02', value: 20 },
        { dayKey: '2025-01-05', value: 30 },
      ]);

      const states = computeMilestoneStates({
        milestones: [
          { id: 'a', value: 25 },
          { id: 'b', value: 50 },
          { id: 'c', value: 75 },
        ],
        currentValue: 60,
        entries,
        aggregationMode: 'sum',
        countMode: 'distinctDays',
      });

      expect(states.map((s) => s.completed)).toEqual([true, true, false]);
      expect(states[0].completedAtDayKey).toBe('2025-01-02'); // 10+20=30 >= 25
      expect(states[1].completedAtDayKey).toBe('2025-01-05'); // 30+30=60 >= 50
      expect(states[2].completedAtDayKey).toBeUndefined();
    });

    it('returns empty when goal has no milestones', () => {
      const states = computeMilestoneStates({
        milestones: undefined,
        currentValue: 100,
        entries: [],
        aggregationMode: 'sum',
        countMode: 'distinctDays',
      });
      expect(states).toEqual([]);
    });

    it('preserves input ordering of milestones', () => {
      const entries = makeEntries([{ dayKey: '2025-01-01', value: 100 }]);
      const states = computeMilestoneStates({
        milestones: [
          { id: 'b', value: 50 },
          { id: 'a', value: 25 },
          { id: 'c', value: 75 },
        ],
        currentValue: 100,
        entries,
        aggregationMode: 'sum',
        countMode: 'distinctDays',
      });
      expect(states.map((s) => s.id)).toEqual(['b', 'a', 'c']);
      expect(states.every((s) => s.completed)).toBe(true);
    });

    it('mirrors acknowledgedAt onto the state', () => {
      const ackTime = '2025-04-15T00:00:00.000Z';
      const states = computeMilestoneStates({
        milestones: [
          { id: 'a', value: 25, acknowledgedAt: ackTime },
          { id: 'b', value: 50 },
        ],
        currentValue: 30,
        entries: makeEntries([{ dayKey: '2025-01-01', value: 30 }]),
        aggregationMode: 'sum',
        countMode: 'distinctDays',
      });
      expect(states[0].acknowledgedAt).toBe(ackTime);
      expect(states[1].acknowledgedAt).toBeUndefined();
    });

    it('crosses milestones via boolean target multipliers', () => {
      const habit: Habit = {
        id: 'habit-1',
        categoryId: 'cat-1',
        name: 'Pull-ups',
        goal: { type: 'boolean', frequency: 'daily', target: 25 },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      const habitMap = new Map<string, Habit>([['habit-1', habit]]);

      const entries: EntryView[] = [
        {
          habitId: 'habit-1', dayKey: '2025-01-01' as EntryView['dayKey'],
          timestampUtc: '2025-01-01T00:00:00.000Z', value: 1,
          source: 'manual', provenance: {}, deletedAt: null, conflict: false,
        },
        {
          habitId: 'habit-1', dayKey: '2025-01-02' as EntryView['dayKey'],
          timestampUtc: '2025-01-02T00:00:00.000Z', value: 1,
          source: 'manual', provenance: {}, deletedAt: null, conflict: false,
        },
      ];

      const states = computeMilestoneStates({
        milestones: [{ id: 'a', value: 40 }],
        currentValue: 50, // 2 entries × target 25
        entries,
        aggregationMode: 'sum',
        countMode: 'distinctDays',
        habitMap,
      });

      expect(states[0].completed).toBe(true);
      expect(states[0].completedAtDayKey).toBe('2025-01-02');
    });

    it('count/distinctDays: completion at the day the cumulative day count crosses', () => {
      const entries = makeEntries([
        { dayKey: '2025-01-01', value: 1 },
        { dayKey: '2025-01-02', value: 1 },
        { dayKey: '2025-01-02', value: 1 }, // duplicate day, no increment
        { dayKey: '2025-01-04', value: 1 },
      ]);

      const states = computeMilestoneStates({
        milestones: [{ id: 'a', value: 2 }, { id: 'b', value: 5 }],
        currentValue: 3,
        entries,
        aggregationMode: 'count',
        countMode: 'distinctDays',
      });

      expect(states[0].completed).toBe(true);
      expect(states[0].completedAtDayKey).toBe('2025-01-02');
      expect(states[1].completed).toBe(false);
    });

    it('list path (entries=null) returns completion flag without completedAtDayKey', () => {
      const states = computeMilestoneStates({
        milestones: [{ id: 'a', value: 25 }, { id: 'b', value: 75 }],
        currentValue: 50,
        entries: null,
        aggregationMode: 'sum',
        countMode: 'distinctDays',
      });

      expect(states[0]).toMatchObject({ id: 'a', completed: true });
      expect(states[0].completedAtDayKey).toBeUndefined();
      expect(states[1]).toMatchObject({ id: 'b', completed: false });
    });

    it('full progress includes milestoneStates when goal has milestones', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: '100 Pull-Ups',
        type: 'cumulative',
        targetValue: 100,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'sum',
        createdAt: '2025-01-01T00:00:00.000Z',
        milestones: [{ id: 'm1', value: 25 }, { id: 'm2', value: 75 }],
      };

      const entryViews: EntryView[] = [
        {
          habitId: 'habit-1', dayKey: '2025-01-10' as EntryView['dayKey'],
          timestampUtc: '2025-01-10T10:00:00.000Z', value: 30,
          source: 'manual', provenance: {}, deletedAt: null, conflict: false,
        },
      ];

      const progress = computeFullGoalProgressV2(goal, entryViews, undefined, 'UTC');
      expect(progress.milestoneStates).toHaveLength(2);
      expect(progress.milestoneStates![0]).toMatchObject({
        id: 'm1', completed: true, completedAtDayKey: '2025-01-10',
      });
      expect(progress.milestoneStates![1].completed).toBe(false);
    });

    it('full progress omits milestoneStates when goal has none', () => {
      const goal: Goal = {
        id: 'goal-1',
        title: 'No milestones',
        type: 'cumulative',
        targetValue: 100,
        linkedHabitIds: ['habit-1'],
        aggregationMode: 'sum',
        createdAt: '2025-01-01T00:00:00.000Z',
      };

      const progress = computeFullGoalProgressV2(goal, [], undefined, 'UTC');
      expect(progress.milestoneStates).toBeUndefined();
    });
  });
});

