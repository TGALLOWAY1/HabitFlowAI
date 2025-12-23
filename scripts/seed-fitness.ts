/**
 * DEV: Seed fitness-focused habit + routine test data.
 *
 * Usage:
 *   npm run seed:fitness -- --days=30 --seed=456 --userId=demo_fitness
 *
 * Notes:
 * - Creates/ensures 5 habits: Run (numeric), Lift (choice), Recovery (choice), Eat Clean (boolean), Meal Prep (boolean weekly)
 * - Generates HabitEntries for last 30 days with realistic patterns
 * - Creates fitness routines: Push/Pull/Legs, Full Body Circuit, Mobility/Stretch
 * - Pins routines for Action Cards
 * - Does NOT store derived metrics (DayLogs recomputed automatically)
 */
import { createCategory } from '../src/server/repositories/categoryRepository';
import { createHabit, getHabitsByUser } from '../src/server/repositories/habitRepository';
import { upsertHabitEntry } from '../src/server/repositories/habitEntryRepository';
import { recomputeDayLogForHabit } from '../src/server/utils/recomputeUtils';
import { createRoutine } from '../src/server/repositories/routineRepository';
import { updateDashboardPrefs } from '../src/server/repositories/dashboardPrefsRepository';
import { getDb, closeConnection } from '../src/server/lib/mongoClient';
import type { Habit } from '../src/models/persistenceTypes';

type Args = {
  days: number;
  seed: number;
  userId: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    days: 30,
    seed: 456,
    userId: 'demo_fitness',
  };

  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const [k, v] = raw.replace(/^--/, '').split('=');
    if (k === 'days' && v) out.days = Math.max(7, Math.min(365, Number(v)));
    if (k === 'seed' && v) out.seed = Number(v);
    if (k === 'userId' && v) out.userId = String(v);
  }

  if (!Number.isFinite(out.days) || out.days <= 0) throw new Error(`Invalid --days: ${out.days}`);
  if (!Number.isFinite(out.seed)) throw new Error(`Invalid --seed: ${out.seed}`);
  if (!out.userId || out.userId.trim().length === 0) throw new Error('Invalid --userId');

  return out;
}

// Deterministic PRNG (Mulberry32)
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundToDecimal(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function dayKeyDaysAgoUtc(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function dayUtcIso(dayKey: string, hourUtc: number): string {
  return `${dayKey}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`;
}

function weekStartDayKey(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function isWeekend(dayKey: string): boolean {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0=Sun
  return dow === 0 || dow === 6;
}

type HabitSeedSpec = {
  key: 'run' | 'lift' | 'recovery' | 'eat_clean' | 'meal_prep';
  name: string;
  type: 'numeric' | 'choice' | 'boolean';
  frequency: 'daily' | 'weekly';
};

const HABITS: HabitSeedSpec[] = [
  { key: 'run', name: 'Run', type: 'numeric', frequency: 'daily' },
  { key: 'lift', name: 'Lift', type: 'choice', frequency: 'daily' },
  { key: 'recovery', name: 'Recovery', type: 'choice', frequency: 'daily' },
  { key: 'eat_clean', name: 'Eat Clean', type: 'boolean', frequency: 'daily' },
  { key: 'meal_prep', name: 'Meal Prep', type: 'boolean', frequency: 'weekly' },
];

const LIFT_OPTIONS = ['push', 'pull', 'legs'];
const RECOVERY_OPTIONS = ['massage', 'foam roll', 'sauna'];

async function ensureSeedHabits(userId: string): Promise<Record<HabitSeedSpec['key'], Habit>> {
  const category = await createCategory({ name: 'Fitness', color: 'bg-blue-500' }, userId);
  const existing = await getHabitsByUser(userId);

  const out = {} as Record<HabitSeedSpec['key'], Habit>;

  for (let i = 0; i < HABITS.length; i++) {
    const spec = HABITS[i];
    const found = existing.find((h) => h.name === spec.name && h.categoryId === category.id);
    if (found) {
      out[spec.key] = found;
      continue;
    }

    let habitData: any;
    if (spec.type === 'numeric') {
      // Run: numeric, daily, unit: miles
      habitData = {
        categoryId: category.id,
        name: spec.name,
        goal: { type: 'number', frequency: 'daily', unit: 'miles' },
        type: 'number',
        frequency: 'daily',
        order: 900 + i,
      };
    } else if (spec.type === 'choice') {
      // Lift or Recovery: choice bundle
      const options = spec.key === 'lift' ? LIFT_OPTIONS : RECOVERY_OPTIONS;
      habitData = {
        categoryId: category.id,
        name: spec.name,
        goal: { type: 'boolean', frequency: 'daily' },
        type: 'bundle',
        frequency: 'daily',
        bundleType: 'choice',
        bundleOptions: options.map((opt, idx) => ({
          id: `opt_${spec.key}_${opt}_${idx}`,
          label: opt.charAt(0).toUpperCase() + opt.slice(1),
        })),
        order: 900 + i,
      };
    } else {
      // Boolean habits (Eat Clean daily, Meal Prep weekly)
      habitData = {
        categoryId: category.id,
        name: spec.name,
        goal: { type: 'boolean', frequency: spec.frequency },
        type: 'boolean',
        frequency: spec.frequency,
        order: 900 + i,
      };
    }

    const created = await createHabit(habitData, userId);
    out[spec.key] = created;
  }

  return out;
}

async function clearPreviousSeed(userId: string, habitIds: string[], startDayKey: string, endDayKey: string): Promise<void> {
  const db = await getDb();

  await db.collection('habitEntries').deleteMany({
    userId,
    habitId: { $in: habitIds },
    source: 'seed_fitness',
    dayKey: { $gte: startDayKey, $lte: endDayKey },
  });
}

function computeRunValue(rng: () => number): number {
  // Randomize between 0.25 - 5.0 miles
  return roundToDecimal(0.25 + rng() * 4.75, 2);
}

function computeLiftOption(rng: () => number, dayOfWeek: number): string {
  // Realistic weekly split: Push (Mon/Thu), Pull (Tue/Fri), Legs (Wed/Sat)
  const dayPattern: Record<number, string> = {
    1: 'push',    // Monday
    2: 'pull',    // Tuesday
    3: 'legs',     // Wednesday
    4: 'push',    // Thursday
    5: 'pull',    // Friday
    6: 'legs',     // Saturday
    0: 'push',    // Sunday (light push or rest)
  };
  
  // 80% follow pattern, 20% random
  if (rng() < 0.8) {
    return dayPattern[dayOfWeek] || 'push';
  }
  return LIFT_OPTIONS[Math.floor(rng() * LIFT_OPTIONS.length)];
}

function computeRecoveryOption(rng: () => number): string {
  return RECOVERY_OPTIONS[Math.floor(rng() * RECOVERY_OPTIONS.length)];
}

function computeCompletionsForDay(params: {
  rng: () => number;
  dayKey: string;
  weekStartKey: string;
  recoveryCountThisWeek: number;
}): {
  run: { value: number } | null;
  lift: { option: string } | null;
  recovery: { option: string } | null;
  eat_clean: boolean;
  meal_prep: boolean;
} {
  const { rng, dayKey, weekStartKey, recoveryCountThisWeek } = params;
  const weekend = isWeekend(dayKey);
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dayOfWeek = d.getUTCDay();

  // Run: 60% completion rate, higher on weekends
  const runProb = weekend ? 0.7 : 0.55;
  const run = rng() < runProb ? { value: computeRunValue(rng) } : null;

  // Lift: 70% completion, follows weekly split pattern
  const liftProb = weekend ? 0.5 : 0.75;
  const lift = rng() < liftProb ? { option: computeLiftOption(rng, dayOfWeek) } : null;

  // Recovery: 1-3x per week (ensure realistic frequency)
  // If we already have 3 this week, don't add more
  // If we have 0-1, increase probability to ensure at least 1-2
  let recoveryProb = 0.15;
  if (recoveryCountThisWeek === 0) {
    recoveryProb = 0.25; // Higher chance if none yet
  } else if (recoveryCountThisWeek >= 3) {
    recoveryProb = 0; // Stop at 3
  } else if (recoveryCountThisWeek === 1) {
    recoveryProb = 0.2; // Moderate chance for second
  }
  const recovery = rng() < recoveryProb ? { option: computeRecoveryOption(rng) } : null;

  // Eat Clean: 65% completion, imperfect consistency
  const eatCleanProb = weekend ? 0.5 : 0.7;
  const eat_clean = rng() < eatCleanProb;

  // Meal Prep: weekly, only on Sunday (start of week)
  const meal_prep = dayOfWeek === 0 && rng() < 0.85;

  return { run, lift, recovery, eat_clean, meal_prep };
}

async function ensureSeedRoutines(userId: string, categoryId: string, liftHabitId: string): Promise<{
  pushPullLegs: string;
  fullBodyCircuit: string;
  mobilityStretch: string;
}> {
  const routines = [
    {
      title: 'Push / Pull / Legs',
      linkedHabitIds: [liftHabitId],
      steps: [
        { id: 'step1', title: 'Warm-up: 5 min dynamic stretching' },
        { id: 'step2', title: 'Main workout: Push, Pull, or Legs focus' },
        { id: 'step3', title: 'Cool-down: 5 min static stretching' },
      ],
    },
    {
      title: 'Full Body Circuit',
      linkedHabitIds: [liftHabitId],
      steps: [
        { id: 'step1', title: 'Warm-up: 5 min light cardio' },
        { id: 'step2', title: 'Circuit: 3 rounds, 45 sec work / 15 sec rest' },
        { id: 'step3', title: 'Cool-down: 5 min stretching' },
      ],
    },
    {
      title: 'Mobility / Stretch',
      linkedHabitIds: [],
      steps: [
        { id: 'step1', title: 'Full body mobility flow: 10 min' },
        { id: 'step2', title: 'Targeted stretching: 10 min' },
        { id: 'step3', title: 'Relaxation: 5 min' },
      ],
    },
  ];

  const routineIds: string[] = [];
  for (const routineData of routines) {
    const routine = await createRoutine(userId, {
      title: routineData.title,
      categoryId,
      linkedHabitIds: routineData.linkedHabitIds,
      steps: routineData.steps,
    });
    routineIds.push(routine.id);
  }

  return {
    pushPullLegs: routineIds[0],
    fullBodyCircuit: routineIds[1],
    mobilityStretch: routineIds[2],
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(args.seed);

  const startDayKey = dayKeyDaysAgoUtc(args.days - 1);
  const endDayKey = dayKeyDaysAgoUtc(0);

  console.log(`[seed:fitness] userId=${args.userId} days=${args.days} seed=${args.seed}`);
  console.log(`[seed:fitness] range ${startDayKey} → ${endDayKey}`);

  const habits = await ensureSeedHabits(args.userId);
  const habitIdByKey = {
    run: habits.run.id,
    lift: habits.lift.id,
    recovery: habits.recovery.id,
    eat_clean: habits.eat_clean.id,
    meal_prep: habits.meal_prep.id,
  };
  const habitIds = Object.values(habitIdByKey);

  await clearPreviousSeed(args.userId, habitIds, startDayKey, endDayKey);

  const category = await createCategory({ name: 'Fitness', color: 'bg-blue-500' }, args.userId);
  const routines = await ensureSeedRoutines(args.userId, category.id, habitIdByKey.lift);

  // Track weekly meal prep to ensure it only happens once per week
  const mealPrepByWeek = new Map<string, boolean>();
  // Track recovery count per week to ensure 1-3x per week
  const recoveryCountByWeek = new Map<string, number>();

  const createdCounts: Record<string, number> = {
    run: 0,
    lift: 0,
    recovery: 0,
    eat_clean: 0,
    meal_prep: 0,
  };

  // Iterate oldest → newest
  for (let idx = 0; idx < args.days; idx++) {
    const daysAgo = args.days - 1 - idx;
    const dayKey = dayKeyDaysAgoUtc(daysAgo);
    const weekStartKey = weekStartDayKey(dayKey);
    const recoveryCountThisWeek = recoveryCountByWeek.get(weekStartKey) || 0;

    const completions = computeCompletionsForDay({
      rng,
      dayKey,
      weekStartKey,
      recoveryCountThisWeek,
    });

    // Run: numeric entry
    if (completions.run) {
      await upsertHabitEntry(habitIdByKey.run, dayKey, args.userId, {
        value: completions.run.value,
        source: 'seed_fitness',
        timestamp: dayUtcIso(dayKey, 18),
      });
      createdCounts.run += 1;
      await recomputeDayLogForHabit(habitIdByKey.run, dayKey, args.userId);
    } else {
      await recomputeDayLogForHabit(habitIdByKey.run, dayKey, args.userId);
    }

    // Lift: choice entry
    if (completions.lift) {
      const liftHabit = habits.lift;
      const option = liftHabit.bundleOptions?.find(
        (opt) => opt.label.toLowerCase() === completions.lift!.option
      );
      if (option) {
        await upsertHabitEntry(habitIdByKey.lift, dayKey, args.userId, {
          value: 1,
          bundleOptionId: option.id,
          bundleOptionLabel: option.label,
          source: 'seed_fitness',
          timestamp: dayUtcIso(dayKey, 19),
        });
        createdCounts.lift += 1;
      }
      await recomputeDayLogForHabit(habitIdByKey.lift, dayKey, args.userId);
    } else {
      await recomputeDayLogForHabit(habitIdByKey.lift, dayKey, args.userId);
    }

    // Recovery: choice entry (lower frequency, 1-3x per week)
    if (completions.recovery) {
      const recoveryHabit = habits.recovery;
      const option = recoveryHabit.bundleOptions?.find(
        (opt) => opt.label.toLowerCase() === completions.recovery!.option
      );
      if (option) {
        await upsertHabitEntry(habitIdByKey.recovery, dayKey, args.userId, {
          value: 1,
          bundleOptionId: option.id,
          bundleOptionLabel: option.label,
          source: 'seed_fitness',
          timestamp: dayUtcIso(dayKey, 20),
        });
        createdCounts.recovery += 1;
        recoveryCountByWeek.set(weekStartKey, recoveryCountThisWeek + 1);
      }
      await recomputeDayLogForHabit(habitIdByKey.recovery, dayKey, args.userId);
    } else {
      await recomputeDayLogForHabit(habitIdByKey.recovery, dayKey, args.userId);
    }

    // Eat Clean: boolean entry
    if (completions.eat_clean) {
      await upsertHabitEntry(habitIdByKey.eat_clean, dayKey, args.userId, {
        value: 1,
        source: 'seed_fitness',
        timestamp: dayUtcIso(dayKey, 18),
      });
      createdCounts.eat_clean += 1;
      await recomputeDayLogForHabit(habitIdByKey.eat_clean, dayKey, args.userId);
    } else {
      await recomputeDayLogForHabit(habitIdByKey.eat_clean, dayKey, args.userId);
    }

    // Meal Prep: weekly boolean entry (only once per week)
    if (completions.meal_prep && !mealPrepByWeek.get(weekStartKey)) {
      await upsertHabitEntry(habitIdByKey.meal_prep, dayKey, args.userId, {
        value: 1,
        source: 'seed_fitness',
        timestamp: dayUtcIso(dayKey, 10), // Sunday morning
      });
      createdCounts.meal_prep += 1;
      mealPrepByWeek.set(weekStartKey, true);
      await recomputeDayLogForHabit(habitIdByKey.meal_prep, dayKey, args.userId);
    } else {
      await recomputeDayLogForHabit(habitIdByKey.meal_prep, dayKey, args.userId);
    }
  }

  // Pin routines for Action Cards (pin first 2)
  const pinnedRoutineIds = [routines.pushPullLegs, routines.fullBodyCircuit];
  await updateDashboardPrefs(args.userId, {
    pinnedRoutineIds,
  });

  console.log(`[seed:fitness] habits ensured: ${Object.values(habits).map((h) => h.name).join(', ')}`);
  console.log(
    `[seed:fitness] habitEntries created: run=${createdCounts.run} lift=${createdCounts.lift} recovery=${createdCounts.recovery} eat_clean=${createdCounts.eat_clean} meal_prep=${createdCounts.meal_prep}`
  );
  console.log(`[seed:fitness] routines created: ${Object.values(routines).length}`);
  console.log(`[seed:fitness] pinned routines: ${pinnedRoutineIds.length}`);
  console.log(`[seed:fitness] go-to routine: ${routines.pushPullLegs} (Push / Pull / Legs)`);
}

main()
  .catch((err) => {
    console.error('[seed:fitness] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeConnection();
  });

