/**
 * DEV: Seed emotion-regulation habit + mood test data.
 *
 * Usage:
 *   npm run seed:emotion -- --days=60 --seed=123 --userId=demo_emotional_wellbeing
 *
 * Notes:
 * - Creates/ensures 4 boolean habits: Walk, Hydration, Sleep Routine, Morning Routine
 * - Generates HabitEntries (source of truth) and recomputes DayLogs (derived cache) for visuals
 * - Generates DailyWellbeing logs (compat) + WellbeingEntries (canonical) for the same dayKey window
 * - Deterministic if --seed is provided
 */
import { createCategory } from '../src/server/repositories/categoryRepository';
import { createHabit, getHabitsByUser } from '../src/server/repositories/habitRepository';
import { upsertHabitEntry } from '../src/server/repositories/habitEntryRepository';
import { recomputeDayLogForHabit } from '../src/server/utils/recomputeUtils';
import { upsertWellbeingLog } from '../src/server/repositories/wellbeingLogRepository';
import { createWellbeingEntries, type WellbeingEntryUpsertInput } from '../src/server/repositories/wellbeingEntryRepository';
import { getDb, closeConnection } from '../src/server/lib/mongoClient';
import type { DailyWellbeing, Habit, WellbeingMetricKey } from '../src/models/persistenceTypes';

type Args = {
  days: number;
  seed: number;
  userId: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    days: 60,
    seed: 123,
    // Default matches existing demo userId so this is safe to run in demo mode.
    userId: 'demo_emotional_wellbeing',
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

function roundInt(n: number): number {
  return Math.round(n);
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

type HabitSeedSpec = {
  key: 'walk' | 'hydration' | 'sleep_routine' | 'morning_routine';
  name: string;
  baseProb: number;
};

const HABITS: HabitSeedSpec[] = [
  { key: 'walk', name: 'Walk', baseProb: 0.55 },
  { key: 'hydration', name: 'Hydration', baseProb: 0.7 },
  { key: 'sleep_routine', name: 'Sleep Routine', baseProb: 0.45 },
  { key: 'morning_routine', name: 'Morning Routine', baseProb: 0.5 },
];

type Mood = {
  anxiety: number; // 1..5
  lowMood: number; // 0..4
  calm: number; // 0..4
  stress: number; // 0..4
  energy: number; // 1..5
  sleepQuality: number; // 0..4
  notes?: string;
};

function isWeekend(dayKey: string): boolean {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  const dow = d.getUTCDay(); // 0=Sun
  return dow === 0 || dow === 6;
}

function pickMessyWindows(rng: () => number, days: number): Array<{ startOffset: number; length: number }> {
  // Choose 1–2 windows of 5 days within the range, deterministic by rng.
  const windowCount = rng() < 0.6 ? 1 : 2;
  const windows: Array<{ startOffset: number; length: number }> = [];
  const length = 5;

  for (let i = 0; i < windowCount; i++) {
    // Avoid the very newest 7 days so the "mess" is visible but not always "right now"
    const maxStart = Math.max(0, days - length - 7);
    const startOffset = Math.floor(rng() * (maxStart + 1));
    windows.push({ startOffset, length });
  }

  // De-dupe overlapping (simple)
  windows.sort((a, b) => a.startOffset - b.startOffset);
  const merged: typeof windows = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (!last) merged.push(w);
    else if (w.startOffset <= last.startOffset + last.length + 1) {
      last.length = Math.max(last.length, w.startOffset + w.length - last.startOffset);
    } else merged.push(w);
  }

  return merged.slice(0, 2);
}

function isInMessyWindow(dayIdxOldestToNewest: number, windows: Array<{ startOffset: number; length: number }>): boolean {
  return windows.some((w) => dayIdxOldestToNewest >= w.startOffset && dayIdxOldestToNewest < w.startOffset + w.length);
}

async function ensureSeedHabits(userId: string): Promise<Record<HabitSeedSpec['key'], Habit>> {
  const category = await createCategory({ name: 'Wellbeing', color: 'bg-emerald-500' }, userId);
  const existing = await getHabitsByUser(userId);

  const out = {} as Record<HabitSeedSpec['key'], Habit>;

  for (let i = 0; i < HABITS.length; i++) {
    const spec = HABITS[i];
    const found = existing.find((h) => h.name === spec.name && h.categoryId === category.id);
    if (found) {
      out[spec.key] = found;
      continue;
    }
    const created = await createHabit(
      {
        categoryId: category.id,
        name: spec.name,
        goal: { type: 'boolean', frequency: 'daily' },
        type: 'boolean',
        order: 900 + i,
      },
      userId
    );
    out[spec.key] = created;
  }

  return out;
}

async function clearPreviousSeed(userId: string, habitIds: string[], startDayKey: string, endDayKey: string): Promise<void> {
  const db = await getDb();

  // Only delete seeded habitEntries to avoid clobbering real user data.
  await db.collection('habitEntries').deleteMany({
    userId,
    habitId: { $in: habitIds },
    source: 'seed_emotion_regulation',
    dayKey: { $gte: startDayKey, $lte: endDayKey },
  });

  // Clear wellbeingLogs in range (this is a dev seed; target userId should be a demo/dev userId).
  await db.collection('wellbeingLogs').deleteMany({
    userId,
    date: { $gte: startDayKey, $lte: endDayKey },
  });

  // Clear seeded wellbeingEntries in range (don’t touch checkin-derived entries).
  await db.collection('wellbeingEntries').deleteMany({
    userId,
    source: 'seed_emotion_regulation',
    dayKey: { $gte: startDayKey, $lte: endDayKey },
  });
}

function computeCompletionsForDay(params: {
  rng: () => number;
  dayKey: string;
  inMess: boolean;
  sleepCompletedYesterday: boolean;
}): Record<HabitSeedSpec['key'], boolean> {
  const { rng, dayKey, inMess, sleepCompletedYesterday } = params;
  const weekend = isWeekend(dayKey);

  const roll = (p: number) => rng() < clamp(p, 0.02, 0.98);

  // Baselines
  let walkP = 0.55 + (weekend ? 0.1 : 0);
  let hydrationP = 0.7;
  let sleepP = 0.45 + (weekend ? -0.15 : 0);
  let morningP = 0.5 + (sleepCompletedYesterday ? 0.2 : 0);

  if (inMess) {
    walkP -= 0.25;
    hydrationP -= 0.2;
    sleepP -= 0.25;
    morningP -= 0.25;
  }

  const sleep = roll(sleepP);
  const morning = roll(morningP + (sleep ? 0.05 : -0.05)); // slight same-day coupling
  const hydration = roll(hydrationP);
  const walk = roll(walkP);

  return {
    walk,
    hydration,
    sleep_routine: sleep,
    morning_routine: morning,
  };
}

function computeMoodForDay(params: {
  rng: () => number;
  dayKey: string;
  inMess: boolean;
  completions: Record<HabitSeedSpec['key'], boolean>;
  sleepCompletedYesterday: boolean;
}): Mood {
  const { rng, dayKey, inMess, completions, sleepCompletedYesterday } = params;

  // Start with plausible baselines
  let anxiety = 3;
  let lowMood = 2;
  let calm = 2;
  let stress = 2;
  let energy = 3;
  let sleepQuality = 2;

  // Gentle correlations
  if (completions.walk) calm += 1;
  if (sleepCompletedYesterday) lowMood -= 1;
  if (completions.hydration) anxiety -= 1;
  if (completions.sleep_routine) {
    sleepQuality += 1;
    energy += 0.5;
    stress -= 0.5;
  }
  if (completions.morning_routine) {
    calm += 0.5;
    stress -= 0.25;
  }
  if (completions.sleep_routine && completions.hydration) anxiety -= 0.5;

  // Messy windows: slightly tougher stretch (still non-dramatic)
  if (inMess) {
    anxiety += 1;
    lowMood += 1;
    calm -= 1;
    stress += 1;
    energy -= 0.5;
    sleepQuality -= 0.5;
  }

  // Mild randomness (deterministic via rng)
  const jitter = () => (rng() - 0.5) * 1.2; // ~[-0.6..+0.6]
  const volatility = completions.morning_routine ? 0.7 : 1.0;

  anxiety += jitter() * volatility;
  lowMood += jitter() * volatility;
  calm += jitter() * (completions.morning_routine ? 0.6 : 1.0);
  stress += jitter() * volatility;
  energy += jitter() * 0.8;
  sleepQuality += jitter() * 0.8;

  // Clamp + round to expected scales
  anxiety = roundInt(clamp(anxiety, 1, 5));
  energy = roundInt(clamp(energy, 1, 5));

  lowMood = roundInt(clamp(lowMood, 0, 4));
  calm = roundInt(clamp(calm, 0, 4));
  stress = roundInt(clamp(stress, 0, 4));
  sleepQuality = roundInt(clamp(sleepQuality, 0, 4));

  // Occasional notes (subtle)
  const noteChance = isWeekend(dayKey) ? 0.08 : 0.05;
  const notes = rng() < noteChance ? 'A few things felt heavier today — taking it one step at a time.' : undefined;

  return { anxiety, lowMood, calm, stress, energy, sleepQuality, ...(notes ? { notes } : {}) };
}

function asDailyWellbeing(dayKey: string, mood: Mood): DailyWellbeing {
  // Store as evening session so UI pickers (evening → morning → legacy) find values reliably.
  // Keep it additive-only: no key renames.
  return {
    date: dayKey,
    evening: {
      anxiety: mood.anxiety,
      lowMood: mood.lowMood,
      calm: mood.calm,
      stress: mood.stress,
      energy: mood.energy,
      sleepQuality: mood.sleepQuality,
      ...(mood.notes ? { notes: mood.notes } : {}),
    } as any,
  } as DailyWellbeing;
}

function toWellbeingEntryInputs(dayKey: string, mood: Mood): WellbeingEntryUpsertInput[] {
  const ts = dayUtcIso(dayKey, 21);
  const metricPairs: Array<[WellbeingMetricKey, any]> = [
    ['anxiety', mood.anxiety],
    ['lowMood', mood.lowMood],
    ['calm', mood.calm],
    ['stress', mood.stress],
    ['energy', mood.energy],
    ['sleepQuality', mood.sleepQuality],
  ];

  if (mood.notes) metricPairs.push(['notes', mood.notes]);

  return metricPairs.map(([metricKey, value]) => ({
    dayKey,
    timeOfDay: 'evening',
    metricKey,
    value,
    source: 'seed_emotion_regulation',
    timestampUtc: ts,
  }));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(args.seed);

  const startDayKey = dayKeyDaysAgoUtc(args.days - 1);
  const endDayKey = dayKeyDaysAgoUtc(0);

  console.log(`[seed:emotion] userId=${args.userId} days=${args.days} seed=${args.seed}`);
  console.log(`[seed:emotion] range ${startDayKey} → ${endDayKey}`);

  const habits = await ensureSeedHabits(args.userId);
  const habitIdByKey = {
    walk: habits.walk.id,
    hydration: habits.hydration.id,
    sleep_routine: habits.sleep_routine.id,
    morning_routine: habits.morning_routine.id,
  };
  const habitIds = Object.values(habitIdByKey);

  await clearPreviousSeed(args.userId, habitIds, startDayKey, endDayKey);

  const messyWindows = pickMessyWindows(rng, args.days);
  if (messyWindows.length > 0) {
    console.log(
      `[seed:emotion] messy windows: ${messyWindows
        .map((w) => `startOffset=${w.startOffset} len=${w.length}`)
        .join(' | ')}`
    );
  }

  let sleepYesterday = false;
  const createdCounts: Record<string, number> = {
    walk: 0,
    hydration: 0,
    sleep_routine: 0,
    morning_routine: 0,
  };

  const wellbeingInputs: WellbeingEntryUpsertInput[] = [];
  let wellbeingLogCount = 0;

  // Iterate oldest → newest so "yesterday" correlation is meaningful.
  for (let idx = 0; idx < args.days; idx++) {
    const daysAgo = args.days - 1 - idx;
    const dayKey = dayKeyDaysAgoUtc(daysAgo);

    const inMess = isInMessyWindow(idx, messyWindows);
    const completions = computeCompletionsForDay({
      rng,
      dayKey,
      inMess,
      sleepCompletedYesterday: sleepYesterday,
    });

    // HabitEntries + recompute DayLogs for visuals
    for (const spec of HABITS) {
      const habitId = habitIdByKey[spec.key];
      const shouldComplete = completions[spec.key];

      if (shouldComplete) {
        // Use value=1 for boolean completion.
        await upsertHabitEntry(habitId, dayKey, args.userId, {
          value: 1,
          source: 'seed_emotion_regulation',
          timestamp: dayUtcIso(dayKey, 18),
        });
        createdCounts[spec.key] += 1;
      } else {
        // No entry for that dayKey (DayLog recompute will delete derived cache).
        // We intentionally do NOT delete non-seed entries.
        // (Previous seed entries were cleared in clearPreviousSeed().)
      }

      await recomputeDayLogForHabit(habitId, dayKey, args.userId);
    }

    // Mood metrics correlated with habits
    const mood = computeMoodForDay({
      rng,
      dayKey,
      inMess,
      completions,
      sleepCompletedYesterday: sleepYesterday,
    });

    await upsertWellbeingLog(asDailyWellbeing(dayKey, mood), args.userId);
    wellbeingLogCount += 1;
    wellbeingInputs.push(...toWellbeingEntryInputs(dayKey, mood));

    sleepYesterday = completions.sleep_routine;
  }

  // Canonical wellbeingEntries (batch upsert, idempotent by repo unique index)
  if (wellbeingInputs.length > 0) {
    await createWellbeingEntries(wellbeingInputs, args.userId, { defaultTimeZone: 'UTC' });
  }

  // Small helpful summary
  console.log(`[seed:emotion] habits ensured: ${Object.values(habits).map((h) => h.name).join(', ')}`);
  console.log(
    `[seed:emotion] habitEntries created (completed-days): walk=${createdCounts.walk} hydration=${createdCounts.hydration} sleep=${createdCounts.sleep_routine} morning=${createdCounts.morning_routine}`
  );
  console.log(`[seed:emotion] wellbeingLogs upserted: ${wellbeingLogCount}`);
  console.log(`[seed:emotion] wellbeingEntries upsert inputs: ${wellbeingInputs.length}`);
  console.log(`[seed:emotion] example day ${endDayKey}:`, JSON.stringify(asDailyWellbeing(endDayKey, computeMoodForDay({
    rng: mulberry32(args.seed + 999), // separate deterministic sample
    dayKey: endDayKey,
    inMess: false,
    completions: { walk: true, hydration: true, sleep_routine: true, morning_routine: true },
    sleepCompletedYesterday: true,
  })), null, 2));
}

main()
  .catch((err) => {
    console.error('[seed:emotion] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeConnection();
  });


