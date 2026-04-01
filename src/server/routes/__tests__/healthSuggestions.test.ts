/**
 * Health Suggestion Route Tests
 *
 * Tests for accept/dismiss suggestion endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import healthSuggestionRoutes from '../healthSuggestions';
import { createSuggestion } from '../../repositories/healthSuggestionRepository';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabit } from '../../repositories/habitRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const HID = 'household-suggestions';
const UID = 'user-suggestions';

describe('Health Suggestion Routes', () => {
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
    app.use('/api/health/suggestions', healthSuggestionRoutes);
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('healthSuggestions').deleteMany({});
    await db.collection('habitEntries').deleteMany({});
    await db.collection('habits').deleteMany({});
    await db.collection('categories').deleteMany({});

    const cat = await createCategory({ name: 'Fitness', color: 'bg-green-500' }, HID, UID);
    const habit = await createHabit(
      { name: 'Walk 10k', categoryId: cat.id, goal: { type: 'boolean', frequency: 'daily' } },
      HID, UID
    );
    habitId = habit.id;
  });

  describe('GET /api/health/suggestions', () => {
    it('returns pending suggestions', async () => {
      await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 12000,
          status: 'pending',
        },
        HID, UID
      );

      const res = await request(app).get('/api/health/suggestions');

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].metricValue).toBe(12000);
    });

    it('excludes accepted/dismissed suggestions', async () => {
      await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 12000,
          status: 'accepted',
        },
        HID, UID
      );

      const res = await request(app).get('/api/health/suggestions');
      expect(res.body.suggestions).toHaveLength(0);
    });
  });

  describe('POST /api/health/suggestions/:id/accept', () => {
    it('creates a HabitEntry and marks suggestion accepted', async () => {
      const suggestion = await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 12000,
          status: 'pending',
        },
        HID, UID
      );

      const res = await request(app)
        .post(`/api/health/suggestions/${suggestion.id}/accept`);

      expect(res.status).toBe(200);
      expect(res.body.suggestion.status).toBe('accepted');
      expect(res.body.entry).toBeDefined();
      expect(res.body.entry.source).toBe('apple_health');

      // Verify entry created
      const entries = await getHabitEntriesForDay(habitId, '2026-03-15', HID, UID);
      expect(entries).toHaveLength(1);
    });

    it('is idempotent when entry already exists', async () => {
      const suggestion = await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 12000,
          status: 'pending',
        },
        HID, UID
      );

      // Accept once
      await request(app).post(`/api/health/suggestions/${suggestion.id}/accept`).expect(200);

      // Create a new pending suggestion for same day (simulating edge case)
      const suggestion2 = await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 13000,
          status: 'pending',
        },
        HID, UID
      );

      // Accept second — should find existing entry
      const res = await request(app).post(`/api/health/suggestions/${suggestion2.id}/accept`);
      expect(res.status).toBe(200);

      // Still only one entry
      const entries = await getHabitEntriesForDay(habitId, '2026-03-15', HID, UID);
      expect(entries).toHaveLength(1);
    });
  });

  describe('POST /api/health/suggestions/:id/dismiss', () => {
    it('marks suggestion as dismissed without creating entry', async () => {
      const suggestion = await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 12000,
          status: 'pending',
        },
        HID, UID
      );

      const res = await request(app)
        .post(`/api/health/suggestions/${suggestion.id}/dismiss`);

      expect(res.status).toBe(200);
      expect(res.body.suggestion.status).toBe('dismissed');

      // Verify NO entry created
      const entries = await getHabitEntriesForDay(habitId, '2026-03-15', HID, UID);
      expect(entries).toHaveLength(0);
    });

    it('returns 400 for already-dismissed suggestion', async () => {
      const suggestion = await createSuggestion(
        {
          userId: UID,
          habitId,
          ruleId: 'rule-1',
          dayKey: '2026-03-15',
          metricType: 'steps',
          metricValue: 12000,
          status: 'pending',
        },
        HID, UID
      );

      await request(app).post(`/api/health/suggestions/${suggestion.id}/dismiss`).expect(200);
      const res = await request(app).post(`/api/health/suggestions/${suggestion.id}/dismiss`);
      expect(res.status).toBe(400);
    });
  });
});
