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

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    app = express();
    app.use(identityMiddleware);
    app.get('/api/auth/me', getAuthMe);
  });

  it('returns householdId and userId when identity headers are provided', async () => {
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

  it('returns 401 when identity middleware did not set identity (production)', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(response.body.error).toMatch(/Identity not set|X-Household-Id|X-User-Id/i);
  });

  it('returns bootstrap identity in dev when no headers sent', async () => {
    process.env.NODE_ENV = 'test';

    const response = await request(app)
      .get('/api/auth/me')
      .expect(200);

    expect(response.body).toEqual({
      householdId: 'default-household',
      userId: 'default-user',
    });
  });
});
