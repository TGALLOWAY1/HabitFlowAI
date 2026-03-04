#!/usr/bin/env tsx
/**
 * Verify no duplicate active HabitEntries exist by (householdId, userId, habitId, dayKey).
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
const DEFAULT_HOUSEHOLD_ID = 'default-household';

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
      { $match: { deletedAt: { $exists: false } } },
      {
        $group: {
          _id: {
            householdId: { $ifNull: ['$householdId', DEFAULT_HOUSEHOLD_ID] },
            userId: '$userId',
            habitId: '$habitId',
            dayKey: { $ifNull: ['$dayKey', '$date'] },
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
        'duplicate (householdId, userId, habitId, dayKey) group(s) among active habit entries.'
      );
      process.exit(1);
    }

    console.log('OK: No duplicate active habit entries (per householdId, userId, habitId, dayKey).');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
