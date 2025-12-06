/**
 * Activity Repository Tests
 * 
 * Integration tests for the Activity repository.
 * Requires MongoDB to be running (use test database).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, Db } from 'mongodb';
import type { Activity, ActivityStep } from '../../../models/persistenceTypes';

// Set environment variables BEFORE importing modules that use them
// This ensures the env module reads the correct values
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import {
  createActivity,
  getActivitiesByUser,
  getActivityById,
  updateActivity,
  deleteActivity,
} from '../activityRepository';
import { getDb, closeConnection } from '../../lib/mongoClient';

// Use test database
const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-123';
const OTHER_USER_ID = 'other-user-456';

// Store original env values
let originalDbName: string | undefined;
let originalUseMongo: string | undefined;
let testClient: MongoClient | null = null;

describe('ActivityRepository', () => {
  let testDb: Db;

  beforeAll(async () => {
    // Use test database (env vars already set at top of file)
    originalDbName = process.env.MONGODB_DB_NAME;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    // Get test database
    testDb = await getDb();
    
    // Get client from MongoDB URI for cleanup
    const uri = process.env.MONGODB_URI;
    if (uri) {
      testClient = new MongoClient(uri);
      await testClient.connect();
    }
  });

  afterAll(async () => {
    // Clean up test database
    if (testClient) {
      const adminDb = testClient.db(TEST_DB_NAME);
      await adminDb.dropDatabase();
      await testClient.close();
    }
    
    await closeConnection();

    // Restore original env
    if (originalDbName) {
      process.env.MONGODB_DB_NAME = originalDbName;
    } else {
      delete process.env.MONGODB_DB_NAME;
    }
    if (originalUseMongo) {
      process.env.USE_MONGO_PERSISTENCE = originalUseMongo;
    } else {
      delete process.env.USE_MONGO_PERSISTENCE;
    }
  });

  beforeEach(async () => {
    // Clear ALL activities collection before each test to ensure isolation
    const db = await getDb();
    await db.collection('activities').deleteMany({});
  });

  describe('createActivity', () => {
    it('should create a new activity', async () => {
      const activityData: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: 'Morning Routine',
        steps: [
          {
            id: 'step-1',
            type: 'task',
            title: 'Wake up',
            instruction: 'Get out of bed',
          },
        ],
      };

      const activity = await createActivity(activityData, TEST_USER_ID);

      expect(activity).toBeDefined();
      expect(activity.id).toBeDefined();
      expect(activity.title).toBe(activityData.title);
      expect(activity.steps).toHaveLength(1);
      expect(activity.steps[0].title).toBe('Wake up');
      expect(activity.createdAt).toBeDefined();
      expect(activity.updatedAt).toBeDefined();
      expect(activity.createdAt).toBe(activity.updatedAt); // Should be same on creation
    });

    it('should store activity with userId in database', async () => {
      const activityData: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: 'Test Activity',
        steps: [],
      };

      const activity = await createActivity(activityData, TEST_USER_ID);

      const stored = await testDb.collection('activities').findOne({ id: activity.id });
      expect(stored).toBeDefined();
      expect(stored?.userId).toBe(TEST_USER_ID);
    });

    it('should create activity with habit step', async () => {
      const activityData: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: 'Workout Activity',
        steps: [
          {
            id: 'step-1',
            type: 'habit',
            title: 'Morning Run',
            habitId: 'habit-123',
            timeEstimateMinutes: 30,
          },
        ],
      };

      const activity = await createActivity(activityData, TEST_USER_ID);

      expect(activity.steps).toHaveLength(1);
      expect(activity.steps[0].type).toBe('habit');
      expect(activity.steps[0].habitId).toBe('habit-123');
      expect(activity.steps[0].timeEstimateMinutes).toBe(30);
    });
  });

  describe('getActivitiesByUser', () => {
    it('should return empty array when user has no activities', async () => {
      const activities = await getActivitiesByUser(TEST_USER_ID);
      expect(activities).toEqual([]);
    });

    it('should return only activities for the specified user', async () => {
      // Create activities for test user
      await createActivity(
        { title: 'User Activity 1', steps: [] },
        TEST_USER_ID
      );
      await createActivity(
        { title: 'User Activity 2', steps: [] },
        TEST_USER_ID
      );

      // Create activity for other user
      await createActivity(
        { title: 'Other User Activity', steps: [] },
        OTHER_USER_ID
      );

      const activities = await getActivitiesByUser(TEST_USER_ID);

      expect(activities).toHaveLength(2);
      expect(activities.every(a => a.title.startsWith('User Activity'))).toBe(true);
      expect(activities.some(a => a.title === 'Other User Activity')).toBe(false);
    });
  });

  describe('getActivityById', () => {
    it('should return null for non-existent activity', async () => {
      const activity = await getActivityById('non-existent-id', TEST_USER_ID);
      expect(activity).toBeNull();
    });

    it('should return activity if it exists and belongs to user', async () => {
      const created = await createActivity(
        { title: 'Test Activity', steps: [] },
        TEST_USER_ID
      );

      const activity = await getActivityById(created.id, TEST_USER_ID);

      expect(activity).toBeDefined();
      expect(activity?.id).toBe(created.id);
      expect(activity?.title).toBe('Test Activity');
    });

    it('should return null if activity belongs to different user', async () => {
      const created = await createActivity(
        { title: 'Test Activity', steps: [] },
        OTHER_USER_ID
      );

      const activity = await getActivityById(created.id, TEST_USER_ID);
      expect(activity).toBeNull();
    });
  });

  describe('updateActivity', () => {
    it('should update activity title', async () => {
      const created = await createActivity(
        { title: 'Original Title', steps: [] },
        TEST_USER_ID
      );

      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await updateActivity(
        created.id,
        TEST_USER_ID,
        { title: 'Updated Title' }
      );

      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.steps).toEqual([]); // Unchanged
      expect(updated?.updatedAt).not.toBe(originalUpdatedAt); // Should be updated
      expect(updated?.createdAt).toBe(created.createdAt); // Should not change
    });

    it('should update activity steps', async () => {
      const created = await createActivity(
        {
          title: 'Test Activity',
          steps: [
            { id: 'step-1', type: 'task', title: 'Step 1' },
          ],
        },
        TEST_USER_ID
      );

      const newSteps: ActivityStep[] = [
        { id: 'step-1', type: 'task', title: 'Updated Step 1' },
        { id: 'step-2', type: 'task', title: 'New Step 2' },
      ];

      const updated = await updateActivity(
        created.id,
        TEST_USER_ID,
        { steps: newSteps }
      );

      expect(updated).toBeDefined();
      expect(updated?.steps).toHaveLength(2);
      expect(updated?.steps[0].title).toBe('Updated Step 1');
      expect(updated?.steps[1].title).toBe('New Step 2');
    });

    it('should update updatedAt timestamp on any change', async () => {
      const created = await createActivity(
        { title: 'Test Activity', steps: [] },
        TEST_USER_ID
      );

      const originalUpdatedAt = created.updatedAt;

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await updateActivity(
        created.id,
        TEST_USER_ID,
        { title: 'New Title' }
      );

      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });

    it('should return null if activity does not exist', async () => {
      const updated = await updateActivity(
        'non-existent-id',
        TEST_USER_ID,
        { title: 'Updated Title' }
      );

      expect(updated).toBeNull();
    });

    it('should return null if activity belongs to different user', async () => {
      const created = await createActivity(
        { title: 'Test Activity', steps: [] },
        OTHER_USER_ID
      );

      const updated = await updateActivity(
        created.id,
        TEST_USER_ID,
        { title: 'Updated Title' }
      );

      expect(updated).toBeNull();
    });
  });

  describe('deleteActivity', () => {
    it('should delete activity and return true', async () => {
      const created = await createActivity(
        { title: 'Test Activity', steps: [] },
        TEST_USER_ID
      );

      const deleted = await deleteActivity(created.id, TEST_USER_ID);

      expect(deleted).toBe(true);

      // Verify it's gone
      const activity = await getActivityById(created.id, TEST_USER_ID);
      expect(activity).toBeNull();
    });

    it('should return false if activity does not exist', async () => {
      const deleted = await deleteActivity('non-existent-id', TEST_USER_ID);
      expect(deleted).toBe(false);
    });

    it('should return false if activity belongs to different user', async () => {
      const created = await createActivity(
        { title: 'Test Activity', steps: [] },
        OTHER_USER_ID
      );

      const deleted = await deleteActivity(created.id, TEST_USER_ID);
      expect(deleted).toBe(false);
    });
  });

  describe('create → get → update → delete flow', () => {
    it('should complete full CRUD lifecycle', async () => {
      // Create
      const activityData: Omit<Activity, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
        title: 'Full Lifecycle Activity',
        steps: [
          { id: 'step-1', type: 'task', title: 'Initial Step' },
        ],
      };

      const created = await createActivity(activityData, TEST_USER_ID);
      expect(created).toBeDefined();
      expect(created.title).toBe('Full Lifecycle Activity');

      // Get
      const retrieved = await getActivityById(created.id, TEST_USER_ID);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe(created.title);
      expect(retrieved?.steps).toHaveLength(1);

      // Update
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = await updateActivity(
        created.id,
        TEST_USER_ID,
        {
          title: 'Updated Lifecycle Activity',
          steps: [
            { id: 'step-1', type: 'task', title: 'Updated Step' },
            { id: 'step-2', type: 'task', title: 'New Step' },
          ],
        }
      );
      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Lifecycle Activity');
      expect(updated?.steps).toHaveLength(2);

      // Delete
      const deleted = await deleteActivity(created.id, TEST_USER_ID);
      expect(deleted).toBe(true);

      // Verify deletion
      const afterDelete = await getActivityById(created.id, TEST_USER_ID);
      expect(afterDelete).toBeNull();
    });
  });
});
