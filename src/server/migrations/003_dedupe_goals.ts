/**
 * Migration 003: De-duplicate Goals
 *
 * Removes duplicate goals created by a burst of identical create requests
 * (e.g. a double-clicked "Repeat"/"Extend" on the goal-completed screen, which
 * had no in-flight guard). For each user, goals identical across
 * title / type / targetValue / categoryId / linkedHabitIds / completed-state are
 * collapsed to the earliest-created one; the rest are deleted and any habit
 * `linkedGoalId` pointing at a removed copy is re-pointed to the survivor via
 * the same helper the delete route uses.
 *
 * Goals belonging to a goal track are left untouched to avoid disturbing track
 * ordering/advancement.
 *
 * This migration is IDEMPOTENT: once duplicates are gone, re-running is a no-op.
 *
 * Usage:
 *   npx tsx src/server/migrations/003_dedupe_goals.ts [--dry-run]
 */

import { getDb } from '../lib/mongoClient';
import { deleteGoal } from '../repositories/goalRepository';
import { unlinkHabitsFromGoal } from '../repositories/habitRepository';

const DRY_RUN = process.argv.includes('--dry-run');

interface GoalDoc {
  id: string;
  householdId: string;
  userId: string;
  title: string;
  type: string;
  targetValue: number;
  categoryId?: string;
  linkedHabitIds?: string[];
  completedAt?: string | null;
  trackId?: string;
  createdAt: string;
}

function dedupeKey(g: GoalDoc): string {
  const habits = [...(g.linkedHabitIds ?? [])].sort().join(',');
  const completed = g.completedAt ? 'done' : 'open';
  return [
    g.householdId,
    g.userId,
    g.title,
    g.type,
    g.targetValue,
    g.categoryId ?? '',
    completed,
    habits,
  ].join('|');
}

async function migrate(): Promise<void> {
  console.log(`\n=== Migration 003: De-duplicate Goals ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log('');

  const db = await getDb();
  const collection = db.collection('goals');

  // Only standalone goals — never touch track members.
  const goals = (await collection
    .find({ trackId: { $exists: false } })
    .toArray()) as unknown as GoalDoc[];

  const groups = new Map<string, GoalDoc[]>();
  for (const g of goals) {
    const key = dedupeKey(g);
    const list = groups.get(key);
    if (list) list.push(g);
    else groups.set(key, [g]);
  }

  let removed = 0;
  let groupsWithDupes = 0;

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    groupsWithDupes++;

    // Keep the earliest-created goal; remove the rest.
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const [survivor, ...duplicates] = list;
    console.log(
      `  [${survivor.userId}] "${survivor.title}" — keeping ${survivor.id}, removing ${duplicates.length} duplicate(s)`
    );

    if (DRY_RUN) continue;

    for (const dup of duplicates) {
      await deleteGoal(dup.id, dup.householdId, dup.userId);
      // Re-point/clear any habit linkedGoalId that referenced the removed copy
      // (lands on the survivor, which references the same habits).
      await unlinkHabitsFromGoal(dup.id, dup.householdId, dup.userId);
      removed++;
    }
  }

  console.log('');
  console.log(
    `Results: ${groupsWithDupes} duplicated goal group(s), ${removed} duplicate goal(s) removed${DRY_RUN ? ' (dry-run)' : ''}`
  );
  console.log('=== Migration 003 complete ===\n');
}

// Auto-run when executed directly (not when imported)
const isDirectRun = process.argv[1]?.includes('003_dedupe_goals');
if (isDirectRun) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export { migrate as dedupeGoals };
