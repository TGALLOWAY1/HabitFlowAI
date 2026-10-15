/**
 * DailyCheckIn Repository
 *
 * MongoDB data access for Daily Check-in reflection records: one document per
 * (householdId, userId, dayKey). Reflective data only — completion truth stays
 * in habitEntries, so nothing here may store or imply "done".
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import {
  MONGO_COLLECTIONS,
  type DailyCheckIn,
  type DailyCheckInStatus,
  type HabitCheckIn,
} from '../../models/persistenceTypes';

const COLLECTION = MONGO_COLLECTIONS.DAILY_CHECK_INS;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  await db.collection(COLLECTION).createIndex(
    { householdId: 1, userId: 1, dayKey: 1 },
    { name: 'uniq_household_user_dayKey', unique: true }
  );
  indexesEnsured = true;
}

function toDailyCheckIn(doc: Record<string, unknown>): DailyCheckIn {
  const { _id, householdId: _householdId, ...rest } = doc;
  return rest as unknown as DailyCheckIn;
}

/** Validated, normalized write payload (see parseDailyCheckInBody in the route). */
export interface DailyCheckInInput {
  status: DailyCheckInStatus;
  currentStep: number;
  habits: HabitCheckIn[];
}

export async function getDailyCheckIn(
  householdId: string,
  userId: string,
  dayKey: string
): Promise<DailyCheckIn | null> {
  await ensureIndexes();
  const db = await getDb();
  const doc = await db.collection(COLLECTION).findOne(scopeFilter(householdId, userId, { dayKey }));
  return doc ? toDailyCheckIn(doc) : null;
}

/**
 * Create or replace the check-in for a day. `startedAt` is set once on
 * insert; completion is sticky (an already-complete check-in stays complete
 * and keeps its original `completedAt`).
 */
export async function upsertDailyCheckIn(
  householdId: string,
  userId: string,
  dayKey: string,
  input: DailyCheckInInput
): Promise<DailyCheckIn> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const collection = db.collection(COLLECTION);
  const filter = scopeFilter(scope.householdId, scope.userId, { dayKey });

  const existing = await collection.findOne(filter, { projection: { status: 1, completedAt: 1 } });
  const now = new Date().toISOString();
  const status: DailyCheckInStatus =
    existing?.status === 'complete' || input.status === 'complete' ? 'complete' : 'in_progress';
  const completedAt = status === 'complete'
    ? (typeof existing?.completedAt === 'string' ? existing.completedAt : now)
    : null;

  const result = await collection.findOneAndUpdate(
    filter,
    {
      $set: {
        status,
        currentStep: input.currentStep,
        habits: input.habits,
        completedAt,
        updatedAt: now,
      },
      $setOnInsert: {
        id: randomUUID(),
        householdId: scope.householdId,
        userId: scope.userId,
        dayKey,
        startedAt: now,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  if (!result) {
    throw new Error('Failed to save daily check-in');
  }
  return toDailyCheckIn(result);
}
