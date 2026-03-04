/**
 * Tests for canonical habit entry upsert payload builder.
 * Ensures only server-allowed fields are included and forbidden fields are stripped.
 */

import { describe, it, expect } from 'vitest';
import { buildHabitEntryUpsertPayload } from './habitEntryPayload';

describe('buildHabitEntryUpsertPayload', () => {
  it('returns only allowed keys and expected shape', () => {
    const data = {
      value: 1,
      source: 'manual' as const,
      bundleOptionId: 'opt-1',
      bundleOptionLabel: 'Option One',
    };
    const out = buildHabitEntryUpsertPayload(data);
    expect(out).toEqual({
      value: 1,
      source: 'manual',
      bundleOptionId: 'opt-1',
      bundleOptionLabel: 'Option One',
    });
    expect(Object.keys(out).sort()).toEqual(['bundleOptionId', 'bundleOptionLabel', 'source', 'value']);
  });

  it('strips forbidden completed field', () => {
    const data = {
      value: 0,
      completed: false,
      bundleOptionId: 'opt-1',
      bundleOptionLabel: 'Deselect',
    };
    const out = buildHabitEntryUpsertPayload(data);
    expect(out).not.toHaveProperty('completed');
    expect(out).toEqual({
      value: 0,
      bundleOptionId: 'opt-1',
      bundleOptionLabel: 'Deselect',
    });
  });

  it('strips all forbidden completion/progress fields', () => {
    const data = {
      value: 1,
      completed: true,
      isComplete: true,
      progress: 0.5,
      currentValue: 10,
      percent: 100,
    };
    const out = buildHabitEntryUpsertPayload(data);
    expect(out).toEqual({ value: 1 });
    expect(out).not.toHaveProperty('completed');
    expect(out).not.toHaveProperty('isComplete');
    expect(out).not.toHaveProperty('progress');
    expect(out).not.toHaveProperty('currentValue');
    expect(out).not.toHaveProperty('percent');
  });

  it('omits unknown keys', () => {
    const data = {
      value: 1,
      habitId: 'h1',
      dateKey: '2025-01-15',
      foo: 'bar',
    };
    const out = buildHabitEntryUpsertPayload(data);
    expect(out).toEqual({ value: 1 });
    expect(out).not.toHaveProperty('habitId');
    expect(out).not.toHaveProperty('dateKey');
    expect(out).not.toHaveProperty('foo');
  });

  it('includes choiceChildHabitId and optional fields when present', () => {
    const data = {
      value: 1,
      source: 'manual',
      choiceChildHabitId: 'child-habit-id',
      unitSnapshot: 'miles',
      note: 'Done',
    };
    const out = buildHabitEntryUpsertPayload(data);
    expect(out).toMatchObject({
      value: 1,
      source: 'manual',
      choiceChildHabitId: 'child-habit-id',
      unitSnapshot: 'miles',
      note: 'Done',
    });
  });

  it('TrackerGrid-style choice deselect payload has no forbidden fields', () => {
    const trackerGridDeselectPayload = {
      bundleOptionId: 'opt-1',
      bundleOptionLabel: 'Option One',
      value: 0,
    };
    const out = buildHabitEntryUpsertPayload(trackerGridDeselectPayload);
    expect(out).toEqual(trackerGridDeselectPayload);
    expect(Object.keys(out)).toEqual(['bundleOptionId', 'bundleOptionLabel', 'value']);
  });
});
