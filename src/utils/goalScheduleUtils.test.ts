import { describe, it, expect } from 'vitest';
import {
  deriveScheduleEvents,
  groupEventsByDate,
  filterEventsByCategory,
  filterEventsByGoal,
  sortEvents,
  getEventTypeColor,
  getStatusLabel,
  type ScheduleEvent,
} from './goalScheduleUtils';
import type { GoalWithProgress } from '../models/persistenceTypes';
import type { GoalBreakdownItem } from '../lib/analyticsClient';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGoalWithProgress(overrides: Partial<GoalWithProgress['goal']> & { progressOverrides?: Partial<GoalWithProgress['progress']> } = {}): GoalWithProgress {
  const { progressOverrides, ...goalOverrides } = overrides;
  return {
    goal: {
      id: 'goal-1',
      title: 'Run 100 Miles',
      type: 'cumulative',
      targetValue: 100,
      unit: 'miles',
      linkedHabitIds: ['habit-1'],
      createdAt: '2026-01-01T00:00:00.000Z',
      categoryId: 'cat-fitness',
      ...goalOverrides,
    },
    progress: {
      currentValue: 40,
      percent: 40,
      lastSevenDays: [],
      lastThirtyDays: [],
      inactivityWarning: false,
      ...progressOverrides,
    },
  };
}

function makeAnalytic(overrides: Partial<GoalBreakdownItem> = {}): GoalBreakdownItem {
  return {
    goalId: 'goal-1',
    goalTitle: 'Run 100 Miles',
    progressPercent: 40,
    isCompleted: false,
    isAtRisk: false,
    status: 'On Track',
    currentValue: 40,
    targetValue: 100,
    unit: 'miles',
    timeElapsedPercent: 30,
    requiredPacePerWeek: 5,
    currentPacePerWeek: 4,
    remainingWork: 60,
    estimatedCompletionWeeks: 15,
    completionDate: null,
    timeTakenDays: null,
    avgPerWeek: null,
    ...overrides,
  };
}

const REF_DATE = new Date('2026-04-01');

// ─── deriveScheduleEvents ───────────────────────────────────────────────────

describe('deriveScheduleEvents', () => {
  it('creates a target event from goal deadline', () => {
    const goals = [makeGoalWithProgress({ deadline: '2026-06-15' })];
    const analytics = [makeAnalytic()];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const targetEvents = events.filter(e => e.eventType === 'target');
    expect(targetEvents).toHaveLength(1);
    expect(targetEvents[0].date).toBe('2026-06-15');
    expect(targetEvents[0].label).toBe('Target deadline');
    expect(targetEvents[0].goalId).toBe('goal-1');
  });

  it('creates a completed event from completedAt', () => {
    const goals = [makeGoalWithProgress({
      completedAt: '2026-03-20T14:30:00.000Z',
      progressOverrides: { percent: 100, currentValue: 100 },
    })];
    const analytics = [makeAnalytic({ status: 'Completed', isCompleted: true, progressPercent: 100 })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const completedEvents = events.filter(e => e.eventType === 'completed');
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].date).toBe('2026-03-20');
    expect(completedEvents[0].label).toBe('Completed');
    expect(completedEvents[0].progressPercent).toBe(100);
  });

  it('creates a forecast event when estimatedCompletionWeeks > 0', () => {
    const goals = [makeGoalWithProgress()];
    const analytics = [makeAnalytic({ estimatedCompletionWeeks: 10 })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const forecastEvents = events.filter(e => e.eventType === 'forecast');
    expect(forecastEvents).toHaveLength(1);
    expect(forecastEvents[0].date).toBe('2026-06-10'); // Apr 1 + 10 weeks
    expect(forecastEvents[0].trendExplanation).toBe('At current pace');
    expect(forecastEvents[0].label).toBe('Forecasted completion');
  });

  it('does not create forecast when goal is completed', () => {
    const goals = [makeGoalWithProgress({
      completedAt: '2026-03-20T00:00:00.000Z',
      progressOverrides: { percent: 100, currentValue: 100 },
    })];
    const analytics = [makeAnalytic({ estimatedCompletionWeeks: 5, isCompleted: true, status: 'Completed' })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const forecastEvents = events.filter(e => e.eventType === 'forecast');
    expect(forecastEvents).toHaveLength(0);
  });

  it('does not create forecast when pace is 0', () => {
    const goals = [makeGoalWithProgress()];
    const analytics = [makeAnalytic({ currentPacePerWeek: 0, estimatedCompletionWeeks: null })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const forecastEvents = events.filter(e => e.eventType === 'forecast');
    expect(forecastEvents).toHaveLength(0);
  });

  it('creates milestone events for cumulative goals with pace', () => {
    const goals = [makeGoalWithProgress()];
    const analytics = [makeAnalytic({ currentPacePerWeek: 4, currentValue: 40 })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const milestoneEvents = events.filter(e => e.eventType === 'milestone');
    // 25% = 25 miles (already passed, currentValue=40), may or may not show depending on date range
    // 50% = 50 miles (future), 75% = 75 miles (future)
    expect(milestoneEvents.length).toBeGreaterThanOrEqual(2);
    expect(milestoneEvents.some(e => e.label === '50% milestone')).toBe(true);
    expect(milestoneEvents.some(e => e.label === '75% milestone')).toBe(true);
  });

  it('does not create milestones for onetime goals', () => {
    const goals = [makeGoalWithProgress({ type: 'onetime', targetValue: undefined })];
    const analytics = [makeAnalytic({ currentPacePerWeek: 0 })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const milestoneEvents = events.filter(e => e.eventType === 'milestone');
    expect(milestoneEvents).toHaveLength(0);
  });

  it('maps On Track status correctly', () => {
    const goals = [makeGoalWithProgress({ deadline: '2026-06-15' })];
    const analytics = [makeAnalytic({ status: 'On Track' })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const target = events.find(e => e.eventType === 'target');
    expect(target?.status).toBe('on-track');
  });

  it('maps At Risk status correctly', () => {
    const goals = [makeGoalWithProgress({ deadline: '2026-06-15' })];
    const analytics = [makeAnalytic({ status: 'At Risk', isAtRisk: true })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const target = events.find(e => e.eventType === 'target');
    expect(target?.status).toBe('at-risk');
  });

  it('maps Behind status correctly', () => {
    const goals = [makeGoalWithProgress({ deadline: '2026-06-15' })];
    const analytics = [makeAnalytic({ status: 'Behind', isAtRisk: true })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const target = events.find(e => e.eventType === 'target');
    expect(target?.status).toBe('behind');
  });

  it('uses insufficient-data when no analytic exists', () => {
    const goals = [makeGoalWithProgress({ deadline: '2026-06-15' })];
    const events = deriveScheduleEvents(goals, [], REF_DATE);
    const target = events.find(e => e.eventType === 'target');
    expect(target?.status).toBe('insufficient-data');
  });

  it('handles multiple goals producing events on the same date', () => {
    const goals = [
      makeGoalWithProgress({ id: 'g1', title: 'Goal A', deadline: '2026-06-15' }),
      makeGoalWithProgress({ id: 'g2', title: 'Goal B', deadline: '2026-06-15' }),
    ];
    const analytics = [
      makeAnalytic({ goalId: 'g1' }),
      makeAnalytic({ goalId: 'g2' }),
    ];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    const june15Events = events.filter(e => e.date === '2026-06-15');
    expect(june15Events.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves categoryId from goal', () => {
    const goals = [makeGoalWithProgress({ categoryId: 'cat-study' })];
    const analytics = [makeAnalytic()];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    expect(events.every(e => e.categoryId === 'cat-study')).toBe(true);
  });

  it('all events have isDerived: true', () => {
    const goals = [makeGoalWithProgress({ deadline: '2026-06-15', completedAt: '2026-03-01T00:00:00Z' })];
    const analytics = [makeAnalytic({ status: 'Completed', estimatedCompletionWeeks: 5 })];
    const events = deriveScheduleEvents(goals, analytics, REF_DATE);
    expect(events.every(e => e.isDerived === true)).toBe(true);
  });
});

// ─── groupEventsByDate ──────────────────────────────────────────────────────

describe('groupEventsByDate', () => {
  it('groups events by date', () => {
    const events: ScheduleEvent[] = [
      { goalId: 'g1', goalTitle: 'A', eventType: 'target', date: '2026-06-15', label: '', status: 'on-track', progressPercent: 50, isDerived: true },
      { goalId: 'g2', goalTitle: 'B', eventType: 'forecast', date: '2026-06-15', label: '', status: 'on-track', progressPercent: 30, isDerived: true },
      { goalId: 'g3', goalTitle: 'C', eventType: 'milestone', date: '2026-07-01', label: '', status: 'on-track', progressPercent: 20, isDerived: true },
    ];
    const grouped = groupEventsByDate(events);
    expect(grouped.get('2026-06-15')).toHaveLength(2);
    expect(grouped.get('2026-07-01')).toHaveLength(1);
  });

  it('returns empty map for empty input', () => {
    const grouped = groupEventsByDate([]);
    expect(grouped.size).toBe(0);
  });
});

// ─── filterEventsByCategory ─────────────────────────────────────────────────

describe('filterEventsByCategory', () => {
  const events: ScheduleEvent[] = [
    { goalId: 'g1', goalTitle: 'A', eventType: 'target', date: '2026-06-15', label: '', categoryId: 'cat-fitness', status: 'on-track', progressPercent: 50, isDerived: true },
    { goalId: 'g2', goalTitle: 'B', eventType: 'target', date: '2026-06-16', label: '', categoryId: 'cat-study', status: 'on-track', progressPercent: 30, isDerived: true },
    { goalId: 'g3', goalTitle: 'C', eventType: 'target', date: '2026-06-17', label: '', status: 'on-track', progressPercent: 20, isDerived: true },
  ];

  it('returns all events when no category filter', () => {
    expect(filterEventsByCategory(events, [])).toHaveLength(3);
  });

  it('filters to single category', () => {
    const filtered = filterEventsByCategory(events, ['cat-fitness']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].goalId).toBe('g1');
  });

  it('filters to multiple categories', () => {
    const filtered = filterEventsByCategory(events, ['cat-fitness', 'cat-study']);
    expect(filtered).toHaveLength(2);
  });

  it('excludes events without categoryId', () => {
    const filtered = filterEventsByCategory(events, ['cat-fitness']);
    expect(filtered.every(e => e.categoryId === 'cat-fitness')).toBe(true);
  });
});

// ─── filterEventsByGoal ─────────────────────────────────────────────────────

describe('filterEventsByGoal', () => {
  it('returns only events for the specified goal', () => {
    const events: ScheduleEvent[] = [
      { goalId: 'g1', goalTitle: 'A', eventType: 'target', date: '2026-06-15', label: '', status: 'on-track', progressPercent: 50, isDerived: true },
      { goalId: 'g2', goalTitle: 'B', eventType: 'target', date: '2026-06-16', label: '', status: 'on-track', progressPercent: 30, isDerived: true },
    ];
    expect(filterEventsByGoal(events, 'g1')).toHaveLength(1);
    expect(filterEventsByGoal(events, 'g1')[0].goalId).toBe('g1');
  });
});

// ─── sortEvents ─────────────────────────────────────────────────────────────

describe('sortEvents', () => {
  it('sorts by date then by event type priority', () => {
    const events: ScheduleEvent[] = [
      { goalId: 'g1', goalTitle: 'A', eventType: 'milestone', date: '2026-06-15', label: '', status: 'on-track', progressPercent: 50, isDerived: true },
      { goalId: 'g2', goalTitle: 'B', eventType: 'completed', date: '2026-06-15', label: '', status: 'on-track', progressPercent: 100, isDerived: true },
      { goalId: 'g3', goalTitle: 'C', eventType: 'target', date: '2026-06-14', label: '', status: 'on-track', progressPercent: 30, isDerived: true },
    ];
    const sorted = sortEvents(events);
    expect(sorted[0].date).toBe('2026-06-14'); // earliest date first
    expect(sorted[1].eventType).toBe('completed'); // completed before milestone on same date
    expect(sorted[2].eventType).toBe('milestone');
  });
});

// ─── Utility functions ──────────────────────────────────────────────────────

describe('getEventTypeColor', () => {
  it('returns correct colors', () => {
    expect(getEventTypeColor('target')).toBe('bg-blue-500');
    expect(getEventTypeColor('completed')).toBe('bg-emerald-500');
    expect(getEventTypeColor('forecast')).toBe('bg-amber-500');
    expect(getEventTypeColor('milestone')).toBe('bg-purple-500');
  });
});

describe('getStatusLabel', () => {
  it('returns correct labels', () => {
    expect(getStatusLabel('on-track')).toBe('On track');
    expect(getStatusLabel('at-risk')).toBe('At risk');
    expect(getStatusLabel('behind')).toBe('Behind');
    expect(getStatusLabel('insufficient-data')).toBe('Insufficient data');
  });
});
