/**
 * Migration Script: Create BundleMembership records for existing choice bundles.
 *
 * For each existing choice bundle with subHabitIds, creates a BundleMembership
 * record for each child habit with:
 *   - activeFromDayKey = earliest entry dayKey for the child, or child createdAt, or bundle createdAt
 *   - activeToDayKey = null (currently active)
 *
 * This is a non-destructive migration. Existing subHabitIds and bundleParentId
 * fields remain intact for backward compatibility.
 *
 * Usage:
 *   npx tsx src/scripts/migrateBundleMemberships.ts
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
  archivedAt: string | null;
  householdId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

function extractDayKey(dateStr: string): string {
  // Extract YYYY-MM-DD from ISO string or return as-is if already DayKey format
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '2020-01-01'; // fallback
}

async function migrateBundleMemberships() {
  console.log('Starting Bundle Membership Migration...');
  console.log(`  MongoDB URI: ${MONGO_URI.replace(/\/\/[^@]+@/, '//***@')}`);
  console.log(`  Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const habitsCollection = db.collection<Habit>('habits');
    const entriesCollection = db.collection<HabitEntry>('habitEntries');
    const membershipsCollection = db.collection<BundleMembershipDoc>('bundleMemberships');

    // Find all choice bundles with subHabitIds
    const choiceBundles = await habitsCollection.find({
      type: 'bundle',
      bundleType: 'choice',
      subHabitIds: { $exists: true, $not: { $size: 0 } },
    }).toArray();

    console.log(`Found ${choiceBundles.length} choice bundles to migrate.`);

    // Check for existing memberships to avoid duplicates
    const existingCount = await membershipsCollection.countDocuments();
    if (existingCount > 0) {
      console.log(`WARNING: ${existingCount} existing membership records found. Skipping already-migrated pairs.`);
    }

    let created = 0;
    let skipped = 0;

    for (const bundle of choiceBundles) {
      const householdId = (bundle as any).householdId || 'default-household';
      const userId = (bundle as any).userId || 'default-user';

      console.log(`\nMigrating bundle: "${bundle.name}" (${bundle.id})`);
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

        // Determine activeFromDayKey:
        // 1. Earliest entry dayKey for this child
        // 2. Child habit createdAt
        // 3. Bundle createdAt
        // 4. Fallback: '2020-01-01'
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

    // Create indexes
    console.log('\nCreating indexes...');
    await membershipsCollection.createIndex(
      { householdId: 1, userId: 1, parentHabitId: 1, activeFromDayKey: 1 }
    );
    await membershipsCollection.createIndex(
      { householdId: 1, userId: 1, childHabitId: 1 }
    );
    await membershipsCollection.createIndex(
      { householdId: 1, userId: 1, parentHabitId: 1, activeToDayKey: 1 }
    );

    console.log(`\nMigration complete: ${created} created, ${skipped} skipped.`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateBundleMemberships();
