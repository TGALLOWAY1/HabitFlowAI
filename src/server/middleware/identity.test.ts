import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  identityMiddleware,
  DEV_BOOTSTRAP_HOUSEHOLD_ID,
  DEV_BOOTSTRAP_USER_ID,
} from './identity';

function mockRequest(headers: Record<string, string> = {}): Request {
  return { headers } as Request;
}

function mockResponse(): Response {
  const res = {} as Response;
  res.status = (code: number) => {
    (res as any).statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    (res as any).body = body;
    return res;
  };
  return res;
}

describe('identityMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoMode = process.env.DEMO_MODE_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEMO_MODE_ENABLED = originalDemoMode;
  });

  describe('when identity already set (e.g. from session)', () => {
    it('calls next and keeps pre-set identity', () => {
      const req = mockRequest({ 'x-household-id': 'header-house', 'x-user-id': 'header-user' }) as any;
      req.householdId = 'session-house';
      req.userId = 'session-user';
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect(req.householdId).toBe('session-house');
      expect(req.userId).toBe('session-user');
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEMO_MODE_ENABLED;
    });

    it('returns 401 when no session-derived identity (ignores headers)', () => {
      const req = mockRequest({ 'x-household-id': 'house-1', 'x-user-id': 'user-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next must not be called when identity is not from session in production');
      });

      expect((res as any).statusCode).toBe(401);
      expect((res as any).body?.error).toMatch(/Session required|Log in/i);
      expect((req as any).householdId).toBeUndefined();
      expect((req as any).userId).toBeUndefined();
    });

    it('returns 401 when both headers missing', () => {
      const req = mockRequest({});
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next should not be called');
      });

      expect((res as any).statusCode).toBe(401);
      expect((res as any).body?.error).toMatch(/Session required|Log in/i);
    });
  });

  describe('dev with DEMO_MODE_ENABLED=true', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.DEMO_MODE_ENABLED = 'true';
    });

    it('sets req.householdId and req.userId from X-Household-Id and X-User-Id', () => {
      const req = mockRequest({
        'x-household-id': 'house-1',
        'x-user-id': 'user-1',
      });
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe('house-1');
      expect((req as any).userId).toBe('user-1');
      expect((req as any).identitySource).toBe('demo_headers');
    });

    it('trims header values', () => {
      const req = mockRequest({
        'x-household-id': '  house-2  ',
        'x-user-id': '  user-2  ',
      });
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe('house-2');
      expect((req as any).userId).toBe('user-2');
    });

    it('uses bootstrap identity when both headers missing', () => {
      const req = mockRequest({});
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe(DEV_BOOTSTRAP_HOUSEHOLD_ID);
      expect((req as any).userId).toBe(DEV_BOOTSTRAP_USER_ID);
      expect((req as any).identitySource).toBe('bootstrap');
    });

    it('uses bootstrap when only one header present', () => {
      const req = mockRequest({ 'x-user-id': 'user-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe(DEV_BOOTSTRAP_HOUSEHOLD_ID);
      expect((req as any).userId).toBe(DEV_BOOTSTRAP_USER_ID);
    });
  });

  describe('dev without DEMO_MODE_ENABLED (session required)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      delete process.env.DEMO_MODE_ENABLED;
    });

    it('returns 401 when no session-derived identity even with headers', () => {
      const req = mockRequest({ 'x-household-id': 'house-1', 'x-user-id': 'user-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next should not be called without session or demo mode');
      });

      expect((res as any).statusCode).toBe(401);
      expect((res as any).body?.error).toMatch(/Session required|Log in/i);
      expect((req as any).householdId).toBeUndefined();
      expect((req as any).userId).toBeUndefined();
    });

    it('returns 401 when both headers missing', () => {
      const req = mockRequest({});
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next should not be called');
      });

      expect((res as any).statusCode).toBe(401);
    });
  });
});
