/**
 * Startup Migrations
 *
 * Runs all pending data migrations on server start.
 * Each migration is idempotent and safe to re-run.
 */

import { getDb } from '../lib/mongoClient';

const MIGRATION_COLLECTION = '_migrations';

async function hasRun(migrationId: string): Promise<boolean> {
  const db = await getDb();
  const doc = await db.collection(MIGRATION_COLLECTION).findOne({ _id: migrationId as any });
  return doc != null;
}

async function markComplete(migrationId: string): Promise<void> {
  const db = await getDb();
  await db.collection(MIGRATION_COLLECTION).updateOne(
    { _id: migrationId as any },
    { $set: { completedAt: new Date().toISOString() } },
    { upsert: true }
  );
}

export async function runStartupMigrations(): Promise<void> {
  // Migration 002: Weekly frequency → timesPerWeek
  const m002Id = '002_migrate_weekly_frequency';
  if (!await hasRun(m002Id)) {
    console.log(`[Migrations] Running ${m002Id}...`);
    const { migrateWeeklyFrequency } = await import('./002_migrate_weekly_frequency');
    await migrateWeeklyFrequency();
    await markComplete(m002Id);
    console.log(`[Migrations] ${m002Id} complete.`);
  }
}
