#!/usr/bin/env tsx
/**
 * userId Migration Script — reassign documents from one or more source
 * userIds to a target userId.
 *
 * Safety:
 *   - Dry-run by default (prints report, writes no data).
 *   - Requires --apply to actually modify documents.
 *   - Detects conflicts (same logical key under both source and target).
 *   - Saves a JSON report to docs/migrations/ for every run.
 *   - Idempotent: re-running has no effect if already migrated.
 *
 * Usage:
 *   npx tsx scripts/migrations/migrateUserData.ts \
 *     --from anonymous-user \
 *     --from 32ba4231-79d9-4d07-8aa9-398aee800ce6 \
 *     --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
 *     --dry-run
 *
 *   npx tsx scripts/migrations/migrateUserData.ts \
 *     --from anonymous-user \
 *     --to 8013bd6a-1af4-4dc1-84ec-9e6d51dec7fb \
 *     --apply
 */

import { MongoClient, Db } from 'mongodb';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

// ---------------------------------------------------------------------------
// Collection metadata: which collections to migrate and how to detect conflicts
// ---------------------------------------------------------------------------

interface CollectionSpec {
  name: string;
  /** Fields (besides userId) that form the logical unique key for conflict detection */
  conflictKeys: string[];
}

const COLLECTION_SPECS: CollectionSpec[] = [
  { name: 'habits',          conflictKeys: ['id'] },
  { name: 'categories',      conflictKeys: ['id'] },
  { name: 'goals',           conflictKeys: ['id'] },
  { name: 'habitEntries',    conflictKeys: ['id'] },
  { name: 'dayLogs',         conflictKeys: ['compositeKey'] },
  { name: 'wellbeingLogs',   conflictKeys: ['date'] },
  { name: 'wellbeingEntries',conflictKeys: ['dayKey', 'timeOfDay', 'metricKey'] },
  { name: 'routines',        conflictKeys: ['id'] },
  { name: 'routineLogs',     conflictKeys: ['compositeKey'] },
  { name: 'journalEntries',  conflictKeys: ['id'] },
  { name: 'tasks',           conflictKeys: ['id'] },
  { name: 'goalManualLogs',  conflictKeys: ['id'] },
  { name: 'dashboardPrefs',  conflictKeys: [] },  // one per user, always conflicts
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  from: string[];
  to: string;
  apply: boolean;
  since?: string;
  collections?: string[];
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const from: string[] = [];
  let to = '';
  let apply = false;
  let since: string | undefined;
  let collections: string[] | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--from':
        if (args[i + 1]) { from.push(args[++i]); }
        break;
      case '--to':
        if (args[i + 1]) { to = args[++i]; }
        break;
      case '--apply':
        apply = true;
        break;
      case '--dry-run':
        apply = false;
        break;
      case '--since':
        if (args[i + 1]) { since = args[++i]; }
        break;
      case '--collections':
        if (args[i + 1]) { collections = args[++i].split(',').map(s => s.trim()); }
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  if (from.length === 0) { console.error('ERROR: at least one --from userId required'); process.exit(1); }
  if (!to) { console.error('ERROR: --to userId required'); process.exit(1); }
  if (from.includes(to)) { console.error('ERROR: --from and --to must be different'); process.exit(1); }

  return { from, to, apply, since, collections };
}

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

interface ConflictRecord {
  collection: string;
  conflictKeyValues: Record<string, unknown>;
  fromUserId: string;
}

interface CollectionReport {
  collection: string;
  matchedCount: number;
  wouldReassign: number;
  conflictCount: number;
  conflicts: ConflictRecord[];
  sampleIds: string[];
}

interface MigrationReport {
  timestamp: string;
  mode: 'dry-run' | 'apply';
  from: string[];
  to: string;
  since?: string;
  dbName: string;
  host: string;
  collections: CollectionReport[];
  totalMatched: number;
  totalReassigned: number;
  totalConflicts: number;
}

async function buildCollectionReport(
  db: Db,
  spec: CollectionSpec,
  from: string[],
  to: string,
  since: string | undefined,
): Promise<CollectionReport> {
  const col = db.collection(spec.name);

  // Check if collection exists
  const existing = (await db.listCollections({ name: spec.name }).toArray()).length > 0;
  if (!existing) {
    return { collection: spec.name, matchedCount: 0, wouldReassign: 0, conflictCount: 0, conflicts: [], sampleIds: [] };
  }

  // Build filter for source documents
  const filter: Record<string, unknown> = { userId: { $in: from } };
  if (since) {
    // Try to filter by createdAt or timestamp fields if they exist
    filter.$or = [
      { createdAt: { $gte: since } },
      { timestamp: { $gte: since } },
      { date: { $gte: since } },
      // If none of these fields exist, the doc still matches (no date filter applied)
      { createdAt: { $exists: false }, timestamp: { $exists: false }, date: { $exists: false } },
    ];
  }

  const sourceDocs = await col.find(filter).toArray();
  const matchedCount = sourceDocs.length;

  if (matchedCount === 0) {
    return { collection: spec.name, matchedCount: 0, wouldReassign: 0, conflictCount: 0, conflicts: [], sampleIds: [] };
  }

  // Detect conflicts: find target-user docs with the same logical keys
  const conflicts: ConflictRecord[] = [];

  if (spec.conflictKeys.length > 0) {
    for (const doc of sourceDocs) {
      const conflictFilter: Record<string, unknown> = { userId: to };
      const keyValues: Record<string, unknown> = {};

      for (const key of spec.conflictKeys) {
        conflictFilter[key] = doc[key];
        keyValues[key] = doc[key];
      }

      const existing = await col.findOne(conflictFilter);
      if (existing) {
        conflicts.push({
          collection: spec.name,
          conflictKeyValues: keyValues,
          fromUserId: doc.userId as string,
        });
      }
    }
  } else {
    // Collections with no conflict keys (like dashboardPrefs) — check if target already has a doc
    const targetDoc = await col.findOne({ userId: to });
    if (targetDoc) {
      for (const doc of sourceDocs) {
        conflicts.push({
          collection: spec.name,
          conflictKeyValues: { _id: doc._id },
          fromUserId: doc.userId as string,
        });
      }
    }
  }

  const wouldReassign = matchedCount - conflicts.length;
  const sampleIds = sourceDocs.slice(0, 20).map(d => String(d.id ?? d._id));

  return { collection: spec.name, matchedCount, wouldReassign, conflictCount: conflicts.length, conflicts, sampleIds };
}

async function applyMigration(
  db: Db,
  spec: CollectionSpec,
  from: string[],
  to: string,
  report: CollectionReport,
): Promise<number> {
  if (report.wouldReassign === 0) return 0;

  const col = db.collection(spec.name);

  // Build set of conflict key combos to skip
  const conflictSet = new Set(
    report.conflicts.map(c => JSON.stringify(c.conflictKeyValues))
  );

  let reassigned = 0;

  if (conflictSet.size === 0 && spec.conflictKeys.length > 0) {
    // Fast path: no conflicts, bulk update
    const result = await col.updateMany(
      { userId: { $in: from } },
      { $set: { userId: to } },
    );
    reassigned = result.modifiedCount;
  } else if (spec.conflictKeys.length === 0 && report.conflictCount > 0) {
    // dashboardPrefs-like: skip entirely if target already has a doc
    console.log(`  ⏭  ${spec.name}: skipped (target already has doc, ${report.conflictCount} conflicts)`);
    return 0;
  } else {
    // Doc-by-doc to skip conflicts
    const sourceDocs = await col.find({ userId: { $in: from } }).toArray();
    for (const doc of sourceDocs) {
      const keyValues: Record<string, unknown> = {};
      for (const key of spec.conflictKeys) {
        keyValues[key] = doc[key];
      }
      if (conflictSet.has(JSON.stringify(keyValues))) continue;

      await col.updateOne(
        { _id: doc._id },
        { $set: { userId: to } },
      );
      reassigned++;
    }
  }

  return reassigned;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseArgs();
  const uri = process.env.MONGODB_URI!;
  const dbName = process.env.MONGODB_DB_NAME!;

  if (!uri || !dbName) {
    console.error('ERROR: MONGODB_URI and MONGODB_DB_NAME must be set (via .env or environment)');
    process.exit(1);
  }

  let host = 'unknown';
  try {
    const parsed = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
    host = parsed.hostname;
  } catch { /* keep unknown */ }

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
    autoSelectFamily: false,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    await db.admin().ping();

    const mode = cli.apply ? 'apply' : 'dry-run';
    console.log(`\n=== userId Migration (${mode.toUpperCase()}) ===`);
    console.log(`Host:  ${host}`);
    console.log(`DB:    ${dbName}`);
    console.log(`From:  ${cli.from.join(', ')}`);
    console.log(`To:    ${cli.to}`);
    if (cli.since) console.log(`Since: ${cli.since}`);
    console.log();

    // Filter collection specs if --collections provided
    const specs = cli.collections
      ? COLLECTION_SPECS.filter(s => cli.collections!.includes(s.name))
      : COLLECTION_SPECS;

    // Build reports
    const collectionReports: CollectionReport[] = [];
    for (const spec of specs) {
      const report = await buildCollectionReport(db, spec, cli.from, cli.to, cli.since);
      collectionReports.push(report);

      const status = report.matchedCount === 0
        ? '(empty)'
        : `${report.wouldReassign} to reassign, ${report.conflictCount} conflicts`;
      console.log(`  ${spec.name.padEnd(22)} ${String(report.matchedCount).padStart(5)} matched  →  ${status}`);
    }

    const totalMatched = collectionReports.reduce((s, r) => s + r.matchedCount, 0);
    const totalWouldReassign = collectionReports.reduce((s, r) => s + r.wouldReassign, 0);
    const totalConflicts = collectionReports.reduce((s, r) => s + r.conflictCount, 0);

    console.log(`\nTotal: ${totalMatched} matched, ${totalWouldReassign} to reassign, ${totalConflicts} conflicts`);

    // Apply if requested
    let totalReassigned = 0;
    if (cli.apply) {
      console.log('\n--- APPLYING MIGRATION ---\n');
      for (let i = 0; i < specs.length; i++) {
        const report = collectionReports[i];
        if (report.wouldReassign === 0) continue;
        const count = await applyMigration(db, specs[i], cli.from, cli.to, report);
        console.log(`  ✅ ${specs[i].name}: ${count} documents reassigned`);
        totalReassigned += count;
      }
      console.log(`\nMigration complete: ${totalReassigned} documents reassigned.`);
    } else {
      console.log('\n📋 DRY RUN — no data was modified. Re-run with --apply to execute.');
      totalReassigned = 0;
    }

    // Save report
    const report: MigrationReport = {
      timestamp: new Date().toISOString(),
      mode,
      from: cli.from,
      to: cli.to,
      since: cli.since,
      dbName,
      host,
      collections: collectionReports,
      totalMatched,
      totalReassigned: cli.apply ? totalReassigned : totalWouldReassign,
      totalConflicts,
    };

    const outDir = resolve(process.cwd(), 'docs/migrations');
    mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = resolve(outDir, `user-migration-${ts}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nReport saved to ${outPath}`);

    // Print conflict details if any
    if (totalConflicts > 0) {
      console.log('\n⚠️  Conflicts detected (skipped during migration):');
      for (const cr of collectionReports) {
        for (const conflict of cr.conflicts.slice(0, 10)) {
          console.log(`  ${cr.collection}: keys=${JSON.stringify(conflict.conflictKeyValues)} from=${conflict.fromUserId}`);
        }
        if (cr.conflicts.length > 10) {
          console.log(`  ... and ${cr.conflicts.length - 10} more in ${cr.collection}`);
        }
      }
    }

  } catch (err) {
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
