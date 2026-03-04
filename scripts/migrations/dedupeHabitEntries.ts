#!/usr/bin/env tsx
/**
 * Deduplicate HabitEntries by (userId, habitId, dayKey).
 * Active docs only (deletedAt not set). Deterministic winner: most recent updatedAt, else createdAt, else _id.
 * Losers are soft-deleted (deletedAt + meta.dedupe).
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

type Doc = {
  _id: ObjectId;
  id?: string;
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
  key: { userId: string; habitId: string; dayKey: string };
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
  docsArchived: number;
  docsSoftDeleted: number;
  sampleGroups: Array<{
    key: { userId: string; habitId: string; dayKey: string };
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
  return (doc.dayKey ?? doc.date ?? '').toString();
}

function compareDocs(a: Doc, b: Doc): number {
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

    const active = await coll
      .find({ deletedAt: { $exists: false } })
      .toArray();

    const byKey = new Map<string, Doc[]>();
    for (const doc of active) {
      const dk = canonicalDayKey(doc);
      if (!dk) continue;
      const key = `${doc.userId}\t${doc.habitId}\t${dk}`;
      const list = byKey.get(key) ?? [];
      list.push(doc);
      byKey.set(key, list);
    }

    const groups: DupeGroup[] = [];
    for (const list of byKey.values()) {
      if (list.length <= 1) continue;
      list.sort(compareDocs);
      groups.push({
        key: {
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
      docsArchived: 0,
      docsSoftDeleted: 0,
      sampleGroups,
    };

    if (dryRun) {
      console.log('[dry-run] Duplicate groups:', groups.length, 'Total duplicate docs:', duplicatesFound);
      if (groups.length > 0) {
        console.log('[dry-run] Sample keys:', sampleGroups.map((s) => s.key));
      }
    } else {
      console.log('DB:', dbName, 'Host:', host);
      console.log('Applying soft-delete to', duplicatesFound, 'loser(s) in', groups.length, 'group(s).');
      const now = new Date().toISOString();
      let softDeleted = 0;
      for (const g of groups) {
        for (const loser of g.losers) {
          await coll.updateOne(
            { _id: loser._id },
            {
              $set: {
                deletedAt: now,
                updatedAt: now,
                'meta.dedupe': {
                  winnerId: g.winner.id ?? g.winner._id.toString(),
                  dedupedAt: now,
                  reason: 'dedupe',
                },
              },
            }
          );
          softDeleted++;
        }
      }
      report.docsSoftDeleted = softDeleted;
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
