
// Load env vars first
import './src/server/config/env';
import { getDb, closeConnection } from './src/server/lib/mongoClient';
import { getMongoDbName } from './src/server/config/env';

const HABIT_ID = "7ada237a-c21c-4841-92b2-7dd7902b731b";
const USER_ID = "8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb";

async function checkHabit() {
    console.log("Checking DB:", getMongoDbName());

    try {
        const db = await getDb();
        console.log("Connected to DB instance");

        const collection = db.collection('habits');

        // Check by ID only
        const byId = await collection.findOne({ id: HABIT_ID });
        console.log("Found by ID only:", byId ? "YES" : "NO");
        if (byId) {
            console.log("  Owner:", byId.userId);
            console.log("  Name:", byId.name);
        }

        // Check recent habits
        const count = await collection.countDocuments();
        console.log("Total habits in collection:", count);

        const recent = await collection.find().sort({ createdAt: -1 }).limit(3).toArray();
        console.log("Recent 3 habits:");
        recent.forEach(h => console.log(` - ${h.name} (${h.id}) [User: ${h.userId}]`));

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await closeConnection();
    }
}

checkHabit();
