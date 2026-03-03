#!/usr/bin/env tsx
/**
 * Inspect userId distribution across all key collections.
 * Read-only — no writes.
 */

import { MongoClient } from 'mongodb';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const COLLECTIONS = [
  'habits', 'categories', 'goals', 'habitEntries', 'dayLogs',
  'wellbeingLogs', 'wellbeingEntries', 'routines', 'routineLogs',
  'journalEntries', 'tasks', 'dashboardPrefs', 'goalManualLogs',
];

async function main() {
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB_NAME!;

  const client = new MongoClient(uri, { autoSelectFamily: false });
  await client.connect();
  const db = client.db(dbName);

  console.log(`DB: ${dbName}\n`);

  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    const pipeline = [
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 as const } },
    ];
    const groups = await col.aggregate(pipeline).toArray();
    console.log(`${name}:`);
    for (const g of groups) {
      console.log(`  ${g._id ?? '(null)'}: ${g.count}`);
    }
    if (groups.length === 0) console.log('  (empty)');
  }

  await client.close();
}

main();
