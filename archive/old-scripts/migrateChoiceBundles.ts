
import { MongoClient, ObjectId } from 'mongodb';
import type { Habit, HabitEntry } from '../models/persistenceTypes.js';

// Configuration
const MONGO_URI = process.env.VITE_MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'habitflow';

async function migrateChoiceBundles() {
    console.log('Starting Choice Bundle Migration...');
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const habitsCollection = db.collection<Habit>('habits');
        const habitEntriesCollection = db.collection<HabitEntry>('habitEntries');

        // 1. Find all Legacy Choice Bundles
        // Criteria: bundleType = 'choice' AND bundleOptions exists and is not empty
        const legacyBundles = await habitsCollection.find({
            bundleType: 'choice',
            bundleOptions: { $exists: true, $not: { $size: 0 } }
        }).toArray();

        console.log(`Found ${legacyBundles.length} legacy choice bundles to migrate.`);

        for (const bundle of legacyBundles) {
            console.log(`Migrating bundle: ${bundle.name} (${bundle.id})`);

            const newSubHabitIds: string[] = [...(bundle.subHabitIds || [])];
            const optionIdMap = new Map<string, string>(); // Legacy Option ID -> New Habit ID

            if (bundle.bundleOptions) {
                for (const option of bundle.bundleOptions) {
                    console.log(`  - Processing option: ${option.label}`);

                    // Generate ID for new child habit
                    // Attempt to reuse option.id if possible, but might clash? 
                    // Safer to generate new UUID-like ID, OR use ObjectId.toString()
                    // But our system mostly uses UUIDs strings. We can use crypto.randomUUID() if available, 
                    // or just ObjectId since invalid UUID strings are fine if consistent.
                    // Let's use stringified ObjectId to ensure uniqueness and simplicity in this script context.
                    // Or crypto if available. Node 19+ has global crypto.
                    const newHabitId = new ObjectId().toHexString();

                    // Create New Child Habit
                    const metricMode = option.metricConfig?.mode || 'none';
                    const newChildHabit: Habit = {
                        id: newHabitId,
                        categoryId: bundle.categoryId,
                        name: option.label, // Use option label as name
                        description: `Option for ${bundle.name}`,
                        goal: {
                            // Inherit frequency from parent (Daily)
                            frequency: 'daily',
                            // Metric config mapping
                            type: metricMode === 'required' ? 'number' : 'boolean',
                            target: metricMode === 'required' ? 0 : 1, // Default target? Or 0 if unstated?
                            unit: option.metricConfig?.unit
                        },
                        archived: bundle.archived, // Archive if parent is archived?
                        createdAt: new Date().toISOString(), // Or inherit?
                        bundleParentId: bundle.id, // Link to parent
                        // Ensure minimal valid fields

                    };

                    await habitsCollection.insertOne(newChildHabit);
                    newSubHabitIds.push(newHabitId);
                    optionIdMap.set(option.id || option.key || '', newHabitId);
                }
            }

            // 2. Update Parent Bundle
            await habitsCollection.updateOne(
                { id: bundle.id },
                {
                    $set: {
                        subHabitIds: newSubHabitIds,
                        // Mark legacy field as migrated (optional, or just leave it for safety/rollback? 
                        // Plan said deprecate/remove. We can rename it to `_legacy_bundleOptions` or just keep it 
                        // since our code prioritizes subHabitIds now.)
                        // Let's keep it for safety but ensure subHabitIds is set.
                        // Actually, to verify migration, maybe we should clear it? 
                        // But let's follow "non-destructive" if possible, or "rename".
                        // Let's rename to `legacyBundleOptions`
                        legacyBundleOptions: bundle.bundleOptions,
                    },
                    $unset: {
                        bundleOptions: ""
                    }
                }
            );

            // 3. Migrate Habit Entries (History)
            // Find all entries for this bundle that have a bundleOptionId
            // And update them to have choiceChildHabitId

            // We need to match entries by habitId AND payload logic?
            // Actually, we can update ALL entries for this bundleId that have bundleOptionId matching the map.

            for (const [oldOptionId, newHabitId] of optionIdMap.entries()) {
                if (!oldOptionId) continue;

                const updateResult = await habitEntriesCollection.updateMany(
                    {
                        habitId: bundle.id,
                        bundleOptionId: oldOptionId
                    },
                    {
                        $set: {
                            choiceChildHabitId: newHabitId
                        }
                        // We keep bundleOptionId as deprecated fallback?
                        // Or remove it? New code checks choiceChildHabitId first.
                        // Let's keep it.
                    }
                );

                console.log(`    -> Updated ${updateResult.modifiedCount} entries for option ${oldOptionId} -> ${newHabitId}`);
            }
        }

        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
    }
}

migrateChoiceBundles();
