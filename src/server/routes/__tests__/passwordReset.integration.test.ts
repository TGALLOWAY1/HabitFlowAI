/**
 * Password reset integration tests:
 *  - POST /api/auth/forgot-password (no enumeration, token issued, email sent)
 *  - POST /api/auth/reset-password  (token validation, single-use, session invalidation)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import { createApp } from '../../app';
import { createUser } from '../../repositories/userRepository';
import { createSession, createSessionToken } from '../../repositories/sessionRepository';
import { hashSessionToken } from '../../lib/authCrypto';

vi.mock('../../lib/email', () => ({
  sendPasswordResetEmail: vi.fn(async () => {
    // no-op mock; assertions are made on call args
  }),
}));

import { sendPasswordResetEmail } from '../../lib/email';

const SALT_ROUNDS = 12;

function app() {
  return createApp();
}

async function seedUser(email = 'user@test.com', password = 'oldpassword12') {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await createUser({
    householdId: 'hh1',
    email,
    displayName: email,
    passwordHash,
    role: 'member',
  });
  return user;
}

describe('Password reset integration', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('users').deleteMany({});
    await db.collection('sessions').deleteMany({});
    await db.collection('passwordResetTokens').deleteMany({});
    vi.mocked(sendPasswordResetEmail).mockClear();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns 400 when email is invalid', async () => {
      const res = await request(app())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
      expect(res.body.error).toMatch(/email/i);
    });

    it('returns 200 and sends an email when the user exists', async () => {
      await seedUser('exists@test.com');
      const res = await request(app())
        .post('/api/auth/forgot-password')
        .send({ email: 'exists@test.com' })
        .expect(200);
      expect(res.body.ok).toBe(true);

      const db = await getTestDb();
      const tokens = await db.collection('passwordResetTokens').find({}).toArray();
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.usedAt).toBeUndefined();

      expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledTimes(1);
      const [to, url] = vi.mocked(sendPasswordResetEmail).mock.calls[0]!;
      expect(to).toBe('exists@test.com');
      expect(url).toMatch(/\/reset-password\?token=[0-9a-f]{64}/);
    });

    it('returns 200 without sending email when the user does not exist', async () => {
      const res = await request(app())
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@test.com' })
        .expect(200);
      expect(res.body.ok).toBe(true);

      const db = await getTestDb();
      const tokens = await db.collection('passwordResetTokens').countDocuments();
      expect(tokens).toBe(0);
      expect(vi.mocked(sendPasswordResetEmail)).not.toHaveBeenCalled();
    });

    it('builds the reset link from FRONTEND_ORIGIN, not the request host', async () => {
      // In production the request reaches the API on the backend host, but the
      // emailed link must target the frontend SPA origin.
      const prevAppBaseUrl = process.env.APP_BASE_URL;
      const prevFrontendOrigin = process.env.FRONTEND_ORIGIN;
      delete process.env.APP_BASE_URL;
      process.env.FRONTEND_ORIGIN = 'https://app.habitflow.example';
      try {
        await seedUser('frontend@test.com');
        await request(app())
          .post('/api/auth/forgot-password')
          .send({ email: 'frontend@test.com' })
          .expect(200);

        const url = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];
        expect(url).toMatch(/^https:\/\/app\.habitflow\.example\/reset-password\?token=[0-9a-f]{64}$/);
      } finally {
        if (prevAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
        else process.env.APP_BASE_URL = prevAppBaseUrl;
        if (prevFrontendOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
        else process.env.FRONTEND_ORIGIN = prevFrontendOrigin;
      }
    });

    it('replaces a prior pending token when invoked again', async () => {
      await seedUser('repeat@test.com');
      await request(app()).post('/api/auth/forgot-password').send({ email: 'repeat@test.com' }).expect(200);
      await request(app()).post('/api/auth/forgot-password').send({ email: 'repeat@test.com' }).expect(200);

      const db = await getTestDb();
      const tokens = await db.collection('passwordResetTokens').find({}).toArray();
      expect(tokens).toHaveLength(1);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('returns 400 when the token is missing', async () => {
      const res = await request(app())
        .post('/api/auth/reset-password')
        .send({ newPassword: 'newpassword12' })
        .expect(400);
      expect(res.body.error).toMatch(/token/i);
    });

    it('returns 400 when the password is too short', async () => {
      const res = await request(app())
        .post('/api/auth/reset-password')
        .send({ token: 'whatever', newPassword: 'short' })
        .expect(400);
      expect(res.body.error).toMatch(/password/i);
    });

    it('returns 400 when the token does not match any record', async () => {
      const res = await request(app())
        .post('/api/auth/reset-password')
        .send({ token: 'deadbeef'.repeat(8), newPassword: 'newpassword12' })
        .expect(400);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });

    it('updates the password, marks the token used, and clears sessions', async () => {
      const user = await seedUser('reset@test.com', 'oldpassword12');

      // Establish an active session that should be killed by the reset.
      const { hash: sessionHash } = createSessionToken();
      await createSession({
        householdId: user.householdId,
        userId: user._id,
        tokenHash: sessionHash,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      // Trigger forgot-password to issue a real token, then dig the raw token
      // out of the mock call args.
      await request(app()).post('/api/auth/forgot-password').send({ email: 'reset@test.com' }).expect(200);
      const url = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];
      const rawToken = new URL(url).searchParams.get('token')!;
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);

      await request(app())
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'brandnewpass34' })
        .expect(200);

      // Old password no longer works.
      await request(app())
        .post('/api/auth/login')
        .send({ email: 'reset@test.com', password: 'oldpassword12' })
        .expect(401);

      // New password works.
      await request(app())
        .post('/api/auth/login')
        .send({ email: 'reset@test.com', password: 'brandnewpass34' })
        .expect(200);

      // Token marked used.
      const db = await getTestDb();
      const stored = await db.collection('passwordResetTokens').findOne({ tokenHash: hashSessionToken(rawToken) });
      expect(stored?.usedAt).toBeDefined();

      // Prior session was deleted by reset (a fresh login created a new one).
      const remaining = await db.collection('sessions').countDocuments({ tokenHash: sessionHash });
      expect(remaining).toBe(0);
    });

    it('rejects a token that has already been used', async () => {
      await seedUser('reuse@test.com');
      await request(app()).post('/api/auth/forgot-password').send({ email: 'reuse@test.com' }).expect(200);
      const url = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];
      const rawToken = new URL(url).searchParams.get('token')!;

      await request(app())
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'firstreset12' })
        .expect(200);

      const res = await request(app())
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'secondreset12' })
        .expect(400);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });

    it('rejects an expired token', async () => {
      const user = await seedUser('expired@test.com');
      // Insert a directly-expired token to avoid time mocking.
      const rawToken = 'a'.repeat(64);
      const db = await getTestDb();
      await db.collection('passwordResetTokens').insertOne({
        _id: 'pt-expired',
        userId: user._id,
        householdId: user.householdId,
        tokenHash: hashSessionToken(rawToken),
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      } as any);

      const res = await request(app())
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'goodpassword12' })
        .expect(400);
      expect(res.body.error).toMatch(/invalid|expired/i);
    });
  });
});
