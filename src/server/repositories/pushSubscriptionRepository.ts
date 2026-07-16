/**
 * Push Subscription Repository
 *
 * Stores Web Push device subscriptions (operational device data — NOT truth
 * data; the "entries are truth" invariant is untouched). One document per
 * (householdId, userId, endpoint). Hard deletes are intentional here: device
 * tokens are not truth records, so the soft-delete rule does not apply.
 */

import crypto from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type PushSubscriptionDoc } from '../../models/persistenceTypes';
import { requireScope, scopeFilter } from '../lib/scoping';

const COLLECTION = MONGO_COLLECTIONS.PUSH_SUBSCRIPTIONS;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { householdId: 1, userId: 1, endpoint: 1 },
    { name: 'by_scope_endpoint', unique: true }
  );
  indexesEnsured = true;
}

function stripScope(doc: Record<string, unknown>): PushSubscriptionDoc {
  const { _id, householdId: _h, userId: _u, ...rest } = doc as any;
  return rest as PushSubscriptionDoc;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone: string;
  userAgent?: string;
}

/**
 * Create or refresh the subscription for a device endpoint. Idempotent:
 * repeated subscribes refresh keys/timeZone/lastSeenAt and revive a
 * previously disabled endpoint.
 */
export async function upsertPushSubscription(
  householdId: string,
  userId: string,
  input: PushSubscriptionInput
): Promise<PushSubscriptionDoc> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const now = new Date().toISOString();
  const result = await col.findOneAndUpdate(
    scopeFilter(scope.householdId, scope.userId, { endpoint: input.endpoint }),
    {
      $setOnInsert: {
        id: crypto.randomUUID(),
        createdAt: now,
      },
      $set: {
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        timeZone: input.timeZone,
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        lastSeenAt: now,
      },
      $unset: { disabledAt: '' },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return stripScope(result as any);
}

/** Remove a device subscription entirely (user turned notifications off). */
export async function deletePushSubscriptionByEndpoint(
  householdId: string,
  userId: string,
  endpoint: string
): Promise<boolean> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne(scopeFilter(scope.householdId, scope.userId, { endpoint }));
  return result.deletedCount > 0;
}

/**
 * Mark a subscription dead after the push service reported it gone (404/410).
 * Kept (not deleted) so a later re-subscribe on the same endpoint revives it
 * with its original createdAt.
 */
export async function disablePushSubscriptionByEndpoint(
  householdId: string,
  userId: string,
  endpoint: string
): Promise<void> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.updateOne(
    scopeFilter(scope.householdId, scope.userId, { endpoint }),
    { $set: { disabledAt: new Date().toISOString() } }
  );
}

/** Active subscriptions for one user (e.g. the test-notification endpoint). */
export async function getActivePushSubscriptionsForUser(
  householdId: string,
  userId: string
): Promise<PushSubscriptionDoc[]> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const docs = await col
    .find(scopeFilter(scope.householdId, scope.userId, { disabledAt: { $exists: false } }))
    .toArray();
  return docs.map(stripScope);
}

/**
 * SCHEDULER-ONLY: cross-scope read of every active subscription, WITH the
 * householdId/userId scope fields intact (the scheduler needs them to query
 * each user's habits and entries). This is a deliberate exception to the
 * per-request scoping rule — never call it from a request handler.
 */
export async function getActivePushSubscriptions(): Promise<
  Array<PushSubscriptionDoc & { householdId: string; userId: string }>
> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  const docs = await col.find({ disabledAt: { $exists: false } }).toArray();
  return docs.map((doc) => {
    const { _id, ...rest } = doc as any;
    return rest as PushSubscriptionDoc & { householdId: string; userId: string };
  });
}
