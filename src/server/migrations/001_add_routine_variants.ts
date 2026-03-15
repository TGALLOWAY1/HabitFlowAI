/**
 * Migration 001: Add Routine Variants
 *
 * Converts all existing routines to single-variant format.
 * Each routine's steps and linkedHabitIds move into a "Default" variant.
 *
 * This migration is IDEMPOTENT: it skips routines that already have variants.
 *
 * Usage:
 *   npx tsx src/server/migrations/001_add_routine_variants.ts [--dry-run]
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import type { Routine, RoutineVariant } from '../../models/persistenceTypes';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate(): Promise<void> {
  console.log(`\n=== Migration 001: Add Routine Variants ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('');

  const db = await getDb();
  const collection = db.collection(MONGO_COLLECTIONS.ROUTINES);

  // Count all routines
  const totalCount = await collection.countDocuments();
  console.log(`Total routines in collection: ${totalCount}`);

  // Find routines that need migration (no variants field or empty variants)
  const toMigrate = await collection
    .find({
      $or: [
        { variants: { $exists: false } },
        { variants: { $size: 0 } },
      ]
    })
    .toArray();

  const alreadyMigrated = totalCount - toMigrate.length;
  console.log(`Already migrated: ${alreadyMigrated}`);
  console.log(`To migrate: ${toMigrate.length}`);
  console.log('');

  if (toMigrate.length === 0) {
    console.log('Nothing to migrate. All routines already have variants.');
    return;
  }

  let migratedCount = 0;
  let errorCount = 0;

  for (const doc of toMigrate) {
    const routine = doc as unknown as Routine & { _id: any };
    const routineId = routine.id || String(doc._id);

    try {
      const now = new Date().toISOString();
      const variantId = randomUUID();

      // Compute estimated duration from existing steps
      const steps = routine.steps || [];
      const totalSeconds = steps.reduce(
        (acc: number, step: any) => acc + (step.timerSeconds || 60), 0
      );
      const estimatedMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

      const defaultVariant: RoutineVariant = {
        id: variantId,
        name: 'Default',
        estimatedDurationMinutes: estimatedMinutes,
        sortOrder: 0,
        steps: steps,
        linkedHabitIds: routine.linkedHabitIds || [],
        isAiGenerated: false,
        createdAt: routine.createdAt || now,
        updatedAt: now,
      };

      if (DRY_RUN) {
        console.log(`  [DRY] Would migrate routine "${routine.title}" (${routineId}): ${steps.length} steps → 1 variant "${defaultVariant.name}" (${estimatedMinutes} min)`);
      } else {
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              defaultVariantId: variantId,
              variants: [defaultVariant],
              steps: [], // Clear root-level steps
              updatedAt: now,
            }
          }
        );
        console.log(`  [OK] Migrated routine "${routine.title}" (${routineId}): ${steps.length} steps → variant "${defaultVariant.name}"`);
      }

      migratedCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [ERROR] Failed to migrate routine ${routineId}: ${message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log(`=== Migration Complete ===`);
  console.log(`Migrated: ${migratedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped (already migrated): ${alreadyMigrated}`);

  // Post-migration verification
  if (!DRY_RUN && migratedCount > 0) {
    const verifyCount = await collection.countDocuments({
      variants: { $exists: true, $not: { $size: 0 } }
    });
    console.log(`\nVerification: ${verifyCount} / ${totalCount} routines now have variants`);

    if (verifyCount !== totalCount) {
      console.warn(`WARNING: ${totalCount - verifyCount} routines still lack variants!`);
    }
  }
}

/**
 * Rollback: Restore root-level steps from the first variant.
 */
export async function rollback(): Promise<void> {
  console.log(`\n=== Rollback: Remove Routine Variants ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  const db = await getDb();
  const collection = db.collection(MONGO_COLLECTIONS.ROUTINES);

  const withVariants = await collection.find({
    variants: { $exists: true, $not: { $size: 0 } }
  }).toArray();

  console.log(`Routines with variants to rollback: ${withVariants.length}`);

  for (const doc of withVariants) {
    const routine = doc as any;
    const firstVariant = routine.variants?.[0];

    if (!firstVariant) continue;

    if (DRY_RUN) {
      console.log(`  [DRY] Would rollback "${routine.title}": restore ${firstVariant.steps?.length || 0} steps from variant "${firstVariant.name}"`);
    } else {
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            steps: firstVariant.steps || [],
            linkedHabitIds: firstVariant.linkedHabitIds || [],
            updatedAt: new Date().toISOString(),
          },
          $unset: {
            variants: '',
            defaultVariantId: '',
          }
        }
      );
      console.log(`  [OK] Rolled back "${routine.title}"`);
    }
  }

  console.log('\nRollback complete.');
}

// Run migration when executed directly
if (process.argv[1]?.includes('001_add_routine_variants')) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
