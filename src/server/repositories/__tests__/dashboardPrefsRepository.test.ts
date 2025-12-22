/**
 * DashboardPrefs Repository Tests
 *
 * Integration tests for dashboard prefs persistence.
 * Requires MongoDB (uses test database).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { getDb, closeConnection } from '../../lib/mongoClient';
import { getDashboardPrefs, updateDashboardPrefs } from '../dashboardPrefsRepository';

const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-dashboard-prefs';

let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let testClient: MongoClient | null = null;

describe('DashboardPrefsRepository', () => {
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

    if (originalDbName) process.env.MONGODB_DB_NAME = originalDbName;
    else delete process.env.MONGODB_DB_NAME;
    if (originalUseMongo) process.env.USE_MONGO_PERSISTENCE = originalUseMongo;
    else delete process.env.USE_MONGO_PERSISTENCE;
  });

  beforeEach(async () => {
    const db = await getDb();
    await db.collection('dashboardPrefs').deleteMany({});
    await db.collection('routines').deleteMany({});
  });

  it('should return defaults when none exist', async () => {
    const prefs = await getDashboardPrefs(TEST_USER_ID);
    expect(prefs.userId).toBe(TEST_USER_ID);
    expect(prefs.pinnedRoutineIds).toEqual([]);
  });

  it('should save and retrieve pinnedRoutineIds (and validate against existing routines)', async () => {
    const db = await getDb();
    await db.collection('routines').insertMany([
      { id: 'r1', userId: TEST_USER_ID, title: 'R1', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'r2', userId: TEST_USER_ID, title: 'R2', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    const saved = await updateDashboardPrefs(TEST_USER_ID, { pinnedRoutineIds: ['r1', 'r2', 'missing'] });
    expect(saved.pinnedRoutineIds).toEqual(['r1', 'r2']); // missing filtered

    const roundTrip = await getDashboardPrefs(TEST_USER_ID);
    expect(roundTrip.pinnedRoutineIds).toEqual(['r1', 'r2']);
  });

  it('should save and retrieve checkinExtraMetricKeys (filtering invalid keys and notes)', async () => {
    const saved = await updateDashboardPrefs(TEST_USER_ID, {
      checkinExtraMetricKeys: ['lowMood', 'calm', 'notes', 'not_a_key', 'stress'] as any,
    });
    expect(saved.checkinExtraMetricKeys).toEqual(['lowMood', 'calm', 'stress']);

    const roundTrip = await getDashboardPrefs(TEST_USER_ID);
    expect(roundTrip.checkinExtraMetricKeys).toEqual(['lowMood', 'calm', 'stress']);
  });
});


