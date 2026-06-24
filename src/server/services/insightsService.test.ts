import { describe, expect, it } from 'vitest';
import { format, parseISO, subDays } from 'date-fns';
import type { WellbeingEntry } from '../../models/persistenceTypes';
import { correlateFactorsToOutcomes, cohensD, type FactorSeries, type OutcomeSeries } from './correlationEngine';
import {
  buildOutcomeSeries,
  buildFactorSeries,
  computeMetricPredictions,
  computeDiscoveries,
  computeInsightsOverview,
  type InsightsSources,
} from './insightsService';

const REF = '2026-03-31';

function lastNDayKeys(referenceDayKey: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(format(subDays(parseISO(referenceDayKey), i), 'yyyy-MM-dd'));
  }
  return out;
}

function we(dayKey: string, metricKey: string, value: number, timeOfDay: 'morning' | 'evening' = 'morning'): WellbeingEntry {
  return {
    id: `${dayKey}-${metricKey}-${timeOfDay}`,
    userId: 'u1',
    timestampUtc: `${dayKey}T12:00:00.000Z`,
    dayKey,
    timeOfDay,
    metricKey: metricKey as WellbeingEntry['metricKey'],
    value,
    source: 'test',
    createdAt: `${dayKey}T12:00:00.000Z`,
    updatedAt: `${dayKey}T12:00:00.000Z`,
  };
}

function emptySources(over: Partial<InsightsSources> = {}): InsightsSources {
  return {
    wellbeingEntries: [],
    habits: [],
    habitEntries: [],
    medications: [],
    medicationLogs: [],
    supplements: [],
    supplementLogs: [],
    symptoms: [],
    symptomLogs: [],
    ...over,
  };
}

describe('cohensD', () => {
  it('returns 0 when a group is too small', () => {
    expect(cohensD([1], [1, 2, 3])).toBe(0);
  });

  it('is positive when the first group has a higher mean', () => {
    expect(cohensD([5, 5, 5, 4], [1, 1, 2, 1])).toBeGreaterThan(0);
  });

  it('saturates to ±4 when groups have no spread but different means', () => {
    expect(cohensD([5, 5, 5], [1, 1, 1])).toBe(4);
    expect(cohensD([1, 1, 1], [5, 5, 5])).toBe(-4);
  });
});

describe('correlateFactorsToOutcomes', () => {
  it('surfaces a clear factor→outcome relationship', () => {
    const dayKeys = lastNDayKeys(REF, 20);
    // factor present on even-index days; outcome high on those same days.
    const factorByDay = new Map<string, number>();
    const outcomeByDay = new Map<string, number>();
    dayKeys.forEach((dk, i) => {
      const present = i % 2 === 0;
      factorByDay.set(dk, present ? 1 : 0);
      outcomeByDay.set(dk, present ? 5 : 2);
    });
    const factors: FactorSeries[] = [{ id: 'f1', name: 'Exercise', source: 'habit', byDay: factorByDay }];
    const outcomes: OutcomeSeries[] = [{ key: 'mood', label: 'mood', higherIsBetter: true, byDay: outcomeByDay }];

    const results = correlateFactorsToOutcomes(factors, outcomes, dayKeys);
    expect(results).toHaveLength(1);
    expect(results[0].factorId).toBe('f1');
    expect(results[0].direction).toBe('improves');
    expect(results[0].meanDifference).toBeGreaterThan(0);
  });

  it('drops relationships below the minimum group size', () => {
    const dayKeys = lastNDayKeys(REF, 6);
    const factorByDay = new Map<string, number>();
    const outcomeByDay = new Map<string, number>();
    dayKeys.forEach((dk, i) => {
      factorByDay.set(dk, i === 0 ? 1 : 0); // only 1 "present" day
      outcomeByDay.set(dk, i === 0 ? 5 : 2);
    });
    const factors: FactorSeries[] = [{ id: 'f1', name: 'Rare', source: 'habit', byDay: factorByDay }];
    const outcomes: OutcomeSeries[] = [{ key: 'mood', label: 'mood', higherIsBetter: true, byDay: outcomeByDay }];
    expect(correlateFactorsToOutcomes(factors, outcomes, dayKeys)).toHaveLength(0);
  });
});

describe('buildOutcomeSeries', () => {
  it('averages multiple same-day entries per metric and ignores non-outcome keys', () => {
    const dayKeys = lastNDayKeys(REF, 2);
    const entries = [
      we(dayKeys[0], 'mood', 4, 'morning'),
      we(dayKeys[0], 'mood', 2, 'evening'),
      we(dayKeys[0], 'weight', 180), // not an outcome metric
    ];
    const series = buildOutcomeSeries(entries, dayKeys);
    const mood = series.find((s) => s.key === 'mood');
    expect(mood).toBeDefined();
    expect(mood!.byDay.get(dayKeys[0])).toBe(3); // (4 + 2) / 2
    expect(series.find((s) => s.key === 'weight')).toBeUndefined();
  });
});

describe('buildFactorSeries', () => {
  it('builds taken-series for medications', () => {
    const dayKeys = lastNDayKeys(REF, 5);
    const sources = emptySources({
      medications: [{
        id: 'm1', userId: 'u1', householdId: 'h1', name: 'Lamotrigine', active: true,
        createdAt: '', updatedAt: '',
      } as InsightsSources['medications'][number]],
      medicationLogs: dayKeys.map((dk, i) => ({
        id: `l${i}`, userId: 'u1', householdId: 'h1', medicationId: 'm1', dayKey: dk,
        taken: i % 2 === 0, timestampUtc: '', createdAt: '', updatedAt: '',
      })),
    });
    const factors = buildFactorSeries(sources, 'America/New_York', dayKeys);
    const med = factors.find((f) => f.source === 'medication');
    expect(med).toBeDefined();
    expect(med!.name).toBe('Lamotrigine');
    expect(med!.byDay.get(dayKeys[0])).toBe(1);
    expect(med!.byDay.get(dayKeys[1])).toBe(0);
  });
});

describe('computeMetricPredictions', () => {
  it('detects an improving trend for a higher-is-better metric', () => {
    const dayKeys = lastNDayKeys(REF, 14);
    const byDay = new Map<string, number>();
    dayKeys.forEach((dk, i) => byDay.set(dk, 1 + i * 0.2)); // steadily rising
    const outcomes: OutcomeSeries[] = [{ key: 'mood', label: 'mood', higherIsBetter: true, byDay }];
    const [pred] = computeMetricPredictions(outcomes, dayKeys, 14);
    expect(pred.direction).toBe('improving');
    expect(pred.slopePerWeek).toBeGreaterThan(0);
    expect(pred.predictedValue).toBeGreaterThan(pred.currentValue ?? 0);
    expect(pred.confidence).toBe('high');
  });

  it('flags a rising bad metric as declining', () => {
    const dayKeys = lastNDayKeys(REF, 14);
    const byDay = new Map<string, number>();
    dayKeys.forEach((dk, i) => byDay.set(dk, 1 + i * 0.2)); // anxiety rising = bad
    const outcomes: OutcomeSeries[] = [{ key: 'anxiety', label: 'anxiety', higherIsBetter: false, byDay }];
    const [pred] = computeMetricPredictions(outcomes, dayKeys, 14);
    expect(pred.direction).toBe('declining');
  });

  it('returns low-confidence null predictions when data is sparse', () => {
    const dayKeys = lastNDayKeys(REF, 10);
    const byDay = new Map<string, number>();
    byDay.set(dayKeys[0], 3);
    byDay.set(dayKeys[1], 4); // only 2 points
    const outcomes: OutcomeSeries[] = [{ key: 'mood', label: 'mood', higherIsBetter: true, byDay }];
    const [pred] = computeMetricPredictions(outcomes, dayKeys, 14);
    expect(pred.confidence).toBe('low');
    expect(pred.predictedValue).toBeNull();
  });
});

describe('computeDiscoveries', () => {
  it('always returns at least one discovery (info fallback)', () => {
    expect(computeDiscoveries([], [], 0)).toHaveLength(1);
    expect(computeDiscoveries([], [], 0)[0].type).toBe('info');
  });

  it('emits a coverage milestone', () => {
    const discoveries = computeDiscoveries([], [], 35);
    expect(discoveries.some((d) => d.type === 'milestone' && d.id === 'milestone-30')).toBe(true);
  });
});

describe('computeInsightsOverview', () => {
  it('produces a coherent overview from a habit↔mood relationship', () => {
    const dayKeys = lastNDayKeys(REF, 20);
    const wellbeingEntries: WellbeingEntry[] = [];
    dayKeys.forEach((dk, i) => {
      wellbeingEntries.push(we(dk, 'mood', i % 2 === 0 ? 5 : 2));
      wellbeingEntries.push(we(dk, 'caffeineMg', i % 2 === 0 ? 0 : 300));
    });
    const overview = computeInsightsOverview(emptySources({ wellbeingEntries }), REF, 20, 'America/New_York');
    expect(overview.daysWithCheckins).toBe(20);
    expect(overview.metricAverages.some((m) => m.metricKey === 'mood')).toBe(true);
    expect(overview.discoveries.length).toBeGreaterThan(0);
  });
});
