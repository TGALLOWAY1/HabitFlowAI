/**
 * Auth integration tests: invite redeem, login, logout, me, admin forbidden.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createApp } from '../../app';
import { hashInviteCode } from '../../lib/authCrypto';
import bcrypt from 'bcrypt';
import { createInvite } from '../../repositories/inviteRepository';
import { createUser } from '../../repositories/userRepository';
import { createSession, createSessionToken } from '../../repositories/sessionRepository';

const SALT_ROUNDS = 12;

function app() {
  return createApp();
}

describe('Auth integration', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('users').deleteMany({});
    await db.collection('invites').deleteMany({});
    await db.collection('sessions').deleteMany({});
  });

  describe('POST /api/auth/invite/redeem', () => {
    it('returns 400 for invalid invite code', async () => {
      const res = await request(app())
        .post('/api/auth/invite/redeem')
        .send({ inviteCode: 'BADCODE', email: 'a@b.com', password: 'password123', displayName: 'A' })
        .expect(400);
      expect(res.body.error).toMatch(/Invalid|expired|invite/i);
    });

    it('returns 400 for expired invite', async () => {
      const db = await getTestDb();
      const codeHash = hashInviteCode('VALIDCODE');
      await db.collection('invites').insertOne({
        _id: 'inv-1' as any,
        householdId: 'hh1',
        codeHash,
        role: 'member',
        maxUses: 1,
        uses: 0,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        createdAt: new Date().toISOString(),
        createdByUserId: 'admin-1',
      });
      const res = await request(app())
        .post('/api/auth/invite/redeem')
        .send({ inviteCode: 'VALIDCODE', email: 'a@b.com', password: 'password123', displayName: 'A' })
        .expect(400);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('returns 400 for revoked invite', async () => {
      const db = await getTestDb();
      const codeHash = hashInviteCode('REVOKED');
      await db.collection('invites').insertOne({
        _id: 'inv-2' as any,
        householdId: 'hh1',
        codeHash,
        role: 'member',
        maxUses: 1,
        uses: 0,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        revokedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdByUserId: 'admin-1',
      });
      const res = await request(app())
        .post('/api/auth/invite/redeem')
        .send({ inviteCode: 'REVOKED', email: 'a@b.com', password: 'password123', displayName: 'A' })
        .expect(400);
      expect(res.body.error).toMatch(/revoked/i);
    });

    it('returns 400 when maxUses reached', async () => {
      const db = await getTestDb();
      const codeHash = hashInviteCode('MAXED');
      await db.collection('invites').insertOne({
        _id: 'inv-3' as any,
        householdId: 'hh1',
        codeHash,
        role: 'member',
        maxUses: 1,
        uses: 1,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        createdByUserId: 'admin-1',
      });
      const res = await request(app())
        .post('/api/auth/invite/redeem')
        .send({ inviteCode: 'MAXED', email: 'a@b.com', password: 'password123', displayName: 'A' })
        .expect(400);
      expect(res.body.error).toMatch(/maximum uses/i);
    });

    it('creates user and session and sets cookie on valid redeem', async () => {
      const codeHash = hashInviteCode('GOODCODE');
      await createInvite({
        householdId: 'hh1',
        codeHash,
        role: 'member',
        maxUses: 2,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdByUserId: 'admin-1',
      });
      const res = await request(app())
        .post('/api/auth/invite/redeem')
        .send({
          inviteCode: 'GOODCODE',
          email: 'new@example.com',
          password: 'securepass12',
          displayName: 'New User',
        })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.householdId).toBe('hh1');
      expect(res.body.user.email).toBe('new@example.com');
      expect(res.body.user.displayName).toBe('New User');
      expect(res.body.user.role).toBe('member');
      expect(res.headers['set-cookie']).toBeDefined();
      expect((res.headers['set-cookie'] as unknown as string[]).some((c: string) => c.includes('hf_session'))).toBe(true);

      const db = await getTestDb();
      const userCount = await db.collection('users').countDocuments({ email: 'new@example.com' });
      expect(userCount).toBe(1);
      const sessionCount = await db.collection('sessions').countDocuments();
      expect(sessionCount).toBe(1);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 401 for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correctpass', SALT_ROUNDS);
      await createUser({
        householdId: 'hh1',
        email: 'login@test.com',
        displayName: 'Login',
        passwordHash,
        role: 'member',
      });
      const res = await request(app())
        .post('/api/auth/login')
        .send({ email: 'login@test.com', password: 'wrongpass' })
        .expect(401);
      expect(res.body.error).toMatch(/Invalid|password/i);
    });

    it('sets cookie and returns user on correct password', async () => {
      const passwordHash = await bcrypt.hash('correctpass', SALT_ROUNDS);
      await createUser({
        householdId: 'hh1',
        email: 'correct@test.com',
        displayName: 'Correct',
        passwordHash,
        role: 'admin',
      });
      const res = await request(app())
        .post('/api/auth/login')
        .send({ email: 'correct@test.com', password: 'correctpass' })
        .expect(200);

      expect(res.body.user.email).toBe('correct@test.com');
      expect(res.body.user.role).toBe('admin');
      expect(res.headers['set-cookie']).toBeDefined();
      expect((res.headers['set-cookie'] as unknown as string[]).some((c: string) => c.includes('hf_session'))).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 in production when no session (headers ignored)', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const res = await request(app())
        .get('/api/auth/me')
        .set('X-Household-Id', 'any-house')
        .set('X-User-Id', 'any-user')
        .expect(401);
      process.env.NODE_ENV = prev;
      expect(res.body.error).toMatch(/Session required|Log in/i);
    });

    it('returns user identity when session cookie present', async () => {
      const passwordHash = await bcrypt.hash('pass', SALT_ROUNDS);
      const user = await createUser({
        householdId: 'hh1',
        email: 'me@test.com',
        displayName: 'Me',
        passwordHash,
        role: 'member',
      });
      const { raw: token, hash: tokenHash } = createSessionToken();
      await createSession({
        householdId: 'hh1',
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const res = await request(app())
        .get('/api/auth/me')
        .set('Cookie', `hf_session=${token}`)
        .expect(200);
      expect(res.body.householdId).toBe('hh1');
      expect(res.body.userId).toBe(user._id);
      expect(res.body.email).toBe('me@test.com');
      expect(res.body.displayName).toBe('Me');
      expect(res.body.role).toBe('member');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 200 and ok true; clears session cookie when present', async () => {
      const res = await request(app()).post('/api/auth/logout').expect(200);
      expect(res.body.ok).toBe(true);
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const str = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
        expect(str).toMatch(/hf_session/);
      }
    });
  });

  describe('Admin invite routes', () => {
    it('returns 403 for non-admin (member)', async () => {
      const passwordHash = await bcrypt.hash('pass', SALT_ROUNDS);
      const user = await createUser({
        householdId: 'hh1',
        email: 'member@test.com',
        displayName: 'Member',
        passwordHash,
        role: 'member',
      });
      const { raw: token, hash: tokenHash } = createSessionToken();
      await createSession({
        householdId: 'hh1',
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      });
      const res = await request(app())
        .post('/api/admin/invites')
        .set('Cookie', `hf_session=${token}`)
        .send({ maxUses: 5, expiresAt: new Date(Date.now() + 86400000).toISOString() })
        .expect(403);
      expect(res.body.error).toMatch(/Admin|403/i);
    });
  });
});
