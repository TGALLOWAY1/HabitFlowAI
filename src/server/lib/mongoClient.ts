/**
 * MongoDB Client Utility
 * 
 * Provides a singleton MongoDB connection that is safely reused across requests.
 * Handles connection lifecycle and error handling.
 */

import { MongoClient, Db, MongoClientOptions } from 'mongodb';
import { getMongoDbUri, getMongoDbName } from '../config/env';

// Singleton client instance
let client: MongoClient | null = null;
let db: Db | null = null;
let connectionPromise: Promise<MongoClient> | null = null;

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
  // Return existing database instance if available
  if (db && client) {
    // Verify connection is still alive
    try {
      await client.db().admin().ping();
      return db;
    } catch (error) {
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
    return db;
  }

  // Create new connection
  connectionPromise = connectToMongo();
  
  try {
    const connectedClient = await connectionPromise;
    db = connectedClient.db(getMongoDbName());
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
  };

  try {
    client = new MongoClient(uri, options);
    
    // Test the connection
    await client.connect();
    
    // Verify we can access the database
    await client.db(dbName).admin().ping();
    
    console.log(`Successfully connected to MongoDB database: ${dbName}`);
    
    return client;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to connect to MongoDB:', errorMessage);
    
    // Clean up on failure
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
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

