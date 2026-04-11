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
import { getNowDayKey } from '../../utils/dayKey';

const HID = 'household-rules';
const UID = 'user-rules';

/** Compute a dayKey that is N days before today in the server's default timezone. */
function daysAgoDayKey(n: number): string {
  const today = new Date(getNowDayKey() + 'T00:00:00Z');
  today.setUTCDate(today.getUTCDate() - n);
  return today.toISOString().slice(0, 10);
}

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
    beforeEach(async () => {
      // Create rule shared by all backfill tests
      await request(app)
        .post(`/api/habits/${habitId}/health-rule`)
        .send({ metricType: 'steps', operator: '>=', thresholdValue: 10000, behavior: 'auto_log' })
        .expect(201);
    });

    it('backfills qualifying days inside the window', async () => {
      const qualifyingDay = daysAgoDayKey(2);
      const nonQualifyingDay = daysAgoDayKey(3);

      await upsertHealthMetric(
        { userId: UID, dayKey: qualifyingDay, source: 'apple_health', steps: 12000 },
        HID, UID
      );
      await upsertHealthMetric(
        { userId: UID, dayKey: nonQualifyingDay, source: 'apple_health', steps: 5000 },
        HID, UID
      );

      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 7 });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(1);
      expect(res.body.days).toBe(7);

      const qualifyingEntries = await getHabitEntriesForDay(habitId, qualifyingDay, HID, UID);
      expect(qualifyingEntries).toHaveLength(1);
      expect(qualifyingEntries[0].source).toBe('apple_health');

      const nonQualifyingEntries = await getHabitEntriesForDay(habitId, nonQualifyingDay, HID, UID);
      expect(nonQualifyingEntries).toHaveLength(0);
    });

    it('defaults to a 30-day window when no body is sent', async () => {
      const insideDay = daysAgoDayKey(5);
      await upsertHealthMetric(
        { userId: UID, dayKey: insideDay, source: 'apple_health', steps: 12000 },
        HID, UID
      );

      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(30);
      expect(res.body.created).toBe(1);

      const entries = await getHabitEntriesForDay(habitId, insideDay, HID, UID);
      expect(entries).toHaveLength(1);
    });

    it('excludes metrics outside the window', async () => {
      const insideDay = daysAgoDayKey(3);
      const outsideDay = daysAgoDayKey(40);

      await upsertHealthMetric(
        { userId: UID, dayKey: insideDay, source: 'apple_health', steps: 12000 },
        HID, UID
      );
      await upsertHealthMetric(
        { userId: UID, dayKey: outsideDay, source: 'apple_health', steps: 15000 },
        HID, UID
      );

      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 7 });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(1);

      expect(await getHabitEntriesForDay(habitId, insideDay, HID, UID)).toHaveLength(1);
      expect(await getHabitEntriesForDay(habitId, outsideDay, HID, UID)).toHaveLength(0);
    });

    it('rejects days > 365 with a 400', async () => {
      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 400 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects days < 1 with a 400', async () => {
      const zeroRes = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 0 });
      expect(zeroRes.status).toBe(400);

      const negRes = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: -5 });
      expect(negRes.status).toBe(400);
    });

    it('rejects non-integer days with a 400', async () => {
      const floatRes = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 7.5 });
      expect(floatRes.status).toBe(400);

      const stringRes = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 'thirty' });
      expect(stringRes.status).toBe(400);
    });

    it('accepts a timeZone param without error', async () => {
      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 7, timeZone: 'America/Los_Angeles' });

      expect(res.status).toBe(200);
      expect(res.body.days).toBe(7);
    });

    it('returns 0 created when no health data exists in the window', async () => {
      const res = await request(app)
        .post(`/api/habits/${habitId}/health-rule/backfill`)
        .send({ days: 7 });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(0);
      expect(res.body.evaluated).toBe(7);
    });
  });
});
