/**
 * Symptom Repository
 *
 * MongoDB data access for Symptom definitions and daily SymptomLog severity
 * records. All queries are scoped by (householdId, userId).
 *
 * - Symptoms are soft-deleted via `deletedAt` (truth records are never hard-deleted).
 * - SymptomLogs are idempotent on (userId, symptomId, dayKey).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import {
  MONGO_COLLECTIONS,
  type Symptom,
  type SymptomLog,
} from '../../models/persistenceTypes';

const SYMPTOMS = MONGO_COLLECTIONS.SYMPTOMS;
const SYMPTOM_LOGS = MONGO_COLLECTIONS.SYMPTOM_LOGS;

let logIndexesEnsured = false;

async function ensureLogIndexes(): Promise<void> {
  if (logIndexesEnsured) return;
  const db = await getDb();
  await db.collection(SYMPTOM_LOGS).createIndex(
    { userId: 1, symptomId: 1, dayKey: 1 },
    { name: 'uniq_user_symptom_dayKey', unique: true }
  );
  logIndexesEnsured = true;
}

function stripInternal<T>(doc: any): T {
  const { _id, householdId: _h, userId: _u, ...rest } = doc;
  return rest as T;
}

export type SymptomCreateInput = {
  name: string;
  active?: boolean;
  notes?: string | null;
};

export type SymptomUpdateInput = Partial<SymptomCreateInput>;

/** List non-deleted symptoms for a user (active first, then by name). */
export async function listSymptoms(householdId: string, userId: string): Promise<Symptom[]> {
  const db = await getDb();
  const documents = await db
    .collection(SYMPTOMS)
    .find(scopeFilter(householdId, userId, { deletedAt: { $in: [null, undefined] } }))
    .toArray();

  const symptoms = documents.map((d: any) => stripInternal<Symptom>(d));
  symptoms.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return symptoms;
}

export async function createSymptom(
  input: SymptomCreateInput,
  householdId: string,
  userId: string
): Promise<Symptom> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const now = new Date().toISOString();

  const symptom: Symptom = {
    id: randomUUID(),
    userId: scope.userId,
    householdId: scope.householdId,
    name: input.name.trim(),
    active: input.active ?? true,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.collection(SYMPTOMS).insertOne({ ...symptom });
  return symptom;
}

export async function updateSymptom(
  id: string,
  patch: SymptomUpdateInput,
  householdId: string,
  userId: string
): Promise<Symptom | null> {
  const db = await getDb();
  const collection = db.collection(SYMPTOMS);

  const existing = await collection.findOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $in: [null, undefined] } })
  );
  if (!existing) return null;

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };

  if (typeof patch.name === 'string') set.name = patch.name.trim();
  if (typeof patch.active === 'boolean') set.active = patch.active;
  if ('notes' in patch) set.notes = patch.notes ?? null;

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: set },
    { returnDocument: 'after' }
  );
  if (!result) return null;
  return stripInternal<Symptom>(result);
}

/** Soft delete a symptom (sets deletedAt; preserves history). */
export async function softDeleteSymptom(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection(SYMPTOMS).updateOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $in: [null, undefined] } }),
    { $set: { deletedAt: now, active: false, updatedAt: now } }
  );
  return result.matchedCount > 0;
}

/** Get the severity logs for a given day. */
export async function getSymptomLogsForDay(
  householdId: string,
  userId: string,
  dayKey: string
): Promise<SymptomLog[]> {
  await ensureLogIndexes();
  const db = await getDb();
  const documents = await db
    .collection(SYMPTOM_LOGS)
    .find(scopeFilter(householdId, userId, { dayKey }))
    .toArray();
  return documents.map((d: any) => stripInternal<SymptomLog>(d));
}

/** Get logs across a dayKey range (for future timeline/correlation use). */
export async function getSymptomLogsInRange(
  householdId: string,
  userId: string,
  startDayKey: string,
  endDayKey: string
): Promise<SymptomLog[]> {
  await ensureLogIndexes();
  const db = await getDb();
  const documents = await db
    .collection(SYMPTOM_LOGS)
    .find(scopeFilter(householdId, userId, { dayKey: { $gte: startDayKey, $lte: endDayKey } }))
    .sort({ dayKey: 1 })
    .toArray();
  return documents.map((d: any) => stripInternal<SymptomLog>(d));
}

/** Upsert a daily severity record for a symptom (idempotent per day). */
export async function setSymptomLog(
  params: { symptomId: string; dayKey: string; severity: number; notes?: string | null },
  householdId: string,
  userId: string
): Promise<SymptomLog> {
  await ensureLogIndexes();
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const now = new Date().toISOString();

  const filter = scopeFilter(householdId, userId, {
    symptomId: params.symptomId,
    dayKey: params.dayKey,
  });

  await db.collection(SYMPTOM_LOGS).updateOne(
    filter,
    {
      $set: {
        severity: params.severity,
        notes: params.notes ?? null,
        timestampUtc: now,
        updatedAt: now,
      },
      $setOnInsert: {
        id: randomUUID(),
        householdId: scope.householdId,
        userId: scope.userId,
        symptomId: params.symptomId,
        dayKey: params.dayKey,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const doc = await db.collection(SYMPTOM_LOGS).findOne(filter);
  return stripInternal<SymptomLog>(doc);
}
