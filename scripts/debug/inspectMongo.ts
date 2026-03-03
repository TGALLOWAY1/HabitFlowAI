#!/usr/bin/env tsx
/**
 * Read-only MongoDB inspection script.
 *
 * Connects to the same DB the server would use (via .env), lists collections,
 * prints document counts for key collections, and optionally shows one sample
 * _id per collection.
 *
 * Usage:
 *   npx tsx scripts/debug/inspectMongo.ts
 *   npx tsx scripts/debug/inspectMongo.ts --uri mongodb://localhost:27017 --db habitflowai
 *   npx tsx scripts/debug/inspectMongo.ts --show-sample
 *
 * Safety: This script performs NO writes — only listCollections, countDocuments,
 * and findOne (projection: { _id: 1, userId: 1 }).
 */

import { MongoClient } from 'mongodb';
import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const KEY_COLLECTIONS = [
  'habits',
  'categories',
  'goals',
  'habitEntries',
  'dayLogs',
  'wellbeingLogs',
  'wellbeingEntries',
  'routines',
  'routineLogs',
  'journalEntries',
  'tasks',
  'skillTree',
  'dashboardPrefs',
  'routineImages',
  'goalManualLogs',
  'habitPotentialEvidence',
];

function parseArgs() {
  const args = process.argv.slice(2);
  let uri = process.env.MONGODB_URI || '';
  let dbName = process.env.MONGODB_DB_NAME || '';
  let showSample = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--uri' && args[i + 1]) { uri = args[i + 1]; i++; }
    if (args[i] === '--db' && args[i + 1]) { dbName = args[i + 1]; i++; }
    if (args[i] === '--show-sample') { showSample = true; }
  }

  return { uri, dbName, showSample };
}

async function main() {
  const { uri, dbName, showSample } = parseArgs();

  if (!uri) {
    console.error('ERROR: No MONGODB_URI found. Pass --uri or set in .env');
    process.exit(1);
  }
  if (!dbName) {
    console.error('ERROR: No MONGODB_DB_NAME found. Pass --db or set in .env');
    process.exit(1);
  }

  let host = 'unknown';
  try {
    const parsed = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
    host = parsed.hostname;
  } catch { /* keep unknown */ }

  console.log('=== inspectMongo — READ-ONLY ===');
  console.log(`Host:     ${host}`);
  console.log(`DB name:  ${dbName}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV ?? '(unset)'}`);
  console.log();

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
    autoSelectFamily: false,
  });

  try {
    await client.connect();
    const db = client.db(dbName);

    await db.admin().ping();
    console.log('✅ Ping OK\n');

    const collections = (await db.listCollections().toArray()).map(c => c.name).sort();
    console.log(`Collections (${collections.length}):`);
    for (const name of collections) {
      console.log(`  - ${name}`);
    }
    console.log();

    interface CollectionInfo {
      name: string;
      count: number;
      sampleId?: string;
      sampleUserId?: string;
    }

    const results: CollectionInfo[] = [];

    for (const name of KEY_COLLECTIONS) {
      const exists = collections.includes(name);
      if (!exists) {
        results.push({ name, count: 0, sampleId: '(collection missing)' });
        continue;
      }

      const col = db.collection(name);
      const count = await col.countDocuments();
      const entry: CollectionInfo = { name, count };

      if (showSample && count > 0) {
        const sample = await col.findOne({}, { projection: { _id: 1, userId: 1 } });
        if (sample) {
          entry.sampleId = String(sample._id);
          entry.sampleUserId = sample.userId ? String(sample.userId) : '(no userId field)';
        }
      }

      results.push(entry);
    }

    console.log('Key collection counts:');
    console.log('─'.repeat(60));
    for (const r of results) {
      const sampleInfo = r.sampleId && r.sampleId !== '(collection missing)'
        ? `  sample _id=${r.sampleId}  userId=${r.sampleUserId}`
        : r.sampleId === '(collection missing)' ? '  ⚠ MISSING' : '';
      console.log(`  ${r.name.padEnd(30)} ${String(r.count).padStart(6)}${sampleInfo}`);
    }
    console.log('─'.repeat(60));

    const report = {
      timestamp: new Date().toISOString(),
      host,
      dbName,
      nodeEnv: process.env.NODE_ENV ?? '(unset)',
      collections,
      counts: Object.fromEntries(results.map(r => [r.name, r.count])),
      samples: showSample ? Object.fromEntries(results.filter(r => r.sampleId).map(r => [r.name, { _id: r.sampleId, userId: r.sampleUserId }])) : undefined,
    };

    const outDir = resolve(process.cwd(), 'docs/debug');
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, 'mongo-inspection.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    console.log(`\nReport saved to ${outPath}`);

    const totalDocs = results.reduce((sum, r) => sum + r.count, 0);
    if (totalDocs === 0) {
      console.log('\n⚠️  ALL KEY COLLECTIONS ARE EMPTY — data may be in a different DB or was wiped.');
    } else {
      console.log(`\n✅ Total documents across key collections: ${totalDocs}`);
    }

  } catch (err) {
    console.error('Failed to inspect MongoDB:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
