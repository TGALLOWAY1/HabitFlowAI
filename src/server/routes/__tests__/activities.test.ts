/**
 * Activity Routes Tests
 * 
 * Tests for Activity REST API endpoints.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import type { Activity, ActivityStep } from '../../../models/persistenceTypes';

// Set environment variables BEFORE importing modules that use them
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import {
  getActivities,
  getActivity,
  createActivityRoute,
  replaceActivityRoute,
  updateActivityRoute,
  deleteActivityRoute,
} from '../activities';
import { getDb, closeConnection } from '../../lib/mongoClient';

// Use test database
const TEST_DB_NAME = 'habitflowai_test';
const TEST_USER_ID = 'test-user-123';
const OTHER_USER_ID = 'other-user-456';

// Store original env values
let originalDbName: string | undefined;
let originalUseMongo: string | undefined;

describe('Activity Routes', () => {
  let app: Express;

  beforeAll(async () => {
    // Use test database (env vars already set at top of file)
    originalDbName = process.env.MONGODB_DB_NAME;
    process.env.MONGODB_DB_NAME = TEST_DB_NAME;

    // Set up Express app
    app = express();
    app.use(express.json());

    // Add userId to request (simulating auth middleware)
    app.use((req, res, next) => {
      (req as any).userId = TEST_USER_ID;
      next();
    });

    // Register routes
    app.get('/api/activities', getActivities);
    app.post('/api/activities', createActivityRoute);
    app.get('/api/activities/:id', getActivity);
    app.put('/api/activities/:id', replaceActivityRoute);
    app.patch('/api/activities/:id', updateActivityRoute);
    app.delete('/api/activities/:id', deleteActivityRoute);
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
    // Clear ALL activities collection before each test to ensure isolation
    const testDb = await getDb();
    await testDb.collection('activities').deleteMany({});
  });

  describe('GET /api/activities', () => {
    it('should return empty array when no activities exist', async () => {
      const response = await request(app)
        .get('/api/activities')
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body.activities).toEqual([]);
    });

    it('should return activities list with id, title, and steps count', async () => {
      // Create test activities
      await request(app)
        .post('/api/activities')
        .send({
          title: 'Activity 1',
          steps: [
            { id: 'step-1', type: 'task', title: 'Step 1' },
            { id: 'step-2', type: 'task', title: 'Step 2' },
          ],
        })
        .expect(201);

      await request(app)
        .post('/api/activities')
        .send({
          title: 'Activity 2',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(201);

      const response = await request(app)
        .get('/api/activities')
        .expect(200);

      expect(response.body.activities).toHaveLength(2);
      expect(response.body.activities[0]).toHaveProperty('id');
      expect(response.body.activities[0]).toHaveProperty('title');
      expect(response.body.activities[0]).toHaveProperty('stepsCount');
      expect(response.body.activities[0].stepsCount).toBe(2);
      expect(response.body.activities[1].stepsCount).toBe(1);
    });
  });

  describe('POST /api/activities', () => {
    it('should create a new activity', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            { id: 'step-1', type: 'task', title: 'Step 1' },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('activity');
      expect(response.body.activity.title).toBe('Test Activity');
      expect(response.body.activity.steps).toHaveLength(1);
      expect(response.body.activity).toHaveProperty('id');
      expect(response.body.activity).toHaveProperty('createdAt');
      expect(response.body.activity).toHaveProperty('updatedAt');
    });

    it('should create activity with habit step', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Habit Activity',
          steps: [
            {
              id: 'step-1',
              type: 'habit',
              title: 'Morning Run',
              habitId: 'habit-123',
              timeEstimateMinutes: 30,
            },
          ],
        })
        .expect(201);

      expect(response.body.activity.steps[0].type).toBe('habit');
      expect(response.body.activity.steps[0].habitId).toBe('habit-123');
      expect(response.body.activity.steps[0].timeEstimateMinutes).toBe(30);
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('title');
    });

    it('should return 400 if title is empty string', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: '',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if steps is missing', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('steps');
    });

    it('should return 400 if steps is not an array', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: 'not-an-array',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if step id is missing', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            { type: 'task', title: 'Step 1' }, // Missing id
          ],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('id');
    });

    it('should return 400 if step type is invalid', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            { id: 'step-1', type: 'invalid', title: 'Step 1' },
          ],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('type');
    });

    it('should return 400 if habit step missing habitId', async () => {
      const response = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            { id: 'step-1', type: 'habit', title: 'Step 1' }, // Missing habitId
          ],
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('habitId');
    });
  });

  describe('GET /api/activities/:id', () => {
    it('should return activity by ID (POST → GET roundtrip)', async () => {
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [
            { id: 'step-1', type: 'task', title: 'Step 1' },
            { id: 'step-2', type: 'habit', title: 'Step 2', habitId: 'habit-123' },
          ],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      const response = await request(app)
        .get(`/api/activities/${activityId}`)
        .expect(200);

      expect(response.body.activity.id).toBe(activityId);
      expect(response.body.activity.title).toBe('Test Activity');
      expect(response.body.activity.steps).toHaveLength(2);
      expect(response.body.activity.steps[0].type).toBe('task');
      expect(response.body.activity.steps[1].type).toBe('habit');
      expect(response.body.activity.steps[1].habitId).toBe('habit-123');
    });

    it('should return 404 if activity not found', async () => {
      const response = await request(app)
        .get('/api/activities/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 when accessing another user\'s activity', async () => {
      // Create activity with test user
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      // Try to access with different user
      const otherUserApp = express();
      otherUserApp.use(express.json());
      otherUserApp.use((req, res, next) => {
        (req as any).userId = OTHER_USER_ID;
        next();
      });
      otherUserApp.get('/api/activities/:id', getActivity);

      const response = await request(otherUserApp)
        .get(`/api/activities/${activityId}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/activities/:id', () => {
    it('should replace activity (full update)', async () => {
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Original Title',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      const response = await request(app)
        .put(`/api/activities/${activityId}`)
        .send({
          title: 'Updated Title',
          steps: [
            { id: 'step-1', type: 'task', title: 'New Step 1' },
            { id: 'step-2', type: 'task', title: 'New Step 2' },
          ],
        })
        .expect(200);

      expect(response.body.activity.title).toBe('Updated Title');
      expect(response.body.activity.steps).toHaveLength(2);
      expect(response.body.activity.steps[0].title).toBe('New Step 1');
    });

    it('should return 404 if activity not found', async () => {
      const response = await request(app)
        .put('/api/activities/non-existent-id')
        .send({
          title: 'Test',
          steps: [],
        })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/activities/:id', () => {
    it('should partially update activity title', async () => {
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Original Title',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      const response = await request(app)
        .patch(`/api/activities/${activityId}`)
        .send({
          title: 'Updated Title',
        })
        .expect(200);

      expect(response.body.activity.title).toBe('Updated Title');
      expect(response.body.activity.steps).toHaveLength(1); // Unchanged
    });

    it('should partially update activity steps', async () => {
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      const response = await request(app)
        .patch(`/api/activities/${activityId}`)
        .send({
          steps: [
            { id: 'step-1', type: 'task', title: 'Updated Step 1' },
            { id: 'step-2', type: 'task', title: 'New Step 2' },
          ],
        })
        .expect(200);

      expect(response.body.activity.steps).toHaveLength(2);
      expect(response.body.activity.steps[0].title).toBe('Updated Step 1');
      expect(response.body.activity.title).toBe('Test Activity'); // Unchanged
    });

    it('should return 400 if no fields provided', async () => {
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      const response = await request(app)
        .patch(`/api/activities/${activityId}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if activity not found', async () => {
      const response = await request(app)
        .patch('/api/activities/non-existent-id')
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/activities/:id', () => {
    it('should delete activity', async () => {
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [{ id: 'step-1', type: 'task', title: 'Step 1' }],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      await request(app)
        .delete(`/api/activities/${activityId}`)
        .expect(200);

      // Verify it's deleted
      await request(app)
        .get(`/api/activities/${activityId}`)
        .expect(404);
    });

    it('should return 404 if activity not found', async () => {
      const response = await request(app)
        .delete('/api/activities/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 when trying to delete another user\'s activity', async () => {
      // Create activity with test user
      const createResponse = await request(app)
        .post('/api/activities')
        .send({
          title: 'Test Activity',
          steps: [],
        })
        .expect(201);

      const activityId = createResponse.body.activity.id;

      // Try to delete with different user
      const otherUserApp = express();
      otherUserApp.use(express.json());
      otherUserApp.use((req, res, next) => {
        (req as any).userId = OTHER_USER_ID;
        next();
      });
      otherUserApp.delete('/api/activities/:id', deleteActivityRoute);

      const response = await request(otherUserApp)
        .delete(`/api/activities/${activityId}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
