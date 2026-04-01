import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../test/mongoTestHelper';
import { runBackfill } from './healthBackfillService';
import { upsertHealthMetric } from '../repositories/healthMetricDailyRepository';
import { upsertHabitEntry, getHabitEntriesForDay } from '../repositories/habitEntryRepository';
import type { HabitHealthRule, Habit } from '../../models/persistenceTypes';

const HID = 'test-household';
const UID = 'test-user';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Walk 10k steps',
    categoryId: 'cat-1',
    goal: { type: 'boolean', frequency: 'daily' },
    createdAt: '2026-01-01T00:00:00Z',
    archived: false,
    ...overrides,
  } as Habit;
}

function makeRule(overrides: Partial<HabitHealthRule> = {}): HabitHealthRule {
  return {
    id: 'rule-1',
    userId: UID,
    habitId: 'habit-1',
    sourceType: 'apple_health',
    metricType: 'steps',
    operator: '>=',
    thresholdValue: 10000,
    behavior: 'auto_log',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('healthBackfillService', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('habitEntries').deleteMany({});
    await db.collection('healthMetricsDaily').deleteMany({});
  });

  it('creates entries for qualifying days', async () => {
    // Seed health metrics for 3 days, 2 qualifying
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-01', source: 'apple_health', steps: 12000 },
      HID, UID
    );
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-02', source: 'apple_health', steps: 8000 },
      HID, UID
    );
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-03', source: 'apple_health', steps: 15000 },
      HID, UID
    );

    const result = await runBackfill(
      makeHabit(), makeRule(),
      '2026-03-01', '2026-03-03',
      HID, UID
    );

    expect(result.evaluated).toBe(3);
    expect(result.created).toBe(2);  // Days 1 and 3 qualify
    expect(result.skipped).toBe(1);  // Day 2 below threshold

    // Verify entries created
    const day1 = await getHabitEntriesForDay('habit-1', '2026-03-01', HID, UID);
    expect(day1).toHaveLength(1);
    expect(day1[0].source).toBe('apple_health');
    expect(day1[0].sourceRuleId).toBe('rule-1');
    expect(day1[0].value).toBe(1); // boolean habit

    const day3 = await getHabitEntriesForDay('habit-1', '2026-03-03', HID, UID);
    expect(day3).toHaveLength(1);
  });

  it('never overwrites existing entries', async () => {
    // Create a manual entry for day 1
    await upsertHabitEntry('habit-1', '2026-03-01', HID, UID, {
      value: 1,
      source: 'manual',
      timestamp: '2026-03-01T10:00:00Z',
    });

    // Seed qualifying health data
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-01', source: 'apple_health', steps: 12000 },
      HID, UID
    );

    const result = await runBackfill(
      makeHabit(), makeRule(),
      '2026-03-01', '2026-03-01',
      HID, UID
    );

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    // Verify original manual entry preserved
    const entries = await getHabitEntriesForDay('habit-1', '2026-03-01', HID, UID);
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('manual');
  });

  it('is idempotent — running twice produces same result', async () => {
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-01', source: 'apple_health', steps: 12000 },
      HID, UID
    );

    const result1 = await runBackfill(
      makeHabit(), makeRule(),
      '2026-03-01', '2026-03-01',
      HID, UID
    );
    expect(result1.created).toBe(1);

    const result2 = await runBackfill(
      makeHabit(), makeRule(),
      '2026-03-01', '2026-03-01',
      HID, UID
    );
    expect(result2.created).toBe(0);
    expect(result2.skipped).toBe(1);

    // Still only one entry
    const entries = await getHabitEntriesForDay('habit-1', '2026-03-01', HID, UID);
    expect(entries).toHaveLength(1);
  });

  it('skips days with no health data', async () => {
    // No health metrics seeded
    const result = await runBackfill(
      makeHabit(), makeRule(),
      '2026-03-01', '2026-03-03',
      HID, UID
    );

    expect(result.evaluated).toBe(3);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(3);
  });

  it('respects date range boundaries', async () => {
    // Seed data outside range
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-02-28', source: 'apple_health', steps: 12000 },
      HID, UID
    );
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-01', source: 'apple_health', steps: 12000 },
      HID, UID
    );
    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-04', source: 'apple_health', steps: 12000 },
      HID, UID
    );

    const result = await runBackfill(
      makeHabit(), makeRule(),
      '2026-03-01', '2026-03-03',
      HID, UID
    );

    // Only day within range with data
    expect(result.created).toBe(1);

    // Verify no entry outside range
    const outside = await getHabitEntriesForDay('habit-1', '2026-02-28', HID, UID);
    expect(outside).toHaveLength(0);
  });

  it('uses metric value for numeric habits', async () => {
    const numericHabit = makeHabit({
      id: 'habit-numeric',
      goal: { type: 'number', target: 10000, unit: 'steps', frequency: 'daily' },
    });

    await upsertHealthMetric(
      { userId: UID, dayKey: '2026-03-01', source: 'apple_health', steps: 12345 },
      HID, UID
    );

    const result = await runBackfill(
      numericHabit,
      makeRule({ habitId: 'habit-numeric' }),
      '2026-03-01', '2026-03-01',
      HID, UID
    );

    expect(result.created).toBe(1);

    const entries = await getHabitEntriesForDay('habit-numeric', '2026-03-01', HID, UID);
    expect(entries[0].value).toBe(12345);
    expect(entries[0].importedMetricValue).toBe(12345);
    expect(entries[0].importedMetricType).toBe('steps');
  });
});
