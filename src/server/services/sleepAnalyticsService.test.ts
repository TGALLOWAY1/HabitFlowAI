import { describe, expect, it } from 'vitest';
import { format, parseISO, subDays } from 'date-fns';
import type { WellbeingEntry, Habit, HabitEntry, Category } from '../../models/persistenceTypes';
import {
  circularStdDevMinutes,
  consistencySubScore,
  computeSleepAnalytics,
  buildSleepNights,
  SLEEP_CONSISTENCY_TOLERANCE_MIN,
} from './sleepAnalyticsService';
import { clockToMinutesAfterNoon, minutesAfterNoonToClock } from '../../components/analytics/sleep/sleepFormat';

function we(dayKey: string, metricKey: string, value: number): WellbeingEntry {
  return {
    id: `${dayKey}-${metricKey}`,
    userId: 'u1',
    timestampUtc: `${dayKey}T12:00:00.000Z`,
    dayKey,
    timeOfDay: 'morning',
    metricKey: metricKey as WellbeingEntry['metricKey'],
    value,
    source: 'test',
    createdAt: `${dayKey}T12:00:00.000Z`,
    updatedAt: `${dayKey}T12:00:00.000Z`,
  };
}

function lastNDayKeys(referenceDayKey: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(format(subDays(parseISO(referenceDayKey), i), 'yyyy-MM-dd'));
  }
  return out;
}

describe('minutes-after-noon encoding', () => {
  it('keeps a normal sleep window contiguous across midnight', () => {
    expect(clockToMinutesAfterNoon(22, 0)).toBe(600);   // 10:00 PM
    expect(clockToMinutesAfterNoon(23, 58)).toBe(718);  // 11:58 PM
    expect(clockToMinutesAfterNoon(0, 5)).toBe(725);    // 12:05 AM (adjacent to 718)
    expect(clockToMinutesAfterNoon(6, 3)).toBe(1083);   // 6:03 AM
  });

  it('round-trips back to a clock label', () => {
    expect(minutesAfterNoonToClock(600)).toBe('10:00 PM');
    expect(minutesAfterNoonToClock(1083)).toBe('6:03 AM');
    expect(minutesAfterNoonToClock(725)).toBe('12:05 AM');
  });
});

describe('sleep consistency algorithm', () => {
  it('scores tightly-clustered bedtimes very high', () => {
    // 10:00 / 10:05 / 9:58 / 10:02 PM → minutes-after-noon
    const bedtimes = [600, 605, 598, 602];
    const sigma = circularStdDevMinutes(bedtimes);
    expect(sigma).toBeLessThan(5);
    expect(consistencySubScore(sigma)).toBeGreaterThanOrEqual(90);
  });

  it('scores scattered bedtimes poorly', () => {
    // 9:00 / 11:30 / 10:15 / 12:00 → minutes-after-noon
    const bedtimes = [540, 690, 615, 720];
    const sigma = circularStdDevMinutes(bedtimes);
    expect(sigma).toBeGreaterThan(50);
    const score = consistencySubScore(sigma);
    expect(score).toBeLessThan(60);
    // and strictly worse than the tight cluster
    expect(score).toBeLessThan(consistencySubScore(circularStdDevMinutes([600, 605, 598, 602])));
  });

  it('uses τ as the documented decay constant', () => {
    expect(consistencySubScore(0)).toBe(100);
    expect(consistencySubScore(SLEEP_CONSISTENCY_TOLERANCE_MIN)).toBe(Math.round(100 * Math.exp(-1)));
  });
});

describe('buildSleepNights', () => {
  it('pivots metric keys per day and marks data presence', () => {
    const ref = '2026-06-16';
    const keys = lastNDayKeys(ref, 2);
    const entries = [
      we(keys[1], 'appleSleepScore', 82),
      we(keys[1], 'sleepDurationMinutes', 408),
      we(keys[1], 'sleepAidUsed', 0),
    ];
    const nights = buildSleepNights(entries, keys);
    expect(nights).toHaveLength(2);
    expect(nights[0].hasData).toBe(false);
    expect(nights[1].appleSleepScore).toBe(82);
    expect(nights[1].durationMinutes).toBe(408);
    expect(nights[1].sleepAidUsed).toBe(false);
    expect(nights[1].hasData).toBe(true);
  });
});

describe('computeSleepAnalytics', () => {
  const ref = '2026-06-16';

  it('computes headline averages and consistency from form entries', () => {
    const keys = lastNDayKeys(ref, 14);
    const entries: WellbeingEntry[] = [];
    for (const dk of keys) {
      entries.push(we(dk, 'appleSleepScore', 80));
      entries.push(we(dk, 'sleepDurationMinutes', 420));
      entries.push(we(dk, 'sleepBedtimeMinutes', 600));
      entries.push(we(dk, 'sleepWakeMinutes', 1080));
    }
    const result = computeSleepAnalytics(entries, [], [], [], ref, 14, 'America/New_York');
    expect(result.avgAppleSleepScore.value).toBe(80);
    expect(result.avgDurationMinutes.value).toBe(420);
    expect(result.consistencyScore).toBe(100); // identical times every night
    expect(result.coverage.nightsWithData).toBe(14);
  });

  it('surfaces a correlated factor with caveated message', () => {
    const keys = lastNDayKeys(ref, 12);
    const entries: WellbeingEntry[] = [];
    keys.forEach((dk, i) => {
      const phone = i % 2 === 0 ? 1 : 0; // alternate → 6 present, 6 absent
      entries.push(we(dk, 'factorPhoneInBed', phone));
      // phone nights score worse (70) vs no-phone (90)
      entries.push(we(dk, 'appleSleepScore', phone ? 70 : 90));
    });
    const result = computeSleepAnalytics(entries, [], [], [], ref, 12, 'America/New_York');
    const phoneFactor = result.topFactors.find((f) => f.factorId === 'factorPhoneInBed');
    expect(phoneFactor).toBeDefined();
    expect(phoneFactor!.direction).toBe('worsens');
    expect(phoneFactor!.nPresent).toBe(6);
    expect(phoneFactor!.nAbsent).toBe(6);
    expect(phoneFactor!.message).toContain('Correlation, not proof.');
  });

  it('computes sleep-aid independence stats', () => {
    const keys = lastNDayKeys(ref, 10);
    const entries: WellbeingEntry[] = [];
    keys.forEach((dk, i) => {
      // last 4 nights aid-free, earlier mixed
      const used = i < 6 && i % 2 === 0 ? 1 : 0;
      entries.push(we(dk, 'sleepAidUsed', used));
      entries.push(we(dk, 'appleSleepScore', 75));
    });
    const result = computeSleepAnalytics(entries, [], [], [], ref, 10, 'America/New_York');
    expect(result.independence.sampleSize).toBe(10);
    expect(result.independence.aidFreeNights + result.independence.aidNights).toBe(10);
    expect(result.independence.currentAidFreeStreak).toBeGreaterThanOrEqual(4);
  });

  it('returns null stats and consistency when there is no data', () => {
    const result = computeSleepAnalytics([], [], [], [], ref, 7, 'America/New_York');
    expect(result.avgAppleSleepScore.value).toBeNull();
    expect(result.consistencyScore).toBeNull();
    expect(result.coverage.nightsWithData).toBe(0);
    expect(result.topFactors).toHaveLength(0);
  });

  it('includes ordinary habits as generic correlation factors', () => {
    const keys = lastNDayKeys(ref, 12);
    const entries: WellbeingEntry[] = [];
    const habitEntries: HabitEntry[] = [];
    keys.forEach((dk, i) => {
      const exercised = i % 2 === 0;
      entries.push(we(dk, 'appleSleepScore', exercised ? 88 : 72));
      if (exercised) {
        habitEntries.push({
          id: `h-${dk}`,
          habitId: 'habit-exercise',
          timestamp: `${dk}T18:00:00.000Z`,
          dayKey: dk,
          value: 1,
          source: 'manual',
          createdAt: `${dk}T18:00:00.000Z`,
          updatedAt: `${dk}T18:00:00.000Z`,
        });
      }
    });
    const habits: Habit[] = [{
      id: 'habit-exercise',
      categoryId: 'cat-1',
      name: 'Exercise',
      goal: { type: 'boolean', frequency: 'daily', target: 1 },
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    }];
    const categories: Category[] = [{ id: 'cat-1', name: 'Fitness', color: '#10b981' }];
    const result = computeSleepAnalytics(entries, habits, habitEntries, categories, ref, 12, 'America/New_York');
    const ex = result.topFactors.find((f) => f.factorId === 'habit-exercise');
    expect(ex).toBeDefined();
    expect(ex!.source).toBe('habit');
    expect(ex!.direction).toBe('improves');
  });
});
