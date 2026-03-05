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

    it('GET /api/debug/whoami requires session in production (401; route not registered)', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/api/debug/whoami')
        .set('X-Household-Id', 'h1')
        .set('X-User-Id', 'u1');
      expect(res.status).toBe(401);
    });

    it('POST /api/dev/seedDemoEmotionalWellbeing requires session in production (401; route not registered)', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/dev/seedDemoEmotionalWellbeing')
        .set('X-Household-Id', 'h1')
        .set('X-User-Id', 'u1')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/dev/resetDemoEmotionalWellbeing requires session in production (401; route not registered)', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/dev/resetDemoEmotionalWellbeing')
        .set('X-Household-Id', 'h1')
        .set('X-User-Id', 'u1')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('NODE_ENV !== production (dev smoke)', () => {
    const originalDemoMode = process.env.DEMO_MODE_ENABLED;

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.DEMO_MODE_ENABLED = 'true';
    });

    afterEach(() => {
      process.env.DEMO_MODE_ENABLED = originalDemoMode;
    });

    it('GET /api/debug/whoami is registered and returns identity + env info', async () => {
      const app = createApp();
      const res = await request(app).get('/api/debug/whoami');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('householdId');
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('identitySource');
      expect(res.body).toHaveProperty('nodeEnv');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
