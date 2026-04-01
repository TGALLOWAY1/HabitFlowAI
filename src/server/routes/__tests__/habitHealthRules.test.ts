/**
 * Habit Health Rule Route Tests
 *
 * Tests for health rule CRUD and backfill endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import habitHealthRuleRoutes from '../habitHealthRules';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { upsertHealthMetric } from '../../repositories/healthMetricDailyRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const HID = 'household-rules';
const UID = 'user-rules';

describe('Habit Health Rule Routes', () => {
  let app: Express;
  let habitId: string;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = HID;
      (req as any).userId = UID;
      next();
    });
    app.use('/api/habits/:habitId/health-rule', habitHealthRuleRoutes);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('habitHealthRules').deleteMany({});
    await db.collection('habitEntries').deleteMany({});
    await db.collection('healthMetricsDaily').deleteMany({});
    await db.collection('habits').deleteMany({});
    await db.collection('categories').deleteMany({});

    // Create a test habit
    const cat = await createCategory({ name: 'Fitness', color: 'bg-green-500' }, HID, UID);
    const habit = await createHabit(
      { name: 'Walk 10k', categoryId: cat.id, goal: { type: 'boolean', frequency: 'daily' } },
      HID, UID
    );
    habitId = habit.id;
  });

  describe('POST /api/habits/:habitId/health-rule', () => {
    it('creates a rule', async () => {
      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({
          metricType: 'steps',
          operator: '>=',
          thresholdValue: 10000,
          behavior: 'auto_log',
        });

      expect(res.status).toBe(201);
      expect(res.body.rule).toBeDefined();
      expect(res.body.rule.habitId).toBe(habitId);
      expect(res.body.rule.metricType).toBe('steps');
      expect(res.body.rule.active).toBe(true);
    });

    it('returns 409 on duplicate rule', async () => {
      await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' })
        .expect(201);

      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'sleep_hours', operator: '>=', thresholdValue: 7, behavior: 'auto_log' });

      expect(res.status).toBe(409);
    });

    it('returns 404 for non-existent habit', async () => {
      const res = await request(app)
        .post('/api/habits/nonexistent/health-rule')
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' });

      expect(res.status).toBe(404);
    });

    it('validates metricType', async () => {
      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'invalid', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/habits/:habitId/health-rule', () => {
    it('returns null when no rule exists', async () => {
      const res = await request(app)
        .get(`/api/habits/${habitId}/health-rule`);

      expect(res.status).toBe(200);
      expect(res.body.rule).toBeNull();
    });

    it('returns the rule when it exists', async () => {
      await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' })
        .expect(201);

      const res = await request(app)
        .get(`/api/habits/${habitId}/health-rule`);

      expect(res.status).toBe(200);
      expect(res.body.rule.metricType).toBe('steps');
    });
  });

  describe('PATCH /api/habits/:habitId/health-rule', () => {
    it('updates rule fields', async () => {
      await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' })
        .expect(201);

      const res = await request(app)
        .patch(`/api/habits/${habitId}/health-rule`)
        .send({ thresholdValue: 8000, behavior: 'suggest' });

      expect(res.status).toBe(200);
      expect(res.body.rule.thresholdValue).toBe(8000);
      expect(res.body.rule.behavior).toBe('suggest');
    });
  });

  describe('DELETE /api/habits/:habitId/health-rule', () => {
    it('deactivates the rule', async () => {
      await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' })
        .expect(201);

      const deleteRes = await request(app)
        .delete(`/api/habits/${habitId}/health-rule`);

      expect(deleteRes.status).toBe(200);

      // Rule should no longer be found (active: false)
      const getRes = await request(app)
        .get(`/api/habits/${habitId}/health-rule`);

      expect(getRes.body.rule).toBeNull();
    });
  });

  describe('POST /api/habits/:habitId/health-rule/backfill', () => {
    it('backfills qualifying days', async () => {
      // Create rule
      await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' })
        .expect(201);

      // Seed health data
      await upsertHealthMetric(
        { userId: UID, dayKey: '2026-03-01', source: 'apple_health', steps: 12000 },
        HID, UID
      );
      await upsertHealthMetric(
        { userId: UID, dayKey: '2026-03-02', source: 'apple_health', steps: 5000 },
        HID, UID
      );

      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ startDayKey: '2026-03-01' });

      expect(res.status).toBe(200);
      expect(res.body.created).toBeGreaterThanOrEqual(1);

      // Verify entry created for qualifying day
      const entries = await getHabitEntriesForDay(habitId, '2026-03-01', HID, UID);
      expect(entries).toHaveLength(1);
      expect(entries[0].source).toBe('apple_health');

      // Verify no entry for non-qualifying day
      const entries2 = await getHabitEntriesForDay(habitId, '2026-03-02', HID, UID);
      expect(entries2).toHaveLength(0);
    });
  });
});
