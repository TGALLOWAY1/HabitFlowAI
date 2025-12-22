/**
 * DashboardPrefs Repository
 *
 * Stores user-scoped dashboard preferences (view-only), such as pinnedRoutineIds.
 * Guardrail: This must never affect truth stores.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, WELLBEING_METRIC_KEYS, isWellbeingMetricKey, type DashboardPrefs } from '../../models/persistenceTypes';
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
    return { userId, pinnedRoutineIds: [], checkinExtraMetricKeys: [], updatedAt: new Date().toISOString() };
  }

  const { _id, ...prefs } = doc as any;
  return prefs as DashboardPrefs;
}

export async function updateDashboardPrefs(
  userId: string,
  patch: { pinnedRoutineIds?: string[]; checkinExtraMetricKeys?: string[] }
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

  if (patch.checkinExtraMetricKeys !== undefined) {
    if (!Array.isArray(patch.checkinExtraMetricKeys)) {
      throw new Error('checkinExtraMetricKeys must be an array of wellbeing metric keys');
    }
    const cleaned = patch.checkinExtraMetricKeys
      .filter((x) => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .filter((x) => isWellbeingMetricKey(x))
      // notes is handled separately in UI (collapsible textarea), do not store as an "extra metric"
      .filter((x) => x !== 'notes');

    // stable ordering
    const uniq = Array.from(new Set(cleaned));
    // Ensure stored keys remain within canonical set (defense in depth)
    const allowed = new Set(WELLBEING_METRIC_KEYS);
    update.checkinExtraMetricKeys = uniq.filter((k) => allowed.has(k as any)) as any;
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
        checkinExtraMetricKeys: [],
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const { _id, ...prefs } = result as any;
  return prefs as DashboardPrefs;
}


