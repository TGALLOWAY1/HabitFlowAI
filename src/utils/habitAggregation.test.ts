/**
 * Habit Aggregation Tests — Checklist Bundle Success Rule
 *
 * Tests that checklist bundles correctly evaluate configurable success rules.
 */

import { describe, it, expect } from 'vitest';
import { computeHabitStatus } from './habitAggregation';
import type { Habit, HabitEntry } from '../models/persistenceTypes';

function makeChecklistBundle(overrides?: Partial<Habit>): Habit {
  return {
    id: 'bundle-1',
    categoryId: 'cat-1',
    name: 'Chores',
    type: 'bundle',
    bundleType: 'checklist',
    subHabitIds: ['child-1', 'child-2', 'child-3'],
    goal: { type: 'boolean', frequency: 'daily' },
    archived: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Habit;
}

function makeEntry(habitId: string, dateKey: string): HabitEntry {
  return {
    id: `entry-${habitId}-${dateKey}`,
    habitId,
    dateKey,
    timestamp: `${dateKey}T12:00:00Z`,
    createdAt: `${dateKey}T12:00:00Z`,
    source: 'manual',
  } as HabitEntry;
}

const schema = {
  habits: [
    { id: 'child-1', name: 'A' },
    { id: 'child-2', name: 'B' },
    { id: 'child-3', name: 'C' },
  ] as Habit[],
};

describe('computeHabitStatus — checklist bundle', () => {
  const dateKey = '2026-03-29';

  describe('default (full) rule', () => {
    const habit = makeChecklistBundle();

    it('should be complete when all children have entries', () => {
      const entries = [
        makeEntry('child-1', dateKey),
        makeEntry('child-2', dateKey),
        makeEntry('child-3', dateKey),
      ];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(true);
      expect(result.meetsSuccessRule).toBe(true);
      expect(result.isFullyComplete).toBe(true);
      expect(result.completedChildrenCount).toBe(3);
      expect(result.totalChildrenCount).toBe(3);
    });

    it('should not be complete when some children missing', () => {
      const entries = [
        makeEntry('child-1', dateKey),
        makeEntry('child-2', dateKey),
      ];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(false);
      expect(result.meetsSuccessRule).toBe(false);
      expect(result.isFullyComplete).toBe(false);
      expect(result.completedChildrenCount).toBe(2);
    });
  });

  describe('any rule', () => {
    const habit = makeChecklistBundle({ checklistSuccessRule: { type: 'any' } });

    it('should succeed with 1 child complete', () => {
      const entries = [makeEntry('child-1', dateKey)];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(true);
      expect(result.meetsSuccessRule).toBe(true);
      expect(result.isFullyComplete).toBe(false);
    });

    it('should fail with 0 complete', () => {
      const result = computeHabitStatus(habit, [], dateKey, schema);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('threshold rule', () => {
    const habit = makeChecklistBundle({ checklistSuccessRule: { type: 'threshold', threshold: 2 } });

    it('should succeed at threshold', () => {
      const entries = [makeEntry('child-1', dateKey), makeEntry('child-2', dateKey)];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(true);
      expect(result.isFullyComplete).toBe(false);
    });

    it('should fail below threshold', () => {
      const entries = [makeEntry('child-1', dateKey)];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(false);
    });
  });

  describe('percent rule', () => {
    const habit = makeChecklistBundle({ checklistSuccessRule: { type: 'percent', percent: 60 } });

    it('should succeed at 2/3 (67%)', () => {
      const entries = [makeEntry('child-1', dateKey), makeEntry('child-2', dateKey)];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(true);
    });

    it('should fail at 1/3 (33%)', () => {
      const entries = [makeEntry('child-1', dateKey)];
      const result = computeHabitStatus(habit, entries, dateKey, schema);
      expect(result.isComplete).toBe(false);
    });
  });
});
