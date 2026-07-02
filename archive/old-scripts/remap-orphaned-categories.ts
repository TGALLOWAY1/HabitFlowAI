/**
 * One-off migration: Remap orphaned habits to correct current categories
 * and delete habits from intentionally deleted categories.
 *
 * Usage:
 *   npx tsx scripts/remap-orphaned-categories.ts          # dry-run
 *   npx tsx scripts/remap-orphaned-categories.ts --commit  # apply changes
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME ?? 'habitflow';
const USER_ID = '8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env');
  process.exit(1);
}

// Current valid categories
const CURRENT_CATEGORIES: Record<string, string> = {
  '6dd79806-1583-4e22-a389-3c2beb1b14a7': 'Career & Growth',
  '2d78ad09-8c64-46f5-93ce-ca2f1dae2686': 'Creativity & Skill',
  '912acdfb-919c-4d98-8a9a-06bf147dde0c': 'Dog / Home',
  '925882ba-8c4c-40a6-82f6-cf545c73a1b6': 'Fitness',
  '0ef45a5e-1410-4fe9-8077-ace81bcb4372': 'MUST',
  '2a20ec7c-b31d-4fce-bf34-a5d6be3bb0d4': 'Mental Health',
  'ddc8a96a-dba5-4e69-8e6f-7d530f9cb4d7': 'Music',
  '34012431-c138-4aa3-a944-74612ed96420': 'Physical Health',
};

// Remap: orphaned categoryId → correct current categoryId
const CATEGORY_REMAP: Record<string, string> = {
  // Health/fitness habits → Physical Health
  '5074ca56-d283-4fc0-9198-b498dc4aee55': '34012431-c138-4aa3-a944-74612ed96420',
  // Mental health habits → Mental Health
  '6a8eb375-7719-4cd9-bd43-1284812daac6': '2a20ec7c-b31d-4fce-bf34-a5d6be3bb0d4',
  // Music practice → Music
  '0c449f1a-b963-4769-a1e7-b7a7f945d174': 'ddc8a96a-dba5-4e69-8e6f-7d530f9cb4d7',
  // Music creation → Music
  '0ccde244-6d85-4912-8650-33232eef0c71': 'ddc8a96a-dba5-4e69-8e6f-7d530f9cb4d7',
  // Dog/home habits → Dog / Home
  '7cd693f8-264c-4063-b723-67ad3c571bb0': '912acdfb-919c-4d98-8a9a-06bf147dde0c',
  // Relationships/emotional → Mental Health
  '1457f138-6a2f-4653-b8ff-8b61ce2ab70c': '2a20ec7c-b31d-4fce-bf34-a5d6be3bb0d4',
  // Study/career → Career & Growth
  '004235d2-2da8-4bcf-b74d-27499d6e1d7f': '6dd79806-1583-4e22-a389-3c2beb1b14a7',
  // Skills → Career & Growth
  '6a927b1b-dbfa-4f8d-9129-a50a80b1ad9e': '6dd79806-1583-4e22-a389-3c2beb1b14a7',
  // Financial → Career & Growth
  '60bf544c-8a35-4305-b66e-3ca8baabbd59': '6dd79806-1583-4e22-a389-3c2beb1b14a7',
  // Dog habit → Dog / Home
  '090ed5e2-95d9-4bbe-be08-68e1f2213eec': '912acdfb-919c-4d98-8a9a-06bf147dde0c',
  // Mindfulness → Mental Health
  '0b1e0e36-8980-4f5a-8c81-e31195d558cc': '2a20ec7c-b31d-4fce-bf34-a5d6be3bb0d4',
  // Money → Career & Growth
  '94a0d999-f71c-4773-8658-d6a923f548f2': '6dd79806-1583-4e22-a389-3c2beb1b14a7',
  // Learning → Career & Growth
  'c2dca331-e0c7-47e7-a944-3076a6f7baf3': '6dd79806-1583-4e22-a389-3c2beb1b14a7',
  // Job → Career & Growth
  '9fb3135d-38b4-4ae8-aac6-620d33ef9a31': '6dd79806-1583-4e22-a389-3c2beb1b14a7',
};

// Category IDs whose habits should be deleted (category was intentionally removed)
const DELETE_FROM_CATEGORIES = [
  'bdf3da35-32e8-4920-8b00-8f8204299df7', // Deleted "Romantic" category
  '2ac4763b-65e1-432d-863a-446261026049', // Dev artifact
  '03ce0aff-96e8-409a-9ff0-7ee61532e341', // Dev artifact
];

async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== Remap Orphaned Categories (${commit ? 'COMMIT' : 'DRY-RUN'}) ===\n`);

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);
  const habitsColl = db.collection('habits');

  try {
    // Get all habits for this user
    const allHabits = await habitsColl.find({ userId: USER_ID }).toArray();
    console.log(`Total habits: ${allHabits.length}`);

    const currentCategoryIds = new Set(Object.keys(CURRENT_CATEGORIES));

    // Find orphaned habits
    const orphaned = allHabits.filter(h => !currentCategoryIds.has(h.categoryId));
    console.log(`Orphaned habits (referencing non-existent categories): ${orphaned.length}`);

    // Plan: habits to remap
    const toRemap = orphaned.filter(h => CATEGORY_REMAP[h.categoryId]);
    console.log(`\n--- Habits to REMAP (${toRemap.length}) ---`);
    for (const h of toRemap) {
      const targetId = CATEGORY_REMAP[h.categoryId];
      const targetName = CURRENT_CATEGORIES[targetId];
      console.log(`  "${h.name}" → ${targetName} (${h.categoryId.slice(0, 8)}... → ${targetId.slice(0, 8)}...)`);
    }

    // Plan: habits to delete
    const deleteSet = new Set(DELETE_FROM_CATEGORIES);
    const toDelete = orphaned.filter(h => deleteSet.has(h.categoryId));
    console.log(`\n--- Habits to DELETE (${toDelete.length}) ---`);
    for (const h of toDelete) {
      console.log(`  "${h.name}" (categoryId: ${h.categoryId.slice(0, 8)}...)`);
    }

    // Check for any uncovered orphans
    const coveredIds = new Set([...Object.keys(CATEGORY_REMAP), ...DELETE_FROM_CATEGORIES]);
    const uncovered = orphaned.filter(h => !coveredIds.has(h.categoryId));
    if (uncovered.length > 0) {
      console.log(`\n--- UNCOVERED orphaned habits (${uncovered.length}) ---`);
      for (const h of uncovered) {
        console.log(`  "${h.name}" (categoryId: ${h.categoryId})`);
      }
    }

    if (!commit) {
      console.log('\n*** DRY-RUN — no changes made. Pass --commit to apply. ***\n');
      await client.close();
      return;
    }

    // --- Apply changes ---
    console.log('\n--- Applying changes ---');

    // 1. Remap habits
    let remappedCount = 0;
    for (const [oldCatId, newCatId] of Object.entries(CATEGORY_REMAP)) {
      const r = await habitsColl.updateMany(
        { userId: USER_ID, categoryId: oldCatId },
        { $set: { categoryId: newCatId } }
      );
      remappedCount += r.modifiedCount;
    }
    console.log(`Remapped: ${remappedCount} habits`);

    // 2. Delete habits from removed categories
    if (DELETE_FROM_CATEGORIES.length > 0) {
      const r = await habitsColl.deleteMany({
        userId: USER_ID,
        categoryId: { $in: DELETE_FROM_CATEGORIES },
      });
      console.log(`Deleted: ${r.deletedCount} habits`);
    }

    // 3. Verify: count remaining orphaned habits
    const remaining = await habitsColl.find({ userId: USER_ID }).toArray();
    const stillOrphaned = remaining.filter(h => !currentCategoryIds.has(h.categoryId));
    console.log(`\n--- Verification ---`);
    console.log(`Total habits after: ${remaining.length}`);
    console.log(`Orphaned habits remaining: ${stillOrphaned.length}`);
    if (stillOrphaned.length > 0) {
      for (const h of stillOrphaned) {
        console.log(`  "${h.name}" (categoryId: ${h.categoryId})`);
      }
    }

    // 4. Show per-category breakdown
    console.log(`\n--- Per-category breakdown ---`);
    const byCat = new Map<string, number>();
    for (const h of remaining) {
      byCat.set(h.categoryId, (byCat.get(h.categoryId) ?? 0) + 1);
    }
    for (const [catId, count] of byCat) {
      const name = CURRENT_CATEGORIES[catId] ?? '(unknown)';
      console.log(`  ${name}: ${count} habits`);
    }

    console.log('\n*** COMMITTED — changes applied. ***\n');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
