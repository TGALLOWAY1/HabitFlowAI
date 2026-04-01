/**
 * HealthMetricDaily Repository
 *
 * MongoDB data access layer for imported health metrics.
 * All queries are scoped by householdId + userId.
 */

import { getDb } from '../lib/mongoClient';
import type { HealthMetricDaily } from '../../models/persistenceTypes';
import { MONGO_COLLECTIONS } from '../../models/persistenceTypes';
import { randomUUID } from 'crypto';
import { scopeFilter, requireScope } from '../lib/scoping';

const COLLECTION_NAME = MONGO_COLLECTIONS.HEALTH_METRICS_DAILY;

function stripDoc(doc: any): HealthMetricDaily {
  const { _id, userId: _, householdId: __, ...rest } = doc;
  return rest as HealthMetricDaily;
}

/**
 * Upsert a daily health metric record.
 * Atomic upsert by (userId, dayKey, source) — idempotent.
 */
export async function upsertHealthMetric(
  data: Omit<HealthMetricDaily, 'id' | 'createdAt' | 'updatedAt'>,
  householdId: string,
  userId: string
): Promise<HealthMetricDaily> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const now = new Date().toISOString();

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { dayKey: data.dayKey, source: data.source }),
    {
      $set: {
        steps: data.steps,
        activeCalories: data.activeCalories,
        sleepHours: data.sleepHours,
        workoutMinutes: data.workoutMinutes,
        weight: data.weight,
        rawDataJson: data.rawDataJson,
        updatedAt: now,
      },
      $setOnInsert: {
        id: randomUUID(),
        dayKey: data.dayKey,
        source: data.source,
        householdId: scope.householdId,
        userId: scope.userId,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (!result) throw new Error('upsertHealthMetric: findOneAndUpdate returned null');
  return stripDoc(result);
}

/**
 * Get health metric for a specific day and source.
 */
export async function getHealthMetricForDay(
  dayKey: string,
  source: string,
  householdId: string,
  userId: string
): Promise<HealthMetricDaily | null> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const doc = await collection.findOne(
    scopeFilter(householdId, userId, { dayKey, source })
  );
  if (!doc) return null;
  return stripDoc(doc);
}

/**
 * Get health metrics for a date range.
 */
export async function getHealthMetricsForRange(
  startDayKey: string,
  endDayKey: string,
  source: string,
  householdId: string,
  userId: string
): Promise<HealthMetricDaily[]> {
  const db = await getDb();
  const collection = db.collection(COLLECTION_NAME);

  const docs = await collection
    .find(scopeFilter(householdId, userId, {
      source,
      dayKey: { $gte: startDayKey, $lte: endDayKey },
    }))
    .sort({ dayKey: 1 })
    .toArray();

  return docs.map(stripDoc);
}
