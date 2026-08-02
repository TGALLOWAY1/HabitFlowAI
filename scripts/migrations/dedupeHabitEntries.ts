#!/usr/bin/env tsx
/**
 * Deduplicate HabitEntries by (householdId, userId, habitId, dayKey).
 * Operates within a single household only; never merges or dedupes across households.
 * Includes active and soft-deleted docs because the production invariant uses a
 * full unique index. Deterministic winner: active first, then most recently
 * updated/created, then _id. Losers are copied to a recovery collection before
 * being removed from the indexed collection.
 *
 * Default: --dry-run (read-only). Use --apply to modify data; requires --i-understand-this-will-modify-data.
 *
 * Usage:
 *   npx tsx scripts/migrations/dedupeHabitEntries.ts --dry-run
 *   npx tsx scripts/migrations/dedupeHabitEntries.ts --apply --i-understand-this-will-modify-data
 */

import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { MongoClient, ObjectId } from 'mongodb';
import { getMongoDbUri, getMongoDbName } from '../../src/server/config/env';
import { writeFileSync, mkdirSync } from 'fs';
import {
  planDuplicateHabitEntries,
  type DuplicateGroupPlan,
} from './dedupeHabitEntriesPolicy';

const COLLECTION = 'habitEntries';
const ARCHIVE_COLLECTION = 'habitEntryDedupeArchive';
const UNIQUE_INDEX_NAME = 'idx_habitEntries_user_habit_dayKey_active_unique';

type Doc = {
  _id: ObjectId;
  id?: string;
  householdId?: string | null;
  userId: string;
  habitId: string;
  dayKey?: string;
  date?: string;
  updatedAt?: string;
  createdAt?: string;
  deletedAt?: string;
  [k: string]: unknown;
};

type DupeGroup = {
  key: { householdId: string | null; userId: string; habitId: string; dayKey: string };
  winner: Doc;
  losers: Doc[];
  plan: DuplicateGroupPlan;
  habitName?: string;
  goalType?: 'boolean' | 'number';
};

type Report = {
  timestamp: string;
  dryRun: boolean;
  dbName: string;
  host: string;
  duplicatesFound: number;
  groupsAffected: number;
  documentsMissingDayKey: number;
  docsArchived: number;
  docsRemoved: number;
  uniqueIndexPresent: boolean;
  manualReviewGroups: number;
  resolutionCounts: Record<string, number>;
  groups: Array<{
    key: { householdId: string | null; userId: string; habitId: string; dayKey: string };
    habitName?: string;
    goalType?: 'boolean' | 'number';
    winnerId: string;
    loserIds: string[];
    plan: DuplicateGroupPlan;
  }>;
  sampleGroups: Array<{
    key: { householdId: string | null; userId: string; habitId: string; dayKey: string };
    winnerId: string;
    loserIds: string[];
  }>;
};

function parseArgs(): { dryRun: boolean; apply: boolean; confirm: boolean } {
  const args = process.argv.slice(2);
  let dryRun = true;
  let apply = false;
  let confirm = false;
  for (const a of args) {
    if (a === '--apply') apply = true;
    if (a === '--dry-run') dryRun = true;
    if (a === '--i-understand-this-will-modify-data') confirm = true;
  }
  if (apply) dryRun = false;
  return { dryRun, apply, confirm };
}

function canonicalDayKey(doc: Doc): string {
  return (doc.dayKey ?? '').toString();
}

function compareDocs(a: Doc, b: Doc): number {
  const aActive = !a.deletedAt;
  const bActive = !b.deletedAt;
  if (aActive !== bActive) return aActive ? -1 : 1;
  const aUp = a.updatedAt ?? '';
  const bUp = b.updatedAt ?? '';
  if (aUp !== bUp) return bUp.localeCompare(aUp);
  const aCr = a.createdAt ?? '';
  const bCr = b.createdAt ?? '';
  if (aCr !== bCr) return bCr.localeCompare(aCr);
  return a._id.toString().localeCompare(b._id.toString());
}

async function main(): Promise<void> {
  const { dryRun, apply, confirm } = parseArgs();

  if (apply && !confirm) {
    console.error('ERROR: --apply requires --i-understand-this-will-modify-data');
    process.exit(1);
  }

  const uri = getMongoDbUri();
  const dbName = getMongoDbName();
  if (!uri || !dbName) {
    console.error('ERROR: MONGODB_URI and MONGODB_DB_NAME must be set (e.g. in .env)');
    process.exit(1);
  }

  let host = 'unknown';
  try {
    const u = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
    host = u.hostname;
  } catch {
    // ignore
  }

  const client = new MongoClient(uri, { autoSelectFamily: false });
  try {
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection<Doc>(COLLECTION);
    const habits = await db.collection('habits')
      .find({}, { projection: { householdId: 1, userId: 1, id: 1, name: 1, 'goal.type': 1 } })
      .toArray();
    const habitByScopeAndId = new Map(habits.map(habit => [
      JSON.stringify([
        habit.householdId == null ? null : String(habit.householdId),
        habit.userId,
        habit.id,
      ]),
      habit,
    ]));

    const documents = await coll.find({}).toArray();
    const documentsMissingDayKey = documents.filter(doc => !canonicalDayKey(doc)).length;
    if (documentsMissingDayKey > 0) {
      throw new Error(
        `${documentsMissingDayKey} habitEntries document(s) are missing dayKey. Run backfillDayKey before dedupe.`,
      );
    }

    const byKey = new Map<string, Doc[]>();
    for (const doc of documents) {
      const dk = canonicalDayKey(doc);
      const householdId = doc.householdId == null ? null : String(doc.householdId);
      const key = JSON.stringify([householdId, doc.userId, doc.habitId, dk]);
      const list = byKey.get(key) ?? [];
      list.push(doc);
      byKey.set(key, list);
    }

    const groups: DupeGroup[] = [];
    for (const list of byKey.values()) {
      if (list.length <= 1) continue;
      list.sort(compareDocs);
      const householdId = list[0].householdId == null ? null : String(list[0].householdId);
      const habit = habitByScopeAndId.get(JSON.stringify([
        householdId,
        list[0].userId,
        list[0].habitId,
      ]));
      const goalType = habit?.goal?.type === 'boolean' || habit?.goal?.type === 'number'
        ? habit.goal.type
        : undefined;
      groups.push({
        key: {
          householdId,
          userId: list[0].userId,
          habitId: list[0].habitId,
          dayKey: canonicalDayKey(list[0]),
        },
        winner: list[0],
        losers: list.slice(1),
        plan: planDuplicateHabitEntries(list, goalType),
        habitName: typeof habit?.name === 'string' ? habit.name : undefined,
        goalType,
      });
    }

    const duplicatesFound = groups.reduce((s, g) => s + g.losers.length, 0);
    const sampleGroups = groups.slice(0, 10).map((g) => ({
      key: g.key,
      winnerId: g.winner.id ?? g.winner._id.toString(),
      loserIds: g.losers.map((d) => d.id ?? d._id.toString()),
    }));
    const groupDiagnostics = groups.map(g => ({
      key: g.key,
      habitName: g.habitName,
      goalType: g.goalType,
      winnerId: g.winner.id ?? g.winner._id.toString(),
      loserIds: g.losers.map(d => d.id ?? d._id.toString()),
      plan: g.plan,
    }));
    const manualReviewGroups = groups.filter(group => !group.plan.safeToApply).length;
    const resolutionCounts = groups.reduce<Record<string, number>>((counts, group) => {
      counts[group.plan.resolution] = (counts[group.plan.resolution] ?? 0) + 1;
      return counts;
    }, {});

    const report: Report = {
      timestamp: new Date().toISOString(),
      dryRun,
      dbName,
      host,
      duplicatesFound,
      groupsAffected: groups.length,
      documentsMissingDayKey,
      docsArchived: 0,
      docsRemoved: 0,
      uniqueIndexPresent: false,
      manualReviewGroups,
      resolutionCounts,
      groups: groupDiagnostics,
      sampleGroups,
    };

    if (dryRun) {
      console.log('[dry-run] Duplicate groups:', groups.length, 'Total duplicate docs:', duplicatesFound);
      if (groups.length > 0) {
        console.log('[dry-run] Sample keys (householdId, userId, habitId, dayKey):', sampleGroups.map((s) => s.key));
      }
      console.log('[dry-run] Resolution counts:', resolutionCounts, 'Manual review:', manualReviewGroups);
    } else {
      if (manualReviewGroups > 0) {
        throw new Error(
          `${manualReviewGroups} duplicate group(s) require manual review. No database writes were performed.`,
        );
      }
      console.log('DB:', dbName, 'Host:', host);
      console.log('Archiving originals and consolidating', duplicatesFound, 'duplicate(s) in', groups.length, 'group(s).');
      const now = new Date().toISOString();
      const archive = db.collection(ARCHIVE_COLLECTION);
      let archived = 0;
      let removed = 0;
      for (const g of groups) {
        for (const original of [g.winner, ...g.losers]) {
          const { _id, ...archiveDocument } = original;
          const archiveResult = await archive.updateOne(
            { originalCollectionId: _id },
            { $setOnInsert: {
              ...archiveDocument,
              originalCollectionId: _id,
              archivedAt: now,
              dedupe: {
                winnerId: g.winner.id ?? g.winner._id.toString(),
                dedupedAt: now,
                reason: 'history-preserving-unique-index-repair',
                role: original._id.equals(g.winner._id) ? 'winner-original' : 'loser',
                resolution: g.plan.resolution,
              },
            } },
            { upsert: true },
          );
          archived += archiveResult.upsertedCount;
        }

        if (g.plan.resolution === 'sum-numeric-duplicates') {
          await coll.updateOne(
            { _id: g.winner._id },
            { $set: { value: g.plan.replacementValue } },
          );
        }

        for (const loser of g.losers) {
          const deletion = await coll.deleteOne({ _id: loser._id });
          removed += deletion.deletedCount;
        }
      }
      report.docsArchived = archived;
      report.docsRemoved = removed;

      await coll.createIndex(
        { householdId: 1, userId: 1, habitId: 1, dayKey: 1 },
        { unique: true, name: UNIQUE_INDEX_NAME },
      );
      report.uniqueIndexPresent = true;
    }

    if (dryRun) {
      const indexes = await coll.indexes();
      report.uniqueIndexPresent = indexes.some(index => (
        index.name === UNIQUE_INDEX_NAME && index.unique === true
      ));
    }

    const reportDir = resolve(process.cwd(), 'docs', 'migrations');
    mkdirSync(reportDir, { recursive: true });
    const reportPath = resolve(
      reportDir,
      `dedupe-habitEntries-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Report written to', reportPath);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
