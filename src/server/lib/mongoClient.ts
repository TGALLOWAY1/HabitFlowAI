/**
 * MongoDB Client Utility
 * 
 * Provides a singleton MongoDB connection that is safely reused across requests.
 * Handles connection lifecycle and error handling.
 */

import { MongoClient, Db } from 'mongodb';
import type { MongoClientOptions, CreateIndexesOptions } from 'mongodb';
import { getMongoDbUri, getMongoDbName } from '../config/env';

// Singleton client instance
let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<MongoClient> | null = null;
let indexesEnsuredForDbName: string | null = null;

const HABIT_ENTRIES_UNIQUE_INDEX_NAME = 'idx_habitEntries_user_habit_dayKey_active_unique';
const DEDUPE_INSTRUCTIONS =
  'Run the dedupe script to collapse duplicate active entries (see docs/audits/m2_writepaths_daykey_map.md or docs/debug/db-config.md).';

function isTestEnv(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    !!process.env.VITEST ||
    !!process.env.JEST_WORKER_ID
  );
}

/** Returns count of (userId, habitId, dayKey) groups that have more than one active doc. */
async function countDuplicateActiveHabitEntryKeys(database: Db): Promise<number> {
  const coll = database.collection('habitEntries');
  const cursor = coll.aggregate<{ count: number }>([
    { $match: { deletedAt: { $exists: false } } },
    {
      $group: {
        _id: {
          userId: '$userId',
          habitId: '$habitId',
          dayKey: { $ifNull: ['$dayKey', '$date'] },
        },
        n: { $sum: 1 },
      },
    },
    { $match: { n: { $gt: 1 } } },
    { $count: 'count' },
  ]);
  const result = await cursor.next();
  return result?.count ?? 0;
}

async function ensureHabitEntriesUniqueIndex(database: Db): Promise<void> {
  const coll = database.collection('habitEntries');

  // In test, skip duplicate check (aggregation) to avoid slowness; in dev/prod detect duplicates and warn (do not create unique index until deduped).
  if (!isTestEnv()) {
    const duplicateCount = await countDuplicateActiveHabitEntryKeys(database);
    if (duplicateCount > 0) {
      const msg = `[MongoDB] Duplicate active habit entries detected (${duplicateCount} duplicate keys). ${DEDUPE_INSTRUCTIONS}`;
      console.warn(msg);
      return;
    }
  }

  // Optional: skip index creation in test for even faster runs (set SKIP_HABIT_ENTRY_INDEX_IN_TEST=1).
  if (isTestEnv() && (process.env.SKIP_HABIT_ENTRY_INDEX_IN_TEST === '1' || process.env.SKIP_HABIT_ENTRY_INDEX_IN_TEST === 'true')) {
    return;
  }

  // One document per (userId, habitId, dayKey). Soft-delete sets deletedAt on that doc; we do not use a second doc.
  // Partial index with $exists: false is not supported in all MongoDB versions, so we use a full unique index.
  try {
    await coll.createIndex(
      { userId: 1, habitId: 1, dayKey: 1 },
      { unique: true, name: HABIT_ENTRIES_UNIQUE_INDEX_NAME }
    );
  } catch (error: unknown) {
    const code = (error as { code?: number })?.code;
    if (code === 85 || code === 86) {
      return;
    }
    throw error;
  }
}

async function ensureCoreIndexes(database: Db): Promise<void> {
  if (indexesEnsuredForDbName === database.databaseName) {
    return;
  }

  const createIndexSafe = async (
    collectionName: string,
    keys: Record<string, 1 | -1>,
    options?: CreateIndexesOptions
  ) => {
    try {
      await database.collection(collectionName).createIndex(keys, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[MongoDB] Failed to ensure index on ${collectionName}: ${message}`);
    }
  };

  await createIndexSafe('habitEntries', { userId: 1, id: 1 }, { unique: true, name: 'idx_habitEntries_user_id_unique' });
  await createIndexSafe('habitEntries', { userId: 1, habitId: 1, timestamp: -1 }, { name: 'idx_habitEntries_user_habit_timestamp' });
  await createIndexSafe('dayLogs', { userId: 1, compositeKey: 1 }, { unique: true, name: 'idx_dayLogs_user_composite_unique' });
  await createIndexSafe('dayLogs', { userId: 1, habitId: 1, date: 1 }, { name: 'idx_dayLogs_user_habit_date' });

  await ensureHabitEntriesUniqueIndex(database);

  if (!isTestEnv()) {
    console.log('[MongoDB] Indexes ensured (habitEntries unique active: userId, habitId, dayKey)');
  }
  indexesEnsuredForDbName = database.databaseName;
}

/**
 * Get the MongoDB database instance.
 * 
 * Uses a singleton pattern to reuse the same connection across requests.
 * If the connection doesn't exist, it creates a new one.
 * 
 * @returns Promise<Db> - The MongoDB database instance
 * @throws Error if MONGODB_URI or MONGODB_DB_NAME environment variables are not set
 * @throws Error if MongoDB connection fails
 */
export async function getDb(): Promise<Db> {
  const runIndexEnsurance = async (database: Db): Promise<void> => {
    try {
      await ensureCoreIndexes(database);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[MongoDB] Index assurance failed (continuing with DB):', msg);
    }
  };

  // Return existing database instance if available
  if (db && client) {
    // Verify connection is still alive
    try {
      await client.db().admin().ping();
      await runIndexEnsurance(db);
      return db;
    } catch {
      // Connection is dead, reset and reconnect
      console.warn('MongoDB connection lost, reconnecting...');
      client = null;
      db = null;
      connectionPromise = null;
    }
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    const connectedClient = await connectionPromise;
    db = connectedClient.db(getMongoDbName());
    await runIndexEnsurance(db);
    return db;
  }

  // Create new connection
  connectionPromise = connectToMongo();

  try {
    const connectedClient = await connectionPromise;
    db = connectedClient.db(getMongoDbName());
    await runIndexEnsurance(db);
    return db;
  } catch (error) {
    // Reset connection promise on error so we can retry
    connectionPromise = null;
    throw error;
  }
}

/**
 * Connect to MongoDB.
 * 
 * @returns Promise<MongoClient> - The connected MongoDB client
 * @throws Error if MONGODB_URI is not set
 * @throws Error if connection fails
 */
async function connectToMongo(): Promise<MongoClient> {
  const uri = getMongoDbUri();
  const dbName = getMongoDbName();

  if (!uri) {
    throw new Error(
      'MONGODB_URI environment variable is not set. ' +
      'Please set it in your .env file or environment.'
    );
  }

  if (!dbName) {
    throw new Error(
      'MONGODB_DB_NAME environment variable is not set. ' +
      'Please set it in your .env file or environment.'
    );
  }

  // Hard guard: reject non-test DB names when running in a test context.
  // Detects test runners even if NODE_ENV was not explicitly set.
  const isTestEnv = process.env.NODE_ENV === 'test'
    || !!process.env.VITEST
    || !!process.env.JEST_WORKER_ID;

  if (isTestEnv) {
    const TEST_DB_PATTERN = /(_test|test_)/i;
    if (!TEST_DB_PATTERN.test(dbName)) {
      throw new Error(
        `🛑 SAFETY ABORT: Refusing to connect to non-test database "${dbName}" ` +
        `in a test environment (NODE_ENV=${process.env.NODE_ENV}, ` +
        `VITEST=${!!process.env.VITEST}, JEST=${!!process.env.JEST_WORKER_ID}). ` +
        `DB name must contain "_test" or "test_".`
      );
    }
  }

  console.log(`Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//***@')} (database: ${dbName})`);

  const options: MongoClientOptions = {
    // Connection pool settings
    maxPoolSize: 10,
    minPoolSize: 1,
    // Connection timeout
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    // Retry settings
    retryWrites: true,
    retryReads: true,
    // Mitigate IPv4/IPv6 TLS issues with MongoDB Atlas
    autoSelectFamily: false,
  };

  try {
    client = new MongoClient(uri, options);

    // Test the connection
    await client.connect();

    // Verify we can access the database
    await client.db(dbName).admin().ping();

    const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    let host = 'unknown';
    try {
      const parsed = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
      host = parsed.hostname;
    } catch { /* keep 'unknown' */ }

    console.log(`✅ Connected Mongo: host=${host} db=${dbName} NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`);
    console.log(`   Full URI (sanitized): ${sanitizedUri}`);
    console.log(`   MONGODB_URI present: ${!!process.env.MONGODB_URI}`);
    console.log(`   MONGODB_DB_NAME present: ${!!process.env.MONGODB_DB_NAME} (value: ${process.env.MONGODB_DB_NAME ?? '(unset)'})`);
    console.log(`   USE_MONGO_PERSISTENCE: ${process.env.USE_MONGO_PERSISTENCE ?? '(unset)'}`);

    return client;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to connect to MongoDB:', errorMessage);

    // Clean up on failure
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      client = null;
    }

    throw new Error(
      `MongoDB connection failed: ${errorMessage}. ` +
      'Please check your MONGODB_URI and ensure MongoDB is running.'
    );
  }
}

/**
 * Close the MongoDB connection.
 * 
 * Should be called during application shutdown (e.g., in a cleanup handler).
 * 
 * @returns Promise<void>
 */
export async function closeConnection(): Promise<void> {
  if (client) {
    try {
      await client.close();
      console.log('MongoDB connection closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error closing MongoDB connection:', errorMessage);
    } finally {
      client = null;
      db = null;
      connectionPromise = null;
      indexesEnsuredForDbName = null;
    }
  }
}

/**
 * Check if MongoDB connection is active.
 * 
 * @returns Promise<boolean> - True if connection is active, false otherwise
 */
export async function isConnected(): Promise<boolean> {
  if (!client || !db) {
    return false;
  }

  try {
    await client.db().admin().ping();
    return true;
  } catch {
    return false;
  }
}

export { HABIT_ENTRIES_UNIQUE_INDEX_NAME };
