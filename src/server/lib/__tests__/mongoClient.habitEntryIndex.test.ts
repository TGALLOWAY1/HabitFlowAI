import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestDb, setupTestMongo, teardownTestMongo } from '../../../test/mongoTestHelper';
import { countDuplicateHabitEntryKeys } from '../mongoClient';

const UNIQUE_INDEX_NAME = 'idx_habitEntries_user_habit_dayKey_active_unique';

describe('habitEntries unique-index preflight', () => {
  beforeAll(async () => {
    await setupTestMongo('habitflowai_index_preflight_test');
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    const collection = db.collection('habitEntries');
    await collection.deleteMany({});
    await collection.dropIndex(UNIQUE_INDEX_NAME).catch(() => undefined);
  });

  it('detects an active and a soft-deleted document that collide in the full unique index', async () => {
    const db = await getTestDb();
    await db.collection('habitEntries').insertMany([
      {
        id: 'active-entry',
        householdId: 'household-1',
        userId: 'user-1',
        habitId: 'habit-1',
        dayKey: '2026-02-18',
        value: 1,
      },
      {
        id: 'deleted-entry',
        householdId: 'household-1',
        userId: 'user-1',
        habitId: 'habit-1',
        dayKey: '2026-02-18',
        value: 1,
        deletedAt: '2026-02-19T00:00:00.000Z',
      },
    ]);

    await expect(countDuplicateHabitEntryKeys(db)).resolves.toBe(1);
  });

  it('mirrors the index by grouping missing dayKey values together instead of falling back to date', async () => {
    const db = await getTestDb();
    await db.collection('habitEntries').insertMany([
      {
        id: 'legacy-entry-1',
        householdId: 'household-1',
        userId: 'user-1',
        habitId: 'habit-1',
        date: '2026-02-18',
      },
      {
        id: 'legacy-entry-2',
        householdId: 'household-1',
        userId: 'user-1',
        habitId: 'habit-1',
        date: '2026-02-19',
      },
    ]);

    await expect(countDuplicateHabitEntryKeys(db)).resolves.toBe(1);
  });
});
