/**
 * Health Sync Route Tests
 *
 * Tests for POST /api/health/apple/sync.
 * Validates idempotent upsert, auto-log, and suggest behaviors.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import healthRoutes from '../health';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createHealthRule } from '../../repositories/habitHealthRuleRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const HID = 'household-health';
const UID = 'user-health';

describe('POST /api/health/apple/sync', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = HID;
      (req as any).userId = UID;
      next();
    });
    app.use('/api/health', healthRoutes);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('healthMetricsDaily').deleteMany({});
    await db.collection('habitEntries').deleteMany({});
    await db.collection('habitHealthRules').deleteMany({});
    await db.collection('healthSuggestions').deleteMany({});
    await db.collection('habits').deleteMany({});
    await db.collection('categories').deleteMany({});
  });

  it('creates a health metric record', async () => {
    const res = await request(app)
      .post('/api/health/apple/sync')
      .send({
        dayKey: '2026-03-15',
        steps: 9432,
        activeCalories: 450,
        sleepHours: 7.5,
        workoutMinutes: 45,
      });

    expect(res.status).toBe(200);
    expect(res.body.metric).toBeDefined();
    expect(res.body.metric.steps).toBe(9432);
    expect(res.body.metric.dayKey).toBe('2026-03-15');
    expect(res.body.metric.source).toBe('apple_health');
  });

  it('is idempotent — same data twice produces one record', async () => {
    const payload = {
      dayKey: '2026-03-15',
      steps: 9432,
    };

    await request(app).post('/api/health/apple/sync').send(payload).expect(200);
    const res = await request(app).post('/api/health/apple/sync').send(payload).expect(200);

    const db = await getTestDb();
    const count = await db.collection('healthMetricsDaily').countDocuments({});
    expect(count).toBe(1);
    expect(res.body.metric.steps).toBe(9432);
  });

  it('updates metric on second sync for same day', async () => {
    await request(app)
      .post('/api/health/apple/sync')
      .send({ dayKey: '2026-03-15', steps: 5000 })
      .expect(200);

    const res = await request(app)
      .post('/api/health/apple/sync')
      .send({ dayKey: '2026-03-15', steps: 12000 })
      .expect(200);

    expect(res.body.metric.steps).toBe(12000);
  });

  it('returns 400 when no metrics provided', async () => {
    const res = await request(app)
      .post('/api/health/apple/sync')
      .send({ dayKey: '2026-03-15' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid dayKey', async () => {
    const res = await request(app)
      .post('/api/health/apple/sync')
      .send({ dayKey: 'not-a-date', steps: 100 });

    expect(res.status).toBe(400);
  });

  it('auto-logs when rule is satisfied', async () => {
    // Create habit with auto_log rule
    const cat = await createCategory({ name: 'Fitness', color: 'bg-green-500' }, HID, UID);
    const habit = await createHabit(
      { name: 'Walk 10k', categoryId: cat.id, goal: { type: 'boolean', frequency: 'daily' } },
      HID, UID
    );
    await createHealthRule(
      {
        userId: UID,
        habitId: habit.id,
        sourceType: 'apple_health',
        metricType: 'steps',
        operator: '>=',
        thresholdValue: 10000,
        behavior: 'auto_log',
        active: true,
      },
      HID, UID
    );

    const res = await request(app)
      .post('/api/health/apple/sync')
      .send({ dayKey: '2026-03-15', steps: 12000 });

    expect(res.status).toBe(200);
    expect(res.body.autoLogged).toContain(habit.id);

    // Verify entry created
    const entries = await getHabitEntriesForDay(habit.id, '2026-03-15', HID, UID);
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('apple_health');
    expect(entries[0].sourceRuleId).toBeDefined();
  });

  it('creates suggestion when rule behavior is suggest', async () => {
    const cat = await createCategory({ name: 'Fitness', color: 'bg-green-500' }, HID, UID);
    const habit = await createHabit(
      { name: 'Walk 10k', categoryId: cat.id, goal: { type: 'boolean', frequency: 'daily' } },
      HID, UID
    );
    await createHealthRule(
      {
        userId: UID,
        habitId: habit.id,
        sourceType: 'apple_health',
        metricType: 'steps',
        operator: '>=',
        thresholdValue: 10000,
        behavior: 'suggest',
        active: true,
      },
      HID, UID
    );

    const res = await request(app)
      .post('/api/health/apple/sync')
      .send({ dayKey: '2026-03-15', steps: 12000 });

    expect(res.status).toBe(200);
    expect(res.body.suggested).toContain(habit.id);

    // Verify NO entry created (only suggestion)
    const entries = await getHabitEntriesForDay(habit.id, '2026-03-15', HID, UID);
    expect(entries).toHaveLength(0);

    // Verify suggestion created
    const db = await getTestDb();
    const suggestions = await db.collection('healthSuggestions')
      .find({ userId: UID, habitId: habit.id, dayKey: '2026-03-15' })
      .toArray();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].status).toBe('pending');
  });
});
