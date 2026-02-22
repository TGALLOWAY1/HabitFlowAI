import { describe, expect, it } from 'vitest';
import type { Category, Habit, HabitEntry } from '../../models/persistenceTypes';
import { buildMainDashboardReadModel } from './dashboardReadModel';

function createHabit(overrides: Partial<Habit> & Pick<Habit, 'id' | 'categoryId' | 'name'>): Habit {
  return {
    id: overrides.id,
    categoryId: overrides.categoryId,
    name: overrides.name,
    goal: overrides.goal || {
      type: 'boolean',
      frequency: 'daily',
      target: 1,
    },
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createEntry(overrides: Partial<HabitEntry> & Pick<HabitEntry, 'id' | 'habitId' | 'dayKey'>): HabitEntry {
  return {
    id: overrides.id,
    habitId: overrides.habitId,
    dayKey: overrides.dayKey,
    timestamp: overrides.timestamp || `${overrides.dayKey}T12:00:00.000Z`,
    source: overrides.source || 'manual',
    createdAt: overrides.createdAt || '2025-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt || '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const categories: Category[] = [
  { id: 'cat-health', name: 'Health', color: 'bg-emerald-500' },
  { id: 'cat-mind', name: 'Mind', color: 'bg-cyan-500' },
];

describe('dashboardReadModel', () => {
  it('filters deleted entries from daily counts and heatmap', () => {
    const habits: Habit[] = [
      createHabit({ id: 'habit-a', categoryId: 'cat-health', name: 'Walk' }),
    ];

    const entries: HabitEntry[] = [
      createEntry({ id: 'entry-1', habitId: 'habit-a', dayKey: '2026-01-02' }),
      createEntry({
        id: 'entry-2',
        habitId: 'habit-a',
        dayKey: '2026-01-03',
        deletedAt: '2026-01-03T19:00:00.000Z',
      }),
    ];

    const result = buildMainDashboardReadModel({
      habits,
      categories,
      entries,
      query: {
        month: '2026-01',
        cadence: 'all',
        includeWeekly: true,
        timeZone: 'UTC',
      },
      now: new Date('2026-01-05T12:00:00.000Z'),
    });

    expect(result.dailyCounts['2026-01-02']).toBe(1);
    expect(result.dailyCounts['2026-01-03']).toBe(0);
    expect(result.heatmap.habits[0].dayCompletion['2026-01-02']).toBe(true);
    expect(result.heatmap.habits[0].dayCompletion['2026-01-03']).toBe(false);
    expect(result.monthlySummary.completed).toBe(1);
  });

  it('applies weekly habit semantics using distinct day count for boolean targets', () => {
    const habits: Habit[] = [
      createHabit({
        id: 'habit-weekly',
        categoryId: 'cat-health',
        name: 'Strength Sessions',
        goal: {
          type: 'boolean',
          frequency: 'weekly',
          target: 2,
        },
      }),
    ];

    const entries: HabitEntry[] = [
      createEntry({ id: 'entry-1', habitId: 'habit-weekly', dayKey: '2026-01-05' }),
      createEntry({ id: 'entry-2', habitId: 'habit-weekly', dayKey: '2026-01-07' }),
    ];

    const result = buildMainDashboardReadModel({
      habits,
      categories,
      entries,
      query: {
        month: '2026-01',
        cadence: 'weekly',
        includeWeekly: true,
        timeZone: 'UTC',
      },
      now: new Date('2026-01-08T12:00:00.000Z'),
    });

    expect(result.weeklySummary.goal).toBe(1);
    expect(result.weeklySummary.completed).toBe(1);
    expect(result.dailyCounts['2026-01-05']).toBe(1);
    expect(result.dailyCounts['2026-01-06']).toBe(0);
    expect(result.monthlySummary.goal).toBe(5);
    expect(result.monthlySummary.completed).toBe(1);
  });

  it('clamps weekly summary reference day to the selected month boundary', () => {
    const habits: Habit[] = [
      createHabit({ id: 'habit-a', categoryId: 'cat-health', name: 'Walk' }),
    ];

    const result = buildMainDashboardReadModel({
      habits,
      categories,
      entries: [],
      query: {
        month: '2025-01',
        cadence: 'all',
        includeWeekly: true,
        timeZone: 'UTC',
      },
      now: new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(result.weeklySummary.referenceDayKey).toBe('2025-01-31');
    expect(result.weeklySummary.endDayKey).toBe('2025-02-02');
  });

  it('respects includeWeekly=false when cadence is all', () => {
    const habits: Habit[] = [
      createHabit({ id: 'habit-daily', categoryId: 'cat-health', name: 'Hydration' }),
      createHabit({
        id: 'habit-weekly',
        categoryId: 'cat-health',
        name: 'Long Run',
        goal: {
          type: 'number',
          frequency: 'weekly',
          target: 10,
          unit: 'km',
        },
      }),
    ];

    const entries: HabitEntry[] = [
      createEntry({ id: 'entry-1', habitId: 'habit-daily', dayKey: '2026-01-02' }),
      createEntry({ id: 'entry-2', habitId: 'habit-weekly', dayKey: '2026-01-04', value: 12 }),
    ];

    const result = buildMainDashboardReadModel({
      habits,
      categories,
      entries,
      query: {
        month: '2026-01',
        cadence: 'all',
        includeWeekly: false,
        timeZone: 'UTC',
      },
      now: new Date('2026-01-04T12:00:00.000Z'),
    });

    expect(result.heatmap.habits).toHaveLength(1);
    expect(result.heatmap.habits[0].habitId).toBe('habit-daily');
    expect(result.monthlySummary.goal).toBe(31);
    expect(result.dailyCounts['2026-01-04']).toBe(0);
    expect(result.categoryRollup).toHaveLength(1);
  });
});
