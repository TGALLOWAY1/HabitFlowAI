/**
 * Goal Track Progress Window Tests
 *
 * Verifies that progress for tracked goals only counts entries within the active window.
 * This is the most critical invariant of the Goal Tracks feature.
 */

import { describe, it, expect } from 'vitest';
import { computeFullGoalProgressV2 } from '../../utils/goalProgressUtilsV2';
import type { Goal } from '../../../models/persistenceTypes';
import type { EntryView } from '../../services/truthQuery';
import type { DayKey } from '../../../domain/time/dayKey';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: 'Test Goal',
    type: 'cumulative',
    targetValue: 100,
    unit: 'hours',
    linkedHabitIds: ['habit-1'],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEntry(dayKey: string, value: number): EntryView {
  return {
    habitId: 'habit-1',
    dayKey: dayKey as DayKey,
    timestampUtc: `${dayKey}T12:00:00Z`,
    value,
    source: 'manual',
    provenance: {},
  };
}

describe('Progress Window Isolation', () => {
  it('standalone goal counts ALL entries (no dateWindow)', () => {
    const goal = makeGoal();
    const entries = [
      makeEntry('2026-01-01', 10),
      makeEntry('2026-01-15', 20),
      makeEntry('2026-02-01', 30),
    ];

    const progress = computeFullGoalProgressV2(goal, entries, undefined, 'UTC', undefined);
    expect(progress.currentValue).toBe(60);
  });

  it('tracked goal only counts entries within active window', () => {
    const goal = makeGoal({
      trackId: 'track-1',
      trackStatus: 'active',
      activeWindowStart: '2026-01-10',
    });

    const entries = [
      makeEntry('2026-01-01', 10), // Before window — excluded
      makeEntry('2026-01-05', 15), // Before window — excluded
      makeEntry('2026-01-10', 20), // On start date — included
      makeEntry('2026-01-15', 25), // In window — included
      makeEntry('2026-02-01', 30), // In window — included
    ];

    const dateWindow = { start: '2026-01-10' };
    const progress = computeFullGoalProgressV2(goal, entries, undefined, 'UTC', dateWindow);
    expect(progress.currentValue).toBe(75); // 20 + 25 + 30
  });

  it('completed tracked goal counts entries within closed window only', () => {
    const goal = makeGoal({
      trackId: 'track-1',
      trackStatus: 'completed',
      activeWindowStart: '2026-01-10',
      activeWindowEnd: '2026-01-20',
    });

    const entries = [
      makeEntry('2026-01-01', 10), // Before window
      makeEntry('2026-01-10', 20), // In window
      makeEntry('2026-01-15', 25), // In window
      makeEntry('2026-01-20', 15), // On end date — included
      makeEntry('2026-01-25', 30), // After window — excluded
    ];

    const dateWindow = { start: '2026-01-10', end: '2026-01-20' };
    const progress = computeFullGoalProgressV2(goal, entries, undefined, 'UTC', dateWindow);
    expect(progress.currentValue).toBe(60); // 20 + 25 + 15
  });

  it('shared habit entries do not leak from goal 1 to goal 2', () => {
    // Same habit, two goals in same track
    const goal1 = makeGoal({
      id: 'goal-1',
      activeWindowStart: '2026-01-01',
      activeWindowEnd: '2026-01-31',
    });
    const goal2 = makeGoal({
      id: 'goal-2',
      activeWindowStart: '2026-02-01',
    });

    const allEntries = [
      makeEntry('2026-01-05', 20), // Goal 1 period
      makeEntry('2026-01-20', 30), // Goal 1 period
      makeEntry('2026-02-05', 15), // Goal 2 period
      makeEntry('2026-02-15', 25), // Goal 2 period
    ];

    const progress1 = computeFullGoalProgressV2(
      goal1, allEntries, undefined, 'UTC',
      { start: '2026-01-01', end: '2026-01-31' }
    );
    const progress2 = computeFullGoalProgressV2(
      goal2, allEntries, undefined, 'UTC',
      { start: '2026-02-01' }
    );

    expect(progress1.currentValue).toBe(50); // 20 + 30
    expect(progress2.currentValue).toBe(40); // 15 + 25
    // No leakage: goal2 doesn't see goal1's 50 hours
  });

  it('count mode with distinctDays respects window', () => {
    const goal = makeGoal({
      type: 'cumulative',
      aggregationMode: 'count',
      countMode: 'distinctDays',
      targetValue: 10,
    });

    const entries = [
      makeEntry('2026-01-01', 1), // Before window
      makeEntry('2026-01-02', 1), // Before window
      makeEntry('2026-01-10', 1), // In window
      makeEntry('2026-01-11', 1), // In window
      makeEntry('2026-01-12', 1), // In window
    ];

    const dateWindow = { start: '2026-01-10' };
    const progress = computeFullGoalProgressV2(goal, entries, undefined, 'UTC', dateWindow);
    expect(progress.currentValue).toBe(3); // 3 distinct days in window
  });
});
