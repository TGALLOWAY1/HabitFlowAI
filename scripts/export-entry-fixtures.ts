/**
 * TEMPORARY fixture exporter for the iOS M3-001 entry write contract.
 *
 * Emits the PUT /api/entries and DELETE /api/entries/key response shapes,
 * compile-time checked against the server's HabitEntry type; the response
 * envelope mirrors the exact literals in habitEntries.ts (upsertHabitEntryRoute
 * returns { entry, dayLog, completedGoalIds }; deleteHabitEntryByKeyRoute
 * returns { success, dayLog }). Error fixtures use this route's bare
 * `{ error: string }` form verbatim from the route source.
 *
 * Run: npx tsx scripts/export-entry-fixtures.ts <outDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HabitEntry } from '../src/models/persistenceTypes';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: tsx scripts/export-entry-fixtures.ts <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const entry: HabitEntry = {
  id: 'entry-0f8c2a41-synthetic',
  habitId: 'habit-bool-done',
  timestamp: '2026-03-04T18:41:22.512Z',
  value: 1,
  source: 'manual',
  dayKey: '2026-03-04',
  createdAt: '2026-03-04T18:41:22.512Z',
  updatedAt: '2026-03-04T18:41:22.512Z',
};

// Legacy compatibility object; the iOS contract deliberately ignores it.
const dayLog: Record<string, unknown> = {
  dateKey: '2026-03-04',
  habitStatus: { 'habit-bool-done': true },
};

const upsertResponse: {
  entry: HabitEntry;
  dayLog: Record<string, unknown>;
  completedGoalIds: string[];
} = {
  entry,
  dayLog,
  completedGoalIds: ['goal-b2-exam'],
};

const upsertRaw = JSON.parse(JSON.stringify(upsertResponse));
upsertRaw.futureResponseField = 'ignore me';
upsertRaw.entry.futureEntryField = 42;

const deleteResponse: { success: true; dayLog: Record<string, unknown> } = {
  success: true,
  dayLog,
};

writeFileSync(join(outDir, 'entryUpsertSuccess.json'), JSON.stringify(upsertRaw, null, 2) + '\n');
writeFileSync(join(outDir, 'entryDeleteSuccess.json'), JSON.stringify(deleteResponse, null, 2) + '\n');
writeFileSync(
  join(outDir, 'entryErrorMissingKey.json'),
  JSON.stringify({ error: 'habitId and dateKey are required' }, null, 2) + '\n',
);
writeFileSync(
  join(outDir, 'entryErrorHabitNotFound.json'),
  JSON.stringify({ error: 'Habit not found' }, null, 2) + '\n',
);
writeFileSync(
  join(outDir, 'entryErrorStoredCompletion.json'),
  JSON.stringify(
    {
      error:
        'Field "completed" is not allowed. Completion/progress must be derived from HabitEntries, not stored.',
    },
    null,
    2,
  ) + '\n',
);
console.log(`wrote 5 fixtures to ${outDir}`);
