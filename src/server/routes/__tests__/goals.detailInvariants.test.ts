/**
 * Invariant tests for /api/goals/:id/detail.
 *
 * The goal detail page renders three derived views (cumulative chart,
 * weekly summary, day-by-day list) plus a top "currentValue" number.
 * Previously the chart and the top diverged because they used different
 * data sources with different orphan-entry filters — a user with a
 * removed habit saw top=298 / chart=210. These tests lock in the
 * invariant that sum(contributions[].value) === progress.currentValue,
 * regardless of whether any linked habits have been soft-deleted.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit, deleteHabit } from '../../repositories/habitRepository';
import { createGoal } from '../../repositories/goalRepository';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createHabitEntryRoute } from '../habitEntries';
import { getGoalDetailRoute } from '../goals';
import { requestContextMiddleware } from '../../middleware/requestContext';

const TEST_HOUSEHOLD = 'test-household-goals-detail-invariants';
const TEST_USER = 'test-user-goals-detail-invariants';

let app: Express;

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('Goal detail: contributions sum equals progress.currentValue', () => {
  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use(requestContextMiddleware);
    app.use((req, _res, next) => {
      (req as any).householdId = TEST_HOUSEHOLD;
      (req as any).userId = TEST_USER;
      next();
    });

    app.post('/api/entries', createHabitEntryRoute);
    app.get('/api/goals/:id/detail', getGoalDetailRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await Promise.all([
      db.collection('categories').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
      db.collection('habits').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
      db.collection('habitEntries').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
      db.collection('goals').deleteMany({ householdId: TEST_HOUSEHOLD, userId: TEST_USER }),
    ]);
  });

  it('sum mode: matches currentValue across active and deleted habits', async () => {
    const cat = await createCategory({ name: 'Fitness', color: '#FF0000' }, TEST_HOUSEHOLD, TEST_USER);

    const pullUps = await createHabit(
      {
        name: 'Pull ups',
        categoryId: cat.id,
        goal: { type: 'number', frequency: 'daily', target: 10, unit: 'reps' },
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );
    const chinUps = await createHabit(
      {
        name: 'Chin ups',
        categoryId: cat.id,
        goal: { type: 'number', frequency: 'daily', target: 10, unit: 'reps' },
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    const goal = await createGoal(
      {
        title: 'Do 500 pull ups',
        type: 'cumulative',
        targetValue: 500,
        unit: 'reps',
        linkedHabitIds: [pullUps.id, chinUps.id],
        aggregationMode: 'sum',
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    // Pull-ups: 210 reps spread across 3 days.
    await request(app).post('/api/entries').send({
      habitId: pullUps.id, dayKey: daysAgoKey(2), value: 70, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: pullUps.id, dayKey: daysAgoKey(1), value: 70, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: pullUps.id, dayKey: daysAgoKey(0), value: 70, source: 'manual', timeZone: 'UTC',
    });

    // Chin-ups: 88 reps in the past, then the habit gets removed.
    await request(app).post('/api/entries').send({
      habitId: chinUps.id, dayKey: daysAgoKey(5), value: 44, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: chinUps.id, dayKey: daysAgoKey(4), value: 44, source: 'manual', timeZone: 'UTC',
    });

    // Soft-delete the chin-ups habit (orphans its 88 reps of entries).
    const deleted = await deleteHabit(chinUps.id, TEST_HOUSEHOLD, TEST_USER);
    expect(deleted).toBe(true);

    const res = await request(app).get(`/api/goals/${goal.id}/detail`).query({ timeZone: 'UTC' });
    expect(res.status).toBe(200);

    const { progress, contributions } = res.body as {
      progress: { currentValue: number };
      contributions: Array<{ habitId: string; habitName: string; habitDeleted: boolean; value: number }>;
    };

    // The critical invariant: the cumulative chart (sum of contributions)
    // must match the headline number at the top of the page.
    const sumOfContributions = contributions.reduce((s, c) => s + c.value, 0);
    expect(sumOfContributions).toBe(progress.currentValue);
    expect(sumOfContributions).toBe(298); // 210 + 88

    // The removed habit's entries are still present in the series, with
    // habitDeleted=true so the UI can surface them in a "Removed" list.
    const orphaned = contributions.filter(c => c.habitDeleted);
    expect(orphaned.length).toBe(2);
    expect(orphaned.every(c => c.habitName === 'Chin ups')).toBe(true);
    expect(orphaned.reduce((s, c) => s + c.value, 0)).toBe(88);
  });

  it('sum mode with boolean habit: entries contribute the habit target, not entry.value', async () => {
    const cat = await createCategory({ name: 'Health', color: '#00FF00' }, TEST_HOUSEHOLD, TEST_USER);

    // Boolean habit: each check-in is worth `target` toward the goal.
    const habit = await createHabit(
      {
        name: 'Quick pushup set',
        categoryId: cat.id,
        goal: { type: 'boolean', frequency: 'daily', target: 25 },
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );
    const goal = await createGoal(
      {
        title: '1000 pushups',
        type: 'cumulative',
        targetValue: 1000,
        linkedHabitIds: [habit.id],
        aggregationMode: 'sum',
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    // Three check-ins → should contribute 75 total (3 * 25).
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: daysAgoKey(2), value: 1, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: daysAgoKey(1), value: 1, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: daysAgoKey(0), value: 1, source: 'manual', timeZone: 'UTC',
    });

    const res = await request(app).get(`/api/goals/${goal.id}/detail`).query({ timeZone: 'UTC' });
    const { progress, contributions } = res.body;

    const sumOfContributions = contributions.reduce((s: number, c: { value: number }) => s + c.value, 0);
    expect(progress.currentValue).toBe(75);
    expect(sumOfContributions).toBe(progress.currentValue);
  });

  it('count mode (distinctDays): contributions dedupe per day', async () => {
    const cat = await createCategory({ name: 'Mindfulness', color: '#0000FF' }, TEST_HOUSEHOLD, TEST_USER);
    const habit = await createHabit(
      {
        name: 'Meditate',
        categoryId: cat.id,
        goal: { type: 'boolean', frequency: 'daily', target: 1 },
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );
    const goal = await createGoal(
      {
        title: 'Meditate 30 days',
        type: 'cumulative',
        targetValue: 30,
        linkedHabitIds: [habit.id],
        aggregationMode: 'count',
        countMode: 'distinctDays',
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    // Two entries on the same day, one on another. distinctDays = 2.
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: daysAgoKey(1), value: 1, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: daysAgoKey(1), value: 1, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: daysAgoKey(0), value: 1, source: 'manual', timeZone: 'UTC',
    });

    const res = await request(app).get(`/api/goals/${goal.id}/detail`).query({ timeZone: 'UTC' });
    const { progress, contributions } = res.body;

    expect(progress.currentValue).toBe(2);
    const sumOfContributions = contributions.reduce((s: number, c: { value: number }) => s + c.value, 0);
    expect(sumOfContributions).toBe(progress.currentValue);
  });
});
