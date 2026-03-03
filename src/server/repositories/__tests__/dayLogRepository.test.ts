/**
 * DayLog Repository Tests
 * 
 * Integration tests for the DayLog repository.
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DayLog } from '../../../models/persistenceTypes';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';

import {
  upsertDayLog,
  getDayLogsByUser,
  getDayLogsByHabit,
  getDayLog,
  deleteDayLog,
  deleteDayLogsByHabit,
} from '../dayLogRepository';

const TEST_USER_ID = 'test-user-123';

describe('DayLogRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
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

    it('should store day log with routine metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-456',
        source: 'routine',
      };

      const result = await upsertDayLog(log, TEST_USER_ID);

      expect(result.routineId).toBe('routine-456');
      expect(result.source).toBe('routine');
    });

    it('should round-trip routine metadata correctly', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-456',
        source: 'routine',
      };

      // Upsert with routine metadata
      await upsertDayLog(log, TEST_USER_ID);

      // Retrieve and verify
      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.routineId).toBe('routine-456');
      expect(retrieved?.source).toBe('routine');
    });

    it('should work without routine metadata (backward compatibility)', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
      };

      const result = await upsertDayLog(log, TEST_USER_ID);

      expect(result.routineId).toBeUndefined();
      expect(result.source).toBeUndefined();
    });

    it('should preserve compositeKey logic (habitId-date)', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-456',
      };

      await upsertDayLog(log, TEST_USER_ID);

      // Verify we can retrieve using the same habitId and date
      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);
      expect(retrieved).toBeDefined();
      expect(retrieved?.routineId).toBe('routine-456');
    });
  });

  describe('getDayLogsByUser', () => {
    it('should return empty record when user has no logs', async () => {
      const logs = await getDayLogsByUser(TEST_USER_ID);
      expect(logs).toEqual({});
    });

    it('should return all logs for user with routine metadata', async () => {
      const log1: DayLog = {
        habitId: 'habit-1',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-1',
        source: 'routine',
      };

      const log2: DayLog = {
        habitId: 'habit-2',
        date: '2025-01-27',
        value: 1,
        completed: true,
        // No routine metadata
      };

      await upsertDayLog(log1, TEST_USER_ID);
      await upsertDayLog(log2, TEST_USER_ID);

      const logs = await getDayLogsByUser(TEST_USER_ID);

      expect(Object.keys(logs)).toHaveLength(2);
      const log1Key = 'habit-1-2025-01-27';
      const log2Key = 'habit-2-2025-01-27';

      expect(logs[log1Key]?.routineId).toBe('routine-1');
      expect(logs[log1Key]?.source).toBe('routine');
      expect(logs[log2Key]?.routineId).toBeUndefined();
    });
  });

  describe('getDayLogsByHabit', () => {
    it('should return logs for specific habit with routine metadata', async () => {
      const log1: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-1',
        source: 'routine',
      };

      const log2: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-28',
        value: 1,
        completed: true,
        // No routine metadata
      };

      await upsertDayLog(log1, TEST_USER_ID);
      await upsertDayLog(log2, TEST_USER_ID);

      const logs = await getDayLogsByHabit('habit-123', TEST_USER_ID);

      expect(Object.keys(logs)).toHaveLength(2);
      const log1Key = 'habit-123-2025-01-27';
      const log2Key = 'habit-123-2025-01-28';

      expect(logs[log1Key]?.routineId).toBe('routine-1');
      expect(logs[log2Key]?.routineId).toBeUndefined();
    });
  });

  describe('getDayLog', () => {
    it('should return log with routine metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-456',
        source: 'routine',
      };

      await upsertDayLog(log, TEST_USER_ID);

      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.routineId).toBe('routine-456');
      expect(retrieved?.source).toBe('routine');
    });

    it('should return log without routine metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
      };

      await upsertDayLog(log, TEST_USER_ID);

      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.routineId).toBeUndefined();
    });
  });

  describe('deleteDayLog', () => {
    it('should delete log with routine metadata', async () => {
      const log: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-456',
      };

      await upsertDayLog(log, TEST_USER_ID);

      const deleted = await deleteDayLog('habit-123', '2025-01-27', TEST_USER_ID);
      expect(deleted).toBe(true);

      const retrieved = await getDayLog('habit-123', '2025-01-27', TEST_USER_ID);
      expect(retrieved).toBeNull();
    });
  });

  describe('deleteDayLogsByHabit', () => {
    it('should delete all logs for habit including those with routine metadata', async () => {
      const log1: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-27',
        value: 1,
        completed: true,
        routineId: 'routine-1',
      };

      const log2: DayLog = {
        habitId: 'habit-123',
        date: '2025-01-28',
        value: 1,
        completed: true,
        // No routine metadata
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
