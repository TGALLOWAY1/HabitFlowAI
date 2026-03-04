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

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('when headers are provided', () => {
    it('sets req.householdId and req.userId from X-Household-Id and X-User-Id', () => {
      const req = mockRequest({
        'x-household-id': 'house-1',
        'x-user-id': 'user-1',
      });
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe('house-1');
      expect((req as any).userId).toBe('user-1');
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
  });

  describe('production mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('returns 401 when X-Household-Id is missing', () => {
      const req = mockRequest({ 'x-user-id': 'user-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next should not be called');
      });

      expect((res as any).statusCode).toBe(401);
      expect((res as any).body?.error).toMatch(/Missing identity|X-Household-Id|X-User-Id/i);
    });

    it('returns 401 when X-User-Id is missing', () => {
      const req = mockRequest({ 'x-household-id': 'house-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next should not be called');
      });

      expect((res as any).statusCode).toBe(401);
      expect((res as any).body?.error).toMatch(/Missing identity|X-Household-Id|X-User-Id/i);
    });

    it('returns 401 when both headers are missing', () => {
      const req = mockRequest({});
      const res = mockResponse();

      identityMiddleware(req, res, () => {
        expect.fail('next should not be called');
      });

      expect((res as any).statusCode).toBe(401);
      expect((res as any).body?.error).toMatch(/Missing identity|X-Household-Id|X-User-Id/i);
    });
  });

  describe('dev mode (NODE_ENV !== production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('uses bootstrap identity when X-Household-Id is missing', () => {
      const req = mockRequest({ 'x-user-id': 'user-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe(DEV_BOOTSTRAP_HOUSEHOLD_ID);
      expect((req as any).userId).toBe(DEV_BOOTSTRAP_USER_ID);
    });

    it('uses bootstrap identity when X-User-Id is missing', () => {
      const req = mockRequest({ 'x-household-id': 'house-1' });
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe(DEV_BOOTSTRAP_HOUSEHOLD_ID);
      expect((req as any).userId).toBe(DEV_BOOTSTRAP_USER_ID);
    });

    it('uses bootstrap identity when both headers are missing', () => {
      const req = mockRequest({});
      const res = mockResponse();

      identityMiddleware(req, res, () => {});

      expect((req as any).householdId).toBe(DEV_BOOTSTRAP_HOUSEHOLD_ID);
      expect((req as any).userId).toBe(DEV_BOOTSTRAP_USER_ID);
    });
  });
});
