/**
 * DashboardPrefs Repository Tests
 *
 * Integration tests for dashboard prefs persistence.
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { getDashboardPrefs, updateDashboardPrefs } from '../dashboardPrefsRepository';

const TEST_HOUSEHOLD_ID = 'test-household-dashboard';
const TEST_HOUSEHOLD_ID_2 = 'test-household-dashboard-2';
const TEST_USER_ID = 'test-user-dashboard-prefs';

describe('DashboardPrefsRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('dashboardPrefs').deleteMany({});
    await db.collection('routines').deleteMany({});
    await db.collection('goals').deleteMany({});
  });

  it('should return defaults when none exist', async () => {
    const prefs = await getDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(prefs.userId).toBe(TEST_USER_ID);
    expect(prefs.pinnedRoutineIds).toEqual([]);
  });

  it('should save and retrieve pinnedRoutineIds (and validate against existing routines)', async () => {
    const db = await getTestDb();
    await db.collection('routines').insertMany([
      { id: 'r1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'R1', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'r2', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'R2', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    const saved = await updateDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID, { pinnedRoutineIds: ['r1', 'r2', 'missing'] });
    expect(saved.pinnedRoutineIds).toEqual(['r1', 'r2']); // missing filtered

    const roundTrip = await getDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(roundTrip.pinnedRoutineIds).toEqual(['r1', 'r2']);
  });

  it('should save and retrieve pinnedGoalIds (and validate against existing goals)', async () => {
    const db = await getTestDb();
    await db.collection('goals').insertMany([
      { id: 'g1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'G1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'g2', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'G2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    const saved = await updateDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID, { pinnedGoalIds: ['g1', 'g2', 'missing'] });
    expect(saved.pinnedGoalIds).toEqual(['g1', 'g2']); // missing filtered

    const roundTrip = await getDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(roundTrip.pinnedGoalIds).toEqual(['g1', 'g2']);
  });

  it('pinnedGoalIds and pinnedRoutineIds coexist without overwriting each other', async () => {
    const db = await getTestDb();
    await db.collection('routines').insertOne(
      { id: 'r1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'R1', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    );
    await db.collection('goals').insertOne(
      { id: 'g1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'G1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    );

    await updateDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID, { pinnedRoutineIds: ['r1'] });
    await updateDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID, { pinnedGoalIds: ['g1'] });

    const roundTrip = await getDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(roundTrip.pinnedRoutineIds).toEqual(['r1']);
    expect(roundTrip.pinnedGoalIds).toEqual(['g1']);
  });

  it('should save and retrieve checkinExtraMetricKeys (filtering invalid keys and notes)', async () => {
    const saved = await updateDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID, {
      checkinExtraMetricKeys: ['lowMood', 'calm', 'notes', 'not_a_key', 'stress'] as any,
    });
    expect(saved.checkinExtraMetricKeys).toEqual(['lowMood', 'calm', 'stress']);

    const roundTrip = await getDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID);
    expect(roundTrip.checkinExtraMetricKeys).toEqual(['lowMood', 'calm', 'stress']);
  });

  it('scopes dashboard prefs by household so one household cannot overwrite another', async () => {
    const db = await getTestDb();
    await db.collection('routines').insertMany([
      { id: 'h1-r1', householdId: TEST_HOUSEHOLD_ID, userId: TEST_USER_ID, title: 'H1 R1', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'h2-r1', householdId: TEST_HOUSEHOLD_ID_2, userId: TEST_USER_ID, title: 'H2 R1', linkedHabitIds: [], steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    await updateDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID, { pinnedRoutineIds: ['h1-r1'] });
    await updateDashboardPrefs(TEST_HOUSEHOLD_ID_2, TEST_USER_ID, { pinnedRoutineIds: ['h2-r1'] });

    const householdOnePrefs = await getDashboardPrefs(TEST_HOUSEHOLD_ID, TEST_USER_ID);
    const householdTwoPrefs = await getDashboardPrefs(TEST_HOUSEHOLD_ID_2, TEST_USER_ID);

    expect(householdOnePrefs.pinnedRoutineIds).toEqual(['h1-r1']);
    expect(householdTwoPrefs.pinnedRoutineIds).toEqual(['h2-r1']);
  });
});

