/**
 * Push Send Log Repository
 *
 * Dedup ledger for reminder sends: at most one push per
 * (sourceId, dayKey, endpoint), enforced by a unique index so the scheduler is
 * idempotent across restarts, overlapping ticks, and multiple instances.
 * Rows expire via TTL — dedup only needs to outlive the day it protects.
 *
 * sourceId is the reminding entity: a habit id, or a namespaced "routine:<id>"
 * for routine reminders (habit ids are UUIDs, so the prefix can't collide).
 * The stored field (and unique index) keeps its original name `habitId` so
 * existing deployments need no index migration.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import { requireScope } from '../lib/scoping';

const COLLECTION = MONGO_COLLECTIONS.PUSH_SEND_LOG;

// 48h: comfortably outlives the dayKey being deduped in every timezone.
const TTL_SECONDS = 48 * 60 * 60;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex(
    { habitId: 1, dayKey: 1, endpoint: 1 },
    { name: 'dedup_send', unique: true }
  );
  await col.createIndex({ sentAt: 1 }, { name: 'ttl_sent_at', expireAfterSeconds: TTL_SECONDS });
  indexesEnsured = true;
}

/**
 * Claim the right to send this (source, day, device) reminder by inserting the
 * dedup row first. Returns false if another tick/instance already claimed it.
 */
export async function tryClaimSend(
  sourceId: string,
  dayKey: string,
  endpoint: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  try {
    await col.insertOne({
      habitId: sourceId,
      dayKey,
      endpoint,
      householdId: scope.householdId,
      userId: scope.userId,
      status: 'pending',
      sentAt: new Date(),
    });
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) {
      return false;
    }
    throw error;
  }
}

/** Record the outcome of a claimed send. */
export async function markSendResult(
  sourceId: string,
  dayKey: string,
  endpoint: string,
  status: 'sent' | 'gone'
): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.updateOne({ habitId: sourceId, dayKey, endpoint }, { $set: { status } });
}

/**
 * Release a claim after a transient send failure so the next tick can retry
 * (bounded by the scheduler's catch-up window).
 */
export async function releaseClaim(
  sourceId: string,
  dayKey: string,
  endpoint: string
): Promise<void> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.deleteOne({ habitId: sourceId, dayKey, endpoint });
}
