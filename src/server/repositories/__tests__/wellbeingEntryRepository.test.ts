/**
 * WellbeingEntry Repository Tests
 *
 * Integration tests for the WellbeingEntry repository.
 * Requires MongoDB to be running (use test database).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';

// Set environment variables BEFORE importing modules that use them
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { getDb, closeConnection } from '../../lib/mongoClient';
import { createWellbeingEntries, getWellbeingEntries } from '../wellbeingEntryRepository';

const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-123';

let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let testClient: MongoClient | null = null;

describe('WellbeingEntryRepository', () => {
  beforeAll(async () => {
    originalDbName = process.env.MONGODB_DB_NAME;
    originalUseMongo = process.env.USE_MONGO_PERSISTENCE;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    await getDb();

    const uri = process.env.MONGODB_URI;
    if (uri) {
      testClient = new MongoClient(uri);
      await testClient.connect();
    }
  });

  afterAll(async () => {
    if (testClient) {
      const adminDb = testClient.db(TEST_DB_NAME);
      await adminDb.dropDatabase();
      await testClient.close();
    }

    await closeConnection();

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
    const db = await getDb();
    await db.collection('wellbeingEntries').deleteMany({});
  });

  it('should create two distinct entries for morning vs evening with same metricKey', async () => {
    const dayKey = '2025-01-27';

    const created = await createWellbeingEntries(
      [
        {
          dayKey,
          timeOfDay: 'morning',
          metricKey: 'depression',
          value: 2,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
        },
        {
          dayKey,
          timeOfDay: 'evening',
          metricKey: 'depression',
          value: 4,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
        },
      ],
      TEST_USER_ID
    );

    expect(created).toHaveLength(2);
    expect(created.some(e => e.timeOfDay === 'morning' && e.metricKey === 'depression')).toBe(true);
    expect(created.some(e => e.timeOfDay === 'evening' && e.metricKey === 'depression')).toBe(true);

    const fetched = await getWellbeingEntries({
      userId: TEST_USER_ID,
      startDayKey: dayKey,
      endDayKey: dayKey,
    });

    expect(fetched).toHaveLength(2);
  });

  it('should upsert (not duplicate) on repeated saves of the same (dayKey,timeOfDay,metricKey)', async () => {
    const dayKey = '2025-01-27';

    await createWellbeingEntries(
      [
        {
          dayKey,
          timeOfDay: 'morning',
          metricKey: 'depression',
          value: 2,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
        },
      ],
      TEST_USER_ID
    );

    const second = await createWellbeingEntries(
      [
        {
          dayKey,
          timeOfDay: 'morning',
          metricKey: 'depression',
          value: 5,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
        },
      ],
      TEST_USER_ID
    );

    expect(second).toHaveLength(1);
    expect(second[0].value).toBe(5);

    const fetched = await getWellbeingEntries({
      userId: TEST_USER_ID,
      startDayKey: dayKey,
      endDayKey: dayKey,
    });

    expect(fetched).toHaveLength(1);
    expect(fetched[0].value).toBe(5);
  });
});


