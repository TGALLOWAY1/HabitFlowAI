import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { publicDemoIdentity, publicDemoReadOnlyGuard } from './publicDemo';
import { DEMO_USER_ID } from '../config/demo';
import { PUBLIC_DEMO_HOUSEHOLD_ID } from '../../shared/demo';

function mockRequest(headers: Record<string, string> = {}, method = 'GET'): Request {
  return { headers, method } as Request;
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

describe('publicDemoIdentity', () => {
  const originalPublicDemo = process.env.PUBLIC_DEMO_ENABLED;

  afterEach(() => {
    if (originalPublicDemo === undefined) {
      delete process.env.PUBLIC_DEMO_ENABLED;
    } else {
      process.env.PUBLIC_DEMO_ENABLED = originalPublicDemo;
    }
  });

  describe('when PUBLIC_DEMO_ENABLED is not set', () => {
    beforeEach(() => {
      delete process.env.PUBLIC_DEMO_ENABLED;
    });

    it('does not set identity even with the demo header', () => {
      const req = mockRequest({ 'x-demo-mode': 'true' });
      const res = mockResponse();
      let nextCalled = false;

      publicDemoIdentity(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect((req as any).householdId).toBeUndefined();
      expect((req as any).userId).toBeUndefined();
      expect((req as any).identitySource).toBeUndefined();
    });
  });

  describe('when PUBLIC_DEMO_ENABLED=true', () => {
    beforeEach(() => {
      process.env.PUBLIC_DEMO_ENABLED = 'true';
    });

    it('maps X-Demo-Mode: true to the fixed demo identity', () => {
      const req = mockRequest({ 'x-demo-mode': 'true' });
      const res = mockResponse();

      publicDemoIdentity(req, res, () => {});

      expect((req as any).householdId).toBe(PUBLIC_DEMO_HOUSEHOLD_ID);
      expect((req as any).userId).toBe(DEMO_USER_ID);
      expect((req as any).identitySource).toBe('public_demo');
    });

    it('accepts the header case-insensitively and trimmed', () => {
      const req = mockRequest({ 'x-demo-mode': '  TRUE  ' });
      const res = mockResponse();

      publicDemoIdentity(req, res, () => {});

      expect((req as any).identitySource).toBe('public_demo');
    });

    it('does nothing without the demo header', () => {
      const req = mockRequest({});
      const res = mockResponse();

      publicDemoIdentity(req, res, () => {});

      expect((req as any).householdId).toBeUndefined();
      expect((req as any).userId).toBeUndefined();
      expect((req as any).identitySource).toBeUndefined();
    });

    it('ignores non-true header values', () => {
      const req = mockRequest({ 'x-demo-mode': '1' });
      const res = mockResponse();

      publicDemoIdentity(req, res, () => {});

      expect((req as any).identitySource).toBeUndefined();
    });

    it('never overrides a session-derived identity', () => {
      const req = mockRequest({ 'x-demo-mode': 'true' }) as any;
      req.householdId = 'session-house';
      req.userId = 'session-user';
      req.identitySource = 'session';
      const res = mockResponse();

      publicDemoIdentity(req, res, () => {});

      expect(req.householdId).toBe('session-house');
      expect(req.userId).toBe('session-user');
      expect(req.identitySource).toBe('session');
    });

    it('never selects an arbitrary user from X-User-Id headers', () => {
      const req = mockRequest({
        'x-demo-mode': 'true',
        'x-user-id': 'attacker-user',
        'x-household-id': 'attacker-house',
      });
      const res = mockResponse();

      publicDemoIdentity(req, res, () => {});

      expect((req as any).userId).toBe(DEMO_USER_ID);
      expect((req as any).householdId).toBe(PUBLIC_DEMO_HOUSEHOLD_ID);
    });
  });
});

describe('publicDemoReadOnlyGuard', () => {
  function demoRequest(method: string): Request {
    const req = mockRequest({}, method) as any;
    req.householdId = PUBLIC_DEMO_HOUSEHOLD_ID;
    req.userId = DEMO_USER_ID;
    req.identitySource = 'public_demo';
    return req;
  }

  it.each(['GET', 'HEAD', 'OPTIONS'])('allows %s for the demo identity', (method) => {
    const req = demoRequest(method);
    const res = mockResponse();
    let nextCalled = false;

    publicDemoReadOnlyGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect((res as any).statusCode).toBeUndefined();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s for the demo identity with 403', (method) => {
    const req = demoRequest(method);
    const res = mockResponse();

    publicDemoReadOnlyGuard(req, res, () => {
      expect.fail('next must not be called for demo writes');
    });

    expect((res as any).statusCode).toBe(403);
    expect((res as any).body?.demoReadOnly).toBe(true);
    expect((res as any).body?.error).toMatch(/read-only/i);
  });

  it('allows writes for session identities', () => {
    const req = mockRequest({}, 'POST') as any;
    req.householdId = 'session-house';
    req.userId = 'session-user';
    req.identitySource = 'session';
    const res = mockResponse();
    let nextCalled = false;

    publicDemoReadOnlyGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('allows writes for dev demo header identities', () => {
    const req = mockRequest({}, 'POST') as any;
    req.householdId = 'default-household';
    req.userId = DEMO_USER_ID;
    req.identitySource = 'demo_headers';
    const res = mockResponse();
    let nextCalled = false;

    publicDemoReadOnlyGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('allows requests with no identity through (identity middleware owns 401s)', () => {
    const req = mockRequest({}, 'POST');
    const res = mockResponse();
    let nextCalled = false;

    publicDemoReadOnlyGuard(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
