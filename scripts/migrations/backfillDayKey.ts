#!/usr/bin/env tsx
/**
 * Backfill habitEntries.dayKey from legacy "date" or "dateKey" so the unique index
 * (householdId, userId, habitId, dayKey) can be enforced. Run this when you see:
 *   E11000 duplicate key ... idx_habitEntries_user_habit_dayKey_active_unique dup key: { ..., dayKey: null }
 *
 * Does not modify householdId; operates per-document. Report includes householdId for auditing.
 *
 * Default: --dry-run (read-only). Use --apply to update documents.
 *
 * Usage:
 *   npx tsx scripts/migrations/backfillDayKey.ts --dry-run
 *   npx tsx scripts/migrations/backfillDayKey.ts --apply --i-understand-this-will-modify-data
 */

import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { MongoClient, ObjectId } from 'mongodb';
import { getMongoDbUri, getMongoDbName } from '../../src/server/config/env';
import { writeFileSync, mkdirSync } from 'fs';

const COLLECTION = 'habitEntries';
const DAYKEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type Doc = {
  _id: ObjectId;
  id?: string;
  householdId?: string | null;
  userId: string;
  habitId: string;
  dayKey?: string;
  date?: string;
  dateKey?: string;
  timestamp?: string;
  deletedAt?: unknown;
  [k: string]: unknown;
};

type Report = {
  timestamp: string;
  dryRun: boolean;
  dbName: string;
  host: string;
  docsMissingDayKey: number;
  docsUpdated: number;
  docsSkippedNoSource: number;
  sampleUpdated: Array<{ id: string; householdId?: string | null; date?: string; dateKey?: string; dayKeySet: string }>;
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

function deriveDayKey(doc: Doc): string | null {
  if (doc.dayKey && DAYKEY_REGEX.test(String(doc.dayKey))) return String(doc.dayKey);
  if (doc.date && DAYKEY_REGEX.test(String(doc.date))) return String(doc.date);
  if (doc.dateKey && DAYKEY_REGEX.test(String(doc.dateKey))) return String(doc.dateKey);
  if (doc.timestamp && typeof doc.timestamp === 'string') {
    const d = new Date(doc.timestamp);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  return null;
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

    const missingDayKey = await coll
      .find({
        $or: [{ dayKey: { $exists: false } }, { dayKey: null }],
      })
      .toArray();

    const toUpdate: { doc: Doc; dayKey: string }[] = [];
    let skipped = 0;
    for (const doc of missingDayKey) {
      const dk = deriveDayKey(doc);
      if (dk) toUpdate.push({ doc, dayKey: dk });
      else skipped++;
    }

    const report: Report = {
      timestamp: new Date().toISOString(),
      dryRun,
      dbName,
      host,
      docsMissingDayKey: missingDayKey.length,
      docsUpdated: 0,
      docsSkippedNoSource: skipped,
      sampleUpdated: toUpdate.slice(0, 15).map(({ doc, dayKey }) => ({
        id: doc.id ?? doc._id.toString(),
        householdId: doc.householdId ?? undefined,
        date: doc.date,
        dateKey: doc.dateKey,
        dayKeySet: dayKey,
      })),
    };

    if (dryRun) {
      console.log(
        '[dry-run] Documents missing dayKey:',
        missingDayKey.length,
        '| Can backfill:',
        toUpdate.length,
        '| No date/dateKey/timestamp:',
        skipped
      );
      if (toUpdate.length > 0) {
        console.log('[dry-run] Sample:', report.sampleUpdated);
      }
    } else {
      console.log('DB:', dbName, 'Host:', host);
      console.log('Backfilling dayKey on', toUpdate.length, 'document(s).');
      const now = new Date().toISOString();
      let updated = 0;
      for (const { doc, dayKey } of toUpdate) {
        const result = await coll.updateOne(
          { _id: doc._id },
          { $set: { dayKey, updatedAt: now } }
        );
        if (result.modifiedCount) updated++;
      }
      report.docsUpdated = updated;
      console.log('Updated', updated, 'document(s).');
    }

    const reportDir = resolve(process.cwd(), 'docs', 'migrations');
    mkdirSync(reportDir, { recursive: true });
    const reportPath = resolve(
      reportDir,
      `backfill-dayKey-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
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
