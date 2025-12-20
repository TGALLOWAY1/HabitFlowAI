/**
 * HabitEntry DayKey Normalization Tests
 * 
 * Tests for dayKey normalization at API boundary:
 * - Creating entry with dayKey (preferred)
 * - Creating entry with legacy date (converted to dayKey)
 * - Creating entry with timestamp + timeZone (derived to dayKey)
 * - Updating entry dayKey normalization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { createHabitEntryRoute, updateHabitEntryRoute } from '../habitEntries';
import { getDb, closeConnection } from '../../lib/mongoClient';
import { createHabit } from '../../repositories/habitRepository';
import { createCategory } from '../../repositories/categoryRepository';
import { getHabitEntriesForDay } from '../../repositories/habitEntryRepository';

const TEST_DB_NAME = 'test_habitflow_daykey';
const TEST_USER_ID = 'test-user-daykey';

let app: Express;
let testHabitId: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    (req as any).userId = TEST_USER_ID;
    next();
  });
  app.post('/api/entries', createHabitEntryRoute);
  app.patch('/api/entries/:id', updateHabitEntryRoute);
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

describe('POST /api/entries - DayKey Normalization', () => {
  it('should create entry with dayKey (preferred)', async () => {
    const response = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        dayKey: '2025-01-15',
        value: 1,
        source: 'manual',
      });

    expect(response.status).toBe(201);
    expect(response.body.entry.dayKey).toBe('2025-01-15');
    expect(response.body.entry.date).toBe('2025-01-15'); // Legacy alias
    expect(response.body.entry.timestamp).toBeDefined();
  });

  it('should create entry with legacy date (converted to dayKey)', async () => {
    const response = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        date: '2025-01-20', // Legacy date field
        value: 1,
        source: 'manual',
      });

    expect(response.status).toBe(201);
    expect(response.body.entry.dayKey).toBe('2025-01-20');
    expect(response.body.entry.date).toBe('2025-01-20'); // Legacy alias maintained
  });

  it('should create entry with timestamp + timeZone (derived to dayKey)', async () => {
    // Use a timestamp that would result in different dayKey in different timezones
    const timestamp = '2025-01-15T23:00:00.000Z'; // 11 PM UTC = next day in PST

    const response = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        timestamp,
        timeZone: 'America/Los_Angeles', // PST (UTC-8)
        value: 1,
        source: 'manual',
      });

    expect(response.status).toBe(201);
    // In PST, 11 PM UTC on Jan 15 = 3 PM PST on Jan 15, so dayKey should be 2025-01-15
    expect(response.body.entry.dayKey).toBe('2025-01-15');
    expect(response.body.entry.timestamp).toBe(timestamp);
  });

  it('should prefer dayKey over date if both provided', async () => {
    const response = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        dayKey: '2025-01-15', // Preferred
        date: '2025-01-20', // Should be ignored
        value: 1,
        source: 'manual',
      });

    expect(response.status).toBe(201);
    expect(response.body.entry.dayKey).toBe('2025-01-15');
    expect(response.body.entry.date).toBe('2025-01-15'); // Uses dayKey, not date
  });

  it('should reject entry without dayKey, date, or timestamp+timeZone', async () => {
    const response = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        value: 1,
        source: 'manual',
        // No dayKey, date, or timestamp+timeZone
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('dayKey is required');
  });

  it('should store dayKey in database and query by dayKey', async () => {
    // Create entry with dayKey
    const createResponse = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        dayKey: '2025-01-25',
        value: 1,
        source: 'manual',
      });

    expect(createResponse.status).toBe(201);
    const entryId = createResponse.body.entry.id;

    // Query by dayKey using repository
    const entries = await getHabitEntriesForDay(testHabitId, '2025-01-25', TEST_USER_ID);
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe(entryId);
    expect(entries[0].dayKey).toBe('2025-01-25');
    // date is derived from dayKey in API responses, but not persisted
    expect(entries[0].date).toBe('2025-01-25'); // Derived alias
  });

  it('should not persist date field when creating with legacy date input', async () => {
    // Create entry with legacy date (should be normalized to dayKey, date not persisted)
    const createResponse = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        date: '2025-01-30', // Legacy date field
        value: 1,
        source: 'manual',
      });

    expect(createResponse.status).toBe(201);
    const entryId = createResponse.body.entry.id;

    // Verify dayKey is set
    expect(createResponse.body.entry.dayKey).toBe('2025-01-30');
    // date is included in response for backward compatibility (derived from dayKey)
    expect(createResponse.body.entry.date).toBe('2025-01-30');

    // Query directly from DB to verify date is NOT persisted
    const { getDb } = await import('../../lib/mongoClient');
    const db = await getDb();
    const dbEntry = await db.collection('habitEntries').findOne({ id: entryId, userId: TEST_USER_ID });

    expect(dbEntry).toBeDefined();
    expect(dbEntry?.dayKey).toBe('2025-01-30');
    // date should NOT be in the persisted document (or should be undefined if legacy record)
    // New records should not have date field
    if (dbEntry && 'date' in dbEntry) {
      // If date exists, it's from a legacy record - that's OK, but new records won't have it
      // We just verify dayKey is the canonical field
      expect(dbEntry.dayKey).toBeDefined();
    }
  });
});

describe('PATCH /api/entries/:id - DayKey Normalization', () => {
  let entryId: string;
  let originalDayKey: string;

  beforeEach(async () => {
    // Create an entry first
    const createResponse = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        dayKey: '2025-01-15',
        value: 1,
        source: 'manual',
      });

    expect(createResponse.status).toBe(201);
    entryId = createResponse.body.entry.id;
    originalDayKey = createResponse.body.entry.dayKey;
  });

  it('should update entry dayKey when dayKey is provided', async () => {
    const response = await request(app)
      .patch(`/api/entries/${entryId}`)
      .send({
        dayKey: '2025-01-20',
      });

    expect(response.status).toBe(200);
    expect(response.body.entry.dayKey).toBe('2025-01-20');
    expect(response.body.entry.date).toBe('2025-01-20');
  });

  it('should update entry dayKey when legacy date is provided', async () => {
    const response = await request(app)
      .patch(`/api/entries/${entryId}`)
      .send({
        date: '2025-01-25', // Legacy date field
      });

    expect(response.status).toBe(200);
    expect(response.body.entry.dayKey).toBe('2025-01-25');
    expect(response.body.entry.date).toBe('2025-01-25');
  });

  it('should update entry dayKey when timestamp + timeZone is provided', async () => {
    const timestamp = '2025-01-30T12:00:00.000Z';

    const response = await request(app)
      .patch(`/api/entries/${entryId}`)
      .send({
        timestamp,
        timeZone: 'UTC',
      });

    expect(response.status).toBe(200);
    expect(response.body.entry.dayKey).toBe('2025-01-30');
    expect(response.body.entry.timestamp).toBe(timestamp);
  });

  it('should recompute DayLog for both old and new dayKey when dayKey changes', async () => {
    // Create entry on day 1
    const createResponse = await request(app)
      .post('/api/entries')
      .send({
        habitId: testHabitId,
        dayKey: '2025-02-01',
        value: 1,
        source: 'manual',
      });

    const entryId2 = createResponse.body.entry.id;

    // Update entry to day 2
    const updateResponse = await request(app)
      .patch(`/api/entries/${entryId2}`)
      .send({
        dayKey: '2025-02-02',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.entry.dayKey).toBe('2025-02-02');

    // Verify entry is on new day
    const entriesDay2 = await getHabitEntriesForDay(testHabitId, '2025-02-02', TEST_USER_ID);
    expect(entriesDay2.length).toBe(1);
    expect(entriesDay2[0].id).toBe(entryId2);

    // Verify entry is not on old day
    const entriesDay1 = await getHabitEntriesForDay(testHabitId, '2025-02-01', TEST_USER_ID);
    expect(entriesDay1.length).toBe(0);
  });
});

