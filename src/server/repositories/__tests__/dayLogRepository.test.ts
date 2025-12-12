/**
 * DayLog Repository Tests
 * 
 * Integration tests for the DayLog repository.
 * Requires MongoDB to be running (use test database).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';
import type { DayLog } from '../../../models/persistenceTypes';

// Set environment variables BEFORE importing modules that use them
// This ensures the env module reads the correct values
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import {
  upsertDayLog,
  getDayLogsByUser,
  getDayLogsByHabit,
  getDayLog,
  deleteDayLog,
  deleteDayLogsByHabit,
} from '../dayLogRepository';
import { getDb, closeConnection } from '../../lib/mongoClient';

// Use test database
const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-123';
// const OTHER_USER_ID = 'other-user-456';

// Store original env values
let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let testClient: MongoClient | null = null;

describe('DayLogRepository', () => {
  // let testDb: Db;

  beforeAll(async () => {
    // Use test database (env vars already set at top of file)
    originalDbName = process.env.MONGODB_DB_NAME;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    // Get test database
    // Get test database
    await getDb();

    // Get client from MongoDB URI for cleanup
    const uri = process.env.MONGODB_URI;
    if (uri) {
      testClient = new MongoClient(uri);
      await testClient.connect();
    }
  });

  afterAll(async () => {
    // Clean up test database
    if (testClient) {
      const adminDb = testClient.db(TEST_DB_NAME);
      await adminDb.dropDatabase();
      await testClient.close();
    }

    await closeConnection();

    // Restore original env
    if (originalDbName) {
      process.env.MONGODB_DB_NAME = originalDbName;
    } else {
      delete process.env.MONGODB_DB_NAME;
    }
    if (originalUseMongo) {
      process.env.USE_MONGO_PERSISTENCE = originalUseMongo;
    } else {
      delete process.env.USE_MONGO_PERSISTENCE;
    }
  });

  beforeEach(async () => {
    // Clear ALL dayLogs collection before each test to ensure isolation
    const db = await getDb();
    await db.collection('dayLogs').deleteMany({});
  });

  describe('upsertDayLog', () => {
    it('should create a new day log', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
      };

      const result = await upsertDayLog(log, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result.habitId).toBe(log.habitId);
      expect(result.date).toBe(log.date);
      expect(result.value).toBe(log.value);
      expect(result.completed).toBe(log.completed);
    });

    it('should update existing day log', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
      };

      await upsertDayLog(log, TEST_USER_ID);

      // Update the log
      const updatedLog: DayLog = {
        ...log,
        value: 2,
        completed: true,
      };

      const result = await upsertDayLog(updatedLog, TEST_USER_ID);

      expect(result.value).toBe(2);
      expect(result.completed).toBe(true);
    });

    it('should store day log with activity metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-456',
        activityStepId: 'step-789',
      };

      const result = await upsertDayLog(log, TEST_USER_ID);

      expect(result.activityId).toBe('activity-456');
      expect(result.activityStepId).toBe('step-789');
    });

    it('should round-trip activity metadata correctly', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-456',
        activityStepId: 'step-789',
      };

      // Upsert with activity metadata
      await upsertDayLog(log, TEST_USER_ID);

      // Retrieve and verify
      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.activityId).toBe('activity-456');
      expect(retrieved?.activityStepId).toBe('step-789');
    });

    it('should work without activity metadata (backward compatibility)', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
      };

      const result = await upsertDayLog(log, TEST_USER_ID);

      expect(result.activityId).toBeUndefined();
      expect(result.activityStepId).toBeUndefined();
    });

    it('should preserve compositeKey logic (habitId-date)', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-456',
      };

      await upsertDayLog(log, TEST_USER_ID);

      // Verify we can retrieve using the same habitId and date
      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);
      expect(retrieved).toBeDefined();
      expect(retrieved?.activityId).toBe('activity-456');
    });
  });

  describe('getDayLogsByUser', () => {
    it('should return empty record when user has no logs', async () => {
      const logs = await getDayLogsByUser(TEST_USER_ID);
      expect(logs).toEqual({});
    });

    it('should return all logs for user with activity metadata', async () => {
      const log1: DayLog = {
        habitId: 'habit-1',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-1',
        activityStepId: 'step-1',
      };

      const log2: DayLog = {
        habitId: 'habit-2',
        date: '2025-01-27',
        value: 1,
        completed: true,
        // No activity metadata
      };

      await upsertDayLog(log1, TEST_USER_ID);
      await upsertDayLog(log2, TEST_USER_ID);

      const logs = await getDayLogsByUser(TEST_USER_ID);

      expect(Object.keys(logs)).toHaveLength(2);
      const log1Key = 'habit-1-2025-01-27';
      const log2Key = 'habit-2-2025-01-27';

      expect(logs[log1Key]?.activityId).toBe('activity-1');
      expect(logs[log1Key]?.activityStepId).toBe('step-1');
      expect(logs[log2Key]?.activityId).toBeUndefined();
      expect(logs[log2Key]?.activityStepId).toBeUndefined();
    });
  });

  describe('getDayLogsByHabit', () => {
    it('should return logs for specific habit with activity metadata', async () => {
      const log1: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-1',
        activityStepId: 'step-1',
      };

      const log2: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-28',
        value: 1,
        completed: true,
        // No activity metadata
      };

      await upsertDayLog(log1, TEST_USER_ID);
      await upsertDayLog(log2, TEST_USER_ID);

      const logs = await getDayLogsByHabit('habit-123', TEST_USER_ID);

      expect(Object.keys(logs)).toHaveLength(2);
      const log1Key = 'habit-123-2025-01-27';
      const log2Key = 'habit-123-2025-01-28';

      expect(logs[log1Key]?.activityId).toBe('activity-1');
      expect(logs[log2Key]?.activityId).toBeUndefined();
    });
  });

  describe('getDayLog', () => {
    it('should return log with activity metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-456',
        activityStepId: 'step-789',
      };

      await upsertDayLog(log, TEST_USER_ID);

      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.activityId).toBe('activity-456');
      expect(retrieved?.activityStepId).toBe('step-789');
    });

    it('should return log without activity metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
      };

      await upsertDayLog(log, TEST_USER_ID);

      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.activityId).toBeUndefined();
      expect(retrieved?.activityStepId).toBeUndefined();
    });
  });

  describe('deleteDayLog', () => {
    it('should delete log with activity metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-456',
        activityStepId: 'step-789',
      };

      await upsertDayLog(log, TEST_USER_ID);

      const deleted = await deleteDayLog('habit-123', '2025-01-27', TEST_USER_ID);
      expect(deleted).toBe(true);

      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);
      expect(retrieved).toBeNull();
    });
  });

  describe('deleteDayLogsByHabit', () => {
    it('should delete all logs for habit including those with activity metadata', async () => {
      const log1: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        activityId: 'activity-1',
      };

      const log2: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-28',
        value: 1,
        completed: true,
        // No activity metadata
      };

      await upsertDayLog(log1, TEST_USER_ID);
      await upsertDayLog(log2, TEST_USER_ID);

      const deletedCount = await deleteDayLogsByHabit('habit-123', TEST_USER_ID);
      expect(deletedCount).toBe(2);

      const logs = await getDayLogsByHabit('habit-123', TEST_USER_ID);
      expect(Object.keys(logs)).toHaveLength(0);
    });
  });
});
