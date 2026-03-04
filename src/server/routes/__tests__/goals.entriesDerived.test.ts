/**
 * Regression tests for entries-derived goal progress.
 *
 * Verifies that goals-with-progress and goal detail endpoints
 * agree on progress totals when HabitEntries are the only truth.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createGoal } from '../../repositories/goalRepository';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createHabitEntryRoute } from '../habitEntries';
import { getGoalsWithProgress, getGoalDetailRoute, getGoalProgress, createGoalManualLogRoute } from '../goals';
import { requestContextMiddleware } from '../../middleware/requestContext';

const TEST_USER = 'test-user-goals-entries-derived';

let app: Express;
let habitId: string;
let goalId: string;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('Goals entries-derived regression', () => {
  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use(requestContextMiddleware);
    app.use((req, _res, next) => {
      (req as any).userId = TEST_USER;
      next();
    });

    app.post('/api/entries', createHabitEntryRoute);
    app.get('/api/goals-with-progress', getGoalsWithProgress);
    app.get('/api/goals/:id/detail', getGoalDetailRoute);
    app.get('/api/goals/:id/progress', getGoalProgress);
    app.post('/api/goals/:id/manual-logs', createGoalManualLogRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await Promise.all([
      db.collection('categories').deleteMany({ userId: TEST_USER }),
      db.collection('habits').deleteMany({ userId: TEST_USER }),
      db.collection('habitEntries').deleteMany({ userId: TEST_USER }),
      db.collection('goals').deleteMany({ userId: TEST_USER }),
      db.collection('goalManualLogs').deleteMany({ userId: TEST_USER }),
    ]);

    const cat = await createCategory({ name: 'Test', color: '#FF0000' }, TEST_USER);
    const habit = await createHabit(
      {
        name: 'Running',
        categoryId: cat.id,
        goal: { type: 'number', frequency: 'daily', target: 5, unit: 'miles' },
      },
      TEST_USER
    );
    habitId = habit.id;

    const goal = await createGoal(
      {
        title: 'Run 100 miles',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: [habit.id],
        aggregationMode: 'sum',
      },
      TEST_USER
    );
    goalId = goal.id;
  });

  it('goals-with-progress and goal detail agree on progress after creating entries', async () => {
    const day = todayKey();

    const entryRes = await request(app).post('/api/entries').send({
      habitId,
      dayKey: day,
      value: 10,
      source: 'manual',
      timeZone: 'UTC',
    });
    expect(entryRes.status).toBe(201);

    const [gwpRes, detailRes, progressRes] = await Promise.all([
      request(app).get('/api/goals-with-progress').query({ timeZone: 'UTC' }),
      request(app).get(`/api/goals/${goalId}/detail`).query({ timeZone: 'UTC' }),
      request(app).get(`/api/goals/${goalId}/progress`).query({ timeZone: 'UTC' }),
    ]);

    expect(gwpRes.status).toBe(200);
    expect(detailRes.status).toBe(200);
    expect(progressRes.status).toBe(200);

    const gwpGoal = gwpRes.body.goals.find((g: any) => g.goal.id === goalId);
    expect(gwpGoal).toBeDefined();
    expect(gwpGoal.progress.currentValue).toBe(10);
    expect(gwpGoal.progress.percent).toBe(10);

    expect(detailRes.body.progress.currentValue).toBe(10);
    expect(detailRes.body.progress.percent).toBe(10);

    expect(progressRes.body.progress.currentValue).toBe(10);
    expect(progressRes.body.progress.percent).toBe(10);
  });

  it('manual goal log write returns 410 Gone', async () => {
    const res = await request(app)
      .post(`/api/goals/${goalId}/manual-logs`)
      .send({ value: 5, loggedAt: new Date().toISOString() });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('GONE');
  });

  it('with no entries, all progress endpoints report zero', async () => {
    const [gwpRes, detailRes] = await Promise.all([
      request(app).get('/api/goals-with-progress').query({ timeZone: 'UTC' }),
      request(app).get(`/api/goals/${goalId}/detail`).query({ timeZone: 'UTC' }),
    ]);

    const gwpGoal = gwpRes.body.goals.find((g: any) => g.goal.id === goalId);
    expect(gwpGoal.progress.currentValue).toBe(0);
    expect(gwpGoal.progress.percent).toBe(0);

    expect(detailRes.body.progress.currentValue).toBe(0);
    expect(detailRes.body.progress.percent).toBe(0);
  });
});
