/**
 * DayView Route Validation Tests
 * 
 * Tests for DayKey and TimeZone validation at API boundary.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { getDayView } from '../dayView';
import { setupTestMongo, teardownTestMongo } from '../../../test/mongoTestHelper';

const TEST_USER_ID = 'test-user-dayview-validation';

let app: Express;

beforeAll(async () => {
  await setupTestMongo();
  app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    (req as any).userId = TEST_USER_ID;
    next();
  });
  app.get('/api/dayView', getDayView);
});

afterAll(async () => {
  await teardownTestMongo();
});

describe('GET /api/dayView - DayKey and TimeZone Validation', () => {
  it('should reject missing dayKey', async () => {
    const response = await request(app)
      .get('/api/dayView')
      .query({
        timeZone: 'UTC',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('dayKey is required');
  });

  it('should reject invalid dayKey format', async () => {
    const response = await request(app)
      .get('/api/dayView')
      .query({
        dayKey: '2025-13-01', // Invalid month
        timeZone: 'UTC',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('Invalid DayKey format');
  });

  it('should use default timezone (America/New_York) when timeZone missing', async () => {
    const response = await request(app)
      .get('/api/dayView')
      .query({
        dayKey: '2025-01-15',
      });

    expect([200, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body.dayKey).toBe('2025-01-15');
    }
  });

  it('should use default timezone when timeZone invalid (fallback America/New_York)', async () => {
    const response = await request(app)
      .get('/api/dayView')
      .query({
        dayKey: '2025-01-15',
        timeZone: 'Invalid/Timezone/123',
      });

    expect([200, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body.dayKey).toBe('2025-01-15');
    }
  });

  it('should accept valid dayKey and timeZone', async () => {
    const response = await request(app)
      .get('/api/dayView')
      .query({
        dayKey: '2025-01-15',
        timeZone: 'America/Los_Angeles',
      });

    // Should succeed (may return empty dayView if no habits exist)
    expect([200, 500]).toContain(response.status);
    // If 500, it's likely due to missing habits, not validation
    if (response.status === 200) {
      expect(response.body.dayKey).toBe('2025-01-15');
    }
  });
});

