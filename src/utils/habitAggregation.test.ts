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

function makeEntry(habitId: string, dateKey: string, overrides: Partial<HabitEntry> = {}): HabitEntry {
  return {
    id: `entry-${habitId}-${dateKey}`,
    habitId,
    dateKey,
    timestamp: `${dateKey}T12:00:00Z`,
    createdAt: `${dateKey}T12:00:00Z`,
    source: 'manual',
    ...overrides,
  } as HabitEntry;
}

const schema = {
  habits: [
    { id: 'child-1', name: 'A' },
    { id: 'child-2', name: 'B' },
    { id: 'child-3', name: 'C' },
  ] as Habit[],
};

describe('computeHabitStatus — numeric completion', () => {
  const dateKey = '2026-03-29';
  const numericHabit = {
    id: 'numeric-1',
    categoryId: 'cat-1',
    name: 'Drink water',
    goal: { type: 'number', frequency: 'daily', target: 10, unit: 'glasses' },
    archived: false,
    createdAt: '2026-01-01T00:00:00Z',
  } as Habit;

  it.each([
    { value: 0, isComplete: false, isPartial: false },
    { value: 5, isComplete: false, isPartial: true },
    { value: 10, isComplete: true, isPartial: false },
    { value: 12.5, isComplete: true, isPartial: false },
  ])('derives $value against the configured target', ({ value, isComplete, isPartial }) => {
    const entries = value === 0 ? [] : [makeEntry(numericHabit.id, dateKey, { value })];
    const result = computeHabitStatus(numericHabit, entries, dateKey, { habits: [numericHabit] });

    expect(result.currentValue).toBe(value);
    expect(result.targetValue).toBe(10);
    expect(result.isComplete).toBe(isComplete);
    expect(result.isPartial).toBe(isPartial);
  });

  it('does not invent completion when a numeric target is missing', () => {
    const habit = {
      ...numericHabit,
      id: 'numeric-without-target',
      goal: { type: 'number', frequency: 'daily', unit: 'pages' },
    } as Habit;
    const result = computeHabitStatus(
      habit,
      [makeEntry(habit.id, dateKey, { value: 5 })],
      dateKey,
      { habits: [habit] },
    );

    expect(result.isComplete).toBe(false);
    expect(result.isPartial).toBe(true);
  });
});

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
