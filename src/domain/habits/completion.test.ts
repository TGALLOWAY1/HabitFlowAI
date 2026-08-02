import { describe, expect, it } from 'vitest';
import type { Habit } from '../../models/persistenceTypes';
import { deriveDailyHabitCompletion, getCompletionEntryValue, hasValidNumericTarget } from './completion';

function habit(goal: Habit['goal']): Pick<Habit, 'goal'> {
  return { goal };
}

describe('deriveDailyHabitCompletion', () => {
  it.each([
    { label: 'empty', entries: [], current: 0, complete: false, partial: false, percent: 0 },
    { label: 'zero', entries: [{ value: 0 }], current: 0, complete: false, partial: false, percent: 0 },
    { label: 'below', entries: [{ value: 4.5 }], current: 4.5, complete: false, partial: true, percent: 45 },
    { label: 'equal', entries: [{ value: 10 }], current: 10, complete: true, partial: false, percent: 100 },
    { label: 'above', entries: [{ value: 12 }], current: 12, complete: true, partial: false, percent: 100 },
    { label: 'summed', entries: [{ value: 4 }, { value: 6 }], current: 10, complete: true, partial: false, percent: 100 },
  ])('$label numeric progress', ({ entries, current, complete, partial, percent }) => {
    const result = deriveDailyHabitCompletion(
      habit({ type: 'number', frequency: 'daily', target: 10 }),
      entries,
    );

    expect(result).toMatchObject({
      currentValue: current,
      targetValue: 10,
      isComplete: complete,
      isPartial: partial,
      progressPercent: percent,
    });
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'keeps numeric progress incomplete for invalid target %s',
    target => {
      const config = habit({ type: 'number', frequency: 'daily', target });
      expect(hasValidNumericTarget(config)).toBe(false);
      expect(deriveDailyHabitCompletion(config, [{ value: 5 }])).toMatchObject({
        currentValue: 5,
        targetValue: 0,
        isComplete: false,
        isPartial: true,
        progressPercent: 0,
      });
    },
  );

  it('completes boolean habits by entry existence', () => {
    const config = habit({ type: 'boolean', frequency: 'daily' });
    expect(deriveDailyHabitCompletion(config, [])).toMatchObject({ isComplete: false, currentValue: 0 });
    expect(deriveDailyHabitCompletion(config, [{ value: 0 }])).toMatchObject({ isComplete: true, currentValue: 1 });
  });

  it('uses the target when an interaction explicitly completes a numeric habit', () => {
    expect(getCompletionEntryValue(habit({ type: 'boolean', frequency: 'daily' }))).toBe(1);
    expect(getCompletionEntryValue(habit({ type: 'number', frequency: 'daily', target: 2.5 }))).toBe(2.5);
    expect(getCompletionEntryValue(habit({ type: 'number', frequency: 'daily' }))).toBeNull();
  });

  it('ignores corrupt negative and non-finite numeric values', () => {
    const result = deriveDailyHabitCompletion(
      habit({ type: 'number', frequency: 'daily', target: 10 }),
      [{ value: -5 }, { value: Number.NaN }, { value: Number.POSITIVE_INFINITY }, { value: 3 }],
    );
    expect(result).toMatchObject({ currentValue: 3, isComplete: false, isPartial: true });
  });

  it('uses the target that was effective on the historical day', () => {
    const config = {
      goal: { type: 'number' as const, target: 20, frequency: 'daily' as const },
      trackingRevisions: [
        {
          effectiveFromDayKey: '2026-01-01',
          goal: { type: 'number' as const, target: 10, frequency: 'daily' as const },
        },
        {
          effectiveFromDayKey: '2026-08-01',
          goal: { type: 'number' as const, target: 20, frequency: 'daily' as const },
        },
      ],
    };

    expect(deriveDailyHabitCompletion(config, [{ value: 10 }], '2026-07-31').isComplete).toBe(true);
    expect(deriveDailyHabitCompletion(config, [{ value: 10 }], '2026-08-01').isComplete).toBe(false);
  });
});
