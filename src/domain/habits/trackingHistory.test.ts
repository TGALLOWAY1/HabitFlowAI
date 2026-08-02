import { describe, expect, it } from 'vitest';
import {
  isHabitInactiveOnDay,
  recordHabitTrackingRevision,
  resolveHabitTrackingForDay,
  trackingRulesEqual,
  type HabitTrackingFields,
} from './trackingHistory';

function tracking(overrides: Partial<HabitTrackingFields> = {}): HabitTrackingFields {
  return {
    goal: { type: 'number', target: 10, unit: 'pages', frequency: 'daily' },
    assignedDays: [1, 3, 5],
    requiredDaysPerWeek: 3,
    ...overrides,
  };
}

describe('habit tracking history', () => {
  it('falls back to the current rule when no revisions exist', () => {
    expect(resolveHabitTrackingForDay(tracking(), '2026-07-01')).toMatchObject({
      goal: { target: 10 },
      assignedDays: [1, 3, 5],
    });
  });

  it('resolves historical target and schedule rules without changing entries', () => {
    const habit = tracking({
      goal: { type: 'number', target: 20, unit: 'pages', frequency: 'daily' },
      assignedDays: [1, 2, 3, 4, 5],
      requiredDaysPerWeek: 5,
      trackingRevisions: [
        {
          effectiveFromDayKey: '2026-01-01',
          goal: { type: 'number', target: 10, unit: 'pages', frequency: 'daily' },
          assignedDays: [1, 3, 5],
          requiredDaysPerWeek: 3,
        },
        {
          effectiveFromDayKey: '2026-08-01',
          goal: { type: 'number', target: 20, unit: 'pages', frequency: 'daily' },
          assignedDays: [1, 2, 3, 4, 5],
          requiredDaysPerWeek: 5,
        },
      ],
    });

    expect(resolveHabitTrackingForDay(habit, '2026-07-31')).toMatchObject({
      goal: { target: 10 },
      assignedDays: [1, 3, 5],
    });
    expect(resolveHabitTrackingForDay(habit, '2026-08-01')).toMatchObject({
      goal: { target: 20 },
      assignedDays: [1, 2, 3, 4, 5],
    });
  });

  it('records one baseline and replaces repeated same-day edits', () => {
    const original = tracking();
    const firstEdit = tracking({ goal: { type: 'number', target: 15, unit: 'pages', frequency: 'daily' } });
    const first = recordHabitTrackingRevision(original, firstEdit, '2026-08-02', '2026-01-01');
    const secondEdit = tracking({
      goal: { type: 'number', target: 20, unit: 'pages', frequency: 'daily' },
      trackingRevisions: first,
    });
    const second = recordHabitTrackingRevision(
      { ...firstEdit, trackingRevisions: first },
      secondEdit,
      '2026-08-02',
      '2026-01-01',
    );

    expect(second).toHaveLength(2);
    expect(second[0].goal.target).toBe(10);
    expect(second[1].goal.target).toBe(20);
  });

  it('normalizes schedules before comparing rules', () => {
    expect(trackingRulesEqual(
      tracking({ assignedDays: [5, 1, 3] }),
      tracking({ assignedDays: [1, 3, 5] }),
    )).toBe(true);
  });

  it('compares goal values independently of object property insertion order', () => {
    expect(trackingRulesEqual(
      tracking(),
      tracking({
        goal: { frequency: 'daily', unit: 'pages', target: 10, type: 'number' },
      }),
    )).toBe(true);
  });

  it('treats only inclusive inactive intervals as paused days', () => {
    const habit = {
      inactivePeriods: [{ startDayKey: '2026-07-10', endDayKey: '2026-07-12' }],
    };
    expect(isHabitInactiveOnDay(habit, '2026-07-09')).toBe(false);
    expect(isHabitInactiveOnDay(habit, '2026-07-10')).toBe(true);
    expect(isHabitInactiveOnDay(habit, '2026-07-12')).toBe(true);
    expect(isHabitInactiveOnDay(habit, '2026-07-13')).toBe(false);
  });
});
