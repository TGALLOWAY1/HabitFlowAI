/**
 * Medication Repository
 *
 * MongoDB data access for Medication definitions and daily MedicationLog "taken"
 * records. All queries are scoped by (householdId, userId).
 *
 * - Medications are soft-deleted via `deletedAt` (truth records are never hard-deleted).
 * - MedicationLogs are idempotent on (userId, medicationId, dayKey).
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { scopeFilter, requireScope } from '../lib/scoping';
import {
  MONGO_COLLECTIONS,
  type Medication,
  type MedicationDosageChange,
  type MedicationLog,
} from '../../models/persistenceTypes';

const MEDICATIONS = MONGO_COLLECTIONS.MEDICATIONS;
const MEDICATION_LOGS = MONGO_COLLECTIONS.MEDICATION_LOGS;

let logIndexesEnsured = false;

async function ensureLogIndexes(): Promise<void> {
  if (logIndexesEnsured) return;
  const db = await getDb();
  await db.collection(MEDICATION_LOGS).createIndex(
    { userId: 1, medicationId: 1, dayKey: 1 },
    { name: 'uniq_user_medication_dayKey', unique: true }
  );
  logIndexesEnsured = true;
}

function stripInternal<T>(doc: any): T {
  const { _id, householdId: _h, userId: _u, ...rest } = doc;
  return rest as T;
}

export type MedicationCreateInput = {
  name: string;
  dosage?: string | null;
  schedule?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
  notes?: string | null;
};

export type MedicationUpdateInput = Partial<MedicationCreateInput> & {
  dosageHistory?: MedicationDosageChange[];
};

/** List non-deleted medications for a user (active first, then by name). */
export async function listMedications(householdId: string, userId: string): Promise<Medication[]> {
  const db = await getDb();
  const documents = await db
    .collection(MEDICATIONS)
    .find(scopeFilter(householdId, userId, { deletedAt: { $in: [null, undefined] } }))
    .toArray();

  const meds = documents.map((d: any) => stripInternal<Medication>(d));
  meds.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return meds;
}

export async function createMedication(
  input: MedicationCreateInput,
  householdId: string,
  userId: string
): Promise<Medication> {
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const now = new Date().toISOString();

  const dosage = input.dosage ?? null;
  const dosageHistory: MedicationDosageChange[] =
    dosage && input.startDate ? [{ dosage, startDate: input.startDate }] : [];

  const medication: Medication = {
    id: randomUUID(),
    userId: scope.userId,
    householdId: scope.householdId,
    name: input.name.trim(),
    dosage,
    schedule: input.schedule ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    active: input.active ?? true,
    dosageHistory,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.collection(MEDICATIONS).insertOne({ ...medication });
  return medication;
}

export async function updateMedication(
  id: string,
  patch: MedicationUpdateInput,
  householdId: string,
  userId: string
): Promise<Medication | null> {
  const db = await getDb();
  const collection = db.collection(MEDICATIONS);

  const existing = await collection.findOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $in: [null, undefined] } })
  );
  if (!existing) return null;

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };

  if (typeof patch.name === 'string') set.name = patch.name.trim();
  if ('schedule' in patch) set.schedule = patch.schedule ?? null;
  if ('startDate' in patch) set.startDate = patch.startDate ?? null;
  if ('endDate' in patch) set.endDate = patch.endDate ?? null;
  if (typeof patch.active === 'boolean') set.active = patch.active;
  if ('notes' in patch) set.notes = patch.notes ?? null;

  // Dosage changes append to the timeline so correlation analysis can see history.
  if ('dosage' in patch) {
    const nextDosage = patch.dosage ?? null;
    set.dosage = nextDosage;
    if (nextDosage && nextDosage !== (existing as any).dosage) {
      const history: MedicationDosageChange[] = Array.isArray((existing as any).dosageHistory)
        ? [...(existing as any).dosageHistory]
        : [];
      history.push({
        dosage: nextDosage,
        startDate: (patch.startDate ?? new Date().toISOString().slice(0, 10)) as string,
      });
      set.dosageHistory = history;
    }
  }
  if (Array.isArray(patch.dosageHistory)) set.dosageHistory = patch.dosageHistory;

  const result = await collection.findOneAndUpdate(
    scopeFilter(householdId, userId, { id }),
    { $set: set },
    { returnDocument: 'after' }
  );
  if (!result) return null;
  return stripInternal<Medication>(result);
}

/** Soft delete a medication (sets deletedAt; preserves history). */
export async function softDeleteMedication(
  id: string,
  householdId: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection(MEDICATIONS).updateOne(
    scopeFilter(householdId, userId, { id, deletedAt: { $in: [null, undefined] } }),
    { $set: { deletedAt: now, active: false, updatedAt: now } }
  );
  return result.matchedCount > 0;
}

/** Get the "taken" logs for a given day. */
export async function getMedicationLogsForDay(
  householdId: string,
  userId: string,
  dayKey: string
): Promise<MedicationLog[]> {
  await ensureLogIndexes();
  const db = await getDb();
  const documents = await db
    .collection(MEDICATION_LOGS)
    .find(scopeFilter(householdId, userId, { dayKey }))
    .toArray();
  return documents.map((d: any) => stripInternal<MedicationLog>(d));
}

/** Get logs across a dayKey range (for future timeline/correlation use). */
export async function getMedicationLogsInRange(
  householdId: string,
  userId: string,
  startDayKey: string,
  endDayKey: string
): Promise<MedicationLog[]> {
  await ensureLogIndexes();
  const db = await getDb();
  const documents = await db
    .collection(MEDICATION_LOGS)
    .find(scopeFilter(householdId, userId, { dayKey: { $gte: startDayKey, $lte: endDayKey } }))
    .sort({ dayKey: 1 })
    .toArray();
  return documents.map((d: any) => stripInternal<MedicationLog>(d));
}

/** Upsert a daily "taken" record for a medication (idempotent per day). */
export async function setMedicationLog(
  params: { medicationId: string; dayKey: string; taken: boolean; timeTaken?: string | null },
  householdId: string,
  userId: string
): Promise<MedicationLog> {
  await ensureLogIndexes();
  const scope = requireScope(householdId, userId);
  const db = await getDb();
  const now = new Date().toISOString();

  const filter = scopeFilter(householdId, userId, {
    medicationId: params.medicationId,
    dayKey: params.dayKey,
  });

  await db.collection(MEDICATION_LOGS).updateOne(
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
        medicationId: params.medicationId,
        dayKey: params.dayKey,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  const doc = await db.collection(MEDICATION_LOGS).findOne(filter);
  return stripInternal<MedicationLog>(doc);
}
