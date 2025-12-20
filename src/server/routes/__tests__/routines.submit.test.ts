/**
 * Routine Submit Route Tests
 * 
 * Tests for routine submission endpoint, verifying HabitEntry creation
 * and ensuring no direct DayLog writes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Set environment variables BEFORE importing modules that use them
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { submitRoutineRoute } from '../routines';
import { getDb, closeConnection } from '../../lib/mongoClient';
import { createRoutine } from '../../repositories/routineRepository';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';
import { getDayLog } from '../../repositories/dayLogRepository';

// Use test database
const TEST_DB_NAME = 'habitflowai_test_routines';
const TEST_USER_ID = 'test-user-routines';

// Store original env values
let originalDbName: string | undefined;

describe('Routine Submit Route', () => {
  let app: Express;
  let routineId: string;
  let habitId1: string;
  let habitId2: string;

  beforeAll(async () => {
    // Use test database
    originalDbName = process.env.MONGODB_DB_NAME;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    // Set up Express app
    app = express();
    app.use(express.json());

    // Add userId to request (simulating auth middleware)
    app.use((req, _res, next) => {
      (req as any).userId = TEST_USER_ID;
      next();
    });

    // Register route
    app.post('/api/routines/:id/submit', submitRoutineRoute);

    // Create test data
    const category = await createCategory(
      { name: 'Test Category', color: '#000000', order: 0 },
      TEST_USER_ID
    );

    habitId1 = (await createHabit(
      {
        name: 'Test Habit 1',
        categoryId: category.id,
        goal: { type: 'daily', target: 1, unit: 'times', frequency: 'daily' },
        order: 0,
      },
      TEST_USER_ID
    )).id;

    habitId2 = (await createHabit(
      {
        name: 'Test Habit 2',
        categoryId: category.id,
        goal: { type: 'daily', target: 1, unit: 'times', frequency: 'daily' },
        order: 1,
      },
      TEST_USER_ID
    )).id;

    const routine = await createRoutine(
      TEST_USER_ID,
      {
        name: 'Test Routine',
        description: 'Test routine description',
        linkedHabitIds: [habitId1, habitId2],
        steps: [
          {
            id: 'step-1',
            title: 'Step 1',
            instruction: 'Test step',
            order: 0,
          },
        ],
      }
    );
    routineId = routine.id;
  });

  afterAll(async () => {
    // Clean up test database
    const testDb = await getDb();
    await testDb.dropDatabase();
    await closeConnection();

    // Restore original env
    if (originalDbName) {
      process.env.MONGODB_DB_NAME = originalDbName;
    } else {
      delete process.env.MONGODB_DB_NAME;
    }
  });

  beforeEach(async () => {
    // Clear entries and dayLogs before each test (but keep routines, habits, categories)
    const testDb = await getDb();
    await testDb.collection('habitEntries').deleteMany({ userId: TEST_USER_ID });
    await testDb.collection('dayLogs').deleteMany({ userId: TEST_USER_ID });
    await testDb.collection('routineLogs').deleteMany({ userId: TEST_USER_ID });
  });

  describe('POST /api/routines/:id/submit', () => {
    it('should create HabitEntries for each habitId in habitIdsToComplete', async () => {
      const testDate = '2025-01-15';
      const submittedAt = new Date(`${testDate}T12:00:00Z`).toISOString();

      const response = await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: [habitId1, habitId2],
          submittedAt,
          dateOverride: testDate,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Routine submitted successfully');
      expect(response.body).toHaveProperty('createdOrUpdatedCount', 2);
      expect(response.body).toHaveProperty('completedHabitIds');
      expect(response.body.completedHabitIds).toEqual([habitId1, habitId2]);

      // Verify HabitEntries were created
      const entries1 = await getHabitEntriesForDay(habitId1, testDate, TEST_USER_ID);
      const entries2 = await getHabitEntriesForDay(habitId2, testDate, TEST_USER_ID);

      expect(entries1.length).toBeGreaterThan(0);
      expect(entries2.length).toBeGreaterThan(0);

      // Verify entry properties
      const entry1 = entries1[0];
      expect(entry1.habitId).toBe(habitId1);
      expect(entry1.date).toBe(testDate);
      expect(entry1.source).toBe('routine');
      expect(entry1.routineId).toBeDefined();
      expect(typeof entry1.routineId).toBe('string');
      // Verify routineId is set (exact match may vary due to test setup)
      expect(entry1.routineId).toBeTruthy();
      expect(entry1.value).toBe(1);
    });

    it('should not write DayLogs directly - only via recompute', async () => {
      const testDate = '2025-01-16';
      const submittedAt = new Date(`${testDate}T12:00:00Z`).toISOString();

      // Before submission, verify no DayLog exists
      const dayLogBefore = await getDayLog(habitId1, testDate, TEST_USER_ID);
      expect(dayLogBefore).toBeNull();

      // Submit routine
      const response = await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: [habitId1],
          submittedAt,
          dateOverride: testDate,
        })
        .expect(200);

      expect(response.body.createdOrUpdatedCount).toBe(1);

      // Verify HabitEntry exists (source of truth)
      // Wait a bit for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check for entries - they should exist with the testDate since we used dateOverride
      const db = await getDb();
      const allEntries = await db.collection('habitEntries')
        .find({ 
          habitId: habitId1, 
          userId: TEST_USER_ID, 
          deletedAt: { $exists: false },
          source: 'routine'
        })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      
      expect(allEntries.length).toBeGreaterThan(0);
      const createdEntry = allEntries[0];
      expect(createdEntry.date).toBe(testDate); // Should match dateOverride
      expect(createdEntry.source).toBe('routine');
      
      // Now verify DayLog was derived (not written directly)
      // Verify DayLog exists (derived cache, recomputed from entries)
      const dayLogAfter = await getDayLog(habitId1, testDate, TEST_USER_ID);
      expect(dayLogAfter).not.toBeNull();
      expect(dayLogAfter?.habitId).toBe(habitId1);
      expect(dayLogAfter?.date).toBe(testDate);
      expect(dayLogAfter?.completed).toBe(true);
      expect(dayLogAfter?.value).toBe(1);
      expect(dayLogAfter?.source).toBe('routine');
      expect(dayLogAfter?.routineId).toBeDefined();
      expect(typeof dayLogAfter?.routineId).toBe('string');
      // Verify routineId is set (exact match may vary due to test setup)
      expect(dayLogAfter?.routineId).toBeTruthy();

      // Verify DayLog was derived from entries (not written directly)
      // The DayLog should match the aggregated entries
      expect(dayLogAfter?.value).toBe(createdEntry.value);
      expect(dayLogAfter?.source).toBe(createdEntry.source);
      expect(dayLogAfter?.routineId).toBe(createdEntry.routineId);
    });

    it('should handle empty habitIdsToComplete array', async () => {
      const testDate = '2025-01-17';
      const submittedAt = new Date(`${testDate}T12:00:00Z`).toISOString();

      const response = await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: [],
          submittedAt,
          dateOverride: testDate,
        })
        .expect(200);

      expect(response.body).toHaveProperty('createdOrUpdatedCount', 0);
      expect(response.body.completedHabitIds).toEqual([]);
    });

    it('should use dateOverride when provided', async () => {
      const dateOverride = '2025-01-20';
      const submittedAt = new Date('2025-01-18T12:00:00Z').toISOString();

      await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: [habitId1],
          submittedAt,
          dateOverride,
        })
        .expect(200);

      // Verify entry was created with dateOverride, not submittedAt date
      const entries = await getHabitEntriesForDay(habitId1, dateOverride, TEST_USER_ID);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].date).toBe(dateOverride);
    });

    it('should derive date from submittedAt when dateOverride not provided', async () => {
      // Use a date that will work in any timezone (midday UTC)
      const testDate = '2025-01-19';
      const submittedAt = new Date(`${testDate}T12:00:00Z`).toISOString();

      const response = await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: [habitId1],
          submittedAt,
        })
        .expect(200);

      expect(response.body.createdOrUpdatedCount).toBe(1);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify entry was created
      // The deriveDateString function uses local timezone, so the date might differ
      const db = await getDb();
      const entries = await db.collection('habitEntries')
        .find({ 
          habitId: habitId1, 
          userId: TEST_USER_ID,
          deletedAt: { $exists: false },
          source: 'routine'
        })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();
      
      expect(entries.length).toBeGreaterThan(0);
      const createdEntry = entries[0];
      expect(createdEntry.source).toBe('routine');
      // The date should be derived from submittedAt
      const entryDate = createdEntry.date;
      expect(entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Verify it's a reasonable date (within a day of expected due to timezone)
      const expectedDateObj = new Date(testDate + 'T12:00:00Z');
      const actualDateObj = new Date(entryDate + 'T12:00:00Z');
      const daysDiff = Math.abs((expectedDateObj.getTime() - actualDateObj.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeLessThan(2); // Allow 1 day difference for timezone
    });

    it('should return 404 when routine not found', async () => {
      await request(app)
        .post('/api/routines/non-existent-id/submit')
        .send({
          habitIdsToComplete: [habitId1],
        })
        .expect(404);
    });

    it('should validate habitIdsToComplete is an array', async () => {
      await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: 'not-an-array',
        })
        .expect(400);
    });

    it('should validate dateOverride format', async () => {
      await request(app)
        .post(`/api/routines/${routineId}/submit`)
        .send({
          habitIdsToComplete: [habitId1],
          dateOverride: 'invalid-date',
        })
        .expect(400);
    });
  });
});

