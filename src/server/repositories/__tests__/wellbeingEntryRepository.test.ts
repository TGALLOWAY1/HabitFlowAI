/**
 * WellbeingEntry Repository Tests
 *
 * Integration tests for the WellbeingEntry repository.
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createWellbeingEntries, getWellbeingEntries } from '../wellbeingEntryRepository';

const TEST_USER_ID = 'test-user-123';

describe('WellbeingEntryRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
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

  it('should keep createdAt stable across upserts while updating updatedAt', async () => {
    const dayKey = '2025-01-28';

    const first = await createWellbeingEntries(
      [
        {
          dayKey,
          timeOfDay: 'evening',
          metricKey: 'anxiety',
          value: 2,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
        },
      ],
      TEST_USER_ID
    );

    expect(first).toHaveLength(1);
    const firstCreatedAt = (first[0] as any).createdAt;
    const firstUpdatedAt = (first[0] as any).updatedAt;
    expect(typeof firstCreatedAt).toBe('string');
    expect(typeof firstUpdatedAt).toBe('string');

    // Ensure time advances so updatedAt changes
    await new Promise((r) => setTimeout(r, 10));

    const second = await createWellbeingEntries(
      [
        {
          dayKey,
          timeOfDay: 'evening',
          metricKey: 'anxiety',
          value: 4,
          source: 'checkin',
          timestampUtc: new Date().toISOString(),
        },
      ],
      TEST_USER_ID
    );

    expect(second).toHaveLength(1);
    const secondCreatedAt = (second[0] as any).createdAt;
    const secondUpdatedAt = (second[0] as any).updatedAt;

    expect(secondCreatedAt).toBe(firstCreatedAt);
    expect(secondUpdatedAt).not.toBe(firstUpdatedAt);
  });

  it('should accept new superset keys and preserve sleepScore behavior', async () => {
    const dayKey = '2025-02-01';

    const created = await createWellbeingEntries(
      [
        { dayKey, timeOfDay: 'morning', metricKey: 'lowMood', value: 3, source: 'checkin', timestampUtc: new Date().toISOString() },
        { dayKey, timeOfDay: 'evening', metricKey: 'calm', value: 1, source: 'checkin', timestampUtc: new Date().toISOString() },
        { dayKey, timeOfDay: null, metricKey: 'stress', value: 2, source: 'checkin', timestampUtc: new Date().toISOString() },
        { dayKey, timeOfDay: null, metricKey: 'focus', value: 4, source: 'checkin', timestampUtc: new Date().toISOString() },
        { dayKey, timeOfDay: null, metricKey: 'sleepQuality', value: 2, source: 'checkin', timestampUtc: new Date().toISOString() },
        // legacy key remains supported unchanged
        { dayKey, timeOfDay: 'morning', metricKey: 'sleepScore', value: 88, source: 'checkin', timestampUtc: new Date().toISOString() },
      ],
      TEST_USER_ID
    );

    expect(created.length).toBeGreaterThanOrEqual(6);

    const fetched = await getWellbeingEntries({ userId: TEST_USER_ID, startDayKey: dayKey, endDayKey: dayKey });
    const keys = fetched.map((e) => `${e.metricKey}:${e.timeOfDay ?? 'null'}`);

    expect(keys).toContain('lowMood:morning');
    expect(keys).toContain('calm:evening');
    expect(keys).toContain('stress:null');
    expect(keys).toContain('focus:null');
    expect(keys).toContain('sleepQuality:null');
    expect(keys).toContain('sleepScore:morning');
  });
});


