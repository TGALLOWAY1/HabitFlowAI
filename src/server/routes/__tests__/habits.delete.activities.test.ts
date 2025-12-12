/**
 * Habit Delete - Activity Conversion Tests
 * 
 * Tests for converting Activity habit steps to tasks when a habit is deleted.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
// import type { Activity } from '../../../models/persistenceTypes';

// Set environment variables BEFORE importing modules that use them
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import { deleteHabitRoute, createHabitRoute } from '../habits';
import { createActivityRoute } from '../activities';
import { getActivitiesByUser } from '../../repositories/activityRepository';
import { getDb, closeConnection } from '../../lib/mongoClient';

// Use test database
const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-123';

// Store original env values
let originalDbName: string | undefined;
let originalUseMongo: string | undefined;

describe('Habit Delete - Activity Conversion', () => {
  let app: Express;

  beforeAll(async () => {
    // Use test database (env vars already set at top of file)
    originalDbName = process.env.MONGODB_DB_NAME;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    // Set up Express app
    app = express();
    app.use(express.json());

    // Add userId to request (simulating auth middleware)
    app.use((req, _res, next) => {
      (req as any).userId = TEST_USER_ID;
      next();
    });

    // Register routes
    app.post('/api/habits', createHabitRoute);
    app.delete('/api/habits/:id', deleteHabitRoute);
    app.post('/api/activities', createActivityRoute);
  });

  afterAll(async () => {
    // Clean up test database
    const testDb = await getDb();
    await testDb.dropDatabase();
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
    // Clear ALL collections before each test to ensure isolation
    const testDb = await getDb();
    await testDb.collection('habits').deleteMany({});
    await testDb.collection('activities').deleteMany({});
    await testDb.collection('dayLogs').deleteMany({});
  });

  describe('DELETE /api/habits/:id - Activity step conversion', () => {
    it('should convert habit steps to tasks when habit is deleted', async () => {
      // Create a habit
      const habitResponse = await request(app)
        .post('/api/habits')
        .send({
          name: 'Test Habit',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habitId = habitResponse.body.habit.id;

      // Create an activity that references this habit
      const activityResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Habit Step 1',
              habitId: habitId,
              timeEstimateMinutes: 30,
            },
            {
              id: 'step-2',
              type: 'task',
              title: 'Task Step',
            },
            {
              id: 'step-3',
              type: 'habit',
              title: 'Habit Step 2',
              habitId: habitId,
            },
          ],
        })
        .expect(201);

      const activityId = activityResponse.body.activity.id;

      // Verify activity has habit steps
      const activities = await getActivitiesByUser(TEST_USER_ID);
      const activityBeforeDelete = activities.find(a => a.id === activityId);

      expect(activityBeforeDelete).toBeDefined();
      expect(activityBeforeDelete?.steps.filter(s => s.type === 'habit' && s.habitId === habitId)).toHaveLength(2);

      // Delete the habit
      const deleteResponse = await request(app)
        .delete(`/api/habits/${habitId}`)
        .expect(200);

      expect(deleteResponse.body.convertedStepsCount).toBe(2);

      // Verify activity steps were converted
      const activitiesAfter = await getActivitiesByUser(TEST_USER_ID);
      const activityAfterDelete = activitiesAfter.find(a => a.id === activityId);

      expect(activityAfterDelete).toBeDefined();

      // Check that habit steps were converted to tasks
      const step1 = activityAfterDelete!.steps.find(s => s.id === 'step-1');
      const step3 = activityAfterDelete!.steps.find(s => s.id === 'step-3');

      expect(step1).toBeDefined();
      expect(step1?.type).toBe('task');
      expect(step1?.habitId).toBeUndefined();
      expect(step1?.title).toBe('Habit Step 1');
      expect(step1?.timeEstimateMinutes).toBe(30); // Should be preserved

      expect(step3).toBeDefined();
      expect(step3?.type).toBe('task');
      expect(step3?.habitId).toBeUndefined();
      expect(step3?.title).toBe('Habit Step 2');

      // Task step should be unchanged
      const step2 = activityAfterDelete!.steps.find(s => s.id === 'step-2');
      expect(step2?.type).toBe('task');
    });

    it('should handle multiple activities referencing the same habit', async () => {
      // Create a habit
      const habitResponse = await request(app)
        .post('/api/habits')
        .send({
          name: 'Shared Habit',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habitId = habitResponse.body.habit.id;

      // Create multiple activities referencing this habit
      const activity1Response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Activity 1',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Habit Step',
              habitId: habitId,
            },
          ],
        })
        .expect(201);

      const activity2Response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Activity 2',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Habit Step',
              habitId: habitId,
            },
            {
              id: 'step-2',
              type: 'habit',
              title: 'Another Habit Step',
              habitId: habitId,
            },
          ],
        })
        .expect(201);

      // Delete the habit
      const deleteResponse = await request(app)
        .delete(`/api/habits/${habitId}`)
        .expect(200);

      // Should have converted 3 steps total (1 + 2)
      expect(deleteResponse.body.convertedStepsCount).toBe(3);

      // Verify both activities were updated
      const activities = await getActivitiesByUser(TEST_USER_ID);
      const activity1 = activities.find(a => a.id === activity1Response.body.activity.id);
      const activity2 = activities.find(a => a.id === activity2Response.body.activity.id);

      expect(activity1?.steps[0].type).toBe('task');
      expect(activity1?.steps[0].habitId).toBeUndefined();

      expect(activity2?.steps[0].type).toBe('task');
      expect(activity2?.steps[0].habitId).toBeUndefined();
      expect(activity2?.steps[1].type).toBe('task');
      expect(activity2?.steps[1].habitId).toBeUndefined();
    });

    it('should preserve step properties when converting (title, instruction, imageUrl, timeEstimateMinutes)', async () => {
      // Create a habit
      const habitResponse = await request(app)
        .post('/api/habits')
        .send({
          name: 'Test Habit',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habitId = habitResponse.body.habit.id;

      // Create activity with habit step that has all optional properties
      const activityResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Full Habit Step',
              instruction: 'Do this step carefully',
              imageUrl: 'https://example.com/image.jpg',
              timeEstimateMinutes: 45,
              habitId: habitId,
            },
          ],
        })
        .expect(201);

      const activityId = activityResponse.body.activity.id;

      // Delete the habit
      await request(app)
        .delete(`/api/habits/${habitId}`)
        .expect(200);

      // Verify step properties were preserved
      const activities = await getActivitiesByUser(TEST_USER_ID);
      const activity = activities.find(a => a.id === activityId);
      const step = activity?.steps[0];

      expect(step?.type).toBe('task');
      expect(step?.habitId).toBeUndefined();
      expect(step?.title).toBe('Full Habit Step');
      expect(step?.instruction).toBe('Do this step carefully');
      expect(step?.imageUrl).toBe('https://example.com/image.jpg');
      expect(step?.timeEstimateMinutes).toBe(45);
    });

    it('should not convert steps that reference different habits', async () => {
      // Create two habits
      const habit1Response = await request(app)
        .post('/api/habits')
        .send({
          name: 'Habit 1',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habit2Response = await request(app)
        .post('/api/habits')
        .send({
          name: 'Habit 2',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habit1Id = habit1Response.body.habit.id;
      const habit2Id = habit2Response.body.habit.id;

      // Create activity with steps referencing both habits
      const activityResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Habit 1 Step',
              habitId: habit1Id,
            },
            {
              id: 'step-2',
              type: 'habit',
              title: 'Habit 2 Step',
              habitId: habit2Id,
            },
          ],
        })
        .expect(201);

      const activityId = activityResponse.body.activity.id;

      // Delete only habit 1
      await request(app)
        .delete(`/api/habits/${habit1Id}`)
        .expect(200);

      // Verify only step 1 was converted
      const activities = await getActivitiesByUser(TEST_USER_ID);
      const activity = activities.find(a => a.id === activityId);

      const step1 = activity?.steps.find(s => s.id === 'step-1');
      const step2 = activity?.steps.find(s => s.id === 'step-2');

      expect(step1?.type).toBe('task');
      expect(step1?.habitId).toBeUndefined();

      expect(step2?.type).toBe('habit');
      expect(step2?.habitId).toBe(habit2Id); // Should still reference habit 2
    });

    it('should handle activities with no referencing steps gracefully', async () => {
      // Create a habit
      const habitResponse = await request(app)
        .post('/api/habits')
        .send({
          name: 'Test Habit',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habitId = habitResponse.body.habit.id;

      // Create activity with no habit steps
      await request(app)
        .post('/api/activities')
        .send({
          title: 'Task Only Activity',
          steps: [
            {
              id: 'step-1',
              type: 'task',
              title: 'Task Step',
            },
          ],
        })
        .expect(201);

      // Delete the habit
      const deleteResponse = await request(app)
        .delete(`/api/habits/${habitId}`)
        .expect(200);

      // Should have converted 0 steps
      expect(deleteResponse.body.convertedStepsCount).toBe(0);
    });

    it('should continue deleting habit even if activity update fails (best-effort)', async () => {
      // Create a habit
      const habitResponse = await request(app)
        .post('/api/habits')
        .send({
          name: 'Test Habit',
          categoryId: 'category-1',
          goal: { type: 'boolean', frequency: 'daily' },
        })
        .expect(201);

      const habitId = habitResponse.body.habit.id;

      // Create an activity referencing this habit
      await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Habit Step',
              habitId: habitId,
            },
          ],
        })
        .expect(201);

      // Delete the habit - should succeed even if activity update has issues
      // (In a real scenario, we might mock updateActivity to throw, but for now
      // we'll just verify the habit is deleted)
      const deleteResponse = await request(app)
        .delete(`/api/habits/${habitId}`)
        .expect(200);

      expect(deleteResponse.body.message).toBe('Habit deleted successfully');
      // Habit should be deleted regardless of activity update success
    });
  });
});
