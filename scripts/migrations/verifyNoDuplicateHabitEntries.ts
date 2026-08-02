#!/usr/bin/env tsx
/**
 * Verify no duplicate HabitEntries exist by (householdId, userId, habitId, dayKey).
 * Includes soft-deleted documents because the invariant is enforced by a full
 * unique index over the collection.
 * Read-only. Exits 0 if no duplicates, 1 if any duplicate groups remain.
 * Does not operate cross-household; each household is checked independently.
 *
 * Usage:
 *   npx tsx scripts/migrations/verifyNoDuplicateHabitEntries.ts
 */

import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { MongoClient } from 'mongodb';
import { getMongoDbUri, getMongoDbName } from '../../src/server/config/env';

const COLLECTION = 'habitEntries';
const UNIQUE_INDEX_NAME = 'idx_habitEntries_user_habit_dayKey_active_unique';
async function main(): Promise<void> {
  const uri = getMongoDbUri();
  const dbName = getMongoDbName();
  if (!uri || !dbName) {
    console.error('ERROR: MONGODB_URI and MONGODB_DB_NAME must be set (e.g. in .env)');
    process.exit(1);
  }

  const client = new MongoClient(uri, { autoSelectFamily: false });
  try {
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection(COLLECTION);

    const cursor = coll.aggregate<{ count: number }>([
      {
        $group: {
          _id: {
            householdId: '$householdId',
            userId: '$userId',
            habitId: '$habitId',
            dayKey: '$dayKey',
          },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
      { $count: 'count' },
    ]);
    const result = await cursor.next();
    const duplicateKeyCount = result?.count ?? 0;

    if (duplicateKeyCount > 0) {
      console.error(
        'FAIL: Found',
        duplicateKeyCount,
        'duplicate (householdId, userId, habitId, dayKey) group(s) in habitEntries.'
      );
      process.exit(1);
    }

    const indexes = await coll.indexes();
    const uniqueIndex = indexes.find(index => index.name === UNIQUE_INDEX_NAME);
    const expectedKey = JSON.stringify({ householdId: 1, userId: 1, habitId: 1, dayKey: 1 });
    if (!uniqueIndex || uniqueIndex.unique !== true || JSON.stringify(uniqueIndex.key) !== expectedKey) {
      console.error(`FAIL: Expected unique index ${UNIQUE_INDEX_NAME} is missing or has the wrong definition.`);
      process.exit(1);
    }

    console.log('OK: No duplicate habit-entry keys and the canonical unique index is active.');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
