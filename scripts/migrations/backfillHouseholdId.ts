#!/usr/bin/env tsx
/**
 * Backfill householdId on existing documents so queries scoped by householdId don't miss them.
 * If a doc already has householdId, it is left unchanged. Otherwise householdId is set to
 * "default-household" (single-household legacy data).
 *
 * Default: --dry-run (read-only). Use --apply to update documents; requires confirmation.
 *
 * Usage:
 *   node scripts/migrations/backfillHouseholdId.ts --dry-run
 *   npx tsx scripts/migrations/backfillHouseholdId.ts --dry-run
 *   npx tsx scripts/migrations/backfillHouseholdId.ts --apply --i-understand-this-will-modify-data
 */

import { resolve } from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { MongoClient, ObjectId } from 'mongodb';
import { getMongoDbUri, getMongoDbName } from '../../src/server/config/env';
import { writeFileSync, mkdirSync } from 'fs';

const DEFAULT_HOUSEHOLD_ID = 'default-household';

const COLLECTIONS = [
  'habits',
  'categories',
  'goals',
  'habitEntries',
  'routines',
  'habitPotentialEvidence',
] as const;

type Doc = {
  _id: ObjectId;
  householdId?: string | null;
  userId?: string;
  [k: string]: unknown;
};

type CollectionReport = {
  collection: string;
  docsMissingHouseholdId: number;
  docsToUpdate: number;
  docsUpdated: number;
  docsSkippedHasHouseholdId: number;
  sampleIds: string[];
};

type Report = {
  timestamp: string;
  dryRun: boolean;
  dbName: string;
  host: string;
  defaultHouseholdId: string;
  collections: Record<string, CollectionReport>;
  totalUpdated: number;
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

function needsBackfill(doc: Doc): boolean {
  const h = doc.householdId;
  return h === undefined || h === null || (typeof h === 'string' && h.trim() === '');
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
  const report: Report = {
    timestamp: new Date().toISOString(),
    dryRun,
    dbName,
    host,
    defaultHouseholdId: DEFAULT_HOUSEHOLD_ID,
    collections: {},
    totalUpdated: 0,
  };

  try {
    await client.connect();
    const db = client.db(dbName);

    for (const collName of COLLECTIONS) {
      const coll = db.collection<Doc>(collName);

      const missing = await coll
        .find({
          $or: [
            { householdId: { $exists: false } },
            { householdId: null },
            { householdId: '' },
          ],
        })
        .toArray();

      const toUpdate = missing.filter(needsBackfill);
      const skipped = missing.length - toUpdate.length;

      const collectionReport: CollectionReport = {
        collection: collName,
        docsMissingHouseholdId: missing.length,
        docsToUpdate: toUpdate.length,
        docsUpdated: 0,
        docsSkippedHasHouseholdId: skipped,
        sampleIds: toUpdate.slice(0, 10).map((d) => (d.id as string) ?? d._id.toString()),
      };

      if (dryRun) {
        console.log(
          `[dry-run] ${collName}: missing householdId=${missing.length} | would set to "${DEFAULT_HOUSEHOLD_ID}": ${toUpdate.length}`
        );
      } else {
        let updated = 0;
        const now = new Date().toISOString();
        for (const doc of toUpdate) {
          const updatePayload: Record<string, unknown> = { householdId: DEFAULT_HOUSEHOLD_ID };
          if (collName === 'habitEntries' || collName === 'habits' || collName === 'routines' || collName === 'categories' || collName === 'goals') {
            updatePayload.updatedAt = now;
          }
          const result = await coll.updateOne(
            { _id: doc._id },
            { $set: updatePayload }
          );
          if (result.modifiedCount) updated++;
        }
        collectionReport.docsUpdated = updated;
        report.totalUpdated += updated;
        if (toUpdate.length > 0) {
          console.log(`${collName}: updated ${updated} document(s).`);
        }
      }

      report.collections[collName] = collectionReport;
    }

    const reportDir = resolve(process.cwd(), 'docs', 'migrations');
    mkdirSync(reportDir, { recursive: true });
    const reportPath = resolve(
      reportDir,
      `backfill-householdId-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Report written to', reportPath);
    if (dryRun) {
      const totalWouldUpdate = Object.values(report.collections).reduce(
        (s, c) => s + c.docsToUpdate,
        0
      );
      console.log('[dry-run] Total documents that would be updated:', totalWouldUpdate);
    } else {
      console.log('Total documents updated:', report.totalUpdated);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
