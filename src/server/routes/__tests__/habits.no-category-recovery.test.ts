import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { getHabits } from '../habits';
import { getCategories } from '../categories';

const TEST_USER_ID = 'test-no-category-recovery-user';

describe('GET /api/habits no-category recovery', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = 'default-household';
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.get('/api/habits', getHabits);
    app.get('/api/categories', getCategories);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const testDb = await getTestDb();
    await testDb.collection('habits').deleteMany({});
    await testDb.collection('categories').deleteMany({});
  });

  it('auto-assigns habits with empty categoryId to "No Category"', async () => {
    const testDb = await getTestDb();
    await testDb.collection('habits').insertOne({
      id: 'habit-empty-category',
      name: 'Orphan Habit',
      categoryId: '',
      goal: { type: 'boolean', frequency: 'daily' },
      archived: false,
      createdAt: new Date().toISOString(),
      householdId: 'default-household',
      userId: TEST_USER_ID,
    });

    const habitsRes = await request(app).get('/api/habits');
    expect(habitsRes.status).toBe(200);

    const recoveredHabit = habitsRes.body.habits.find((h: any) => h.id === 'habit-empty-category');
    expect(recoveredHabit).toBeDefined();
    expect(recoveredHabit.categoryId).toBeTruthy();

    const categoriesRes = await request(app).get('/api/categories');
    expect(categoriesRes.status).toBe(200);

    const noCategory = categoriesRes.body.categories.find((c: any) => c.name === 'No Category');
    expect(noCategory).toBeDefined();
    expect(recoveredHabit.categoryId).toBe(noCategory.id);
  });
});
