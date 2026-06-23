/**
 * Supplement Repository
 *
 * MongoDB data access for Supplement definitions and daily SupplementLog "taken"
 * records. All queries are scoped by (householdId, userId). Mirrors the medication
 * repository (a supplement is a "taken / not taken today" item).
 *
 * - Supplements are soft-deleted via `deletedAt` (truth records are never hard-deleted).
 * - SupplementLogs are idempotent on (userId, supplementId, dayKey).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import {
  MONGO_COLLECTIONS,
  type Supplement,
  type SupplementLog,
} from '../../models/persistenceTypes';

const SUPPLEMENTS = MONGO_COLLECTIONS.SUPPLEMENTS;
const SUPPLEMENT_LOGS = MONGO_COLLECTIONS.SUPPLEMENT_LOGS;

let logIndexesEnsured = false;

async function ensureLogIndexes(): Promise<void> {
  if (logIndexesEnsured) return;
  const db = await getDb();
  await db.collection(SUPPLEMENT_LOGS).createIndex(
    { userId: 1, supplementId: 1, dayKey: 1 },
    { name: 'uniq_user_supplement_dayKey', unique: true }
  );
  logIndexesEnsured = true;
}

function stripInternal<T>(doc: any): T {
  const { _id, householdId: _h, userId: _u, ...rest } = doc;
  return rest as T;
}

export type SupplementCreateInput = {
  name: string;
  dosage?: string | null;
  schedule?: string | null;
  active?: boolean;
  notes?: string | null;
};

export type SupplementUpdateInput = Partial<SupplementCreateInput>;

/** List non-deleted supplements for a user (active first, then by name). */
export async function listSupplements(householdId: string, userId: string): Promise<Supplement[]> {
  const db = await getDb();
  const documents = await db
    .collection(SUPPLEMENTS)
    .find(scopeFilter(householdId, userId, { deletedAt: { $in: [null, undefined] } }))
    .toArray();

  const supplements = documents.map((d: any) => stripInternal<Supplement>(d));
  supplements.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return supplements;
}

export async function createSupplement(
  input: SupplementCreateInput,
  householdId: string,
  userId: string
): Promise<Supplement> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const now = new Date().toISOString();

  const supplement: Supplement = {
    id: randomUUID(),
    userId: scope.userId,
    householdId: scope.householdId,
    name: input.name.trim(),
    dosage: input.dosage ?? null,
    schedule: input.schedule ?? null,
    active: input.active ?? true,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.collection(SUPPLEMENTS).insertOne({ ...supplement });
  return supplement;
}

export async function updateSupplement(
  id: string,
  patch: SupplementUpdateInput,
  householdId: string,
  userId: string
): Promise<Supplement | null> {
  const db = await getDb();
  const collection = db.collection(SUPPLEMENTS);

  const existing = await collection.findOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $in: [null, undefined] } })
  );
  if (!existing) return null;

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };

  if (typeof patch.name === 'string') set.name = patch.name.trim();
  if ('dosage' in patch) set.dosage = patch.dosage ?? null;
  if ('schedule' in patch) set.schedule = patch.schedule ?? null;
  if (typeof patch.active === 'boolean') set.active = patch.active;
  if ('notes' in patch) set.notes = patch.notes ?? null;

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: set },
    { returnDocument: 'after' }
  );
  if (!result) return null;
  return stripInternal<Supplement>(result);
}

/** Soft delete a supplement (sets deletedAt; preserves history). */
export async function softDeleteSupplement(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection(SUPPLEMENTS).updateOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $in: [null, undefined] } }),
    { $set: { deletedAt: now, active: false, updatedAt: now } }
  );
  return result.matchedCount > 0;
}

/** Get the "taken" logs for a given day. */
export async function getSupplementLogsForDay(
  householdId: string,
  userId: string,
  dayKey: string
): Promise<SupplementLog[]> {
  await ensureLogIndexes();
  const db = await getDb();
  const documents = await db
    .collection(SUPPLEMENT_LOGS)
    .find(scopeFilter(householdId, userId, { dayKey }))
    .toArray();
  return documents.map((d: any) => stripInternal<SupplementLog>(d));
}

/** Get logs across a dayKey range (for future timeline/correlation use). */
export async function getSupplementLogsInRange(
  householdId: string,
  userId: string,
  startDayKey: string,
  endDayKey: string
): Promise<SupplementLog[]> {
  await ensureLogIndexes();
  const db = await getDb();
  const documents = await db
    .collection(SUPPLEMENT_LOGS)
    .find(scopeFilter(householdId, userId, { dayKey: { $gte: startDayKey, $lte: endDayKey } }))
    .sort({ dayKey: 1 })
    .toArray();
  return documents.map((d: any) => stripInternal<SupplementLog>(d));
}

/** Upsert a daily "taken" record for a supplement (idempotent per day). */
export async function setSupplementLog(
  params: { supplementId: string; dayKey: string; taken: boolean; timeTaken?: string | null },
  householdId: string,
  userId: string
): Promise<SupplementLog> {
  await ensureLogIndexes();
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const now = new Date().toISOString();

  const filter = scopeFilter(householdId, userId, {
    supplementId: params.supplementId,
    dayKey: params.dayKey,
  });

  await db.collection(SUPPLEMENT_LOGS).updateOne(
    filter,
    {
      $set: {
        taken: params.taken,
        timeTaken: params.timeTaken ?? null,
        timestampUtc: now,
        updatedAt: now,
      },
      $setOnInsert: {
        id: randomUUID(),
        householdId: scope.householdId,
        userId: scope.userId,
        supplementId: params.supplementId,
        dayKey: params.dayKey,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const doc = await db.collection(SUPPLEMENT_LOGS).findOne(filter);
  return stripInternal<SupplementLog>(doc);
}
