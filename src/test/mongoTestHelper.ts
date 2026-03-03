/**
 * Shared MongoDB test helper using mongodb-memory-server.
 *
 * Provides an in-memory MongoDB instance so integration tests never
 * touch Atlas or any external database.
 *
 * Usage in a test file:
 *
 *   import { setupTestMongo, teardownTestMongo, getTestDb } from '../../test/mongoTestHelper';
 *
 *   beforeAll(async () => { await setupTestMongo(); });
 *   afterAll(async () => { await teardownTestMongo(); });
 *
 *   beforeEach(async () => {
 *     const db = await getTestDb();
 *     await db.collection('myCollection').deleteMany({});
 *   });
 *
 * If ALLOW_LIVE_DB_TESTS=true is set AND MONGODB_DB_NAME contains "_test",
 * the helper falls back to the real URI instead of in-memory. This allows
 * controlled live-DB integration runs in CI.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { closeConnection, getDb } from '../server/lib/mongoClient';

let mongod: MongoMemoryServer | null = null;
let originalUri: string | undefined;
let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let originalNodeEnv: string | undefined;

/**
 * Start an in-memory MongoDB and configure process.env so that
 * the app's mongoClient connects to it.
 */
export async function setupTestMongo(dbName = 'habitflowai_test'): Promise<void> {
  // Save originals
  originalUri = process.env.MONGODB_URI;
  originalDbName = process.env.MONGODB_DB_NAME;
  originalUseMongo = process.env.USE_MONGO_PERSISTENCE;
  originalNodeEnv = process.env.NODE_ENV;

  // Reset any existing singleton connection
  await closeConnection();

  const useLiveDb = process.env.ALLOW_LIVE_DB_TESTS === 'true';

  if (useLiveDb) {
    // Live DB mode: use real URI but enforce test DB name
    if (!dbName.includes('_test') && !dbName.includes('test_')) {
      throw new Error(
        `ALLOW_LIVE_DB_TESTS=true but dbName "${dbName}" does not include "_test". Aborting.`
      );
    }
    process.env.MONGODB_DB_NAME = dbName;
  } else {
    // In-memory mode (default)
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DB_NAME = dbName;
  }

  process.env.USE_MONGO_PERSISTENCE = 'true';
  process.env.NODE_ENV = 'test';
}

/**
 * Get the test DB instance (delegates to the app's getDb singleton).
 */
export async function getTestDb() {
  return getDb();
}

/**
 * Stop the in-memory MongoDB and restore original env vars.
 */
export async function teardownTestMongo(): Promise<void> {
  await closeConnection();

  if (mongod) {
    await mongod.stop();
    mongod = null;
  }

  // Restore
  if (originalUri !== undefined) process.env.MONGODB_URI = originalUri;
  else delete process.env.MONGODB_URI;

  if (originalDbName !== undefined) process.env.MONGODB_DB_NAME = originalDbName;
  else delete process.env.MONGODB_DB_NAME;

  if (originalUseMongo !== undefined) process.env.USE_MONGO_PERSISTENCE = originalUseMongo;
  else delete process.env.USE_MONGO_PERSISTENCE;

  if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
  else delete process.env.NODE_ENV;
}
