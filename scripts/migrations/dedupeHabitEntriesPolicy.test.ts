import { describe, expect, it } from 'vitest';
import { planDuplicateHabitEntries } from './dedupeHabitEntriesPolicy';

describe('habit entry dedupe policy', () => {
  it('removes only deleted collisions when one active document exists', () => {
    expect(planDuplicateHabitEntries([
      { value: 4 },
      { value: 9, deletedAt: '2026-01-02T00:00:00.000Z' },
    ], 'number')).toMatchObject({
      resolution: 'remove-deleted-collisions',
      safeToApply: true,
      activeCount: 1,
    });
  });

  it('collapses boolean duplicates without changing completion', () => {
    expect(planDuplicateHabitEntries([{ value: 1 }, { value: 1 }], 'boolean')).toMatchObject({
      resolution: 'collapse-boolean-duplicates',
      safeToApply: true,
    });
  });

  it('sums numeric duplicates to preserve current derived progress', () => {
    expect(planDuplicateHabitEntries([{ value: 4 }, { value: 6 }], 'number')).toMatchObject({
      resolution: 'sum-numeric-duplicates',
      safeToApply: true,
      replacementValue: 10,
    });
  });

  it('stops when freeze and progress documents conflict', () => {
    expect(planDuplicateHabitEntries([
      { note: 'freeze:auto', value: 0 },
      { value: 1 },
    ], 'boolean')).toMatchObject({
      resolution: 'manual-review',
      safeToApply: false,
    });
  });

  it('stops when multiple choices were stored for one day', () => {
    expect(planDuplicateHabitEntries([
      { bundleOptionId: 'walk' },
      { bundleOptionId: 'run' },
    ], 'boolean')).toMatchObject({
      resolution: 'manual-review',
      safeToApply: false,
    });
  });
});
