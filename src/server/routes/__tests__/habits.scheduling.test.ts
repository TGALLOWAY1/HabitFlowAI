/**
 * Habit Scheduling Tests
 *
 * Validates that POST/PATCH /api/habits correctly handles
 * assignedDays and requiredDaysPerWeek fields, including
 * the derived nonNegotiable behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  getHabits,
  createHabitRoute,
  updateHabitRoute,
} from '../habits';
import {
  createCategoryRoute,
} from '../categories';

const TEST_USER_ID = 'test-scheduling-user';
const TEST_HOUSEHOLD_ID = 'test-scheduling-household';

describe('Habit Scheduling (assignedDays + requiredDaysPerWeek)', () => {
  let app: Express;
  let category: any;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = TEST_HOUSEHOLD_ID;
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.get('/api/habits', getHabits);
    app.post('/api/habits', createHabitRoute);
    app.patch('/api/habits/:id', updateHabitRoute);
    app.post('/api/categories', createCategoryRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const testDb = await getTestDb();
    await testDb.collection('habits').deleteMany({});
    await testDb.collection('categories').deleteMany({});

    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'Health', color: 'bg-green-500' });
    category = res.body.category;
  });

  it('creates a habit with assignedDays and requiredDaysPerWeek', async () => {
    const res = await request(app)
      .post('/api/habits')
      .send({
        name: 'Grocery Shopping',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        assignedDays: [0, 3], // Sun + Wed
        requiredDaysPerWeek: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.habit.assignedDays).toEqual([0, 3]);
    expect(res.body.habit.requiredDaysPerWeek).toBe(2);
  });

  it('creates a habit with all 7 days and required 7 (non-negotiable)', async () => {
    const res = await request(app)
      .post('/api/habits')
      .send({
        name: 'Meditation',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        requiredDaysPerWeek: 7,
        nonNegotiable: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.habit.assignedDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(res.body.habit.requiredDaysPerWeek).toBe(7);
    expect(res.body.habit.nonNegotiable).toBe(true);
  });

  it('creates a habit with flexible streak (grace days)', async () => {
    const res = await request(app)
      .post('/api/habits')
      .send({
        name: 'Clean Eating',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        assignedDays: [1, 2, 3, 4, 5], // Mon-Fri
        requiredDaysPerWeek: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.habit.assignedDays).toEqual([1, 2, 3, 4, 5]);
    expect(res.body.habit.requiredDaysPerWeek).toBe(3);
  });

  it('updates requiredDaysPerWeek via PATCH', async () => {
    const createRes = await request(app)
      .post('/api/habits')
      .send({
        name: 'Exercise',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        requiredDaysPerWeek: 7,
      });

    const habitId = createRes.body.habit.id;

    const updateRes = await request(app)
      .patch(`/api/habits/${habitId}`)
      .send({
        requiredDaysPerWeek: 5,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.habit.requiredDaysPerWeek).toBe(5);
  });

  it('updates assignedDays via PATCH', async () => {
    const createRes = await request(app)
      .post('/api/habits')
      .send({
        name: 'Reading',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        requiredDaysPerWeek: 7,
      });

    const habitId = createRes.body.habit.id;

    const updateRes = await request(app)
      .patch(`/api/habits/${habitId}`)
      .send({
        assignedDays: [1, 3, 5], // Mon, Wed, Fri
        requiredDaysPerWeek: 3,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.habit.assignedDays).toEqual([1, 3, 5]);
    expect(updateRes.body.habit.requiredDaysPerWeek).toBe(3);
  });

  it('creates a habit without scheduling fields (backward compat)', async () => {
    const res = await request(app)
      .post('/api/habits')
      .send({
        name: 'Old Style Habit',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
      });

    expect(res.status).toBe(201);
    // Fields should be undefined (backward compatible)
    expect(res.body.habit.requiredDaysPerWeek ?? undefined).toBeUndefined();
  });

  it('persists weekly occurrence and checklist streak configuration', async () => {
    const weeklyRes = await request(app)
      .post('/api/habits')
      .send({
        name: 'Run twice',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        timesPerWeek: 2,
      });
    expect(weeklyRes.status).toBe(201);
    expect(weeklyRes.body.habit.timesPerWeek).toBe(2);

    const bundleRes = await request(app)
      .post('/api/habits')
      .send({
        name: 'Morning checklist',
        categoryId: category.id,
        type: 'bundle',
        bundleType: 'checklist',
        subHabitIds: ['child-1', 'child-2'],
        goal: { type: 'boolean', frequency: 'daily' },
        checklistSuccessRule: { type: 'threshold', threshold: 1 },
        streakType: 'full',
      });
    expect(bundleRes.status).toBe(201);
    expect(bundleRes.body.habit.checklistSuccessRule).toEqual({ type: 'threshold', threshold: 1 });
    expect(bundleRes.body.habit.streakType).toBe('full');
  });

  it.each([
    ['missing numeric target', { goal: { type: 'number', frequency: 'daily' } }],
    ['zero numeric target', { goal: { type: 'number', frequency: 'daily', target: 0 } }],
    ['negative numeric target', { goal: { type: 'number', frequency: 'daily', target: -1 } }],
    ['duplicate scheduled days', { assignedDays: [1, 1, 3] }],
    ['out-of-range scheduled day', { assignedDays: [1, 7] }],
    ['empty schedule', { assignedDays: [] }],
    ['quota larger than schedule', { assignedDays: [1, 3], requiredDaysPerWeek: 3 }],
    ['zero weekly occurrence target', { timesPerWeek: 0 }],
    ['fractional weekly occurrence target', { timesPerWeek: 2.5 }],
  ])('rejects invalid habit definition: %s', async (_label, override) => {
    const res = await request(app)
      .post('/api/habits')
      .send({
        name: `Invalid ${_label}`,
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        ...override,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates the merged habit when a schedule or target is edited', async () => {
    const createRes = await request(app)
      .post('/api/habits')
      .send({
        name: 'Read pages',
        categoryId: category.id,
        goal: { type: 'number', frequency: 'daily', target: 10 },
        assignedDays: [1, 3, 5],
        requiredDaysPerWeek: 2,
      });
    expect(createRes.status).toBe(201);

    const invalidSchedule = await request(app)
      .patch(`/api/habits/${createRes.body.habit.id}`)
      .send({ assignedDays: [1] });
    expect(invalidSchedule.status).toBe(400);

    const invalidTarget = await request(app)
      .patch(`/api/habits/${createRes.body.habit.id}`)
      .send({ goal: { type: 'number', frequency: 'daily', target: -3 } });
    expect(invalidTarget.status).toBe(400);
  });
});
