
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://tjgalloway:tjgalloway@habitflowai.dgdrdui.mongodb.net/?retryWrites=true&w=majority&appName=HabitFlowAI";
const DB_NAME = 'HabitFlowAI';

async function migrate() {
    console.log('Starting migration: DayLog -> HabitEntry');
    console.log(`Connecting to MongoDB...`);

    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        const db = client.db(DB_NAME);

        const dayLogsCollection = db.collection('dayLogs');
        const habitEntriesCollection = db.collection('habitEntries');

        const dayLogs = await dayLogsCollection.find({}).toArray();
        console.log(`Found ${dayLogs.length} DayLog(s).`);

        let migratedCount = 0;
        let skippedCount = 0;

        for (const log of dayLogs) {
            // Check if entry already exists for this habit+date
            const existingEntry = await habitEntriesCollection.findOne({
                habitId: log.habitId,
                date: log.date
            });

            if (existingEntry) {
                skippedCount++;
                continue;
            }

            // Determine value
            let value = 0;
            if (typeof log.value === 'number') {
                value = log.value;
            } else if (log.completed) {
                value = 1;
            }

            if (value === 0 && !log.completed) {
                // Skip empty/incomplete logs that have no value
                skippedCount++;
                continue;
            }

            const newEntry = {
                id: randomUUID(),
                habitId: log.habitId,
                userId: log.userId || 'anonymous-user', // Fallback
                date: log.date,
                value: value,
                timestamp: new Date().toISOString(), // We don't have original timestamp, use now
                source: 'migration',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await habitEntriesCollection.insertOne(newEntry);
            migratedCount++;
        }

        console.log(`Migration Complete.`);
        console.log(`Migrated: ${migratedCount}`);
        console.log(`Skipped (Exists or Empty): ${skippedCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
    }
}

migrate();
