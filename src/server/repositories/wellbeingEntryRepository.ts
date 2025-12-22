/**
 * WellbeingEntry Repository
 *
 * MongoDB data access layer for WellbeingEntry entities.
 * Provides CRUD operations for canonical wellbeing metric observations.
 *
 * Idempotency/uniqueness is enforced on:
 *   (userId, dayKey, timeOfDay, metricKey) for non-deleted documents
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, isWellbeingMetricKey, type WellbeingEntry, type WellbeingMetricKey, type WellbeingTimeOfDay } from '../../models/persistenceTypes';
import { normalizeDayKey } from '../utils/dayKeyNormalization';

const COLLECTION_NAME = MONGO_COLLECTIONS.WELLBEING_ENTRIES;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  // Unique constraint for idempotency.
  // Note: We avoid partial indexes here for maximum compatibility with various Mongo deployments.
  // Soft-delete is implemented via isDeleted=true and deletedAt set.
  await collection.createIndex(
    { userId: 1, dayKey: 1, timeOfDay: 1, metricKey: 1, isDeleted: 1 },
    {
      name: 'uniq_user_dayKey_timeOfDay_metricKey_isDeleted',
      unique: true,
    }
  );

  // Query helper indexes
  await collection.createIndex(
    { userId: 1, dayKey: 1 },
    { name: 'by_user_dayKey' }
  );

  await collection.createIndex(
    { userId: 1, metricKey: 1, dayKey: 1 },
    { name: 'by_user_metricKey_dayKey' }
  );

  indexesEnsured = true;
}

export type WellbeingEntryUpsertInput = {
  timestampUtc?: string;
  dayKey?: string;
  /** Legacy compatibility: accept date as dayKey */
  date?: string;
  /** Needed if deriving dayKey from timestampUtc */
  timeZone?: string;

  timeOfDay?: WellbeingTimeOfDay | null;
  metricKey: WellbeingMetricKey | string;
  value: number | string | null;
  source?: 'checkin' | 'import' | 'test';
};

export function getWellbeingEntryUniqSelector(args: {
  userId: string;
  dayKey: string;
  timeOfDay: WellbeingTimeOfDay | null;
  metricKey: WellbeingMetricKey;
}) {
  return {
    userId: args.userId,
    dayKey: args.dayKey,
    timeOfDay: args.timeOfDay,
    metricKey: args.metricKey,
    isDeleted: false,
  };
}

/**
 * Batch upsert WellbeingEntries (canonical store).
 *
 * - Enforces locked metric keys
 * - Normalizes dayKey at write time
 * - Upserts by (userId, dayKey, timeOfDay, metricKey)
 */
export async function createWellbeingEntries(
  entries: WellbeingEntryUpsertInput[],
  userId: string,
  options?: { defaultTimeZone?: string }
): Promise<WellbeingEntry[]> {
  await ensureIndexes();

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const now = new Date().toISOString();
  const defaultTimeZone = options?.defaultTimeZone || 'UTC';

  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const normalized = entries.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Each wellbeing entry must be an object');
    }

    if (!raw.metricKey || typeof raw.metricKey !== 'string') {
      throw new Error('metricKey is required and must be a string');
    }
    if (!isWellbeingMetricKey(raw.metricKey)) {
      throw new Error(
        `Invalid metricKey: "${raw.metricKey}". Metric keys are LOCKED. See docs/reference/00_DATA_CONTRACT_WELLBEING_KEYS.md`
      );
    }

    const metricKey = raw.metricKey as WellbeingMetricKey;
    const timeOfDay: WellbeingTimeOfDay | null =
      raw.timeOfDay === 'morning' || raw.timeOfDay === 'evening' ? raw.timeOfDay : null;

    const timestampUtc = raw.timestampUtc || new Date().toISOString();
    const timeZone = raw.timeZone || defaultTimeZone;

    const dayKey = normalizeDayKey({
      dayKey: raw.dayKey,
      date: raw.date,
      timestamp: timestampUtc,
      timeZone,
    });

    const source = raw.source || 'checkin';

    return {
      metricKey,
      timeOfDay,
      timestampUtc,
      dayKey,
      value: raw.value ?? null,
      source,
    };
  });

  const ops = normalized.map((e) => {
    const filter = getWellbeingEntryUniqSelector({
      userId,
      dayKey: e.dayKey,
      timeOfDay: e.timeOfDay,
      metricKey: e.metricKey,
    });

    return {
      updateOne: {
        filter,
        update: {
          $set: {
            userId,
            dayKey: e.dayKey,
            timeOfDay: e.timeOfDay,
            metricKey: e.metricKey,
            timestampUtc: e.timestampUtc,
            value: e.value,
            source: e.source,
            isDeleted: false,
            updatedAt: now,
          },
          $setOnInsert: {
            id: randomUUID(),
            createdAt: now,
          },
        },
        upsert: true,
      },
    };
  });

  await collection.bulkWrite(ops, { ordered: false });

  // Return the latest versions for the affected keys
  const selectors = normalized.map((e) => ({
    userId,
    dayKey: e.dayKey,
    timeOfDay: e.timeOfDay,
    metricKey: e.metricKey,
    isDeleted: false,
  }));

  const documents = await collection.find({ $or: selectors }).toArray();

  return documents.map((doc: any) => {
    const { _id, ...rest } = doc;
    return rest as WellbeingEntry;
  });
}

export async function getWellbeingEntries(params: {
  userId: string;
  startDayKey: string;
  endDayKey: string;
}): Promise<WellbeingEntry[]> {
  await ensureIndexes();

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const documents = await collection
    .find({
      userId: params.userId,
      isDeleted: false,
      dayKey: { $gte: params.startDayKey, $lte: params.endDayKey },
    })
    .sort({ dayKey: 1, timestampUtc: 1 })
    .toArray();

  return documents.map((doc: any) => {
    const { _id, ...rest } = doc;
    return rest as WellbeingEntry;
  });
}

export async function softDeleteWellbeingEntry(
  id: string,
  userId: string
): Promise<boolean> {
  await ensureIndexes();

  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const now = new Date().toISOString();
  const result = await collection.updateOne(
    { id, userId, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: now, updatedAt: now } }
  );

  return result.matchedCount > 0;
}


