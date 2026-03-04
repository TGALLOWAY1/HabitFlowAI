/**
 * Debug and dev-only route registration: not exposed in production.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('debug and dev-only routes', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('NODE_ENV=production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('GET /api/debug/whoami is not registered and returns 404', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/debug/whoami')
        .set('X-Household-Id', 'h1')
        .set('X-User-Id', 'u1');
      expect(res.status).toBe(404);
    });

    it('POST /api/dev/seedDemoEmotionalWellbeing is not registered and returns 404', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/dev/seedDemoEmotionalWellbeing')
        .set('X-Household-Id', 'h1')
        .set('X-User-Id', 'u1')
        .send({});
      expect(res.status).toBe(404);
    });

    it('POST /api/dev/resetDemoEmotionalWellbeing is not registered and returns 404', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/dev/resetDemoEmotionalWellbeing')
        .set('X-Household-Id', 'h1')
        .set('X-User-Id', 'u1')
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('NODE_ENV !== production (dev smoke)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('GET /api/debug/whoami is registered and returns identity + env info', async () => {
      const app = createApp();
      const res = await request(app).get('/api/debug/whoami');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('householdId');
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('nodeEnv');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
