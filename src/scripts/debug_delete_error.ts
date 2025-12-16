
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'HabitFlowAI';

async function checkHabit() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(DB_NAME);
        const habitsCollection = db.collection('habits');

        const targetId = 'f5154ee8-a391-4327-8cc3-8663c84ce09e'; // The curl created ID

        console.log(`Checking for habit with ID: ${targetId}`);

        const query: any = { id: targetId };
        // Try to check if it's a valid ObjectId before constructing
        if (targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId)) {
            query.$or = [{ _id: new ObjectId(targetId) }, { id: targetId }];
        }

        console.log(`Checking for habit with ID: ${targetId}`);
        const habit = await habitsCollection.findOne(query);

        if (habit) {
            console.log('Habit FOUND:', JSON.stringify(habit, null, 2));
        } else {
            console.log('Habit NOT FOUND.');
        }

        // Also listing all habits to see if we can find the parent bundle 'Calisthenics'
        const calisthenics = await habitsCollection.findOne({ name: 'Calisthenics' });
        if (calisthenics) {
            console.log('Parent Bundle FOUND:', JSON.stringify(calisthenics, null, 2));
        } else {
            console.log('Parent Bundle NOT FOUND.');
        }

        console.log('\n--- Inspecting Calisthenics Bundle & Children ---');

        const bundle = await habitsCollection.findOne({ name: 'Calisthenics' });
        if (bundle) {
            console.log('Parent Bundle:', JSON.stringify(bundle, null, 2));

            if (bundle.subHabitIds && bundle.subHabitIds.length > 0) {
                const children = await habitsCollection.find({ id: { $in: bundle.subHabitIds } }).toArray();
                console.log('Children:', JSON.stringify(children, null, 2));
            } else {
                console.log('Bundle has no subHabitIds.');
            }
        } else {
            console.log('Calisthenics bundle NOT FOUND.');
        }

        // Also check specifically for Push ups and Pull ups by name to be sure
        const specificHabits = await habitsCollection.find({ name: { $in: ['Push ups', 'Pull ups', 'Push Ups', 'Pull Ups'] } }).toArray();
        console.log('Specific Habits found by name:', JSON.stringify(specificHabits, null, 2));

        console.log('\n--- Listing All Habits ---');
        const allHabits = await habitsCollection.find({}).toArray();
        allHabits.forEach(h => console.log(`- ${h.name} (ID: ${h.id || h._id})`));
        console.log(`Total Habits: ${allHabits.length}`);

    } catch (error) {
        console.error('Error checking habit:', error);
    } finally {
        await client.close();
    }
}

checkHabit();
