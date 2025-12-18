
// Load env vars first
import './src/server/config/env';
import { getDb, closeConnection } from './src/server/lib/mongoClient';
import { getMongoDbName } from './src/server/config/env';

async function checkGoal() {
    console.log("Checking DB:", getMongoDbName());

    try {
        const db = await getDb();
        const collection = db.collection('goals'); // Goals collection

        const goal = await collection.findOne({ title: "Run 100 miles" });

        if (goal) {
            console.log("Goal Found:", goal.title, `(${goal.id})`);
            console.log("Linked Habit IDs:", goal.linkedHabitIds);

            // Check if the problematic ID is in there
            const problemId = "7ada237a-c21c-4841-92b2-7dd7902b731b";
            if (goal.linkedHabitIds && goal.linkedHabitIds.includes(problemId)) {
                console.log("!!! FOUND DATA INTEGRITY ISSUE !!!");
                console.log("Goal references deleted habit:", problemId);
            } else {
                console.log("Problem ID not found in goal links.");
            }
        } else {
            console.log("Goal 'Run 100 miles' not found.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await closeConnection();
    }
}

checkGoal();
