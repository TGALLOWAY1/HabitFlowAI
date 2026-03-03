#!/usr/bin/env tsx
/**
 * Test-user cleanup script — removes documents belonging to test/debug
 * userIds from the production database.
 *
 * Safety:
 *   - Dry-run by default.
 *   - Never deletes the known real user or demo users unless --include-demo.
 *   - Reports every userId and per-collection count before deleting.
 *
 * Usage:
 *   npx tsx scripts/migrations/cleanupTestUsers.ts --dry-run
 *   npx tsx scripts/migrations/cleanupTestUsers.ts --apply
 *   npx tsx scripts/migrations/cleanupTestUsers.ts --apply --include-demo
 */

import { MongoClient, Db } from 'mongodb';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const USER_SCOPED_COLLECTIONS = [
  'habits', 'categories', 'goals', 'habitEntries', 'dayLogs',
  'wellbeingLogs', 'wellbeingEntries', 'routines', 'routineLogs',
  'journalEntries', 'tasks', 'goalManualLogs', 'dashboardPrefs',
  'routineImages',
];

const TEST_USER_PATTERNS = [
  /^test-user-/,
  /^test-/,
  /^vitest-/,
  /^jest-/,
  /^debug-user-/,
];

const DEMO_USER_PATTERNS = [
  /^demo_/,
];

/** These are NEVER deleted unless the user explicitly uses --include-known */
const PROTECTED_USER_IDS = new Set([
  '8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb', // known real user
  'anonymous-user',                         // may contain real data
]);

interface CliArgs {
  apply: boolean;
  includeDemoUsers: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let apply = false;
  let includeDemoUsers = false;

  for (const arg of args) {
    if (arg === '--apply') apply = true;
    if (arg === '--dry-run') apply = false;
    if (arg === '--include-demo') includeDemoUsers = true;
  }

  return { apply, includeDemoUsers };
}

function isTestUser(userId: string, includeDemoUsers: boolean): boolean {
  if (PROTECTED_USER_IDS.has(userId)) return false;

  for (const pattern of TEST_USER_PATTERNS) {
    if (pattern.test(userId)) return true;
  }

  if (includeDemoUsers) {
    for (const pattern of DEMO_USER_PATTERNS) {
      if (pattern.test(userId)) return true;
    }
  }

  return false;
}

async function discoverAllUserIds(db: Db): Promise<Map<string, Map<string, number>>> {
  const userCollectionCounts = new Map<string, Map<string, number>>();

  for (const name of USER_SCOPED_COLLECTIONS) {
    const exists = (await db.listCollections({ name }).toArray()).length > 0;
    if (!exists) continue;

    const pipeline = [
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ];
    const groups = await db.collection(name).aggregate(pipeline).toArray();

    for (const g of groups) {
      const uid = g._id as string;
      if (!uid) continue;
      if (!userCollectionCounts.has(uid)) {
        userCollectionCounts.set(uid, new Map());
      }
      userCollectionCounts.get(uid)!.set(name, g.count as number);
    }
  }

  return userCollectionCounts;
}

async function main() {
  const cli = parseArgs();
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB_NAME!;

  if (!uri || !dbName) {
    console.error('ERROR: MONGODB_URI and MONGODB_DB_NAME must be set');
    process.exit(1);
  }

  const client = new MongoClient(uri, { autoSelectFamily: false });

  try {
    await client.connect();
    const db = client.db(dbName);

    const mode = cli.apply ? 'APPLY' : 'DRY-RUN';
    console.log(`\n=== Test User Cleanup (${mode}) ===`);
    console.log(`DB: ${dbName}\n`);

    // Discover all userIds
    const allUsers = await discoverAllUserIds(db);

    // Classify
    const testUsers = new Map<string, Map<string, number>>();
    const realUsers = new Map<string, Map<string, number>>();

    for (const [uid, counts] of allUsers) {
      if (isTestUser(uid, cli.includeDemoUsers)) {
        testUsers.set(uid, counts);
      } else {
        realUsers.set(uid, counts);
      }
    }

    // Report real users (will NOT be touched)
    console.log('--- Protected / real users (NOT touched) ---');
    for (const [uid, counts] of realUsers) {
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      console.log(`  ${uid.padEnd(50)} ${String(total).padStart(5)} docs`);
    }

    console.log(`\n--- Test users to clean up (${testUsers.size} found) ---`);
    if (testUsers.size === 0) {
      console.log('  No test users found.');
      return;
    }

    let grandTotal = 0;
    const report: Record<string, Record<string, number>> = {};
    for (const [uid, counts] of testUsers) {
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      grandTotal += total;
      report[uid] = Object.fromEntries(counts);
      console.log(`  ${uid}`);
      for (const [col, count] of counts) {
        console.log(`    ${col.padEnd(22)} ${String(count).padStart(5)}`);
      }
    }

    console.log(`\nTotal test-user documents: ${grandTotal}`);

    if (cli.apply) {
      console.log('\n--- DELETING ---\n');
      const testUserIds = [...testUsers.keys()];
      let totalDeleted = 0;

      for (const name of USER_SCOPED_COLLECTIONS) {
        const exists = (await db.listCollections({ name }).toArray()).length > 0;
        if (!exists) continue;
        const result = await db.collection(name).deleteMany({ userId: { $in: testUserIds } });
        if (result.deletedCount > 0) {
          console.log(`  ✅ ${name}: ${result.deletedCount} deleted`);
          totalDeleted += result.deletedCount;
        }
      }

      console.log(`\nCleanup complete: ${totalDeleted} documents deleted.`);
    } else {
      console.log('\n📋 DRY RUN — no data was deleted. Re-run with --apply to execute.');
    }

    // Save report
    const outDir = resolve(process.cwd(), 'docs/migrations');
    mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = resolve(outDir, `test-user-cleanup-${ts}.json`);
    writeFileSync(outPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: cli.apply ? 'apply' : 'dry-run',
      dbName,
      testUsers: report,
      totalDocuments: grandTotal,
    }, null, 2) + '\n');
    console.log(`Report saved to ${outPath}`);

  } catch (err) {
    console.error('Cleanup failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
