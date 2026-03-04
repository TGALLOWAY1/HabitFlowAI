/**
 * Household user registry: GET /api/household/users, POST /api/household/users
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import householdUsersRouter from '../householdUsers';

const HOUSEHOLD_A = 'household-a';
const HOUSEHOLD_B = 'household-b';
const USER_1 = 'user-1';

function appWithIdentity(householdId: string, userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).householdId = householdId;
    (req as any).userId = userId;
    next();
  });
  app.use('/api/household', householdUsersRouter);
  return app;
}

describe('Household users registry', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('householdUsers').deleteMany({});
  });

  describe('GET /api/household/users', () => {
    it('returns only users for the same household', async () => {
      const db = await getTestDb();
      const col = db.collection('householdUsers');
      await col.insertMany([
        { householdId: HOUSEHOLD_A, userId: 'u-a1', createdAt: new Date().toISOString() },
        { householdId: HOUSEHOLD_A, userId: 'u-a2', displayName: 'Alice', createdAt: new Date().toISOString() },
        { householdId: HOUSEHOLD_B, userId: 'u-b1', createdAt: new Date().toISOString() },
      ]);

      const app = appWithIdentity(HOUSEHOLD_A, USER_1);
      const res = await request(app).get('/api/household/users').expect(200);

      expect(res.body.users).toHaveLength(2);
      const ids = res.body.users.map((u: { userId: string }) => u.userId).sort();
      expect(ids).toEqual(['u-a1', 'u-a2']);
    });

    it('returns empty array when household has no users', async () => {
      const app = appWithIdentity(HOUSEHOLD_A, USER_1);
      const res = await request(app).get('/api/household/users').expect(200);
      expect(res.body.users).toEqual([]);
    });
  });

  describe('POST /api/household/users', () => {
    it('creates user with generated userId and returns created user', async () => {
      const app = appWithIdentity(HOUSEHOLD_A, USER_1);
      const res = await request(app)
        .post('/api/household/users')
        .send({})
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.householdId).toBe(HOUSEHOLD_A);
      expect(res.body.user.userId).toBeDefined();
      expect(typeof res.body.user.userId).toBe('string');
      expect(res.body.user.userId.length).toBeGreaterThan(0);
      expect(res.body.user.createdAt).toBeDefined();
    });

    it('creates user with optional displayName', async () => {
      const app = appWithIdentity(HOUSEHOLD_A, USER_1);
      const res = await request(app)
        .post('/api/household/users')
        .send({ displayName: 'Bob' })
        .expect(201);

      expect(res.body.user.displayName).toBe('Bob');
      expect(res.body.user.householdId).toBe(HOUSEHOLD_A);
      expect(res.body.user.userId).toBeDefined();
      expect(res.body.user.createdAt).toBeDefined();
    });

    it('creates user with provided userId when supplied', async () => {
      const app = appWithIdentity(HOUSEHOLD_A, USER_1);
      const customId = 'custom-user-id-123';
      const res = await request(app)
        .post('/api/household/users')
        .send({ userId: customId })
        .expect(201);

      expect(res.body.user.userId).toBe(customId);
      expect(res.body.user.householdId).toBe(HOUSEHOLD_A);
    });
  });
});
