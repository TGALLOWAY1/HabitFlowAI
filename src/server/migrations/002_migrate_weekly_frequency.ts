/**
 * Migration 002: Migrate Weekly Frequency to timesPerWeek
 *
 * Converts habits that use the old `frequency: 'weekly'` model to the new
 * `timesPerWeek` field. Also normalizes `goal.frequency: 'weekly'` to `'daily'`.
 *
 * This migration is IDEMPOTENT: it only updates habits that still have the
 * old fields set.
 *
 * Changes per habit:
 * - Sets `timesPerWeek = weeklyTarget || goal.target || 1`
 * - Sets `goal.frequency = 'daily'`
 * - Unsets `frequency` and `weeklyTarget` (legacy top-level fields)
 *
 * Usage:
 *   npx tsx src/server/migrations/002_migrate_weekly_frequency.ts [--dry-run]
 */

import { getDb } from '../lib/mongoClient';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate(): Promise<void> {
  console.log(`\n=== Migration 002: Migrate Weekly Frequency to timesPerWeek ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('');

  const db = await getDb();
  const collection = db.collection('habits');

  // Find habits with legacy weekly frequency (either top-level or in goal)
  const legacyHabits = await collection.find({
    $or: [
      { frequency: 'weekly' },
      { 'goal.frequency': 'weekly' },
    ],
  }).toArray();

  console.log(`Found ${legacyHabits.length} habits with legacy weekly frequency`);

  let updated = 0;
  let skipped = 0;

  for (const habit of legacyHabits) {
    const name = habit.name || habit.id;
    const userId = habit.userId;

    // Derive timesPerWeek from old fields
    const timesPerWeek = habit.weeklyTarget ?? habit.goal?.target ?? 1;

    console.log(`  [${userId}] "${name}" → timesPerWeek=${timesPerWeek}`);

    if (!DRY_RUN) {
      await collection.updateOne(
        { _id: habit._id },
        {
          $set: {
            timesPerWeek,
            'goal.frequency': 'daily',
          },
          $unset: {
            frequency: '',
            weeklyTarget: '',
          },
        }
      );
      updated++;
    } else {
      skipped++;
    }
  }

  console.log('');
  console.log(`Results: ${updated} updated, ${skipped} skipped (dry-run)`);
  console.log('=== Migration 002 complete ===\n');
}

// Auto-run when executed directly (not when imported)
const isDirectRun = process.argv[1]?.includes('002_migrate_weekly_frequency');
if (isDirectRun) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export { migrate as migrateWeeklyFrequency };
