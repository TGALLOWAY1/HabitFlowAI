/**
 * Routine Image Repository Tests
 *
 * Integration tests for routine image persistence.
 * Requires MongoDB (uses test database).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { getDb, closeConnection } from '../../lib/mongoClient';
import {
  upsertRoutineImage,
  getRoutineImageByRoutineId,
  deleteRoutineImageByRoutineId,
} from '../routineImageRepository';

const TEST_DB_NAME = 'habitflowai_test';
const TEST_ROUTINE_ID = 'test-routine-123';

let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let testClient: MongoClient | null = null;

describe('RoutineImageRepository', () => {
  beforeAll(async () => {
    originalDbName = process.env.MONGODB_DB_NAME;
    originalUseMongo = process.env.USE_MONGO_PERSISTENCE;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    await getDb();

    const uri = process.env.MONGODB_URI;
    if (uri) {
      testClient = new MongoClient(uri);
      await testClient.connect();
    }
  });

  afterAll(async () => {
    if (testClient) {
      const adminDb = testClient.db(TEST_DB_NAME);
      await adminDb.dropDatabase();
      await testClient.close();
    }
    await closeConnection();

    if (originalDbName) process.env.MONGODB_DB_NAME = originalDbName;
    else delete process.env.MONGODB_DB_NAME;
    if (originalUseMongo) process.env.USE_MONGO_PERSISTENCE = originalUseMongo;
    else delete process.env.USE_MONGO_PERSISTENCE;
  });

  beforeEach(async () => {
    const db = await getDb();
    await db.collection('routineImages').deleteMany({});
  });

  it('should upsert and retrieve an image', async () => {
    const testData = Buffer.from('fake-image-data');
    const contentType = 'image/jpeg';

    const result = await upsertRoutineImage({
      routineId: TEST_ROUTINE_ID,
      contentType,
      data: testData,
    });

    expect(result.imageId).toBe(TEST_ROUTINE_ID);

    const retrieved = await getRoutineImageByRoutineId(TEST_ROUTINE_ID);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.contentType).toBe(contentType);
    expect(retrieved?.data).toEqual(testData);
  });

  it('should return null for non-existent image', async () => {
    const retrieved = await getRoutineImageByRoutineId('non-existent-routine');
    expect(retrieved).toBeNull();
  });

  it('should update existing image on upsert', async () => {
    const initialData = Buffer.from('initial-data');
    const updatedData = Buffer.from('updated-data');

    await upsertRoutineImage({
      routineId: TEST_ROUTINE_ID,
      contentType: 'image/png',
      data: initialData,
    });

    await upsertRoutineImage({
      routineId: TEST_ROUTINE_ID,
      contentType: 'image/jpeg',
      data: updatedData,
    });

    const retrieved = await getRoutineImageByRoutineId(TEST_ROUTINE_ID);
    expect(retrieved?.contentType).toBe('image/jpeg');
    expect(retrieved?.data).toEqual(updatedData);
  });

  it('should delete an image', async () => {
    const testData = Buffer.from('test-data');

    await upsertRoutineImage({
      routineId: TEST_ROUTINE_ID,
      contentType: 'image/png',
      data: testData,
    });

    await deleteRoutineImageByRoutineId(TEST_ROUTINE_ID);

    const retrieved = await getRoutineImageByRoutineId(TEST_ROUTINE_ID);
    expect(retrieved).toBeNull();
  });
});

