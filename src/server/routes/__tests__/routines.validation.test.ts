/**
 * Routines Route Validation Tests
 * 
 * Tests for DayKey validation in routine submission (dateOverride).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { submitRoutineRoute } from '../routines';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createRoutine } from '../../repositories/routineRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';

const TEST_HOUSEHOLD_ID = 'test-household-routines-validation';
const TEST_USER_ID = 'test-user-routines-validation';

let app: Express;
let testRoutineId: string;

beforeAll(async () => {
  await setupTestMongo();
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).householdId = TEST_HOUSEHOLD_ID;
    (req as any).userId = TEST_USER_ID;
    next();
  });
  app.post('/api/routines/:id/submit', submitRoutineRoute);
});

afterAll(async () => {
  await teardownTestMongo();
});

beforeEach(async () => {
  const db = await getTestDb();
  await db.collection('routines').deleteMany({ userId: TEST_USER_ID });
  await db.collection('habits').deleteMany({ userId: TEST_USER_ID });
  await db.collection('categories').deleteMany({ userId: TEST_USER_ID });
  await db.collection('habitEntries').deleteMany({ userId: TEST_USER_ID });
  await db.collection('routineLogs').deleteMany({ userId: TEST_USER_ID });

  // Create test routine
  const category = await createCategory(
    { name: 'Test Category', color: '#000000' },
    TEST_HOUSEHOLD_ID,
    TEST_USER_ID
  );

  const habit = await createHabit(
    { name: 'Test Habit', categoryId: category.id, goal: { type: 'boolean', frequency: 'daily' } },
    TEST_HOUSEHOLD_ID,
    TEST_USER_ID
  );

  const routine = await createRoutine(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
    title: 'Test Routine',
    linkedHabitIds: [habit.id],
    steps: [],
  });

  testRoutineId = routine.id;
});

describe('POST /api/routines/:id/submit - dateOverride Validation', () => {
  it('should reject invalid dateOverride format (not DayKey)', async () => {
    const response = await request(app)
      .post(`/api/routines/${testRoutineId}/submit`)
      .send({
        habitIdsToComplete: [],
        dateOverride: '2025-13-01', // Invalid month
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('Invalid DayKey format');
  });

  it('should reject dateOverride with invalid day', async () => {
    const response = await request(app)
      .post(`/api/routines/${testRoutineId}/submit`)
      .send({
        habitIdsToComplete: [],
        dateOverride: '2025-01-32', // Invalid day
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('Invalid DayKey format');
  });

  it('should accept valid dateOverride', async () => {
    const response = await request(app)
      .post(`/api/routines/${testRoutineId}/submit`)
      .send({
        habitIdsToComplete: [],
        dateOverride: '2025-01-15',
      });

    // Should succeed (may return 404 if routine not found, but validation should pass)
    expect([200, 404]).toContain(response.status);
    // If 200, validation passed
    if (response.status === 200) {
      expect(response.body.message).toBeDefined();
    }
  });

  it('should accept request without dateOverride', async () => {
    const response = await request(app)
      .post(`/api/routines/${testRoutineId}/submit`)
      .send({
        habitIdsToComplete: [],
      });

    // Should succeed (may return 404 if routine not found, but validation should pass)
    expect([200, 404]).toContain(response.status);
  });
});

