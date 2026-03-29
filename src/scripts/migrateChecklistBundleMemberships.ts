/**
 * Migration Script: Create BundleMembership records for existing checklist bundles.
 *
 * For each existing checklist bundle with subHabitIds, creates a BundleMembership
 * record for each child habit with:
 *   - activeFromDayKey = earliest entry dayKey for the child, or child createdAt, or bundle createdAt
 *   - activeToDayKey = null (currently active)
 *   - daysOfWeek = null (daily, preserving current behavior)
 *   - graduatedAt = null
 *
 * This is a non-destructive migration. Existing subHabitIds and bundleParentId
 * fields remain intact for backward compatibility.
 *
 * Usage:
 *   npx tsx src/scripts/migrateChecklistBundleMemberships.ts
 *
 * Environment:
 *   VITE_MONGO_URI or MONGODB_URI - MongoDB connection string
 *   MONGODB_DB_NAME - Database name (defaults to 'habitflow')
 */

import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import type { Habit, HabitEntry } from '../models/persistenceTypes.js';

const MONGO_URI = process.env.MONGODB_URI || process.env.VITE_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'habitflow';

interface BundleMembershipDoc {
  id: string;
  parentHabitId: string;
  childHabitId: string;
  activeFromDayKey: string;
  activeToDayKey: string | null;
  daysOfWeek: number[] | null;
  graduatedAt: string | null;
  archivedAt: string | null;
  householdId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

function extractDayKey(dateStr: string): string {
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '2020-01-01';
}

async function migrateChecklistBundleMemberships() {
  console.log('Starting Checklist Bundle Membership Migration...');
  console.log(`  MongoDB URI: ${MONGO_URI.replace(/\/\/[^@]+@/, '//***@')}`);
  console.log(`  Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const habitsCollection = db.collection<Habit>('habits');
    const entriesCollection = db.collection<HabitEntry>('habitEntries');
    const membershipsCollection = db.collection<BundleMembershipDoc>('bundleMemberships');

    // Find all checklist bundles with subHabitIds
    const checklistBundles = await habitsCollection.find({
      type: 'bundle',
      bundleType: 'checklist',
      subHabitIds: { $exists: true, $not: { $size: 0 } },
    }).toArray();

    console.log(`Found ${checklistBundles.length} checklist bundles to migrate.`);

    let created = 0;
    let skipped = 0;

    for (const bundle of checklistBundles) {
      const householdId = (bundle as any).householdId || 'default-household';
      const userId = (bundle as any).userId || 'default-user';

      console.log(`\nMigrating checklist bundle: "${bundle.name}" (${bundle.id})`);
      console.log(`  Children: ${bundle.subHabitIds?.length ?? 0}`);

      if (!bundle.subHabitIds) continue;

      for (const childId of bundle.subHabitIds) {
        // Check if membership already exists
        const existing = await membershipsCollection.findOne({
          parentHabitId: bundle.id,
          childHabitId: childId,
          householdId,
          userId,
        });

        if (existing) {
          console.log(`  - Child ${childId}: already migrated, skipping`);
          skipped++;
          continue;
        }

        // Determine activeFromDayKey
        let activeFromDayKey: string | null = null;

        // Try earliest entry
        const earliestEntry = await entriesCollection
          .find({ habitId: childId, deletedAt: { $exists: false } })
          .sort({ dayKey: 1 })
          .limit(1)
          .toArray();

        if (earliestEntry.length > 0 && earliestEntry[0].dayKey) {
          activeFromDayKey = earliestEntry[0].dayKey;
        }

        // Try child habit createdAt
        if (!activeFromDayKey) {
          const childHabit = await habitsCollection.findOne({ id: childId });
          if (childHabit && (childHabit as any).createdAt) {
            activeFromDayKey = extractDayKey((childHabit as any).createdAt);
          }
        }

        // Try bundle createdAt
        if (!activeFromDayKey && (bundle as any).createdAt) {
          activeFromDayKey = extractDayKey((bundle as any).createdAt);
        }

        // Final fallback
        if (!activeFromDayKey) {
          activeFromDayKey = '2020-01-01';
        }

        const now = new Date().toISOString();
        const membership: BundleMembershipDoc = {
          id: randomUUID(),
          parentHabitId: bundle.id,
          childHabitId: childId,
          activeFromDayKey,
          activeToDayKey: null,
          daysOfWeek: null,
          graduatedAt: null,
          archivedAt: null,
          householdId,
          userId,
          createdAt: now,
          updatedAt: now,
        };

        await membershipsCollection.insertOne(membership as any);
        console.log(`  - Child ${childId}: created membership (from ${activeFromDayKey})`);
        created++;
      }
    }

    console.log(`\nMigration complete: ${created} created, ${skipped} skipped.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateChecklistBundleMemberships();
