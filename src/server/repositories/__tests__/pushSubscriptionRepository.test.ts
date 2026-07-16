/**
 * Push Subscription Repository Tests
 *
 * Integration tests for Web Push device subscription persistence and the
 * pushSendLog dedup ledger. Uses mongodb-memory-server via shared test helper.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestMongo, teardownTestMongo, getTestDb } from '../../../test/mongoTestHelper';
import {
  upsertPushSubscription,
  deletePushSubscriptionByEndpoint,
  disablePushSubscriptionByEndpoint,
  getActivePushSubscriptionsForUser,
  getActivePushSubscriptions,
} from '../pushSubscriptionRepository';
import { tryClaimSend, markSendResult, releaseClaim } from '../pushSendLogRepository';

const HH = 'test-household-push';
const USER_A = 'test-user-push-a';
const USER_B = 'test-user-push-b';

const ENDPOINT_1 = 'https://push.example.com/send/device-1';
const ENDPOINT_2 = 'https://push.example.com/send/device-2';

function input(overrides: Partial<{ endpoint: string; timeZone: string }> = {}) {
  return {
    endpoint: overrides.endpoint ?? ENDPOINT_1,
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
    timeZone: overrides.timeZone ?? 'America/New_York',
    userAgent: 'test-agent',
  };
}

describe('PushSubscriptionRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('pushSubscriptions').deleteMany({});
    await db.collection('pushSendLog').deleteMany({});
  });

  it('creates a subscription with generated id and timestamps', async () => {
    const sub = await upsertPushSubscription(HH, USER_A, input());
    expect(sub.id).toBeTruthy();
    expect(sub.endpoint).toBe(ENDPOINT_1);
    expect(sub.timeZone).toBe('America/New_York');
    expect(sub.createdAt).toBeTruthy();
    expect(sub.lastSeenAt).toBeTruthy();
    expect((sub as any).householdId).toBeUndefined(); // scope stripped on read
    expect((sub as any).userId).toBeUndefined();
  });

  it('is idempotent: re-subscribe refreshes timeZone/lastSeenAt but keeps id and createdAt', async () => {
    const first = await upsertPushSubscription(HH, USER_A, input());
    await new Promise((r) => setTimeout(r, 5));
    const second = await upsertPushSubscription(HH, USER_A, input({ timeZone: 'Europe/London' }));

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.timeZone).toBe('Europe/London');
    expect(second.lastSeenAt >= first.lastSeenAt).toBe(true);

    const db = await getTestDb();
    expect(await db.collection('pushSubscriptions').countDocuments({})).toBe(1);
  });

  it('re-subscribe revives a disabled endpoint', async () => {
    await upsertPushSubscription(HH, USER_A, input());
    await disablePushSubscriptionByEndpoint(HH, USER_A, ENDPOINT_1);
    expect(await getActivePushSubscriptionsForUser(HH, USER_A)).toHaveLength(0);

    const revived = await upsertPushSubscription(HH, USER_A, input());
    expect(revived.disabledAt).toBeUndefined();
    expect(await getActivePushSubscriptionsForUser(HH, USER_A)).toHaveLength(1);
  });

  it('supports multiple devices per user', async () => {
    await upsertPushSubscription(HH, USER_A, input({ endpoint: ENDPOINT_1 }));
    await upsertPushSubscription(HH, USER_A, input({ endpoint: ENDPOINT_2 }));
    const subs = await getActivePushSubscriptionsForUser(HH, USER_A);
    expect(subs).toHaveLength(2);
  });

  it('delete removes only the targeted endpoint for the scoped user', async () => {
    await upsertPushSubscription(HH, USER_A, input({ endpoint: ENDPOINT_1 }));
    await upsertPushSubscription(HH, USER_B, input({ endpoint: ENDPOINT_2 }));

    // User B cannot delete user A's endpoint
    expect(await deletePushSubscriptionByEndpoint(HH, USER_B, ENDPOINT_1)).toBe(false);
    // User A can
    expect(await deletePushSubscriptionByEndpoint(HH, USER_A, ENDPOINT_1)).toBe(true);

    expect(await getActivePushSubscriptionsForUser(HH, USER_A)).toHaveLength(0);
    expect(await getActivePushSubscriptionsForUser(HH, USER_B)).toHaveLength(1);
  });

  it('scoped reads do not leak across users', async () => {
    await upsertPushSubscription(HH, USER_A, input({ endpoint: ENDPOINT_1 }));
    const subsB = await getActivePushSubscriptionsForUser(HH, USER_B);
    expect(subsB).toHaveLength(0);
  });

  it('getActivePushSubscriptions returns all active subs with scope fields (scheduler)', async () => {
    await upsertPushSubscription(HH, USER_A, input({ endpoint: ENDPOINT_1 }));
    await upsertPushSubscription(HH, USER_B, input({ endpoint: ENDPOINT_2 }));
    await disablePushSubscriptionByEndpoint(HH, USER_B, ENDPOINT_2);

    const all = await getActivePushSubscriptions();
    expect(all).toHaveLength(1);
    expect(all[0].householdId).toBe(HH);
    expect(all[0].userId).toBe(USER_A);
  });
});

describe('PushSendLogRepository', () => {
  beforeAll(async () => {
    await setupTestMongo();
  });

  afterAll(async () => {
    await teardownTestMongo();
  });

  beforeEach(async () => {
    const db = await getTestDb();
    await db.collection('pushSendLog').deleteMany({});
  });

  it('claims once per (habit, dayKey, endpoint)', async () => {
    expect(await tryClaimSend('h1', '2026-07-16', ENDPOINT_1, HH, USER_A)).toBe(true);
    expect(await tryClaimSend('h1', '2026-07-16', ENDPOINT_1, HH, USER_A)).toBe(false);
    // Different day / endpoint / habit are independent claims
    expect(await tryClaimSend('h1', '2026-07-17', ENDPOINT_1, HH, USER_A)).toBe(true);
    expect(await tryClaimSend('h1', '2026-07-16', ENDPOINT_2, HH, USER_A)).toBe(true);
    expect(await tryClaimSend('h2', '2026-07-16', ENDPOINT_1, HH, USER_A)).toBe(true);
  });

  it('releaseClaim allows a retry after transient failure', async () => {
    expect(await tryClaimSend('h1', '2026-07-16', ENDPOINT_1, HH, USER_A)).toBe(true);
    await releaseClaim('h1', '2026-07-16', ENDPOINT_1);
    expect(await tryClaimSend('h1', '2026-07-16', ENDPOINT_1, HH, USER_A)).toBe(true);
  });

  it('markSendResult records the outcome', async () => {
    await tryClaimSend('h1', '2026-07-16', ENDPOINT_1, HH, USER_A);
    await markSendResult('h1', '2026-07-16', ENDPOINT_1, 'sent');
    const db = await getTestDb();
    const row = await db.collection('pushSendLog').findOne({ habitId: 'h1' });
    expect(row?.status).toBe('sent');
  });
});
