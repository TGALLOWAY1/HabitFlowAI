/**
 * Habit Reminder Field Tests
 *
 * Validates that POST/PATCH /api/habits correctly handles the
 * reminderTime ("HH:mm") and reminderEnabled fields, including
 * format validation and the clear-with-null contract.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createHabitRoute, updateHabitRoute } from '../habits';
import { createCategoryRoute } from '../categories';

const TEST_HOUSEHOLD_ID = 'test-reminder-household';
const TEST_USER_ID = 'test-reminder-user';

describe('Habit Reminder Fields (reminderTime + reminderEnabled)', () => {
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

  async function createHabit(extra: Record<string, unknown> = {}) {
    return request(app)
      .post('/api/habits')
      .send({
        name: 'Meditate',
        categoryId: category.id,
        goal: { type: 'boolean', frequency: 'daily' },
        ...extra,
      });
  }

  it('creates a habit with a valid reminderTime', async () => {
    const res = await createHabit({ reminderTime: '09:00' });
    expect(res.status).toBe(201);
    expect(res.body.habit.reminderTime).toBe('09:00');
  });

  it('accepts boundary times 00:00 and 23:59', async () => {
    const early = await createHabit({ reminderTime: '00:00' });
    expect(early.status).toBe(201);
    const late = await createHabit({ reminderTime: '23:59' });
    expect(late.status).toBe(201);
  });

  it.each(['9:00', '25:00', '09:60', '0900', '09:00:00', 'evening'])(
    'rejects malformed reminderTime %s on create',
    async (bad) => {
      const res = await createHabit({ reminderTime: bad });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  );

  it('treats null reminderTime as unset on create', async () => {
    const res = await createHabit({ reminderTime: null });
    expect(res.status).toBe(201);
    expect(res.body.habit.reminderTime ?? undefined).toBeUndefined();
  });

  it('sets reminderTime via PATCH', async () => {
    const created = await createHabit();
    const res = await request(app)
      .patch(`/api/habits/${created.body.habit.id}`)
      .send({ reminderTime: '07:30' });
    expect(res.status).toBe(200);
    expect(res.body.habit.reminderTime).toBe('07:30');
  });

  it('rejects malformed reminderTime via PATCH', async () => {
    const created = await createHabit({ reminderTime: '07:30' });
    const res = await request(app)
      .patch(`/api/habits/${created.body.habit.id}`)
      .send({ reminderTime: '7:30pm' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('toggles reminderEnabled without losing reminderTime', async () => {
    const created = await createHabit({ reminderTime: '07:30' });
    const id = created.body.habit.id;

    const off = await request(app).patch(`/api/habits/${id}`).send({ reminderEnabled: false });
    expect(off.status).toBe(200);
    expect(off.body.habit.reminderEnabled).toBe(false);
    expect(off.body.habit.reminderTime).toBe('07:30');

    const on = await request(app).patch(`/api/habits/${id}`).send({ reminderEnabled: true });
    expect(on.status).toBe(200);
    expect(on.body.habit.reminderEnabled).toBe(true);
    expect(on.body.habit.reminderTime).toBe('07:30');
  });

  it('clears reminderTime with null while keeping other fields', async () => {
    const created = await createHabit({ reminderTime: '07:30', description: 'daily calm' });
    const id = created.body.habit.id;

    const res = await request(app).patch(`/api/habits/${id}`).send({ reminderTime: null });
    expect(res.status).toBe(200);
    expect(res.body.habit.reminderTime ?? undefined).toBeUndefined();
    expect(res.body.habit.description).toBe('daily calm');
  });
});
