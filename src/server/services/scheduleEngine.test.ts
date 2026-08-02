import { describe, it, expect } from 'vitest';
import {
  isTrackableHabit,
  isHabitScheduledOnDay,
  getScheduledHabitsForDay,
  getExpectedOpportunitiesInRange,
  usesWeeklyQuotaStreak,
} from './scheduleEngine';
import type { Habit } from '../../models/persistenceTypes';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    categoryId: 'cat1',
    name: 'Test Habit',
    goal: { type: 'boolean', target: 1, frequency: 'daily' },
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Habit;
}

describe('isTrackableHabit', () => {
  it('returns true for normal habits', () => {
    expect(isTrackableHabit(makeHabit())).toBe(true);
  });

  it('returns false for archived habits', () => {
    expect(isTrackableHabit(makeHabit({ archived: true }))).toBe(false);
  });

  it('returns false for bundle parents', () => {
    expect(isTrackableHabit(makeHabit({ type: 'bundle' }))).toBe(false);
  });

  it('returns false for soft-deleted habits', () => {
    expect(isTrackableHabit(makeHabit({ deletedAt: '2026-03-30T12:00:00Z' }))).toBe(false);
  });
});

describe('usesWeeklyQuotaStreak', () => {
  const cases: Array<[string, Partial<Habit>, boolean]> = [
    ['explicit weekly quota', { timesPerWeek: 3 }, true],
    ['strict every-day schedule', { assignedDays: [0, 1, 2, 3, 4, 5, 6], requiredDaysPerWeek: 7 }, false],
    ['strict custom weekdays', { assignedDays: [1, 3, 5], requiredDaysPerWeek: 3 }, false],
    ['flexible schedule with a grace day', { assignedDays: [1, 2, 3, 4, 5], requiredDaysPerWeek: 4 }, true],
    ['assigned days without a weekly requirement', { assignedDays: [1, 3, 5] }, false],
  ];

  it.each(cases)('classifies %s', (_label, schedule, expected) => {
    expect(usesWeeklyQuotaStreak(makeHabit(schedule))).toBe(expected);
  });
});

describe('isHabitScheduledOnDay', () => {
  describe('daily habit, no assignedDays', () => {
    const habit = makeHabit();

    it('is scheduled every day', () => {
      // 2026-03-30 is Monday, 2026-03-31 is Tuesday, ...
      expect(isHabitScheduledOnDay(habit, '2026-03-30')).toBe(true);
      expect(isHabitScheduledOnDay(habit, '2026-03-31')).toBe(true);
      expect(isHabitScheduledOnDay(habit, '2026-04-05')).toBe(true); // Sunday
    });
  });

  it('is not scheduled before its creation day', () => {
    const habit = makeHabit({ createdAt: '2026-04-01T18:00:00Z' });
    expect(isHabitScheduledOnDay(habit, '2026-03-31')).toBe(false);
    expect(isHabitScheduledOnDay(habit, '2026-04-01')).toBe(true);
  });

  it('uses the user timezone for the creation-day boundary', () => {
    const habit = makeHabit({ createdAt: '2026-04-01T01:00:00.000Z' });

    expect(isHabitScheduledOnDay(habit, '2026-03-31', 'America/New_York')).toBe(true);
    expect(isHabitScheduledOnDay(habit, '2026-03-31', 'UTC')).toBe(false);
  });

  describe('daily habit with assignedDays', () => {
    // Mon=1, Wed=3, Fri=5
    const habit = makeHabit({ assignedDays: [1, 3, 5] });

    it('is scheduled on assigned days only', () => {
      expect(isHabitScheduledOnDay(habit, '2026-03-30')).toBe(true);  // Monday
      expect(isHabitScheduledOnDay(habit, '2026-03-31')).toBe(false); // Tuesday
      expect(isHabitScheduledOnDay(habit, '2026-04-01')).toBe(true);  // Wednesday
      expect(isHabitScheduledOnDay(habit, '2026-04-02')).toBe(false); // Thursday
      expect(isHabitScheduledOnDay(habit, '2026-04-03')).toBe(true);  // Friday
      expect(isHabitScheduledOnDay(habit, '2026-04-04')).toBe(false); // Saturday
      expect(isHabitScheduledOnDay(habit, '2026-04-05')).toBe(false); // Sunday
    });
  });

  describe('timesPerWeek habit, no assignedDays', () => {
    const habit = makeHabit({
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
      timesPerWeek: 3,
    });

    it('is scheduled every day (user picks which days)', () => {
      expect(isHabitScheduledOnDay(habit, '2026-03-30')).toBe(true);  // Monday
      expect(isHabitScheduledOnDay(habit, '2026-03-31')).toBe(true);  // Tuesday
      expect(isHabitScheduledOnDay(habit, '2026-04-05')).toBe(true);  // Sunday
    });
  });

  describe('timesPerWeek habit with assignedDays', () => {
    const habit = makeHabit({
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
      timesPerWeek: 1,
      assignedDays: [3], // Wednesday
    });

    it('is scheduled on assigned days only', () => {
      expect(isHabitScheduledOnDay(habit, '2026-03-30')).toBe(false); // Monday
      expect(isHabitScheduledOnDay(habit, '2026-04-01')).toBe(true);  // Wednesday
      expect(isHabitScheduledOnDay(habit, '2026-04-03')).toBe(false); // Friday
    });
  });

  describe('scheduled-daily (assignedDays + requiredDaysPerWeek)', () => {
    const habit = makeHabit({
      assignedDays: [1, 3, 5],
      requiredDaysPerWeek: 2,
    });

    it('is scheduled on assigned days', () => {
      expect(isHabitScheduledOnDay(habit, '2026-03-30')).toBe(true);  // Monday
      expect(isHabitScheduledOnDay(habit, '2026-03-31')).toBe(false); // Tuesday
      expect(isHabitScheduledOnDay(habit, '2026-04-01')).toBe(true);  // Wednesday
    });
  });
});

describe('getScheduledHabitsForDay', () => {
  it('filters to habits scheduled on the given day', () => {
    const daily = makeHabit({ id: 'daily' });
    const weekly = makeHabit({
      id: 'weekly',
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
      timesPerWeek: 1,
    });
    const mwf = makeHabit({ id: 'mwf', assignedDays: [1, 3, 5] });

    // Monday: daily + weekly (timesPerWeek shows every day) + mwf
    const monday = getScheduledHabitsForDay([daily, weekly, mwf], '2026-03-30');
    expect(monday.map(h => h.id).sort()).toEqual(['daily', 'mwf', 'weekly']);

    // Tuesday: daily + weekly (timesPerWeek shows every day)
    const tuesday = getScheduledHabitsForDay([daily, weekly, mwf], '2026-03-31');
    expect(tuesday.map(h => h.id).sort()).toEqual(['daily', 'weekly']);
  });
});

describe('getExpectedOpportunitiesInRange', () => {
  it('daily habit: 1 opportunity per day', () => {
    const habit = makeHabit();
    // 7-day range (Mon 3/30 to Sun 4/5)
    expect(getExpectedOpportunitiesInRange(habit, '2026-03-30', '2026-04-05')).toBe(7);
  });

  it('daily habit with assignedDays [1,3,5]: 3 per week', () => {
    const habit = makeHabit({ assignedDays: [1, 3, 5] });
    // Mon 3/30 to Sun 4/5 = 1 full week, 3 assigned days
    expect(getExpectedOpportunitiesInRange(habit, '2026-03-30', '2026-04-05')).toBe(3);
  });

  it('timesPerWeek habit without assignedDays: 1 opportunity per week', () => {
    const habit = makeHabit({
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
      timesPerWeek: 3,
    });
    // 1 week = 1 opportunity (counted by distinct weeks)
    expect(getExpectedOpportunitiesInRange(habit, '2026-03-30', '2026-04-05')).toBe(1);
    // 2 weeks = 2 opportunities
    expect(getExpectedOpportunitiesInRange(habit, '2026-03-30', '2026-04-12')).toBe(2);
  });

  it('timesPerWeek habit across partial weeks: counts each week touched', () => {
    const habit = makeHabit({
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
      timesPerWeek: 1,
    });
    // Wed 4/1 to Tue 4/7 spans 2 ISO weeks (W14 Mon 3/30 and W15 Mon 4/6)
    expect(getExpectedOpportunitiesInRange(habit, '2026-04-01', '2026-04-07')).toBe(2);
  });

  it('timesPerWeek habit with assignedDays: counts assigned days in range', () => {
    const habit = makeHabit({
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
      timesPerWeek: 2,
      assignedDays: [1, 3, 5], // Mon, Wed, Fri
    });
    // Mon 3/30 to Sun 4/5 = 3 assigned days
    expect(getExpectedOpportunitiesInRange(habit, '2026-03-30', '2026-04-05')).toBe(3);
  });

  it('single day range returns 1 for daily habit', () => {
    const habit = makeHabit();
    expect(getExpectedOpportunitiesInRange(habit, '2026-04-01', '2026-04-01')).toBe(1);
  });

  it('counts weekday schedules independently of the process timezone', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    try {
      const mondayHabit = makeHabit({ assignedDays: [1] });
      expect(getExpectedOpportunitiesInRange(mondayHabit, '2026-03-30', '2026-03-30')).toBe(1);
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });

  it('empty range returns 0', () => {
    const habit = makeHabit();
    expect(getExpectedOpportunitiesInRange(habit, '2026-04-05', '2026-04-01')).toBe(0);
  });

  it('does not count opportunities before habit creation', () => {
    const habit = makeHabit({ createdAt: '2026-04-03T18:00:00Z' });
    expect(getExpectedOpportunitiesInRange(habit, '2026-03-30', '2026-04-05')).toBe(3);
  });

  it('applies the user-local creation day when counting opportunities', () => {
    const habit = makeHabit({ createdAt: '2026-04-01T01:00:00.000Z' });
    expect(
      getExpectedOpportunitiesInRange(
        habit,
        '2026-03-31',
        '2026-04-01',
        'America/New_York',
      ),
    ).toBe(2);
  });
});
