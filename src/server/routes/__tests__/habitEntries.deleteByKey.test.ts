/**
 * HabitEntry Delete By Key Tests
 * 
 * Tests for deleting habit entries by (habitId, dayKey) using canonical dayKey format.
 * This is the preferred deletion method as it avoids issues with stale entry IDs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { deleteHabitEntryByKeyRoute } from '../habitEntries';
import { getDb, closeConnection } from '../../lib/mongoClient';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';
import { createHabitEntry } from '../../repositories/habitEntryRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const TEST_DB_NAME = 'test_habitflow_delete_by_key';
const TEST_USER_ID = 'test-user-delete-by-key';

let app: Express;
let testHabitId: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    (req as any).userId = TEST_USER_ID;
    next();
  });
  app.delete('/api/entries/key', deleteHabitEntryByKeyRoute);
});

afterAll(async () => {
  await closeConnection();
});

beforeEach(async () => {
  const db = await getDb();
  await db.collection('habits').deleteMany({ userId: TEST_USER_ID });
  await db.collection('habitEntries').deleteMany({ userId: TEST_USER_ID });
  await db.collection('categories').deleteMany({ userId: TEST_USER_ID });

  // Create test habit
  const category = await createCategory({
    name: 'Test Category',
    color: '#000000',
  }, TEST_USER_ID);

  const habit = await createHabit({
    name: 'Test Habit',
    categoryId: category.id,
    type: 'boolean',
  }, TEST_USER_ID);

  testHabitId = habit.id;
});

describe('DELETE /api/entries/key - Delete by habitId + dayKey', () => {
  it('should delete entry using canonical dayKey format (YYYY-MM-DD)', async () => {
    const dayKey = '2025-01-27'; // Canonical format

    // Create an entry first
    const entry = await createHabitEntry({
      habitId: testHabitId,
      dayKey,
      value: 1,
      source: 'manual',
      timestamp: new Date().toISOString(),
    }, TEST_USER_ID);

    // Verify entry exists
    const entriesBefore = await getHabitEntriesForDay(testHabitId, dayKey, TEST_USER_ID);
    expect(entriesBefore.length).toBe(1);
    expect(entriesBefore[0].id).toBe(entry.id);

    // Delete by key
    const response = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
        dateKey: dayKey,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.dayLog).toBeDefined(); // DayLog should be recomputed

    // Verify entry is soft-deleted (not in active queries)
    const entriesAfter = await getHabitEntriesForDay(testHabitId, dayKey, TEST_USER_ID);
    expect(entriesAfter.length).toBe(0);

    // Verify entry still exists in DB but is soft-deleted
    const db = await getDb();
    const dbEntry = await db.collection('habitEntries').findOne({
      id: entry.id,
      userId: TEST_USER_ID,
    });
    expect(dbEntry).toBeDefined();
    expect(dbEntry?.deletedAt).toBeDefined(); // Should have deletedAt timestamp
  });

  it('should return 404 when no active entry exists for the given key', async () => {
    const dayKey = '2025-01-28';

    // Try to delete non-existent entry
    const response = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
        dateKey: dayKey,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('No active entry found');
  });

  it('should reject invalid dayKey format', async () => {
    const response = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
        dateKey: '2025/01/27', // Invalid format (should be YYYY-MM-DD)
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('YYYY-MM-DD format');
  });

  it('should require both habitId and dateKey', async () => {
    // Missing dateKey
    const response1 = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
      });

    expect(response1.status).toBe(400);
    expect(response1.body.error).toContain('required');

    // Missing habitId
    const response2 = await request(app)
      .delete('/api/entries/key')
      .query({
        dateKey: '2025-01-27',
      });

    expect(response2.status).toBe(400);
    expect(response2.body.error).toContain('required');
  });

  it('should only delete active entries (not already soft-deleted)', async () => {
    const dayKey = '2025-01-29';

    // Create and then soft-delete an entry
    const entry = await createHabitEntry({
      habitId: testHabitId,
      dayKey,
      value: 1,
      source: 'manual',
      timestamp: new Date().toISOString(),
    }, TEST_USER_ID);

    // Soft delete it manually
    const db = await getDb();
    await db.collection('habitEntries').updateOne(
      { id: entry.id, userId: TEST_USER_ID },
      { $set: { deletedAt: new Date().toISOString() } }
    );

    // Try to delete again - should return 404
    const response = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
        dateKey: dayKey,
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('No active entry found');
  });

  it('should support legacy date field in database (backward compatibility)', async () => {
    const dayKey = '2025-01-30';

    // Create entry with legacy date field (simulating old records)
    const db = await getDb();
    const entryId = crypto.randomUUID();
    await db.collection('habitEntries').insertOne({
      _id: new (await import('mongodb')).ObjectId(),
      id: entryId,
      habitId: testHabitId,
      userId: TEST_USER_ID,
      date: dayKey, // Legacy field (no dayKey)
      value: 1,
      source: 'manual',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Verify entry exists
    const entriesBefore = await getHabitEntriesForDay(testHabitId, dayKey, TEST_USER_ID);
    expect(entriesBefore.length).toBe(1);

    // Delete by key - should work with legacy date field
    const response = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
        dateKey: dayKey,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify entry is soft-deleted
    const entriesAfter = await getHabitEntriesForDay(testHabitId, dayKey, TEST_USER_ID);
    expect(entriesAfter.length).toBe(0);
  });

  it('should recompute DayLog after deletion', async () => {
    const dayKey = '2025-01-31';

    // Create an entry
    await createHabitEntry({
      habitId: testHabitId,
      dayKey,
      value: 1,
      source: 'manual',
      timestamp: new Date().toISOString(),
    }, TEST_USER_ID);

    // Delete entry
    const response = await request(app)
      .delete('/api/entries/key')
      .query({
        habitId: testHabitId,
        dateKey: dayKey,
      });

    expect(response.status).toBe(200);
    // DayLog should be recomputed (may be null if no entries remain)
    expect(response.body.dayLog).toBeDefined();
  });
});

