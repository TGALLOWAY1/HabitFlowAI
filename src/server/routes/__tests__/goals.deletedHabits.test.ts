/**
 * Tests for goal progress when linked habits have been deleted.
 *
 * Verifies that:
 * 1. Entries from deleted habits still count toward goal progress
 * 2. Entries that were cascade-soft-deleted (legacy) still count
 * 3. All goal progress endpoints agree
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit, deleteHabit } from '../../repositories/habitRepository';
import { createGoal } from '../../repositories/goalRepository';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createHabitEntryRoute } from '../habitEntries';
import { getGoalsWithProgress, getGoalDetailRoute, getGoalProgress } from '../goals';
import { requestContextMiddleware } from '../../middleware/requestContext';

const TEST_HOUSEHOLD = 'test-household-goals-deleted-habits';
const TEST_USER = 'test-user-goals-deleted-habits';

let app: Express;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('Goal progress with deleted habits', () => {
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
    app.get('/api/goals-with-progress', getGoalsWithProgress);
    app.get('/api/goals/:id/detail', getGoalDetailRoute);
    app.get('/api/goals/:id/progress', getGoalProgress);
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

  it('entries from a deleted habit still count toward goal progress (sum mode)', async () => {
    const cat = await createCategory({ name: 'Fitness', color: '#00FF00' }, TEST_HOUSEHOLD, TEST_USER);
    const habit = await createHabit(
      {
        name: 'Running',
        categoryId: cat.id,
        goal: { type: 'number', frequency: 'daily', target: 5, unit: 'miles' },
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    const goal = await createGoal(
      {
        title: 'Run 100 miles',
        type: 'cumulative',
        targetValue: 100,
        unit: 'miles',
        linkedHabitIds: [habit.id],
        aggregationMode: 'sum',
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    // Create entries
    const day = todayKey();
    const entryRes = await request(app).post('/api/entries').send({
      habitId: habit.id,
      dayKey: day,
      value: 10,
      source: 'manual',
      timeZone: 'UTC',
    });
    expect(entryRes.status).toBe(201);

    // Verify progress before deletion
    const beforeRes = await request(app).get(`/api/goals/${goal.id}/progress`).query({ timeZone: 'UTC' });
    expect(beforeRes.body.progress.currentValue).toBe(10);

    // Delete the habit (entries persist as orphans)
    const deleted = await deleteHabit(habit.id, TEST_HOUSEHOLD, TEST_USER);
    expect(deleted).toBe(true);

    // Goal progress should still include the entries
    const [progressRes, gwpRes, detailRes] = await Promise.all([
      request(app).get(`/api/goals/${goal.id}/progress`).query({ timeZone: 'UTC' }),
      request(app).get('/api/goals-with-progress').query({ timeZone: 'UTC' }),
      request(app).get(`/api/goals/${goal.id}/detail`).query({ timeZone: 'UTC' }),
    ]);

    expect(progressRes.body.progress.currentValue).toBe(10);
    expect(progressRes.body.progress.percent).toBe(10);

    const gwpGoal = gwpRes.body.goals.find((g: any) => g.goal.id === goal.id);
    expect(gwpGoal).toBeDefined();
    expect(gwpGoal.progress.currentValue).toBe(10);

    expect(detailRes.body.progress.currentValue).toBe(10);
  });

  it('entries from a deleted habit still count toward goal progress (count/distinctDays mode)', async () => {
    const cat = await createCategory({ name: 'Health', color: '#0000FF' }, TEST_HOUSEHOLD, TEST_USER);
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

    // Create entries on two different days
    const day1 = todayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const day2 = yesterday.toISOString().slice(0, 10);

    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: day1, value: 1, source: 'manual', timeZone: 'UTC',
    });
    await request(app).post('/api/entries').send({
      habitId: habit.id, dayKey: day2, value: 1, source: 'manual', timeZone: 'UTC',
    });

    // Delete the habit
    await deleteHabit(habit.id, TEST_HOUSEHOLD, TEST_USER);

    // Progress should still show 2 distinct days
    const progressRes = await request(app).get(`/api/goals/${goal.id}/progress`).query({ timeZone: 'UTC' });
    expect(progressRes.body.progress.currentValue).toBe(2);
    expect(progressRes.body.progress.percent).toBe(7); // 2/30 ≈ 6.67 → rounds to 7
  });

  it('cascade-soft-deleted entries (legacy) still count toward goal progress', async () => {
    const cat = await createCategory({ name: 'Exercise', color: '#FF0000' }, TEST_HOUSEHOLD, TEST_USER);
    const habit = await createHabit(
      {
        name: 'Push-ups',
        categoryId: cat.id,
        goal: { type: 'number', frequency: 'daily', target: 50, unit: 'reps' },
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    const goal = await createGoal(
      {
        title: 'Do 1000 push-ups',
        type: 'cumulative',
        targetValue: 1000,
        unit: 'reps',
        linkedHabitIds: [habit.id],
        aggregationMode: 'sum',
      },
      TEST_HOUSEHOLD,
      TEST_USER
    );

    // Create an entry
    const day = todayKey();
    await request(app).post('/api/entries').send({
      habitId: habit.id,
      dayKey: day,
      value: 50,
      source: 'manual',
      timeZone: 'UTC',
    });

    // Simulate legacy cascade-soft-delete: set deletedAt on entries directly
    const db = await getTestDb();
    await db.collection('habitEntries').updateMany(
      { habitId: habit.id, householdId: TEST_HOUSEHOLD, userId: TEST_USER },
      { $set: { deletedAt: new Date().toISOString() } }
    );

    // Hard-delete the habit (simulating legacy behavior)
    await deleteHabit(habit.id, TEST_HOUSEHOLD, TEST_USER);

    // Goal progress should STILL include the cascade-soft-deleted entries
    const progressRes = await request(app).get(`/api/goals/${goal.id}/progress`).query({ timeZone: 'UTC' });
    expect(progressRes.body.progress.currentValue).toBe(50);
    expect(progressRes.body.progress.percent).toBe(5); // 50/1000

    const gwpRes = await request(app).get('/api/goals-with-progress').query({ timeZone: 'UTC' });
    const gwpGoal = gwpRes.body.goals.find((g: any) => g.goal.id === goal.id);
    expect(gwpGoal.progress.currentValue).toBe(50);
  });
});
