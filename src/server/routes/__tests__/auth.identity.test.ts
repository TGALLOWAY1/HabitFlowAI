/**
 * Auth identity route tests: GET /api/auth/me
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { identityMiddleware } from '../../middleware/identity';
import { getAuthMe } from '../auth';

describe('GET /api/auth/me', () => {
  let app: Express;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoMode = process.env.DEMO_MODE_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEMO_MODE_ENABLED = originalDemoMode;
  });

  beforeEach(() => {
    app = express();
    app.use(identityMiddleware);
    app.get('/api/auth/me', getAuthMe);
  });

  it('returns householdId and userId when demo mode and identity headers are provided', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_MODE_ENABLED = 'true';

    const response = await request(app)
      .get('/api/auth/me')
      .set('X-Household-Id', 'house-abc')
      .set('X-User-Id', 'user-xyz')
      .expect(200);

    expect(response.body).toEqual({
      householdId: 'house-abc',
      userId: 'user-xyz',
    });
  });

  it('returns 401 in production when no session (headers ignored)', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/api/auth/me')
      .set('X-Household-Id', 'house-abc')
      .set('X-User-Id', 'user-xyz')
      .expect(401);

    expect(response.body.error).toMatch(/Session required|Log in/i);
  });

  it('returns 401 in production when no headers and no session', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app).get('/api/auth/me').expect(401);

    expect(response.body.error).toMatch(/Session required|Log in/i);
  });

  it('returns bootstrap identity in dev when DEMO_MODE_ENABLED and no headers sent', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_MODE_ENABLED = 'true';

    const response = await request(app).get('/api/auth/me').expect(200);

    expect(response.body).toEqual({
      householdId: 'default-household',
      userId: 'default-user',
    });
  });

  it('returns 401 in dev without demo mode when no session', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DEMO_MODE_ENABLED;

    const response = await request(app).get('/api/auth/me').expect(401);

    expect(response.body.error).toMatch(/Session required|Log in/i);
  });
});
