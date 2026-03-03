#!/usr/bin/env tsx
/**
 * Post-migration verification script.
 *
 * Checks:
 *   1. Document counts per collection for the target user.
 *   2. No documents remain for the source users (unless --allow-leftovers).
 *   3. Referential integrity: every habitEntry.habitId should refer to a
 *      habit owned by the target user.
 *
 * Usage:
 *   npx tsx scripts/migrations/verifyUserMigration.ts \
 *     --from anonymous-user \
 *     --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
 *     --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb
 *
 *   npx tsx scripts/migrations/verifyUserMigration.ts \
 *     --from anonymous-user --to 8013bd6a-... --allow-leftovers
 */

import { MongoClient } from 'mongodb';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const USER_SCOPED_COLLECTIONS = [
  'habits', 'categories', 'goals', 'habitEntries', 'dayLogs',
  'wellbeingLogs', 'wellbeingEntries', 'routines', 'routineLogs',
  'journalEntries', 'tasks', 'goalManualLogs', 'dashboardPrefs',
];

interface CliArgs {
  from: string[];
  to: string;
  allowLeftovers: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const from: string[] = [];
  let to = '';
  let allowLeftovers = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from':
        if (args[i + 1]) from.push(args[++i]);
        break;
      case '--to':
        if (args[i + 1]) to = args[++i];
        break;
      case '--allow-leftovers':
        allowLeftovers = true;
        break;
    }
  }

  if (from.length === 0) { console.error('ERROR: at least one --from required'); process.exit(1); }
  if (!to) { console.error('ERROR: --to required'); process.exit(1); }
  return { from, to, allowLeftovers };
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
  let exitCode = 0;

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log(`\n=== Post-Migration Verification ===`);
    console.log(`DB:   ${dbName}`);
    console.log(`From: ${cli.from.join(', ')}`);
    console.log(`To:   ${cli.to}\n`);

    // 1. Target user document counts
    console.log('--- Target user document counts ---');
    for (const name of USER_SCOPED_COLLECTIONS) {
      const exists = (await db.listCollections({ name }).toArray()).length > 0;
      if (!exists) { console.log(`  ${name.padEnd(22)} (collection missing)`); continue; }
      const count = await db.collection(name).countDocuments({ userId: cli.to });
      console.log(`  ${name.padEnd(22)} ${String(count).padStart(6)}`);
    }

    // 2. Leftover check for source users
    console.log('\n--- Leftover documents for source users ---');
    let leftoversFound = false;
    for (const name of USER_SCOPED_COLLECTIONS) {
      const exists = (await db.listCollections({ name }).toArray()).length > 0;
      if (!exists) continue;
      const count = await db.collection(name).countDocuments({ userId: { $in: cli.from } });
      if (count > 0) {
        leftoversFound = true;
        console.log(`  ⚠️  ${name.padEnd(22)} ${String(count).padStart(6)} leftover docs`);
      }
    }
    if (!leftoversFound) {
      console.log('  ✅ No leftover documents for source users.');
    } else if (!cli.allowLeftovers) {
      console.log('\n  ❌ Leftover documents found. Use --allow-leftovers to suppress this error.');
      exitCode = 1;
    } else {
      console.log('\n  ⚠️  Leftovers found but --allow-leftovers is set.');
    }

    // 3. Referential integrity: habitEntry.habitId → habit owned by target
    console.log('\n--- Referential integrity: habitEntry.habitId → habits ---');
    const habitsCol = db.collection('habits');
    const entriesCol = db.collection('habitEntries');

    const targetHabitIds = new Set(
      (await habitsCol.find({ userId: cli.to }, { projection: { id: 1 } }).toArray())
        .map(h => h.id as string)
    );

    const targetEntries = await entriesCol.find(
      { userId: cli.to },
      { projection: { id: 1, habitId: 1 } }
    ).toArray();

    let orphanedEntries = 0;
    const orphanedHabitIds = new Set<string>();
    for (const entry of targetEntries) {
      if (!targetHabitIds.has(entry.habitId as string)) {
        orphanedEntries++;
        orphanedHabitIds.add(entry.habitId as string);
      }
    }

    if (orphanedEntries === 0) {
      console.log(`  ✅ All ${targetEntries.length} habitEntries reference valid habits.`);
    } else {
      console.log(`  ⚠️  ${orphanedEntries} habitEntries reference ${orphanedHabitIds.size} habit IDs not owned by target:`);
      for (const hid of [...orphanedHabitIds].slice(0, 10)) {
        console.log(`      habitId=${hid}`);
      }
      if (orphanedHabitIds.size > 10) {
        console.log(`      ... and ${orphanedHabitIds.size - 10} more`);
      }
    }

    // 4. Referential integrity: dayLog.habitId → habit owned by target
    console.log('\n--- Referential integrity: dayLog.habitId → habits ---');
    const dayLogsCol = db.collection('dayLogs');
    const targetDayLogs = await dayLogsCol.find(
      { userId: cli.to },
      { projection: { habitId: 1 } }
    ).toArray();

    let orphanedDayLogs = 0;
    const orphanedDayLogHabitIds = new Set<string>();
    for (const dl of targetDayLogs) {
      if (!targetHabitIds.has(dl.habitId as string)) {
        orphanedDayLogs++;
        orphanedDayLogHabitIds.add(dl.habitId as string);
      }
    }

    if (orphanedDayLogs === 0) {
      console.log(`  ✅ All ${targetDayLogs.length} dayLogs reference valid habits.`);
    } else {
      console.log(`  ⚠️  ${orphanedDayLogs} dayLogs reference ${orphanedDayLogHabitIds.size} habit IDs not owned by target.`);
    }

    // 5. Referential integrity: goalManualLogs.goalId → goal owned by target
    console.log('\n--- Referential integrity: goalManualLog.goalId → goals ---');
    const goalsCol = db.collection('goals');
    const manualLogsCol = db.collection('goalManualLogs');

    const targetGoalIds = new Set(
      (await goalsCol.find({ userId: cli.to }, { projection: { id: 1 } }).toArray())
        .map(g => g.id as string)
    );

    const targetManualLogs = await manualLogsCol.find(
      { userId: cli.to },
      { projection: { goalId: 1 } }
    ).toArray();

    let orphanedManualLogs = 0;
    for (const ml of targetManualLogs) {
      if (!targetGoalIds.has(ml.goalId as string)) {
        orphanedManualLogs++;
      }
    }

    if (orphanedManualLogs === 0) {
      console.log(`  ✅ All ${targetManualLogs.length} goalManualLogs reference valid goals.`);
    } else {
      console.log(`  ⚠️  ${orphanedManualLogs} goalManualLogs reference goals not owned by target.`);
    }

    console.log('\n=== Verification complete ===\n');

  } catch (err) {
    console.error('Verification failed:', err instanceof Error ? err.message : err);
    exitCode = 1;
  } finally {
    await client.close();
    process.exit(exitCode);
  }
}

main();
