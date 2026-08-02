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

const COLLECTION = 'habitEntries';
const ARCHIVE_COLLECTION = 'habitEntryDedupeArchive';

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
      groups.push({
        key: {
          householdId,
          userId: list[0].userId,
          habitId: list[0].habitId,
          dayKey: canonicalDayKey(list[0]),
        },
        winner: list[0],
        losers: list.slice(1),
      });
    }

    const duplicatesFound = groups.reduce((s, g) => s + g.losers.length, 0);
    const sampleGroups = groups.slice(0, 10).map((g) => ({
      key: g.key,
      winnerId: g.winner.id ?? g.winner._id.toString(),
      loserIds: g.losers.map((d) => d.id ?? d._id.toString()),
    }));

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
      sampleGroups,
    };

    if (dryRun) {
      console.log('[dry-run] Duplicate groups:', groups.length, 'Total duplicate docs:', duplicatesFound);
      if (groups.length > 0) {
        console.log('[dry-run] Sample keys (householdId, userId, habitId, dayKey):', sampleGroups.map((s) => s.key));
      }
    } else {
      console.log('DB:', dbName, 'Host:', host);
      console.log('Archiving and removing', duplicatesFound, 'loser(s) in', groups.length, 'group(s).');
      const now = new Date().toISOString();
      const archive = db.collection(ARCHIVE_COLLECTION);
      let archived = 0;
      let removed = 0;
      for (const g of groups) {
        for (const loser of g.losers) {
          const { _id, ...archiveDocument } = loser;
          await archive.updateOne(
            { originalCollectionId: _id },
            { $setOnInsert: {
              ...archiveDocument,
              originalCollectionId: _id,
              archivedAt: now,
              dedupe: {
                winnerId: g.winner.id ?? g.winner._id.toString(),
                dedupedAt: now,
                reason: 'unique-index-repair',
              },
            } },
            { upsert: true },
          );
          archived++;
          const deletion = await coll.deleteOne({ _id });
          removed += deletion.deletedCount;
        }
      }
      report.docsArchived = archived;
      report.docsRemoved = removed;
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
