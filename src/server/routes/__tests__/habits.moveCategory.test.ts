/**
 * Habit Move-to-Category Tests
 *
 * Validates that PATCH /api/habits/:id with { categoryId } correctly
 * reassigns a habit's category while preserving all other data.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import {
  getHabits,
  createHabitRoute,
  updateHabitRoute,
} from '../habits';
import {
  createCategoryRoute,
  getCategories,
} from '../categories';
import { getDb, closeConnection } from '../../lib/mongoClient';

const TEST_DB_NAME = 'habitflowai_test_move';
const TEST_USER_ID = 'test-move-user';

let originalDbName: string | undefined;

describe('Habit Move-to-Category', () => {
  let app: Express;
  let categoryA: any;
  let categoryB: any;
  let habit: any;

  beforeAll(async () => {
    originalDbName = process.env.MONGODB_DB_NAME;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.get('/api/habits', getHabits);
    app.post('/api/habits', createHabitRoute);
    app.patch('/api/habits/:id', updateHabitRoute);
    app.get('/api/categories', getCategories);
    app.post('/api/categories', createCategoryRoute);
  });

  afterAll(async () => {
    const testDb = await getDb();
    await testDb.dropDatabase();
    await closeConnection();
    if (originalDbName) {
      process.env.MONGODB_DB_NAME = originalDbName;
    } else {
      delete process.env.MONGODB_DB_NAME;
    }
  });

  beforeEach(async () => {
    const testDb = await getDb();
    await testDb.collection('habits').deleteMany({});
    await testDb.collection('categories').deleteMany({});

    // Seed two categories
    const resA = await request(app)
      .post('/api/categories')
      .send({ name: 'Fitness', color: 'bg-red-500' });
    categoryA = resA.body.category;

    const resB = await request(app)
      .post('/api/categories')
      .send({ name: 'Mental Health', color: 'bg-blue-500' });
    categoryB = resB.body.category;

    // Seed a habit in Category A
    const resH = await request(app)
      .post('/api/habits')
      .send({
        name: 'Meditate',
        categoryId: categoryA.id,
        goal: { type: 'boolean', frequency: 'daily' },
      });
    habit = resH.body.habit;
  });

  it('200: moves habit to a valid category', async () => {
    const res = await request(app)
      .patch(`/api/habits/${habit.id}`)
      .send({ categoryId: categoryB.id });

    expect(res.status).toBe(200);
    expect(res.body.habit.categoryId).toBe(categoryB.id);
    expect(res.body.habit.name).toBe('Meditate');
  });

  it('preserves all other habit fields after move', async () => {
    const res = await request(app)
      .patch(`/api/habits/${habit.id}`)
      .send({ categoryId: categoryB.id });

    const moved = res.body.habit;
    expect(moved.id).toBe(habit.id);
    expect(moved.name).toBe(habit.name);
    expect(moved.goal).toEqual(habit.goal);
    expect(moved.createdAt).toBe(habit.createdAt);
    expect(moved.archived).toBe(false);
  });

  it('404: habit not found', async () => {
    const res = await request(app)
      .patch('/api/habits/nonexistent-id')
      .send({ categoryId: categoryB.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400: target category does not exist', async () => {
    const res = await request(app)
      .patch(`/api/habits/${habit.id}`)
      .send({ categoryId: 'nonexistent-category-id' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('does not appear in old category after move', async () => {
    await request(app)
      .patch(`/api/habits/${habit.id}`)
      .send({ categoryId: categoryB.id });

    const res = await request(app)
      .get('/api/habits')
      .query({ categoryId: categoryA.id });

    const habitsInA = res.body.habits;
    expect(habitsInA.find((h: any) => h.id === habit.id)).toBeUndefined();
  });

  it('appears in new category after move', async () => {
    await request(app)
      .patch(`/api/habits/${habit.id}`)
      .send({ categoryId: categoryB.id });

    const res = await request(app)
      .get('/api/habits')
      .query({ categoryId: categoryB.id });

    const habitsInB = res.body.habits;
    expect(habitsInB.find((h: any) => h.id === habit.id)).toBeDefined();
  });
});
