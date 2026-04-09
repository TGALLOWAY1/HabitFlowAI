/**
 * DashboardPrefs Repository
 *
 * Stores user-scoped dashboard preferences (view-only), such as pinnedRoutineIds.
 * Guardrail: This must never affect truth stores.
 */

import { getDb } from '../lib/mongoClient';
import { MONGO_COLLECTIONS, WELLBEING_METRIC_KEYS, isWellbeingMetricKey, type DashboardPrefs } from '../../models/persistenceTypes';
import { JOURNAL_TEMPLATES } from '../../data/journalTemplates';
import { getRoutines } from './routineRepository';
import { requireScope, scopeFilter } from '../lib/scoping';

const COLLECTION = MONGO_COLLECTIONS.DASHBOARD_PREFS;

let indexesEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  const col = db.collection(COLLECTION);
  await col.createIndex({ householdId: 1, userId: 1 }, { name: 'by_household_user', unique: true });
  indexesEnsured = true;
}

export async function getDashboardPrefs(householdId: string, userId: string): Promise<DashboardPrefs> {
  const scope = requireScope(householdId, userId);
  await ensureIndexes();
  const db = await getDb();
  const col = db.collection(COLLECTION);

  const doc = await col.findOne(scopeFilter(scope.householdId, scope.userId));
  if (!doc) {
    return { userId: scope.userId, pinnedRoutineIds: [], checkinExtraMetricKeys: [], updatedAt: new Date().toISOString() };
  }

  const { _id, householdId: _householdId, ...prefs } = doc as any;
  return prefs as DashboardPrefs;
}

export async function updateDashboardPrefs(
  householdId: string,
  userId: string,
  patch: { pinnedRoutineIds?: string[]; pinnedJournalTemplateIds?: string[]; checkinExtraMetricKeys?: string[]; hideStreaks?: boolean }
): Promise<DashboardPrefs> {
  const scope = requireScope(householdId, userId);
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

    const routines = await getRoutines(scope.householdId, scope.userId);
    const validIdSet = new Set(routines.map((r) => r.id));
    const filtered = ids.filter((id) => validIdSet.has(id));

    update.pinnedRoutineIds = filtered;
  }

  if (patch.pinnedJournalTemplateIds !== undefined) {
    if (!Array.isArray(patch.pinnedJournalTemplateIds)) {
      throw new Error('pinnedJournalTemplateIds must be an array of template IDs');
    }
    const ids = patch.pinnedJournalTemplateIds
      .filter((x) => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    const validIdSet = new Set(JOURNAL_TEMPLATES.map((t) => t.id));
    update.pinnedJournalTemplateIds = ids.filter((id) => validIdSet.has(id));
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

  if (patch.hideStreaks !== undefined) {
    update.hideStreaks = !!patch.hideStreaks;
  }

  // Fix: Use full document replace approach to avoid MongoDB update conflicts
  // Get existing prefs first, then merge and replace
  const existing = await col.findOne(scopeFilter(scope.householdId, scope.userId));
  const existingPrefs = existing
    ? ({ ...existing, _id: undefined, householdId: undefined } as any as DashboardPrefs)
    : { userId: scope.userId, pinnedRoutineIds: [], checkinExtraMetricKeys: [], updatedAt: now };

  // Merge patch into existing prefs
  const merged: DashboardPrefs = {
    ...existingPrefs,
    ...update,
    userId: scope.userId, // Always set userId
    updatedAt: now,
  };

  // Ensure arrays exist (defensive)
  if (!merged.pinnedRoutineIds) merged.pinnedRoutineIds = [];
  if (!merged.checkinExtraMetricKeys) merged.checkinExtraMetricKeys = [];

  const result = await col.findOneAndUpdate(
    scopeFilter(scope.householdId, scope.userId),
    { $set: { ...merged, householdId: scope.householdId } as any },
    { upsert: true, returnDocument: 'after' }
  );

  const { _id, householdId: _householdId, ...prefs } = result as any;
  return prefs as DashboardPrefs;
}

