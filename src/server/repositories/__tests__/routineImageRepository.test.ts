/**
 * Routine Image Repository Tests
 *
 * Integration tests for routine image persistence.
 * Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  upsertRoutineImage,
  getRoutineImageByRoutineId,
  deleteRoutineImageByRoutineId,
} from '../routineImageRepository';

const TEST_ROUTINE_ID = 'test-routine-123';

describe('RoutineImageRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
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

