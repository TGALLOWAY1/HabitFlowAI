/**
 * Bundle Membership Routes Tests
 *
 * Integration tests for Bundle Membership REST API endpoints.
 * Uses mongodb-memory-server — no external MongoDB required.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';
import {
  getBundleMembershipsRoute,
  createBundleMembershipRoute,
  endBundleMembershipRoute,
  archiveBundleMembershipRoute,
  deleteBundleMembershipRoute,
} from '../bundleMemberships';

const TEST_HOUSEHOLD_ID = 'test-household-bm-routes';
const TEST_USER_ID = 'test-user-bm-routes';

describe('Bundle Membership Routes', () => {
  let app: Express;
  let categoryId: string;
  let parentHabitId: string;
  let childHabitId1: string;
  let childHabitId2: string;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      (req as any).householdId = TEST_HOUSEHOLD_ID;
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.get('/api/bundle-memberships', getBundleMembershipsRoute);
    app.post('/api/bundle-memberships', createBundleMembershipRoute);
    app.patch('/api/bundle-memberships/:id/end', endBundleMembershipRoute);
    app.patch('/api/bundle-memberships/:id/archive', archiveBundleMembershipRoute);
    app.delete('/api/bundle-memberships/:id', deleteBundleMembershipRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('bundleMemberships').deleteMany({});
    await db.collection('habits').deleteMany({});
    await db.collection('categories').deleteMany({});
    await db.collection('habitEntries').deleteMany({});

    // Create test data
    const category = await createCategory(
      { name: 'Test', color: 'bg-blue-500' },
      TEST_HOUSEHOLD_ID, TEST_USER_ID
    );
    categoryId = category.id;

    // Create child habits first
    const child1 = await createHabit({
      name: 'Study GRE',
      categoryId,
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
    }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    childHabitId1 = child1.id;

    const child2 = await createHabit({
      name: 'Study Linear Algebra',
      categoryId,
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
    }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    childHabitId2 = child2.id;

    // Create parent choice bundle
    const parent = await createHabit({
      name: 'Study Daily',
      categoryId,
      type: 'bundle',
      bundleType: 'choice',
      subHabitIds: [childHabitId1, childHabitId2],
      goal: { type: 'boolean', target: 1, frequency: 'daily' },
    }, TEST_HOUSEHOLD_ID, TEST_USER_ID);
    parentHabitId = parent.id;
  });

  describe('POST /api/bundle-memberships', () => {
    it('should create a membership', async () => {
      const res = await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId,
          childHabitId: childHabitId1,
          activeFromDayKey: '2026-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.parentHabitId).toBe(parentHabitId);
      expect(res.body.childHabitId).toBe(childHabitId1);
      expect(res.body.activeFromDayKey).toBe('2026-01-01');
      expect(res.body.activeToDayKey).toBeNull();
    });

    it('should create a membership with activeToDayKey', async () => {
      const res = await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId,
          childHabitId: childHabitId1,
          activeFromDayKey: '2026-01-01',
          activeToDayKey: '2026-03-31',
        });

      expect(res.status).toBe(201);
      expect(res.body.activeToDayKey).toBe('2026-03-31');
    });

    it('should reject invalid activeFromDayKey', async () => {
      const res = await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId,
          childHabitId: childHabitId1,
          activeFromDayKey: 'not-a-date',
        });

      expect(res.status).toBe(400);
    });

    it('should reject activeToDayKey < activeFromDayKey', async () => {
      const res = await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId,
          childHabitId: childHabitId1,
          activeFromDayKey: '2026-03-01',
          activeToDayKey: '2026-01-01',
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-choice-bundle parent', async () => {
      const nonBundle = await createHabit({
        name: 'Regular Habit',
        categoryId,
        goal: { type: 'boolean', target: 1, frequency: 'daily' },
      }, TEST_HOUSEHOLD_ID, TEST_USER_ID);

      const res = await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId: nonBundle.id,
          childHabitId: childHabitId1,
          activeFromDayKey: '2026-01-01',
        });

      expect(res.status).toBe(400);
    });

    it('should reject duplicate active membership', async () => {
      await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId,
          childHabitId: childHabitId1,
          activeFromDayKey: '2026-01-01',
        });

      const res = await request(app)
        .post('/api/bundle-memberships')
        .send({
          parentHabitId,
          childHabitId: childHabitId1,
          activeFromDayKey: '2026-04-01',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/bundle-memberships', () => {
    it('should list all memberships for a parent', async () => {
      await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1, activeFromDayKey: '2026-01-01',
      });
      await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId2, activeFromDayKey: '2026-04-01',
      });

      const res = await request(app)
        .get(`/api/bundle-memberships?parentHabitId=${parentHabitId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('should filter by dayKey when provided', async () => {
      await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1,
        activeFromDayKey: '2026-01-01', activeToDayKey: '2026-03-31',
      });
      await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId2,
        activeFromDayKey: '2026-04-01',
      });

      // Feb: only child-1
      const feb = await request(app)
        .get(`/api/bundle-memberships?parentHabitId=${parentHabitId}&dayKey=2026-02-15`);
      expect(feb.body).toHaveLength(1);
      expect(feb.body[0].childHabitId).toBe(childHabitId1);

      // May: only child-2
      const may = await request(app)
        .get(`/api/bundle-memberships?parentHabitId=${parentHabitId}&dayKey=2026-05-15`);
      expect(may.body).toHaveLength(1);
      expect(may.body[0].childHabitId).toBe(childHabitId2);
    });
  });

  describe('PATCH /api/bundle-memberships/:id/end', () => {
    it('should end a membership', async () => {
      const create = await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1, activeFromDayKey: '2026-01-01',
      });

      const res = await request(app)
        .patch(`/api/bundle-memberships/${create.body.id}/end`)
        .send({ endDayKey: '2026-03-31' });

      expect(res.status).toBe(200);
      expect(res.body.activeToDayKey).toBe('2026-03-31');
    });

    it('should reject ending an already-ended membership', async () => {
      const create = await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1,
        activeFromDayKey: '2026-01-01', activeToDayKey: '2026-03-31',
      });

      const res = await request(app)
        .patch(`/api/bundle-memberships/${create.body.id}/end`)
        .send({ endDayKey: '2026-06-30' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/bundle-memberships/:id/archive', () => {
    it('should archive a membership', async () => {
      const create = await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1, activeFromDayKey: '2026-01-01',
      });

      const res = await request(app)
        .patch(`/api/bundle-memberships/${create.body.id}/archive`);

      expect(res.status).toBe(200);
      expect(res.body.archivedAt).toBeDefined();
    });
  });

  describe('DELETE /api/bundle-memberships/:id', () => {
    it('should delete membership when child has no entries', async () => {
      const create = await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1, activeFromDayKey: '2026-01-01',
      });

      const res = await request(app)
        .delete(`/api/bundle-memberships/${create.body.id}`);

      expect(res.status).toBe(204);
    });

    it('should reject delete when child has entries', async () => {
      const create = await request(app).post('/api/bundle-memberships').send({
        parentHabitId, childHabitId: childHabitId1, activeFromDayKey: '2026-01-01',
      });

      // Add an entry for the child habit
      const db = await getTestDb();
      await db.collection('habitEntries').insertOne({
        id: 'entry-1',
        habitId: childHabitId1,
        dayKey: '2026-01-15',
        date: '2026-01-15',
        timestamp: new Date().toISOString(),
        source: 'manual',
        value: 1,
        householdId: TEST_HOUSEHOLD_ID,
        userId: TEST_USER_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .delete(`/api/bundle-memberships/${create.body.id}`);

      expect(res.status).toBe(409);
      expect(res.body.entryCount).toBe(1);
    });
  });
});
