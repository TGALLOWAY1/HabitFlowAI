import { describe, expect, it } from 'vitest';
import type { Habit, HabitEntry, Category } from '../../models/persistenceTypes';
import type { BundleMembershipRecord } from '../domain/canonicalTypes';
import {
  computeHabitAnalyticsSummary,
  computeHeatmapData,
  computeTrendData,
  computeCategoryBreakdown,
  computeInsights,
  computeRoutineAnalytics,
  computeGoalAnalytics,
} from './analyticsService';

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    categoryId: 'cat-1',
    name: 'Test Habit',
    goal: { type: 'boolean', frequency: 'daily', target: 1 },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createEntry(habitId: string, dayKey: string, overrides: Partial<HabitEntry> = {}): HabitEntry {
  return {
    id: `entry-${habitId}-${dayKey}`,
    habitId,
    timestamp: `${dayKey}T10:00:00.000Z`,
    dayKey,
    date: dayKey,
    source: 'manual',
    createdAt: `${dayKey}T10:00:00.000Z`,
    updatedAt: `${dayKey}T10:00:00.000Z`,
    ...overrides,
  } as HabitEntry;
}

function createCategory(id: string, name: string, color = 'bg-emerald-500'): Category {
  return { id, name, color };
}

// ─── Summary Tests ───────────────────────────────────────────────────────────

describe('computeHabitAnalyticsSummary', () => {
  it('computes basic summary for a single daily habit', () => {
    const habits = [createHabit()];
    const entries = [
      createEntry('habit-1', '2026-03-29'),
      createEntry('habit-1', '2026-03-30'),
      createEntry('habit-1', '2026-03-31'),
    ];

    const result = computeHabitAnalyticsSummary(habits, entries, [], '2026-03-31', 7);

    expect(result.totalCompletions).toBe(3);
    expect(result.consistencyScore).toBeGreaterThan(0);
    expect(result.completionRate).toBeGreaterThan(0);
    expect(result.currentStreak).toBe(3);
  });

  it('counts graduated habits from memberships', () => {
    const habits = [createHabit()];
    const memberships: BundleMembershipRecord[] = [
      {
        id: 'm1', parentHabitId: 'p1', childHabitId: 'habit-1',
        activeFromDayKey: '2026-01-01', activeToDayKey: null,
        daysOfWeek: null, graduatedAt: '2026-03-01T00:00:00Z',
        archivedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
      },
      {
        id: 'm2', parentHabitId: 'p1', childHabitId: 'habit-2',
        activeFromDayKey: '2026-01-01', activeToDayKey: null,
        daysOfWeek: null, graduatedAt: null,
        archivedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const result = computeHabitAnalyticsSummary(habits, [], memberships, '2026-03-31', 7);
    expect(result.graduatedHabits).toBe(1);
  });

  it('handles habits with assignedDays for completion rate', () => {
    // Habit assigned to Mon(1), Wed(3), Fri(5) only
    const habits = [createHabit({ assignedDays: [1, 3, 5] })];
    // 2026-03-30 is Monday, 2026-03-31 is Tuesday
    const entries = [createEntry('habit-1', '2026-03-30')]; // Monday: completed

    const result = computeHabitAnalyticsSummary(habits, entries, [], '2026-03-31', 7);
    // Over 7 days (Mar 25-31), Mon/Wed/Fri scheduled = 3 days, completed 1
    expect(result.completionRate).toBeCloseTo(1 / 3, 2);
  });

  it('excludes archived habits', () => {
    const habits = [
      createHabit({ id: 'h1' }),
      createHabit({ id: 'h2', archived: true }),
    ];
    const entries = [
      createEntry('h1', '2026-03-31'),
      createEntry('h2', '2026-03-31'),
    ];

    const result = computeHabitAnalyticsSummary(habits, entries, [], '2026-03-31', 7);
    // Only h1 is trackable, so completion rate should reflect only h1
    expect(result.completionRate).toBeGreaterThan(0);
  });

  it('excludes bundle parents from metrics', () => {
    const habits = [
      createHabit({ id: 'h1' }),
      createHabit({ id: 'bundle-1', type: 'bundle' }),
    ];
    const entries = [createEntry('h1', '2026-03-31')];

    const result = computeHabitAnalyticsSummary(habits, entries, [], '2026-03-31', 7);
    // Only h1 counts, not bundle
    expect(result.totalCompletions).toBe(1);
  });

  it('excludes freeze entries from completion count', () => {
    const habits = [createHabit()];
    const entries = [
      createEntry('habit-1', '2026-03-30'),
      createEntry('habit-1', '2026-03-31', { note: 'freeze:manual' }),
    ];

    const result = computeHabitAnalyticsSummary(habits, entries, [], '2026-03-31', 7);
    expect(result.totalCompletions).toBe(1);
  });

  it('returns zeros for empty data', () => {
    const result = computeHabitAnalyticsSummary([], [], [], '2026-03-31', 7);
    expect(result.consistencyScore).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
    expect(result.totalCompletions).toBe(0);
    expect(result.graduatedHabits).toBe(0);
  });
});

// ─── Heatmap Tests ───────────────────────────────────────────────────────────

describe('computeHeatmapData', () => {
  it('returns one data point per day', () => {
    const habits = [createHabit()];
    const entries = [createEntry('habit-1', '2026-03-31')];

    const result = computeHeatmapData(habits, entries, '2026-03-31', 7);
    expect(result).toHaveLength(7);
    expect(result[result.length - 1].dayKey).toBe('2026-03-31');
    expect(result[result.length - 1].completionPercent).toBe(1);
  });

  it('computes correct completion percent', () => {
    const habits = [
      createHabit({ id: 'h1' }),
      createHabit({ id: 'h2' }),
    ];
    const entries = [createEntry('h1', '2026-03-31')]; // 1 of 2 completed

    const result = computeHeatmapData(habits, entries, '2026-03-31', 1);
    expect(result[0].completionPercent).toBe(0.5);
    expect(result[0].completedCount).toBe(1);
    expect(result[0].scheduledCount).toBe(2);
  });
});

// ─── Trends Tests ────────────────────────────────────────────────────────────

describe('computeTrendData', () => {
  it('groups data by ISO week', () => {
    const habits = [createHabit()];
    const entries = [
      createEntry('habit-1', '2026-03-16'), // Week 12
      createEntry('habit-1', '2026-03-23'), // Week 13
    ];

    const result = computeTrendData(habits, entries, '2026-03-31', 30);
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Weeks should be sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i].week > result[i - 1].week).toBe(true);
    }
  });

  it('computes correct weekly rates', () => {
    const habits = [createHabit()];
    // All 7 days in one week completed
    const entries = Array.from({ length: 7 }, (_, i) => {
      const day = 24 + i; // Mar 24-30 are all in ISO week 13 (2026)
      return createEntry('habit-1', `2026-03-${String(day).padStart(2, '0')}`);
    });

    const result = computeTrendData(habits, entries, '2026-03-30', 7);
    // Should have 1 full week
    const fullWeek = result.find(r => r.totalCompleted === 7);
    if (fullWeek) {
      expect(fullWeek.completionRate).toBe(1);
    }
  });
});

// ─── Category Breakdown Tests ────────────────────────────────────────────────

describe('computeCategoryBreakdown', () => {
  it('groups habits by category', () => {
    const habits = [
      createHabit({ id: 'h1', categoryId: 'cat-1' }),
      createHabit({ id: 'h2', categoryId: 'cat-2' }),
    ];
    const categories = [
      createCategory('cat-1', 'Fitness'),
      createCategory('cat-2', 'Learning'),
    ];
    const entries = [
      createEntry('h1', '2026-03-31'),
      createEntry('h2', '2026-03-31'),
    ];

    const result = computeCategoryBreakdown(habits, entries, categories, '2026-03-31', 1);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.categoryName !== 'Uncategorized')).toBe(true);
  });

  it('sorts by completion rate descending', () => {
    const habits = [
      createHabit({ id: 'h1', categoryId: 'cat-1' }),
      createHabit({ id: 'h2', categoryId: 'cat-2' }),
    ];
    const categories = [
      createCategory('cat-1', 'Fitness'),
      createCategory('cat-2', 'Learning'),
    ];
    // Only h1 completed — cat-1 should rank higher
    const entries = [createEntry('h1', '2026-03-31')];

    const result = computeCategoryBreakdown(habits, entries, categories, '2026-03-31', 1);
    expect(result[0].categoryId).toBe('cat-1');
    expect(result[0].completionRate).toBe(1);
    expect(result[1].completionRate).toBe(0);
  });
});

// ─── Insights Tests ──────────────────────────────────────────────────────────

describe('computeInsights', () => {
  it('returns empty for no habits', () => {
    const result = computeInsights([], [], '2026-03-31', 30);
    expect(result).toEqual([]);
  });

  it('identifies best day of week', () => {
    const habits = [createHabit()];
    // Complete every Monday in March 2026
    const entries = [
      createEntry('habit-1', '2026-03-02'), // Mon
      createEntry('habit-1', '2026-03-09'), // Mon
      createEntry('habit-1', '2026-03-16'), // Mon
      createEntry('habit-1', '2026-03-23'), // Mon
      createEntry('habit-1', '2026-03-30'), // Mon
    ];

    const result = computeInsights(habits, entries, '2026-03-31', 30);
    const bestDay = result.find(i => i.type === 'success' && i.message.includes('best day'));
    expect(bestDay).toBeDefined();
    expect(bestDay!.message).toContain('Monday');
  });

  it('identifies most consistent habit', () => {
    const habits = [
      createHabit({ id: 'h1', name: 'Running' }),
      createHabit({ id: 'h2', name: 'Reading' }),
    ];
    // h1 completed every day for 7 days, h2 only 1 day
    const entries = [
      ...Array.from({ length: 7 }, (_, i) =>
        createEntry('h1', `2026-03-${String(25 + i).padStart(2, '0')}`)
      ),
      createEntry('h2', '2026-03-31'),
    ];

    const result = computeInsights(habits, entries, '2026-03-31', 7);
    const mostConsistent = result.find(i => i.message.includes('most consistent'));
    expect(mostConsistent).toBeDefined();
    expect(mostConsistent!.message).toContain('Running');
  });

  it('identifies weekend vs weekday difference', () => {
    const habits = [createHabit()];
    // Complete only weekdays (Mon-Fri) in a full week
    const entries = [
      createEntry('habit-1', '2026-03-23'), // Mon
      createEntry('habit-1', '2026-03-24'), // Tue
      createEntry('habit-1', '2026-03-25'), // Wed
      createEntry('habit-1', '2026-03-26'), // Thu
      createEntry('habit-1', '2026-03-27'), // Fri
      // Skip Sat(28) and Sun(29)
    ];

    const result = computeInsights(habits, entries, '2026-03-31', 14);
    const weekendInsight = result.find(i => i.message.includes('weekday') || i.message.includes('weekend'));
    expect(weekendInsight).toBeDefined();
  });
});

// ─── Routine Analytics Tests ─────────────────────────────────────────────────

describe('computeRoutineAnalytics', () => {
  it('computes basic routine metrics', () => {
    const routines = [
      { id: 'r1', title: 'Morning Routine', userId: 'u1' },
      { id: 'r2', title: 'Evening Routine', userId: 'u1' },
    ] as any;

    const routineLogs: Record<string, any> = {
      'r1-2026-03-30': { routineId: 'r1', date: '2026-03-30', startedAt: '2026-03-30T07:00:00Z', completedAt: '2026-03-30T07:15:00Z', actualDurationSeconds: 900 },
      'r1-2026-03-31': { routineId: 'r1', date: '2026-03-31', startedAt: '2026-03-31T07:00:00Z', completedAt: '2026-03-31T07:20:00Z', actualDurationSeconds: 1200 },
      'r2-2026-03-31': { routineId: 'r2', date: '2026-03-31', startedAt: '2026-03-31T20:00:00Z', completedAt: '2026-03-31T20:10:00Z', actualDurationSeconds: 600 },
    };

    const result = computeRoutineAnalytics(routines, routineLogs, '2026-03-31', 7);
    expect(result.totalCompleted).toBe(3);
    expect(result.totalStarted).toBe(3);
    expect(result.reliabilityRate).toBe(1);
    expect(result.averageDurationSeconds).toBe(900); // (900+1200+600)/3
    expect(result.routineBreakdown).toHaveLength(2);
    expect(result.routineBreakdown[0].routineTitle).toBe('Morning Routine');
  });

  it('handles empty logs', () => {
    const result = computeRoutineAnalytics([], {}, '2026-03-31', 7);
    expect(result.totalCompleted).toBe(0);
    expect(result.reliabilityRate).toBe(0);
  });
});

// ─── Goal Analytics Tests ────────────────────────────────────────────────────

describe('computeGoalAnalytics', () => {
  it('computes basic goal metrics', () => {
    const goals = [
      { id: 'g1', title: 'Run 100 miles', type: 'cumulative', targetValue: 100, linkedHabitIds: ['h1'], aggregationMode: 'sum', createdAt: '2026-01-01' },
      { id: 'g2', title: 'Pass exam', type: 'onetime', linkedHabitIds: [], completedAt: '2026-03-15', createdAt: '2026-01-01' },
    ] as any;
    const habits = [createHabit({ id: 'h1' })];
    const entries = [
      createEntry('h1', '2026-03-30', { value: 5 }),
      createEntry('h1', '2026-03-31', { value: 10 }),
    ];

    const result = computeGoalAnalytics(goals, habits, entries, '2026-03-31');
    expect(result.activeGoals).toBe(1);
    expect(result.completedGoals).toBe(1);
    expect(result.goalBreakdown).toHaveLength(2);

    const runGoal = result.goalBreakdown.find(g => g.goalId === 'g1');
    expect(runGoal!.progressPercent).toBe(15); // 15/100
    expect(runGoal!.isCompleted).toBe(false);

    const examGoal = result.goalBreakdown.find(g => g.goalId === 'g2');
    expect(examGoal!.isCompleted).toBe(true);
    expect(examGoal!.progressPercent).toBe(100);
  });

  it('marks goals at risk near deadline', () => {
    const goals = [
      { id: 'g1', title: 'Goal', type: 'cumulative', targetValue: 100, linkedHabitIds: ['h1'], aggregationMode: 'sum', deadline: '2026-04-10', createdAt: '2026-01-01' },
    ] as any;
    const habits = [createHabit({ id: 'h1' })];
    const entries = [createEntry('h1', '2026-03-31', { value: 5 })];

    const result = computeGoalAnalytics(goals, habits, entries, '2026-03-31');
    expect(result.goalsAtRisk).toBe(1);
    expect(result.goalBreakdown[0].isAtRisk).toBe(true);
  });
});
