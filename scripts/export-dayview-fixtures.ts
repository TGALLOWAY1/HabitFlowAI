/**
 * TEMPORARY fixture exporter for the iOS M2-001 Today read contract.
 *
 * Emits DayViewResponse JSON that is (a) compile-time checked against the
 * server's own DayViewResponse/DayViewHabitStatus/Habit types and (b) uses the
 * server's own derivation functions (deriveDailyHabitCompletion,
 * deriveWeeklyHabitProgress) for every derived field, so the fixture values
 * provably match server logic at this source revision.
 *
 * Not a substitute for live traffic capture (mongod is unavailable in this
 * environment); provenance is recorded in the fixture README on the iOS side.
 *
 * Run: npx tsx scripts/export-dayview-fixtures.ts <outDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Habit } from '../src/models/persistenceTypes';
import type { DayViewResponse, DayViewHabitStatus } from '../src/server/services/dayViewService';
import { deriveDailyHabitCompletion } from '../src/domain/habits/completion';
import { deriveWeeklyHabitProgress } from '../src/domain/habits/weeklyProgress';
import type { DayKey } from '../src/domain/time/dayKey';
import { hasExplicitWeeklyQuotaOnDay } from '../src/domain/habits/schedule';
import { evaluateChecklistSuccess } from '../src/server/services/checklistSuccessService';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: tsx scripts/export-dayview-fixtures.ts <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// Wednesday; ISO week (Monday start) is 2026-03-02 .. 2026-03-08.
const dayKey = '2026-03-04' as DayKey;
const weekStart = '2026-03-02' as DayKey;
const weekEnd = '2026-03-08' as DayKey;

function habitBase(id: string, name: string, overrides: Partial<Habit>): Habit {
  return {
    id,
    categoryId: 'cat-health-0001',
    name,
    goal: { type: 'boolean', frequency: 'daily' },
    archived: false,
    createdAt: '2025-11-01T14:30:00.000Z',
    ...overrides,
  };
}

const booleanDone = habitBase('habit-bool-done', 'Morning stretch', {
  type: 'boolean',
  order: 0,
  scheduledTime: '07:00',
});
const booleanTodo = habitBase('habit-bool-todo', 'Read 20 minutes', {
  type: 'boolean',
  order: 1,
  description: 'Any book counts',
});
const numericPartial = habitBase('habit-num-partial', 'Drink water', {
  type: 'number',
  goal: { type: 'number', target: 8, unit: 'glasses', frequency: 'daily' },
  order: 2,
});
const numericOver = habitBase('habit-num-over', 'Push-ups', {
  type: 'number',
  goal: { type: 'number', target: 20, unit: 'reps', frequency: 'daily' },
  order: 3,
});
const numericNoTarget = habitBase('habit-num-manual', 'Meditation minutes', {
  type: 'number',
  goal: { type: 'number', unit: 'minutes', frequency: 'daily' },
  order: 4,
});
const weeklyQuota = habitBase('habit-weekly-gym', 'Gym session', {
  type: 'boolean',
  timesPerWeek: 3,
  order: 5,
});
const checklistChild1 = habitBase('habit-child-floss', 'Floss', {
  type: 'boolean',
  bundleParentId: 'habit-bundle-evening',
  order: 7,
});
const checklistChild2 = habitBase('habit-child-journal', 'One-line journal', {
  type: 'boolean',
  bundleParentId: 'habit-bundle-evening',
  order: 8,
});
const checklistBundle = habitBase('habit-bundle-evening', 'Evening wind-down', {
  type: 'bundle',
  bundleType: 'checklist',
  subHabitIds: [checklistChild1.id, checklistChild2.id],
  checklistSuccessRule: { type: 'full' },
  order: 6,
});
const choiceChildRun = habitBase('habit-child-run', 'Run', {
  type: 'boolean',
  bundleParentId: 'habit-bundle-cardio',
  order: 10,
});
const choiceChildBike = habitBase('habit-child-bike', 'Bike', {
  type: 'boolean',
  bundleParentId: 'habit-bundle-cardio',
  order: 11,
});
const choiceBundle = habitBase('habit-bundle-cardio', 'Cardio (pick one)', {
  type: 'bundle',
  bundleType: 'choice',
  subHabitIds: [choiceChildRun.id, choiceChildBike.id],
  order: 9,
});

function dailyStatus(habit: Habit, values: number[]): DayViewHabitStatus {
  return {
    habit,
    ...deriveDailyHabitCompletion(habit, values.map(value => ({ value })), dayKey),
  };
}

// Mirrors the weekly branch of computeDayView (dayViewService.ts).
function weeklyStatus(habit: Habit, completedDayKeys: DayKey[]): DayViewHabitStatus {
  if (!hasExplicitWeeklyQuotaOnDay(habit, dayKey)) {
    throw new Error(`${habit.id} is not a weekly-quota habit on ${dayKey}`);
  }
  const entries = completedDayKeys.map((entryDayKey, index) => ({
    habitId: habit.id,
    dayKey: entryDayKey,
    value: 1,
    id: `entry-${habit.id}-${index}`,
  }));
  const progress = deriveWeeklyHabitProgress(habit, weekStart, weekEnd, entries);
  return {
    habit,
    isComplete: progress.isComplete,
    isPartial: progress.currentValue > 0 && !progress.isComplete,
    currentValue: progress.currentValue,
    targetValue: progress.targetValue,
    progressPercent: progress.targetValue > 0
      ? Math.min(100, Math.round((progress.currentValue / progress.targetValue) * 100))
      : 0,
    weekComplete: progress.isComplete,
  };
}

// Mirrors the bundle branch of computeDayView (dayViewService.ts).
function bundleStatus(
  bundleHabit: Habit,
  childStatuses: DayViewHabitStatus[],
): DayViewHabitStatus {
  const completedChildrenCount = childStatuses.filter(status => status.isComplete).length;
  const totalChildrenCount = childStatuses.length;
  const isComplete = bundleHabit.bundleType === 'checklist'
    ? evaluateChecklistSuccess(
        completedChildrenCount,
        totalChildrenCount,
        bundleHabit.checklistSuccessRule,
      ).meetsSuccessRule
    : completedChildrenCount > 0;
  return {
    habit: bundleHabit,
    isComplete,
    isPartial: completedChildrenCount > 0 && !isComplete,
    currentValue: completedChildrenCount,
    targetValue: totalChildrenCount,
    progressPercent: totalChildrenCount > 0
      ? Math.min(100, Math.round((completedChildrenCount / totalChildrenCount) * 100))
      : 0,
    completedChildrenCount,
    totalChildrenCount,
  };
}

const checklistChild1Status = dailyStatus(checklistChild1, [1]);
const checklistChild2Status = dailyStatus(checklistChild2, []);
const choiceRunStatus = dailyStatus(choiceChildRun, [1]);
const choiceBikeStatus = dailyStatus(choiceChildBike, []);

const mixed: DayViewResponse = {
  dayKey,
  habits: [
    dailyStatus(booleanDone, [1]),
    dailyStatus(booleanTodo, []),
    dailyStatus(numericPartial, [2, 1]),
    dailyStatus(numericOver, [25]),
    dailyStatus(numericNoTarget, [15]),
    weeklyStatus(weeklyQuota, ['2026-03-02' as DayKey, '2026-03-03' as DayKey]),
    bundleStatus(checklistBundle, [checklistChild1Status, checklistChild2Status]),
    checklistChild1Status,
    checklistChild2Status,
    bundleStatus(choiceBundle, [choiceRunStatus, choiceBikeStatus]),
    choiceRunStatus,
    choiceBikeStatus,
  ],
};

const empty: DayViewResponse = { dayKey, habits: [] };

// Sanity assertions so a silent semantic drift in the imported functions fails loudly.
function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`fixture assertion failed: ${label}`);
}
assert(mixed.habits[0].isComplete && mixed.habits[0].progressPercent === 100, 'boolean done');
assert(!mixed.habits[1].isComplete && !mixed.habits[1].isPartial, 'boolean todo');
assert(mixed.habits[2].isPartial && mixed.habits[2].currentValue === 3
  && mixed.habits[2].progressPercent === 38, 'numeric partial 3/8');
assert(mixed.habits[3].isComplete && mixed.habits[3].currentValue === 25
  && mixed.habits[3].progressPercent === 100, 'numeric over-target capped');
assert(!mixed.habits[4].isComplete && mixed.habits[4].isPartial
  && mixed.habits[4].targetValue === 0 && mixed.habits[4].progressPercent === 0,
  'numeric without target is progress, never completion');
assert(mixed.habits[5].isPartial && mixed.habits[5].currentValue === 2
  && mixed.habits[5].targetValue === 3 && mixed.habits[5].weekComplete === false,
  'weekly quota 2/3');
assert(!mixed.habits[6].isComplete && mixed.habits[6].isPartial
  && mixed.habits[6].completedChildrenCount === 1 && mixed.habits[6].totalChildrenCount === 2,
  'checklist full-rule 1/2');
assert(mixed.habits[9].isComplete && mixed.habits[9].completedChildrenCount === 1,
  'choice any-child complete');

// Unknown-field tolerance: augment serialized JSON only (keeps typed literals honest).
const mixedRaw = JSON.parse(JSON.stringify(mixed));
mixedRaw.futureResponseField = { note: 'ignore me' };
mixedRaw.habits[0].futureStatusField = 42;
mixedRaw.habits[0].habit.futureHabitField = ['ignore', 'me'];

const errorEnvelope = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'dayKey is required (YYYY-MM-DD format)',
  },
};

writeFileSync(join(outDir, 'dayViewMixed.json'), JSON.stringify(mixedRaw, null, 2) + '\n');
writeFileSync(join(outDir, 'dayViewEmpty.json'), JSON.stringify(empty, null, 2) + '\n');
writeFileSync(join(outDir, 'dayViewValidationError.json'), JSON.stringify(errorEnvelope, null, 2) + '\n');
console.log(`wrote 3 fixtures to ${outDir}`);
