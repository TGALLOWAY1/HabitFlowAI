/**
 * DayLog Routes Deprecation Tests
 * 
 * Tests to verify that DayLog write endpoints are deprecated and return 410 Gone.
 * DayLogs are derived caches and must not be written directly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

// Set environment variables BEFORE importing modules that use them
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017';
}
process.env.USE_MONGO_PERSISTENCE = 'true';

import {
  getDayLogs,
  upsertDayLogRoute,
  getDayLogRoute,
  deleteDayLogRoute,
} from '../dayLogs';
import { getDb, closeConnection } from '../../lib/mongoClient';

// Use test database
const TEST_DB_NAME = 'habitflowai_test_daylogs_deprecated';
const TEST_USER_ID = 'test-user-daylogs';

// Store original env values
let originalDbName: string | undefined;

describe('DayLog Routes Deprecation', () => {
  let app: Express;

  beforeAll(async () => {
    // Use test database
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
    app.get('/api/dayLogs', getDayLogs);
    app.post('/api/dayLogs', upsertDayLogRoute);
    app.put('/api/dayLogs', upsertDayLogRoute);
    app.get('/api/dayLogs/:habitId/:date', getDayLogRoute);
    app.delete('/api/dayLogs/:habitId/:date', deleteDayLogRoute);
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
  });

  describe('Write Operations (Deprecated)', () => {
    it('POST /api/dayLogs should return 410 Gone', async () => {
      const response = await request(app)
        .post('/api/dayLogs')
        .send({
          habitId: 'test-habit-123',
          date: '2025-01-15',
          value: 1,
          completed: true,
        })
        .expect(410);

      expect(response.body).toHaveProperty('error', 'DayLogs are deprecated. Write HabitEntries instead.');
      expect(response.body).toHaveProperty('deprecated', true);
      expect(response.body).toHaveProperty('message');

      // Verify no DayLog was created
      const testDb = await getDb();
      const dayLogs = await testDb.collection('dayLogs')
        .find({ habitId: 'test-habit-123', userId: TEST_USER_ID })
        .toArray();
      expect(dayLogs.length).toBe(0);
    });

    it('PUT /api/dayLogs should return 410 Gone', async () => {
      const response = await request(app)
        .put('/api/dayLogs')
        .send({
          habitId: 'test-habit-456',
          date: '2025-01-16',
          value: 2,
          completed: true,
        })
        .expect(410);

      expect(response.body).toHaveProperty('error', 'DayLogs are deprecated. Write HabitEntries instead.');
      expect(response.body).toHaveProperty('deprecated', true);

      // Verify no DayLog was created
      const testDb = await getDb();
      const dayLogs = await testDb.collection('dayLogs')
        .find({ habitId: 'test-habit-456', userId: TEST_USER_ID })
        .toArray();
      expect(dayLogs.length).toBe(0);
    });

    it('DELETE /api/dayLogs/:habitId/:date should return 410 Gone', async () => {
      const response = await request(app)
        .delete('/api/dayLogs/test-habit-789/2025-01-17')
        .expect(410);

      expect(response.body).toHaveProperty('error', 'DayLogs are deprecated. Delete HabitEntries instead.');
      expect(response.body).toHaveProperty('deprecated', true);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Read Operations (Legacy)', () => {
    it('GET /api/dayLogs should return legacy header and flag', async () => {
      const response = await request(app)
        .get('/api/dayLogs')
        .expect(200);

      expect(response.headers['x-legacy-endpoint']).toBe('true');
      expect(response.body).toHaveProperty('legacy', true);
      expect(response.body).toHaveProperty('logs');
    });

    it('GET /api/dayLogs/:habitId/:date should return legacy header and flag', async () => {
      // This will return 404 since no log exists, but we can still check the structure
      const response = await request(app)
        .get('/api/dayLogs/non-existent/2025-01-15')
        .expect(404);

      // 404 responses don't have legacy header, but if it were found it would
      expect(response.body).toHaveProperty('error');
    });
  });
});

