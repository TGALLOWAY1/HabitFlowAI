/**
 * DashboardPrefs Repository
 *
 * Stores user-scoped dashboard preferences (view-only), such as pinnedRoutineIds.
 * Guardrail: This must never affect truth stores.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, type DashboardPrefs } from '../../models/persistenceTypes';
import { getRoutines } from './routineRepository';

const COLLECTION = MONGO_COLLECTIONS.DASHBOARD_PREFS;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex({ userId: 1 }, { name: 'by_userId', unique: true });
  indexesEnsured = true;
}

export async function getDashboardPrefs(userId: string): Promise<DashboardPrefs> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const doc = await col.findOne({ userId });
  if (!doc) {
    return { userId, pinnedRoutineIds: [], updatedAt: new Date().toISOString() };
  }

  const { _id, ...prefs } = doc as any;
  return prefs as DashboardPrefs;
}

export async function updateDashboardPrefs(
  userId: string,
  patch: { pinnedRoutineIds?: string[] }
): Promise<DashboardPrefs> {
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const now = new Date().toISOString();

  const update: Partial<DashboardPrefs> = { updatedAt: now };

  if (patch.pinnedRoutineIds !== undefined) {
    if (!Array.isArray(patch.pinnedRoutineIds)) {
      throw new Error('pinnedRoutineIds must be an array of routine IDs');
    }
    const ids = patch.pinnedRoutineIds
      .filter((x) => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    // Validate existence for this user (soft validation: only keep IDs that exist)
    const routines = await getRoutines(userId);
    const validIdSet = new Set(routines.map((r) => r.id));
    const filtered = ids.filter((id) => validIdSet.has(id));

    update.pinnedRoutineIds = filtered;
  }

  const result = await col.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        ...update,
      },
      $setOnInsert: {
        pinnedRoutineIds: [],
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const { _id, ...prefs } = result as any;
  return prefs as DashboardPrefs;
}


