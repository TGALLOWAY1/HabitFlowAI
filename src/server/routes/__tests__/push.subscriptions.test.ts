/**
 * Push Subscription Route Tests
 *
 * Covers the /api/push endpoints: public-key availability, subscribe
 * validation + idempotency, unsubscribe, and test-send (with the web-push
 * sender mocked, including gone-endpoint cleanup).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';

vi.mock('../../lib/webPush', async () => {
  const actual = await vi.importActual<typeof import('../../lib/webPush')>('../../lib/webPush');
  return {
    ...actual,
    sendPush: vi.fn(async () => 'sent' as const),
  };
});

import { sendPush } from '../../lib/webPush';
import {
  getPushPublicKeyRoute,
  savePushSubscriptionRoute,
  deletePushSubscriptionRoute,
  sendTestPushRoute,
} from '../pushSubscriptions';

const TEST_HOUSEHOLD_ID = 'test-push-routes-household';
const TEST_USER_ID = 'test-push-routes-user';
const ENDPOINT = 'https://push.example.com/send/route-device';

const VALID_BODY = {
  subscription: {
    endpoint: ENDPOINT,
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
  },
  timeZone: 'Europe/Berlin',
  userAgent: 'vitest',
};

describe('Push subscription routes', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestMongo();

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).householdId = TEST_HOUSEHOLD_ID;
      (req as any).userId = TEST_USER_ID;
      next();
    });

    app.get('/api/push/public-key', getPushPublicKeyRoute);
    app.post('/api/push/subscriptions', savePushSubscriptionRoute);
    app.delete('/api/push/subscriptions', deletePushSubscriptionRoute);
    app.post('/api/push/test', sendTestPushRoute);
  });

  afterAll(async () => {
    await teardownTestMongo();
    delete process.env.PUSH_REMINDERS_ENABLED;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('pushSubscriptions').deleteMany({});
    vi.mocked(sendPush).mockClear();
    vi.mocked(sendPush).mockResolvedValue('sent');

    // Configured by default; individual tests flip these off
    process.env.PUSH_REMINDERS_ENABLED = 'true';
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
  });

  describe('GET /api/push/public-key', () => {
    it('returns the public key when configured', async () => {
      const res = await request(app).get('/api/push/public-key');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enabled: true, publicKey: 'test-public-key' });
    });

    it('reports disabled when the flag is off', async () => {
      process.env.PUSH_REMINDERS_ENABLED = 'false';
      const res = await request(app).get('/api/push/public-key');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enabled: false, publicKey: null });
    });

    it('reports disabled when VAPID keys are missing', async () => {
      process.env.VAPID_PRIVATE_KEY = '';
      const res = await request(app).get('/api/push/public-key');
      expect(res.body.enabled).toBe(false);
    });
  });

  describe('POST /api/push/subscriptions', () => {
    it('creates a subscription', async () => {
      const res = await request(app).post('/api/push/subscriptions').send(VALID_BODY);
      expect(res.status).toBe(201);
      expect(res.body.subscription.endpoint).toBe(ENDPOINT);
      expect(res.body.subscription.timeZone).toBe('Europe/Berlin');
      expect(res.body.subscription.id).toBeTruthy();
    });

    it('is idempotent on repeat subscribe', async () => {
      const first = await request(app).post('/api/push/subscriptions').send(VALID_BODY);
      const second = await request(app)
        .post('/api/push/subscriptions')
        .send({ ...VALID_BODY, timeZone: 'Asia/Tokyo' });

      expect(second.status).toBe(201);
      expect(second.body.subscription.id).toBe(first.body.subscription.id);
      expect(second.body.subscription.timeZone).toBe('Asia/Tokyo');

      const db = await getTestDb();
      expect(await db.collection('pushSubscriptions').countDocuments({})).toBe(1);
    });

    it('rejects a missing endpoint or keys', async () => {
      const noEndpoint = await request(app)
        .post('/api/push/subscriptions')
        .send({ subscription: { keys: VALID_BODY.subscription.keys }, timeZone: 'UTC' });
      expect(noEndpoint.status).toBe(400);
      expect(noEndpoint.body.error.code).toBe('VALIDATION_ERROR');

      const noKeys = await request(app)
        .post('/api/push/subscriptions')
        .send({ subscription: { endpoint: ENDPOINT, keys: { p256dh: 'x' } }, timeZone: 'UTC' });
      expect(noKeys.status).toBe(400);
    });

    it('falls back to the default timezone for invalid input', async () => {
      const res = await request(app)
        .post('/api/push/subscriptions')
        .send({ ...VALID_BODY, timeZone: 'Not/AZone' });
      expect(res.status).toBe(201);
      expect(res.body.subscription.timeZone).toBe('America/New_York');
    });

    it('returns 501 PUSH_DISABLED when unconfigured', async () => {
      process.env.PUSH_REMINDERS_ENABLED = 'false';
      const res = await request(app).post('/api/push/subscriptions').send(VALID_BODY);
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('PUSH_DISABLED');
    });
  });

  describe('DELETE /api/push/subscriptions', () => {
    it('removes an existing subscription', async () => {
      await request(app).post('/api/push/subscriptions').send(VALID_BODY);
      const res = await request(app).delete('/api/push/subscriptions').send({ endpoint: ENDPOINT });
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      const again = await request(app).delete('/api/push/subscriptions').send({ endpoint: ENDPOINT });
      expect(again.body.deleted).toBe(false);
    });

    it('rejects a missing endpoint', async () => {
      const res = await request(app).delete('/api/push/subscriptions').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/push/test', () => {
    it('sends to every active device of the caller', async () => {
      await request(app).post('/api/push/subscriptions').send(VALID_BODY);
      await request(app).post('/api/push/subscriptions').send({
        ...VALID_BODY,
        subscription: { ...VALID_BODY.subscription, endpoint: `${ENDPOINT}-2` },
      });

      const res = await request(app).post('/api/push/test');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ sent: 2, gone: 0, errors: 0 });
      expect(vi.mocked(sendPush)).toHaveBeenCalledTimes(2);
    });

    it('disables subscriptions the push service reports gone', async () => {
      await request(app).post('/api/push/subscriptions').send(VALID_BODY);
      vi.mocked(sendPush).mockResolvedValueOnce('gone');

      const res = await request(app).post('/api/push/test');
      expect(res.body).toEqual({ sent: 0, gone: 1, errors: 0 });

      // Endpoint is now disabled — a second test-send reaches no devices
      const again = await request(app).post('/api/push/test');
      expect(again.body).toEqual({ sent: 0, gone: 0, errors: 0 });
    });

    it('returns 501 when unconfigured', async () => {
      process.env.PUSH_REMINDERS_ENABLED = 'false';
      const res = await request(app).post('/api/push/test');
      expect(res.status).toBe(501);
    });
  });
});
