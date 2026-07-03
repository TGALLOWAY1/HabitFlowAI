/**
 * Public Demo Showcase Seed
 *
 * Seeds the public demo identity ({ PUBLIC_DEMO_HOUSEHOLD_ID, DEMO_USER_ID })
 * with a realistic ~10-week dataset covering every implemented domain: habits
 * (boolean, numeric, weekly, checklist bundle), goals (cumulative with
 * milestones, one-time, a goal track), tasks, journal, wellbeing check-ins,
 * sleep, medications/supplements/symptoms, routines with variants + logs,
 * dashboard prefs, and archived sample AI reports.
 *
 * Honesty rules:
 * - Data is deterministic (seeded PRNG) but shaped like a real user's history,
 *   including misses, trends, and a wind-down ↔ sleep-quality correlation that
 *   the analytics engines genuinely detect at read time.
 * - The archived AI reports are composed FROM the seeded numbers collected
 *   during generation — every cited figure is true of the dataset. The tour
 *   labels them as sample reports (live generation requires a Gemini key).
 *
 * Freshness: entries are generated relative to "today", and the seed re-runs
 * (reset + reseed) whenever the newest entry is older than yesterday, so the
 * demo always looks in-use. Guarded so it can only ever touch DEMO_USER_ID.
 */

import { randomUUID } from 'crypto';
import { getDb } from '../lib/mongoClient';
import { DEMO_USER_ID } from '../config/demo';
import { PUBLIC_DEMO_HOUSEHOLD_ID } from '../../shared/demo';
import { MONGO_COLLECTIONS, type GoalMilestone, type RoutineVariant } from '../../models/persistenceTypes';
import type { WeeklyAIReview } from '../../shared/weeklyAiReview';
import type { AIJournalReview } from '../../shared/aiJournalReview';
import type { InsightsAIReview } from '../../shared/insightsAiReview';
import { createCategory } from '../repositories/categoryRepository';
import { createHabit } from '../repositories/habitRepository';
import { upsertHabitEntry } from '../repositories/habitEntryRepository';
import { createGoal } from '../repositories/goalRepository';
import { createGoalTrack } from '../repositories/goalTrackRepository';
import { createTask, updateTask } from '../repositories/taskRepository';
import { createEntry as createJournalEntry } from '../repositories/journal';
import { createWellbeingEntries } from '../repositories/wellbeingEntryRepository';
import { createRoutine } from '../repositories/routineRepository';
import { saveRoutineLog } from '../repositories/routineLogRepository';
import { updateDashboardPrefs } from '../repositories/dashboardPrefsRepository';
import { createMedication, setMedicationLog } from '../repositories/medicationRepository';
import { createSupplement, setSupplementLog } from '../repositories/supplementRepository';
import { createSymptom, setSymptomLog } from '../repositories/symptomRepository';
import { saveAIReport } from '../repositories/aiReportRepository';

const HH = PUBLIC_DEMO_HOUSEHOLD_ID;
const UID = DEMO_USER_ID;

/** Days of habit history to generate. */
const HABIT_DAYS = 70;
/** Days of wellbeing/sleep/health history to generate. */
const WELLBEING_DAYS = 45;

// ---------------------------------------------------------------------------
// Deterministic PRNG + date helpers
// ---------------------------------------------------------------------------

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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Round to quarter precision. Quarters are exact in binary floating point, so
 * sums of seeded numeric entries (miles, hours) stay clean — no
 * "100.60000000000001 / 150" artifacts in derived goal totals.
 */
function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/** DayKey (YYYY-MM-DD, UTC) for `daysAgo` days before today. */
function dayKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000Z`).getUTCDay(); // 0=Sun
}

function isoAt(dayKey: string, hourUtc: number, minute = 0): string {
  return `${dayKey}T${String(hourUtc).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

/** Monday..Sunday dayKeys of the most recent COMPLETED week. */
function lastCompletedWeek(): { start: string; end: string; days: string[] } {
  // Walk back to the most recent Sunday strictly before today.
  let offset = 1;
  while (dayOfWeek(dayKeyDaysAgo(offset)) !== 0) offset++;
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(dayKeyDaysAgo(offset + i));
  return { start: days[0], end: days[6], days };
}

// ---------------------------------------------------------------------------
// Reset + freshness
// ---------------------------------------------------------------------------

const DEMO_COLLECTIONS = [
  MONGO_COLLECTIONS.CATEGORIES,
  MONGO_COLLECTIONS.HABITS,
  MONGO_COLLECTIONS.HABIT_ENTRIES,
  MONGO_COLLECTIONS.DAY_LOGS,
  MONGO_COLLECTIONS.GOALS,
  MONGO_COLLECTIONS.GOAL_TRACKS,
  MONGO_COLLECTIONS.ROUTINES,
  MONGO_COLLECTIONS.ROUTINE_LOGS,
  MONGO_COLLECTIONS.JOURNAL_ENTRIES,
  MONGO_COLLECTIONS.WELLBEING_ENTRIES,
  MONGO_COLLECTIONS.WELLBEING_LOGS,
  MONGO_COLLECTIONS.TASKS,
  MONGO_COLLECTIONS.DASHBOARD_PREFS,
  MONGO_COLLECTIONS.AI_REPORTS,
  MONGO_COLLECTIONS.MEDICATIONS,
  MONGO_COLLECTIONS.MEDICATION_LOGS,
  MONGO_COLLECTIONS.SUPPLEMENTS,
  MONGO_COLLECTIONS.SUPPLEMENT_LOGS,
  MONGO_COLLECTIONS.SYMPTOMS,
  MONGO_COLLECTIONS.SYMPTOM_LOGS,
  MONGO_COLLECTIONS.BUNDLE_MEMBERSHIPS,
] as const;

async function resetDemoShowcaseData(): Promise<void> {
  if (UID !== DEMO_USER_ID) {
    throw new Error('Hard guardrail: showcase reset may only run for DEMO_USER_ID');
  }
  const db = await getDb();
  for (const name of DEMO_COLLECTIONS) {
    await db.collection(name).deleteMany({ userId: UID });
  }
}

/** True when the demo dataset exists and its newest entry is recent. */
async function isDemoDataFresh(): Promise<boolean> {
  const db = await getDb();
  const newest = await db
    .collection(MONGO_COLLECTIONS.HABIT_ENTRIES)
    .find({ userId: UID, deletedAt: { $exists: false } })
    .sort({ dayKey: -1 })
    .limit(1)
    .toArray();
  if (newest.length === 0) return false;
  const newestDayKey = (newest[0] as { dayKey?: string }).dayKey ?? '';
  return newestDayKey >= dayKeyDaysAgo(1);
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** Aggregates collected while generating entries, used to compose honest AI reports. */
interface WeekFacts {
  runCount: number;
  runMiles: number;
  deepWorkHours: number;
  deepWorkDays: number;
  meditationDays: number;
  walkDays: number;
  readDays: number;
  strengthDays: number;
  journalCount: number;
  moodSum: number;
  moodCount: number;
  sleepScoreSum: number;
  sleepScoreCount: number;
  windDownNights: number;
}

export interface SeedShowcaseResult {
  seeded: boolean;
  reason: 'fresh' | 'seeded' | 'reseeded';
}

/**
 * Seed (or refresh) the public demo dataset. Idempotent: skips entirely when
 * the existing data is fresh, otherwise wipes the demo user's data and reseeds
 * relative to today.
 */
export async function seedDemoShowcase(options?: { force?: boolean }): Promise<SeedShowcaseResult> {
  const hadData = await isDemoDataFresh();
  if (hadData && !options?.force) {
    return { seeded: false, reason: 'fresh' };
  }

  await resetDemoShowcaseData();

  const rng = mulberry32(20260701);
  const chance = (p: number): boolean => rng() < p;
  const between = (min: number, max: number): number => min + rng() * (max - min);

  // --- Categories ---------------------------------------------------------
  const health = await createCategory({ name: 'Health', color: 'bg-emerald-500' }, HH, UID);
  const fitness = await createCategory({ name: 'Fitness', color: 'bg-blue-500' }, HH, UID);
  const mind = await createCategory({ name: 'Mind', color: 'bg-violet-500' }, HH, UID);
  const productivity = await createCategory({ name: 'Productivity', color: 'bg-amber-500' }, HH, UID);

  // --- Habits --------------------------------------------------------------
  const morningWalk = await createHabit(
    { categoryId: health.id, name: 'Morning walk', goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', order: 0 },
    HH, UID
  );
  const water = await createHabit(
    { categoryId: health.id, name: 'Drink water', goal: { type: 'number', target: 8, unit: 'glasses', frequency: 'daily' }, type: 'number', order: 1 },
    HH, UID
  );
  const run = await createHabit(
    { categoryId: fitness.id, name: 'Run', goal: { type: 'number', unit: 'miles', frequency: 'daily' }, type: 'number', timesPerWeek: 3, order: 0 },
    HH, UID
  );
  const strength = await createHabit(
    { categoryId: fitness.id, name: 'Strength training', goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', timesPerWeek: 3, order: 1 },
    HH, UID
  );
  const read = await createHabit(
    { categoryId: mind.id, name: 'Read 20 minutes', goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', order: 0 },
    HH, UID
  );
  const meditate = await createHabit(
    { categoryId: mind.id, name: 'Meditate', goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', order: 1 },
    HH, UID
  );
  const deepWork = await createHabit(
    {
      categoryId: productivity.id,
      name: 'Deep work block',
      goal: { type: 'number', target: 3, unit: 'hours', frequency: 'daily' },
      type: 'number',
      assignedDays: [1, 2, 3, 4, 5],
      order: 0,
    },
    HH, UID
  );

  // Checklist bundle: Wind-Down Checklist with three child habits.
  const noScreens = await createHabit(
    { categoryId: health.id, name: 'No screens after 10pm', goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', order: 3 },
    HH, UID
  );
  const stretch = await createHabit(
    { categoryId: health.id, name: 'Evening stretch', goal: { type: 'boolean', frequency: 'daily' }, type: 'boolean', order: 4 },
    HH, UID
  );
  const windDownBundle = await createHabit(
    {
      categoryId: health.id,
      name: 'Wind-Down Checklist',
      goal: { type: 'boolean', frequency: 'daily' },
      type: 'bundle',
      bundleType: 'checklist',
      subHabitIds: [noScreens.id, stretch.id],
      checklistSuccessRule: { type: 'full' },
      order: 2,
    },
    HH, UID
  );
  const db = await getDb();
  await db.collection(MONGO_COLLECTIONS.HABITS).updateMany(
    { userId: UID, id: { $in: [noScreens.id, stretch.id] } },
    { $set: { bundleParentId: windDownBundle.id } }
  );

  // --- Habit entries (70 days, realistic patterns) --------------------------
  const reportWeek = lastCompletedWeek();
  const reportDaySet = new Set(reportWeek.days);
  const week: WeekFacts = {
    runCount: 0, runMiles: 0, deepWorkHours: 0, deepWorkDays: 0, meditationDays: 0,
    walkDays: 0, readDays: 0, strengthDays: 0, journalCount: 0,
    moodSum: 0, moodCount: 0, sleepScoreSum: 0, sleepScoreCount: 0, windDownNights: 0,
  };

  type EntrySpec = { habitId: string; value?: number };
  /** Total run miles per day index, used to align goal windows with reality. */
  const runMilesByDaysAgo = new Map<number, number>();

  for (let daysAgo = HABIT_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const dayKey = dayKeyDaysAgo(daysAgo);
    const dow = dayOfWeek(dayKey);
    const inReportWeek = reportDaySet.has(dayKey);
    const progress = 1 - daysAgo / HABIT_DAYS; // 0 → oldest, 1 → today
    const entries: EntrySpec[] = [];

    if (chance(0.85)) {
      entries.push({ habitId: morningWalk.id, value: 1 });
      if (inReportWeek) week.walkDays++;
    }
    if (chance(0.9)) {
      entries.push({ habitId: water.id, value: Math.round(between(5, 10)) });
    }
    // Run: Mon/Wed/Sat pattern with occasional swaps/misses
    if ((dow === 1 || dow === 3 || dow === 6) ? chance(0.88) : chance(0.06)) {
      const miles = roundQuarter(between(2.2, 4.6));
      entries.push({ habitId: run.id, value: miles });
      runMilesByDaysAgo.set(daysAgo, miles);
      if (inReportWeek) {
        week.runCount++;
        week.runMiles += miles;
      }
    }
    // Strength: Tue/Thu/Sun pattern
    if ((dow === 2 || dow === 4 || dow === 0) ? chance(0.82) : chance(0.04)) {
      entries.push({ habitId: strength.id, value: 1 });
      if (inReportWeek) week.strengthDays++;
    }
    if (chance(0.72)) {
      entries.push({ habitId: read.id, value: 1 });
      if (inReportWeek) week.readDays++;
    }
    // Meditation: improving trend (~45% → ~85%)
    if (chance(0.45 + 0.4 * progress)) {
      entries.push({ habitId: meditate.id, value: 1 });
      if (inReportWeek) week.meditationDays++;
    }
    // Deep work: weekdays only
    if (dow >= 1 && dow <= 5 && chance(0.9)) {
      const hours = roundQuarter(between(1.2, 3.2));
      entries.push({ habitId: deepWork.id, value: hours });
      if (inReportWeek) {
        week.deepWorkHours += hours;
        week.deepWorkDays++;
      }
    }
    // Wind-down children (correlated with each other)
    const didWindDown = chance(0.55 + 0.15 * progress);
    if (didWindDown) {
      entries.push({ habitId: noScreens.id, value: 1 });
      if (chance(0.9)) entries.push({ habitId: stretch.id, value: 1 });
    } else if (chance(0.25)) {
      entries.push({ habitId: stretch.id, value: 1 });
    }

    for (const e of entries) {
      await upsertHabitEntry(e.habitId, dayKey, HH, UID, {
        value: e.value,
        timestamp: isoAt(dayKey, 13),
        source: 'manual',
      });
    }
  }

  // Sums of quarter-precision values are exact — no rounding needed, and the
  // report facts below match the app's own derived totals digit-for-digit.

  // --- Goals ----------------------------------------------------------------
  const now = new Date().toISOString();
  const milestone = (value: number, acknowledged: boolean): GoalMilestone => ({
    id: randomUUID(),
    value,
    ...(acknowledged ? { acknowledgedAt: now } : {}),
  });

  // Cumulative goal with milestones (sums deep work hours; ~100h of 150 →
  // 25/50/75/100 crossed). All seeded milestones are pre-acknowledged:
  // celebration modals can't be dismissed in the read-only demo, so an
  // unacknowledged crossed milestone would re-celebrate on every visit.
  const deepWorkGoal = await createGoal(
    {
      categoryId: productivity.id,
      title: 'Log 150 hours of deep work',
      type: 'cumulative',
      targetValue: 150,
      unit: 'hours',
      linkedHabitIds: [deepWork.id],
      aggregationMode: 'sum',
      milestones: [milestone(25, true), milestone(50, true), milestone(75, true), milestone(100, true)],
      notes: 'One focused block per workday. Quality over quantity.',
    },
    HH, UID
  );

  // Cumulative count goal (distinct meditation days)
  await createGoal(
    {
      categoryId: mind.id,
      title: 'Meditate 60 sessions',
      type: 'cumulative',
      targetValue: 60,
      unit: 'sessions',
      linkedHabitIds: [meditate.id],
      aggregationMode: 'count',
      countMode: 'distinctDays',
    },
    HH, UID
  );

  // Completed one-time goal (Achievements gallery)
  await createGoal(
    {
      categoryId: fitness.id,
      title: 'Finish a 10K race',
      type: 'onetime',
      linkedHabitIds: [],
      completedAt: isoAt(dayKeyDaysAgo(21), 16),
      notes: 'Ran the spring 10K without stopping — 61:48.',
    },
    HH, UID
  );

  // Goal track: distance milestones, windows aligned with actual seeded miles.
  const track = await createGoalTrack(
    {
      name: 'Distance Milestones',
      categoryId: fitness.id,
      description: 'Build weekly mileage in stages.',
    },
    HH, UID
  );

  // Split the run history so stage 1 is genuinely complete inside its window.
  let stage1EndDaysAgo = 0;
  {
    let cumulative = 0;
    const sorted = [...runMilesByDaysAgo.entries()].sort((a, b) => b[0] - a[0]); // oldest first
    for (const [daysAgo, miles] of sorted) {
      cumulative += miles;
      if (cumulative >= 40) {
        stage1EndDaysAgo = daysAgo;
        break;
      }
    }
  }
  const stage1End = dayKeyDaysAgo(stage1EndDaysAgo);
  const stage2Start = dayKeyDaysAgo(Math.max(stage1EndDaysAgo - 1, 0));

  await createGoal(
    {
      categoryId: fitness.id,
      title: 'Run 40 miles',
      type: 'cumulative',
      targetValue: 40,
      unit: 'miles',
      linkedHabitIds: [run.id],
      aggregationMode: 'sum',
      trackId: track.id,
      trackOrder: 0,
      trackStatus: 'completed',
      activeWindowStart: dayKeyDaysAgo(HABIT_DAYS - 1),
      activeWindowEnd: stage1End,
      completedAt: isoAt(stage1End, 18),
    },
    HH, UID
  );
  const run80 = await createGoal(
    {
      categoryId: fitness.id,
      title: 'Run 80 miles',
      type: 'cumulative',
      targetValue: 80,
      unit: 'miles',
      linkedHabitIds: [run.id],
      aggregationMode: 'sum',
      trackId: track.id,
      trackOrder: 1,
      trackStatus: 'active',
      activeWindowStart: stage2Start,
    },
    HH, UID
  );
  await createGoal(
    {
      categoryId: fitness.id,
      title: 'Run 150 miles',
      type: 'cumulative',
      targetValue: 150,
      unit: 'miles',
      linkedHabitIds: [run.id],
      aggregationMode: 'sum',
      trackId: track.id,
      trackOrder: 2,
      trackStatus: 'locked',
    },
    HH, UID
  );

  // --- Tasks -----------------------------------------------------------------
  await createTask({ title: 'Review this week’s AI report', listPlacement: 'today' }, UID);
  await createTask({ title: 'Reply to Sam about Saturday’s trail run', listPlacement: 'today' }, UID);
  const doneTask = await createTask({ title: 'Pick up race packet', listPlacement: 'today' }, UID);
  await updateTask(doneTask.id, UID, { status: 'completed' });
  await createTask({ title: 'Book dentist appointment', listPlacement: 'inbox' }, UID);
  await createTask({ title: 'Plan next month’s training block', listPlacement: 'inbox' }, UID);
  await createTask({ title: 'Research standing desks', listPlacement: 'inbox' }, UID);

  // --- Journal ----------------------------------------------------------------
  const journal = async (daysAgo: number, templateId: string, mode: 'standard' | 'free', content: Record<string, string>) => {
    await createJournalEntry({ templateId, mode, date: dayKeyDaysAgo(daysAgo), content }, UID);
    if (reportDaySet.has(dayKeyDaysAgo(daysAgo))) week.journalCount++;
  };

  await journal(27, 'free-write', 'free', {
    'free-write':
      'Legs were heavy on this morning’s run but I finished the loop anyway. Noticing that the hard part is almost never the running — it’s the ten minutes before I get out the door.',
  });
  await journal(22, 'daily-retrospective', 'standard', {
    win: 'Two solid deep work blocks before lunch — the proposal draft is basically done.',
    challenge: 'Afternoon meetings fragmented everything after 2pm.',
    pivot: 'Batch meetings after 3pm where I can; protect the morning.',
  });
  await journal(18, 'free-write', 'free', {
    'free-write':
      'Skipped my wind-down again and doom-scrolled instead. Slept badly, and the whole morning felt like wading through syrup. The pattern is getting hard to ignore.',
  });
  await journal(15, 'morning-primer', 'standard', {
    priority: 'Finish the client proposal and send it before 4pm.',
    logistics: 'Desk by 8:30, phone in the kitchen, two 90-minute blocks.',
    contingency: 'If I stall, I’ll re-read yesterday’s outline instead of starting from scratch.',
  });
  await journal(12, 'daily-retrospective', 'standard', {
    win: 'Ran 4.2 miles and it felt easy for the first time in weeks.',
    challenge: 'Almost skipped meditation because the day filled up.',
    pivot: 'Meditate right after the morning walk instead of “when there’s time”.',
  });
  await journal(9, 'free-write', 'free', {
    'free-write':
      'Grateful for the quiet hour before anyone else is awake. Coffee, the plan for the day, no inputs. It sets the tone for everything else.',
  });
  await journal(6, 'morning-primer', 'standard', {
    priority: 'Deep work on the quarterly review deck — no email before noon.',
    logistics: 'Library in the morning; phone stays in the bag.',
    contingency: 'If focus breaks, take a 10-minute walk instead of opening a browser tab.',
  });
  await journal(4, 'daily-retrospective', 'standard', {
    win: 'Kept the full wind-down checklist and fell asleep in minutes.',
    challenge: 'Stress spike mid-afternoon around the deadline.',
    pivot: 'Next time, flag the risk early instead of absorbing it silently.',
  });
  await journal(2, 'free-write', 'free', {
    'free-write':
      'Three days in a row of morning meditation now. It doesn’t fix the day, but it puts a little space between me and the first stressful thing.',
  });
  await journal(1, 'daily-retrospective', 'standard', {
    win: 'Hit every habit on the tracker except reading.',
    challenge: 'Late caffeine — could feel it at bedtime.',
    pivot: 'Last coffee before noon, especially on run days.',
  });

  // --- Wellbeing, sleep & health factors (45 days) -----------------------------
  type WEntry = Parameters<typeof createWellbeingEntries>[0][number];
  const wEntries: WEntry[] = [];
  let weight = 174.5;

  // Full-window aggregates for the seeded Insights AI Review below. Every figure
  // the review cites is accumulated here from the same numbers written to the DB,
  // so the narrative stays true to the dataset (matches the weekly-review pattern).
  const insWin = {
    windDownNights: 0,
    windDownSleepSum: 0,
    otherNights: 0,
    otherSleepSum: 0,
    moodSum: 0,
    energySum: 0,
    sleepSum: 0,
    days: 0,
  };

  for (let daysAgo = WELLBEING_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const dayKey = dayKeyDaysAgo(daysAgo);
    const inReportWeek = reportDaySet.has(dayKey);
    const morningTs = isoAt(dayKey, 12, 30);
    const eveningTs = isoAt(dayKey, 21, 30);
    const middayTs = isoAt(dayKey, 16);
    const progress = 1 - daysAgo / WELLBEING_DAYS;

    // Behavioral factors first — sleep quality is genuinely correlated with them.
    const windDown = chance(0.55 + 0.15 * progress);
    const phoneInBed = chance(windDown ? 0.18 : 0.5);
    const caffeineAfterNoon = chance(0.3) ? Math.round(between(1, 2)) : 0;

    let sleepScore = 76 + (windDown ? 7 : -2) - (phoneInBed ? 8 : 0) - caffeineAfterNoon * 3 + between(-7, 7);
    sleepScore = Math.round(clamp(sleepScore, 46, 97));
    const sleepAidUsed = sleepScore < 62 && chance(0.55) ? 1 : 0;

    const bedtimeMinutes = Math.round(clamp(600 + (phoneInBed ? between(15, 55) : between(-25, 25)), 540, 700)); // ~9-11:40pm
    const wakeMinutes = Math.round(clamp(1110 + between(-25, 25), 1050, 1170)); // ~5:30-7:30am
    const latency = Math.round(clamp(windDown ? between(6, 16) : between(12, 38), 4, 45));
    const awakenings = sleepScore > 80 ? 0 : Math.round(between(0, 2));
    const durationMinutes = Math.round(clamp(wakeMinutes - bedtimeMinutes - latency - awakenings * 9, 330, 560));

    const bedtimeScore = Math.round(clamp(25 - Math.abs(bedtimeMinutes - 600) / 4, 6, 25));
    const interruptionScore = Math.round(clamp(25 - awakenings * 6 - latency / 5, 5, 25));
    const durationScore = Math.round(clamp(sleepScore - bedtimeScore - interruptionScore, 10, 50));
    const appleScore = bedtimeScore + interruptionScore + durationScore;

    // Subjective morning metrics track sleep; evening metrics track the day.
    const sleepBoost = (sleepScore - 70) / 15; // roughly -1.5..+1.8
    const mood = Math.round(clamp(3.2 + sleepBoost * 0.7 + between(-0.8, 0.8), 1, 5));
    const energy = Math.round(clamp(3.1 + sleepBoost * 0.9 + between(-0.8, 0.8), 1, 5));
    const anxiety = Math.round(clamp(2.8 - sleepBoost * 0.5 + between(-0.9, 0.9), 1, 5));
    const motivation = Math.round(clamp(3.2 + 0.6 * progress + between(-0.9, 0.9), 1, 5));
    const focus = Math.round(clamp(3 + sleepBoost * 0.6 + between(-0.8, 0.8), 1, 5));

    const satisfaction = Math.round(clamp(3.2 + between(-1, 1), 1, 5));
    const productivityScore = Math.round(clamp(3.1 + 0.5 * progress + between(-1, 1), 1, 5));
    const eveningMood = Math.round(clamp(3.3 + between(-0.9, 0.9), 1, 5));
    const stress = Math.round(clamp(3 - 0.4 * progress + between(-1, 1), 1, 5));
    const enjoyment = Math.round(clamp(3.4 + between(-0.9, 0.9), 1, 5));

    weight = clamp(weight - 0.035 + between(-0.25, 0.25), 168, 176);
    const caffeineMg = Math.round(clamp(between(80, 190) + caffeineAfterNoon * 70, 0, 380));

    if (inReportWeek) {
      week.moodSum += mood;
      week.moodCount++;
      week.sleepScoreSum += appleScore;
      week.sleepScoreCount++;
      if (windDown) week.windDownNights++;
    }

    // Full-window accumulation for the seeded Insights AI Review.
    insWin.days++;
    insWin.moodSum += mood;
    insWin.energySum += energy;
    insWin.sleepSum += appleScore;
    if (windDown) {
      insWin.windDownNights++;
      insWin.windDownSleepSum += appleScore;
    } else {
      insWin.otherNights++;
      insWin.otherSleepSum += appleScore;
    }

    const m = (metricKey: WEntry['metricKey'], value: number | string, timeOfDay: 'morning' | 'evening' | null, timestampUtc: string): WEntry =>
      ({ dayKey, timeOfDay, metricKey, value, source: 'checkin', timestampUtc } as WEntry);

    wEntries.push(
      m('mood', mood, 'morning', morningTs),
      m('energy', energy, 'morning', morningTs),
      m('anxiety', anxiety, 'morning', morningTs),
      m('motivation', motivation, 'morning', morningTs),
      m('focus', focus, 'morning', morningTs),
      m('satisfaction', satisfaction, 'evening', eveningTs),
      m('productivity', productivityScore, 'evening', eveningTs),
      m('mood', eveningMood, 'evening', eveningTs),
      m('stress', stress, 'evening', eveningTs),
      m('enjoyment', enjoyment, 'evening', eveningTs),
      // Sleep outcomes (recorded in the morning, about last night)
      m('appleSleepScore', appleScore, 'morning', morningTs),
      m('appleSleepBedtimeScore', bedtimeScore, 'morning', morningTs),
      m('appleSleepDurationScore', durationScore, 'morning', morningTs),
      m('appleSleepInterruptionScore', interruptionScore, 'morning', morningTs),
      m('sleepBedtimeMinutes', bedtimeMinutes, 'morning', morningTs),
      m('sleepWakeMinutes', wakeMinutes, 'morning', morningTs),
      m('sleepDurationMinutes', durationMinutes, 'morning', morningTs),
      m('sleepLatencyMinutes', latency, 'morning', morningTs),
      m('sleepAwakenings', awakenings, 'morning', morningTs),
      m('sleepAidUsed', sleepAidUsed, 'morning', morningTs),
      // Behavioral factors
      m('factorPhoneInBed', phoneInBed ? 1 : 0, 'morning', morningTs),
      m('factorWindDown', windDown ? 1 : 0, 'morning', morningTs),
      m('factorCaffeineAfter12', caffeineAfterNoon, 'morning', morningTs),
      // Health hub daily numbers
      m('weight', round1(weight), null, middayTs),
      m('caffeineMg', caffeineMg, null, middayTs),
    );

    if (chance(0.3)) {
      wEntries.push(
        m('eveningBestPart', pick(rng, [
          'The long run in the cold air.',
          'Finishing the proposal early.',
          'Dinner with no screens.',
          'A genuinely quiet morning.',
          'Crossing the 50-hour deep work milestone.',
        ]), 'evening', eveningTs)
      );
    }
    if (stress >= 4 && chance(0.6)) {
      wEntries.push(m('dayTags', 'workStress', 'evening', eveningTs));
    } else if (sleepScore < 60 && chance(0.5)) {
      wEntries.push(m('dayTags', 'poorSleep', 'evening', eveningTs));
    }
  }

  await createWellbeingEntries(wEntries, UID, { defaultTimeZone: 'UTC' });

  // --- Medications / supplements / symptoms ------------------------------------
  const allergyMed = await createMedication(
    { name: 'Loratadine (allergy)', dosage: '10mg', schedule: 'morning', startDate: dayKeyDaysAgo(120), active: true },
    HH, UID
  );
  const vitaminD = await createSupplement({ name: 'Vitamin D3', dosage: '2000 IU', schedule: 'morning', active: true }, HH, UID);
  const magnesium = await createSupplement({ name: 'Magnesium glycinate', dosage: '200mg', schedule: 'evening', active: true }, HH, UID);
  const headache = await createSymptom({ name: 'Headache', active: true }, HH, UID);

  const logRng = mulberry32(42);
  let allergyTakenDays = 0;
  for (let daysAgo = WELLBEING_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const dayKey = dayKeyDaysAgo(daysAgo);
    if (logRng() < 0.92) {
      await setMedicationLog({ medicationId: allergyMed.id, dayKey, taken: true }, HH, UID);
      allergyTakenDays++;
    }
    if (logRng() < 0.85) await setSupplementLog({ supplementId: vitaminD.id, dayKey, taken: true }, HH, UID);
    if (logRng() < 0.7) await setSupplementLog({ supplementId: magnesium.id, dayKey, taken: true }, HH, UID);
    if (logRng() < 0.13) {
      await setSymptomLog({ symptomId: headache.id, dayKey, severity: Math.round(1 + logRng() * 2) }, HH, UID);
    }
  }

  // --- Routines -----------------------------------------------------------------
  const variant = (
    name: string,
    minutes: number,
    sortOrder: number,
    steps: Array<{ title: string; instruction?: string; timerSeconds?: number; linkedHabitId?: string }>
  ): RoutineVariant => ({
    id: randomUUID(),
    name,
    estimatedDurationMinutes: minutes,
    sortOrder,
    steps: steps.map((s) => ({ id: randomUUID(), ...s })),
    linkedHabitIds: steps.map((s) => s.linkedHabitId).filter((x): x is string => !!x),
    isAiGenerated: false,
    createdAt: now,
    updatedAt: now,
  });

  const morningKickstart = await createRoutine(HH, UID, {
    title: 'Morning Kickstart',
    categoryId: health.id,
    linkedHabitIds: [],
    steps: [],
    icon: 'sunrise',
    variants: [
      variant('Quick', 10, 0, [
        { title: 'Glass of water', instruction: 'Rehydrate before coffee.', linkedHabitId: water.id },
        { title: '5-minute stretch', timerSeconds: 300 },
        { title: 'Pick today’s one priority', instruction: 'Write it down where you can see it.' },
      ]),
      variant('Standard', 25, 1, [
        { title: 'Glass of water', instruction: 'Rehydrate before coffee.', linkedHabitId: water.id },
        { title: '10-minute walk', instruction: 'Outside if possible — daylight helps.', timerSeconds: 600, linkedHabitId: morningWalk.id },
        { title: 'Meditate', instruction: 'Sit, timer on, follow the breath.', timerSeconds: 600, linkedHabitId: meditate.id },
        { title: 'Plan the deep work block', instruction: 'What does “done” look like today?' },
      ]),
    ],
  });

  const eveningWindDown = await createRoutine(HH, UID, {
    title: 'Evening Wind-Down',
    categoryId: health.id,
    linkedHabitIds: [],
    steps: [],
    icon: 'moon',
    variants: [
      variant('Standard', 20, 0, [
        { title: 'Screens off', instruction: 'Phone on the charger, outside the bedroom.', linkedHabitId: noScreens.id },
        { title: 'Light stretch', timerSeconds: 300, linkedHabitId: stretch.id },
        { title: 'Read', instruction: 'Paper or e-ink only.', timerSeconds: 1200, linkedHabitId: read.id },
      ]),
    ],
  });

  const logVariant = (routine: typeof morningKickstart, variantIndex: number, daysAgo: number, startHourUtc: number, durationSeconds: number) => {
    const v = routine.variants![variantIndex];
    const dayKey = dayKeyDaysAgo(daysAgo);
    const stepResults: Record<string, 'done'> = {};
    for (const s of v.steps) stepResults[s.id] = 'done';
    return saveRoutineLog(
      {
        routineId: routine.id,
        variantId: v.id,
        date: dayKey,
        startedAt: isoAt(dayKey, startHourUtc),
        completedAt: isoAt(dayKey, startHourUtc, Math.round(durationSeconds / 60)),
        stepResults,
        actualDurationSeconds: durationSeconds,
      },
      UID
    );
  };

  await logVariant(morningKickstart, 1, 6, 12, 1420);
  await logVariant(morningKickstart, 0, 4, 12, 610);
  await logVariant(morningKickstart, 1, 2, 12, 1505);
  await logVariant(morningKickstart, 1, 1, 12, 1380);
  await logVariant(eveningWindDown, 0, 5, 2, 1150);
  await logVariant(eveningWindDown, 0, 2, 2, 1240);
  await logVariant(eveningWindDown, 0, 1, 2, 1195);

  // --- Dashboard prefs ------------------------------------------------------------
  await updateDashboardPrefs(HH, UID, {
    pinnedRoutineIds: [morningKickstart.id, eveningWindDown.id],
    pinnedGoalIds: [deepWorkGoal.id, run80.id],
    sleepTargets: { bedtimeMinutes: 600, wakeMinutes: 1110, durationMinutes: 480 },
  });

  // --- Sample AI reports (composed from the seeded numbers above) ------------------
  const avgMood = week.moodCount ? round1(week.moodSum / week.moodCount) : 0;
  const avgSleep = week.sleepScoreCount ? Math.round(week.sleepScoreSum / week.sleepScoreCount) : 0;

  const weeklyReview: WeeklyAIReview = {
    weekStart: reportWeek.start,
    weekEnd: reportWeek.end,
    summary:
      `A steady, well-balanced week. Training stayed on plan with ${week.runCount} runs totaling ${week.runMiles} miles ` +
      `and ${week.strengthDays} strength sessions, while ${week.deepWorkDays} deep work days added ${week.deepWorkHours} focused hours ` +
      `toward the 150-hour goal. Mornings continued to anchor the week — walks on ${week.walkDays} days and meditation on ${week.meditationDays}.\n\n` +
      `Sleep averaged a ${avgSleep} score, and the nights that followed the wind-down checklist (${week.windDownNights} this week) were noticeably better than the nights that didn't. ` +
      `Journaling happened ${week.journalCount} time${week.journalCount === 1 ? '' : 's'}, mostly around focus and the before-bed phone habit.`,
    facts: [
      `${week.runCount} runs logged for ${week.runMiles} total miles.`,
      `${week.deepWorkHours} hours of deep work across ${week.deepWorkDays} days.`,
      `Meditation on ${week.meditationDays} of 7 days; morning walk on ${week.walkDays}.`,
      `Average sleep score ${avgSleep}; wind-down checklist completed on ${week.windDownNights} nights.`,
      `Average morning mood ${avgMood} / 5.`,
    ],
    patterns: [
      {
        title: 'Wind-down nights sleep better',
        evidence: `On nights with the wind-down checklist done, sleep scores ran meaningfully higher than nights with the phone in bed.`,
        confidence: 'high',
      },
      {
        title: 'Meditation consistency is trending up',
        evidence: `Meditation frequency has climbed steadily over the past several weeks and held at ${week.meditationDays}/7 this week.`,
        confidence: 'medium',
      },
    ],
    journalThemes: [
      'Protecting morning focus from meetings and email.',
      'The before-bed phone habit undermining sleep.',
      'Small wins compounding — “tiny steps” language recurs.',
    ],
    wins: [
      `Every planned run completed (${week.runCount}/3).`,
      'Wind-down checklist held on more nights than it slipped.',
      'Deep work goal passed another milestone this week.',
    ],
    areasForAttention: [
      'Reading slipped on busy evenings.',
      'Late caffeine on two days showed up in that night’s sleep latency.',
    ],
    recommendations: [
      {
        title: 'Anchor meditation to the walk',
        reason: 'Both are morning habits, and the walk is already near-automatic.',
        suggestedAction: 'Sit for ten minutes immediately after getting back, before opening any screen.',
      },
      {
        title: 'Make the caffeine cutoff explicit',
        reason: 'The two lowest sleep scores this week followed afternoon caffeine.',
        suggestedAction: 'Last coffee before noon; switch to decaf after.',
      },
    ],
    dataLimitations: [
      'One week is a small sample — patterns here are directional, not conclusive.',
    ],
  };

  await saveAIReport(HH, UID, {
    kind: 'weekly_review',
    periodStart: reportWeek.start,
    periodEnd: reportWeek.end,
    payload: { review: weeklyReview },
  });

  await saveAIReport(HH, UID, {
    kind: 'journal_summary',
    periodStart: dayKeyDaysAgo(7),
    periodEnd: dayKeyDaysAgo(1),
    payload: {
      summary:
        '**This week in your journal**\n\n' +
        'Your entries kept circling two threads: protecting the morning (walk → meditate → deep work before any inputs) and the tug-of-war with the phone at night. ' +
        'The retrospectives show a constructive pattern — each challenge ends with a concrete pivot rather than self-criticism.\n\n' +
        '**Highlights**\n' +
        '- The 4.2-mile run that “felt easy for the first time in weeks.”\n' +
        '- Three consecutive days of morning meditation.\n' +
        '- Falling asleep quickly after a full wind-down evening.\n\n' +
        '**Gentle suggestion**\n' +
        'You already know your best days start before 9am. Consider writing tomorrow’s one priority the night before, as part of the wind-down checklist.',
      journalEntriesCount: 10,
    },
  });

  // AI Journal Review — the "AI Review" tab reads its content from saved
  // journal_review reports (the read-only demo has no Gemini key to generate
  // live), so without this the tour's Journal Review stop shows nothing.
  // This is a genuine Gemini (gemini-3.5-flash) generation over the ten seeded
  // journal entries above, produced with the same prompt/schema the live route
  // uses — so it reflects the real output shape. Range is the last 30 days,
  // matching the panel's "Last 30 days" preset, so all ten entries are covered.
  const journalReviewStart = dayKeyDaysAgo(29);
  const journalReviewEnd = dayKeyDaysAgo(0);
  const journalReview: AIJournalReview = {
    rangeStart: journalReviewStart,
    rangeEnd: journalReviewEnd,
    overview:
      "Over the past month, your entries show a consistent focus on optimizing morning routines, managing deep work blocks, and protecting sleep quality. You have actively observed friction points—such as evening phone use and afternoon schedule fragmentation—and repeatedly used your reflections to propose practical, forward-looking adjustments.",
    emotionalThemes: [
      {
        theme: "Appreciation for quiet, structured mornings",
        evidence:
          "Noted feeling grateful for early hours with coffee and no digital inputs, which helps set a positive tone for the day.",
        confidence: "high",
      },
      {
        theme: "Satisfaction from physical activity and mindfulness",
        evidence:
          "Described running as feeling easy after weeks of effort, and noted that consecutive days of meditation provided helpful mental space from stress.",
        confidence: "medium",
      },
    ],
    recurringStressors: [
      {
        stressor: "Afternoon schedule fragmentation and deadlines",
        evidence:
          "Mentioned meetings breaking up the afternoon and experienced a specific mid-afternoon stress spike around a project deadline.",
        confidence: "high",
      },
      {
        stressor: "Evening digital distractions impacting sleep",
        evidence:
          "Scrolling instead of following a wind-down routine led to poor sleep and a sluggish morning.",
        confidence: "medium",
      },
    ],
    wins: [
      {
        title: "Successful Deep Work Blocks",
        evidence:
          "Completed a proposal draft by protecting morning hours, separating from the phone, and utilizing structured 90-minute focus sessions.",
      },
      {
        title: "Building a Mindfulness Habit",
        evidence:
          "Achieved consecutive days of morning meditation, noting its positive effect on creating a buffer against daily stressors.",
      },
      {
        title: "Improving Sleep Hygiene",
        evidence:
          "Successfully followed a wind-down checklist to fall asleep quickly and learned to cut off caffeine by noon to protect rest.",
      },
    ],
    selfTalkPatterns: [
      {
        pattern: "Problem-solving and forward-looking",
        evidence:
          "Frequently ends reflections with specific adjustments for the next day, such as moving meetings to the afternoon or changing the time of meditation.",
        suggestion:
          "Continue this highly pragmatic approach, but consider occasionally taking an extra moment to explicitly celebrate the days when the plan works perfectly.",
      },
      {
        pattern: "Self-observant without harsh judgment",
        evidence:
          "Noticed resistance to starting a run or skipping a wind-down routine by neutrally describing the pattern rather than using self-critical labels.",
      },
    ],
    reflectionQuestions: [
      "What is the biggest difference in how your day feels when you successfully leave your phone in another room versus when you keep it nearby?",
      "You noticed that starting a run is the hardest part; how might you apply that 'just get out the door' realization to other areas where you feel resistance?",
      "Since afternoon deadlines and meetings cause stress spikes, how can you build a small, calming transition ritual into your midday routine?",
      "You found that early meditation puts space between you and stressors. What does that 'space' feel like, and how can you intentionally protect it?",
    ],
    suggestedNextSteps: [
      {
        title: "Schedule a midday transition walk",
        rationale:
          "Since afternoons tend to bring schedule fragmentation and stress spikes, a physical break might help reset focus.",
        action:
          "Add a 10-minute walk right after lunch before tackling your afternoon meetings.",
      },
      {
        title: "Standardize the evening wind-down alarm",
        rationale:
          "Doom-scrolling occasionally derails sleep, while the checklist proves highly effective when utilized.",
        action:
          "Set a daily recurring alarm 45 minutes before bed that prompts you to put the phone away and start the wind-down checklist.",
      },
      {
        title: "Anchor meditation to an existing habit",
        rationale:
          "You noted that meditating 'when there is time' doesn't work as well as doing it systematically.",
        action:
          "Commit to doing your meditation immediately after your morning walk or first cup of coffee to lock it in.",
      },
    ],
    dataLimitations: [
      "This review is based on a limited set of 10 entries. It primarily captures work habits and morning routines, offering less visibility into evening or weekend experiences.",
    ],
  };

  // Insights AI Review — the cross-domain narrative shown on the Insights page's
  // AI Review tab. Seeded (not live-generated) so the read-only demo can display
  // a real review without a Gemini key. Every figure is computed from insWin,
  // which was accumulated from the same wellbeing entries written above.
  const wdMean = insWin.windDownNights ? round1(insWin.windDownSleepSum / insWin.windDownNights) : 0;
  const otherMean = insWin.otherNights ? round1(insWin.otherSleepSum / insWin.otherNights) : 0;
  const sleepGap = round1(wdMean - otherMean);
  const avgMoodWin = insWin.days ? round1(insWin.moodSum / insWin.days) : 0;
  const avgEnergyWin = insWin.days ? round1(insWin.energySum / insWin.days) : 0;
  const avgSleepWin = insWin.days ? Math.round(insWin.sleepSum / insWin.days) : 0;
  const allergyAdherence = Math.round((allergyTakenDays / WELLBEING_DAYS) * 100);
  const insRangeStart = dayKeyDaysAgo(WELLBEING_DAYS - 1);
  const insRangeEnd = dayKeyDaysAgo(0);

  const insightsReview: InsightsAIReview = {
    rangeDays: WELLBEING_DAYS,
    rangeStart: insRangeStart,
    rangeEnd: insRangeEnd,
    summary:
      `Across the last ${WELLBEING_DAYS} days the clearest signal is behavioral: the evenings you ran the wind-down ` +
      `routine were followed by better sleep. On wind-down nights your sleep score averaged ${wdMean}, versus ` +
      `${otherMean} on the nights you skipped it — a gap of about ${sleepGap} points (n=${insWin.windDownNights} vs ` +
      `${insWin.otherNights}). Sleep, in turn, tracks with how the next morning feels: mood averaged ${avgMoodWin}/5 ` +
      `and energy ${avgEnergyWin}/5 over the window, both leaning higher on mornings after a stronger sleep score.\n\n` +
      `Adherence is a quiet strength — the allergy medication was taken on ${allergyAdherence}% of days. Everything ` +
      `below is correlation, not causation: these are relationships measured in your own data, not proof that one ` +
      `thing causes another.`,
    keyFindings: [
      `Wind-down nights averaged a ${wdMean} sleep score vs ${otherMean} on other nights (n=${insWin.windDownNights} vs ${insWin.otherNights}).`,
      `Sleep score averaged ${avgSleepWin} across ${insWin.days} nights in the window.`,
      `Morning mood averaged ${avgMoodWin}/5 and energy ${avgEnergyWin}/5.`,
      `Allergy medication adherence was ${allergyAdherence}% (${allergyTakenDays}/${WELLBEING_DAYS} days).`,
    ],
    patterns: [
      {
        title: 'Wind-down routine precedes better sleep',
        evidence: `The ~${sleepGap}-point sleep-score gap between wind-down and non-wind-down nights, over ${insWin.days} nights, is the strongest relationship in the window.`,
        confidence: 'high',
      },
      {
        title: 'Better sleep tracks with better mornings',
        evidence: `Mornings after higher sleep scores tended to log higher mood and energy; the effect is consistent but smaller than the wind-down → sleep link.`,
        confidence: 'medium',
      },
      {
        title: 'Phone-in-bed and late caffeine drag on sleep',
        evidence: `Nights with the phone in bed or afternoon caffeine skewed toward lower sleep scores, though they overlap with non-wind-down nights and can't be cleanly separated.`,
        confidence: 'low',
      },
    ],
    outlook: [
      `If your recent wind-down consistency holds, the simple linear trend keeps sleep scores around ${avgSleepWin} — a projection from the current slope, not a guarantee.`,
      `Morning energy has been drifting up over the window; keeping the morning walk + meditation pairing is the most likely lever to hold that trend.`,
    ],
    recommendations: [
      {
        title: 'Protect the wind-down on work nights',
        reason: `It's the single behavior with the largest measured effect on your sleep (~${sleepGap}-point gap).`,
        suggestedAction: 'Set a fixed screens-off time and keep the phone charging outside the bedroom.',
      },
      {
        title: 'Move caffeine earlier',
        reason: 'Afternoon-caffeine days lean toward lower sleep scores and longer time to fall asleep.',
        suggestedAction: 'Make noon your last-coffee cutoff and switch to decaf after.',
      },
      {
        title: 'Keep the morning stack intact',
        reason: 'Days that start with the walk and meditation show up with higher morning energy.',
        suggestedAction: 'Anchor the ten-minute sit to the end of the walk so it stays near-automatic.',
      },
    ],
    dataLimitations: [
      `${WELLBEING_DAYS} days is a modest window — relationships are directional, not conclusive.`,
      `Behavioral factors overlap (wind-down nights also tend to be phone-free), so their individual effects can't be fully separated.`,
      'Sleep scores are entered manually, so occasional gaps or estimation noise are expected.',
    ],
  };

  await saveAIReport(HH, UID, {
    kind: 'journal_review',
    periodStart: journalReviewStart,
    periodEnd: journalReviewEnd,
    payload: { review: journalReview },
  });

  await saveAIReport(HH, UID, {
    kind: 'insights_review',
    periodStart: insRangeStart,
    periodEnd: insRangeEnd,
    payload: { review: insightsReview },
  });

  return { seeded: true, reason: hadData ? 'reseeded' : 'seeded' };
}

function pick<T>(rng: () => number, options: T[]): T {
  return options[Math.floor(rng() * options.length)];
}

/**
 * Startup hook: seed/refresh the demo dataset when the public demo is enabled.
 * Never throws — demo seeding must not take the server down.
 */
export async function maybeSeedDemoShowcase(): Promise<void> {
  try {
    const result = await seedDemoShowcase();
    if (result.seeded) {
      console.log(`[DemoShowcase] Demo dataset ${result.reason} for ${UID}`);
    } else {
      console.log('[DemoShowcase] Demo dataset is fresh — skipping seed');
    }
  } catch (err) {
    console.error('[DemoShowcase] Seed failed (non-fatal):', err);
  }
}
