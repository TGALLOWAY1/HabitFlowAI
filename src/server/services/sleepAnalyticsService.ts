/**
 * Sleep Analytics Service
 *
 * Computes the Sleep Analytics dashboard entirely from canonical truth at read
 * time. Nothing is stored. Inputs are WellbeingEntry records (sleep outcomes +
 * behavioral factors, all logged with timeOfDay:'morning') plus the user's
 * HabitEntries (so the correlation engine can also use any other tracked habit).
 *
 * `computeSleepAnalytics` is PURE (inputs -> output, no I/O) so the same function
 * can back a future AI prompt-assembly layer and be unit-tested deterministically.
 *
 * ── Clock-time encoding ──────────────────────────────────────────────────────
 * Bedtime/wake clock times are stored as "minutes-after-noon" (minutes elapsed
 * since 12:00 noon, wrapped 0..1439) so a normal sleep window stays numerically
 * contiguous across midnight. See the data contract doc for details.
 *
 * ── Sleep Consistency Score ──────────────────────────────────────────────────
 * Rewards going to bed AND waking at SIMILAR clock times night-to-night,
 * independent of sleep DURATION. For bedtime and wake separately we compute a
 * circular standard deviation (clock is modular, period 1440 min), map it to a
 * 0-100 sub-score via exponential decay, then average the two:
 *
 *   σ_circ = sqrt(-2 ln R)   where R is the mean resultant length of the angles
 *   σ_min  = σ_circ * 1440 / (2π)
 *   subScore = 100 * exp(-σ_min / τ)        τ = SLEEP_CONSISTENCY_TOLERANCE_MIN
 *   consistency = round((subScore_bedtime + subScore_wake) / 2)
 *
 * Worked examples (τ = 90):
 *   Bedtimes 10:00/10:05/9:58/10:02 → σ≈2.6m → subScore≈97 (very consistent).
 *   Bedtimes 9:00/11:30/10:15/12:00 → σ≈68m → subScore≈47 (poor) — even though
 *   the average bedtime (~10:41 PM) and duration could look fine; duration is
 *   excluded by design.
 */

import { parseISO, subDays, format, getISOWeek, getISOWeekYear } from 'date-fns';
import type { Habit, HabitEntry, Category, WellbeingEntry } from '../../models/persistenceTypes';
import { buildDayStatesByHabit } from './analyticsService';
import { isTrackableHabit } from './scheduleEngine';

// ─── Tunable constants ─────────────────────────────────────────────────────────

/** Tolerance (minutes) for the consistency exponential decay. Single tuning knob. */
export const SLEEP_CONSISTENCY_TOLERANCE_MIN = 90;
/** Minimum nights with a field before a stat/consistency value is reported. */
const MIN_NIGHTS_FOR_CONSISTENCY = 3;
/** Minimum nights per group before a correlation factor is surfaced. */
const MIN_NIGHTS_PER_GROUP = 5;
/** Minimum |Cohen's d| before a correlation factor is surfaced. */
const MIN_EFFECT_SIZE = 0.2;
/** Max correlation factors returned. */
const MAX_FACTORS = 6;

const MINUTES_PER_DAY = 1440;

// ─── Types (mirrored structurally in src/lib/analyticsClient.ts) ───────────────

export interface SleepStat {
  value: number | null;
  sampleSize: number;
  trendDelta: number | null;
  trendDirection: 'better' | 'worse' | 'stable' | null;
}

export interface SleepNight {
  dayKey: string;
  appleSleepScore: number | null;
  bedtimeScore: number | null;
  durationScore: number | null;
  interruptionScore: number | null;
  bedtimeMinutes: number | null;
  wakeMinutes: number | null;
  durationMinutes: number | null;
  latencyMinutes: number | null;
  awakenings: number | null;
  sleepAidUsed: boolean | null;
  sleepQuality0to4: number | null;
  morningEnergy: number | null;
  hasData: boolean;
}

export interface SleepTrendPoint {
  dayKey: string;
  durationMinutes: number | null;
  appleSleepScore: number | null;
  bedtimeMinutes: number | null;
  wakeMinutes: number | null;
  sleepQuality0to10: number | null;
}

export interface SleepWeekSummary {
  weekLabel: string;
  avgDurationMinutes: number | null;
  avgLatencyMinutes: number | null;
  nightsOnTarget: number;
  avgAwakenings: number | null;
  sleepAidFreeNights: number;
  avgMorningEnergy: number | null;
}

export interface SleepFactorInsight {
  factorId: string;
  factorName: string;
  source: 'form' | 'habit';
  outcome: 'appleSleepScore' | 'sleepQuality' | 'latencyMinutes' | 'bedtimeMinutes';
  factorPresentMean: number;
  factorAbsentMean: number;
  meanDifference: number;
  effectSize: number;
  direction: 'improves' | 'worsens';
  nPresent: number;
  nAbsent: number;
  message: string;
}

export interface SleepAchievement {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  value?: number | null;
  icon: 'streak' | 'quality' | 'consistency' | 'aidfree' | 'latency';
}

export interface SleepTargets {
  bedtimeMinutes: number;
  wakeMinutes: number;
  durationMinutes: number;
}

export interface SleepIndependence {
  aidFreeNights: number;
  aidNights: number;
  aidFreePercent: number | null;
  currentAidFreeStreak: number;
  longestAidFreeStreak: number;
  trendDirection: 'better' | 'worse' | 'stable' | null;
  trendDelta: number | null;
  sampleSize: number;
}

export interface SleepAnalyticsSummary {
  avgDurationMinutes: SleepStat;
  avgLatencyMinutes: SleepStat;
  avgBedtimeMinutes: SleepStat;
  avgWakeMinutes: SleepStat;
  avgSleepQuality0to10: SleepStat;
  avgAppleSleepScore: SleepStat;
  consistencyScore: number | null;
  consistencyBedtime: number | null;
  consistencyWake: number | null;
  consistencyTrendDelta: number | null;
  independence: SleepIndependence;
  trend: SleepTrendPoint[];
  weeklySummary: SleepWeekSummary[];
  topFactors: SleepFactorInsight[];
  achievements: SleepAchievement[];
  nights: SleepNight[];
  targets: SleepTargets;
  rangeDays: number;
  coverage: { nightsWithData: number; nightsInRange: number };
}

export const DEFAULT_SLEEP_TARGETS: SleepTargets = {
  bedtimeMinutes: 600,  // 10:00 PM
  wakeMinutes: 1080,    // 6:00 AM
  durationMinutes: 480, // 8h
};

// ─── Small numeric helpers ─────────────────────────────────────────────────────

function toNum(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function generateDayKeyRange(startDayKey: string, endDayKey: string): string[] {
  const days: string[] = [];
  const start = parseISO(startDayKey);
  const end = parseISO(endDayKey);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(format(d, 'yyyy-MM-dd'));
  }
  return days;
}

function startDayKeyForRange(referenceDayKey: string, days: number): string {
  return format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
}

/**
 * Circular standard deviation (in minutes) of clock values on a 1440-min period.
 * Returns 0 for <2 samples.
 */
export function circularStdDevMinutes(values: number[]): number {
  if (values.length < 2) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (const v of values) {
    const theta = (2 * Math.PI * v) / MINUTES_PER_DAY;
    sumSin += Math.sin(theta);
    sumCos += Math.cos(theta);
  }
  const n = values.length;
  const r = Math.sqrt((sumSin / n) ** 2 + (sumCos / n) ** 2);
  if (r <= 0) return MINUTES_PER_DAY / 4; // fully dispersed → cap
  const sigmaRad = Math.sqrt(-2 * Math.log(Math.min(1, r)));
  return (sigmaRad * MINUTES_PER_DAY) / (2 * Math.PI);
}

/** Map a circular std-dev (minutes) to a 0-100 consistency sub-score. */
export function consistencySubScore(sigmaMin: number): number {
  return Math.round(100 * Math.exp(-sigmaMin / SLEEP_CONSISTENCY_TOLERANCE_MIN));
}

// ─── Per-night build ───────────────────────────────────────────────────────────

const SLEEP_METRIC_KEYS = new Set<string>([
  'appleSleepScore', 'appleSleepBedtimeScore', 'appleSleepDurationScore', 'appleSleepInterruptionScore',
  'sleepBedtimeMinutes', 'sleepWakeMinutes', 'sleepDurationMinutes', 'sleepLatencyMinutes',
  'sleepAwakenings', 'sleepAidUsed', 'sleepQuality', 'energy',
  'factorPhoneInBed', 'factorBlueLightMinutes', 'factorWindDown', 'factorLateNightEating', 'factorCaffeineAfter12',
]);

/** Behavioral factor metric keys captured by the sleep form. */
const FORM_FACTOR_KEYS: Array<{ key: string; name: string }> = [
  { key: 'sleepAidUsed', name: 'Sleep aid used' },
  { key: 'factorPhoneInBed', name: 'Phone in bed' },
  { key: 'factorBlueLightMinutes', name: 'Blue light after target' },
  { key: 'factorWindDown', name: 'Wind-down routine' },
  { key: 'factorLateNightEating', name: 'Late-night eating' },
  { key: 'factorCaffeineAfter12', name: 'Caffeine after noon' },
];

/**
 * Pivot wellbeing entries into a Map<dayKey, Record<metricKey, number>>.
 * Morning sleep entries only; last write wins per (dayKey, metricKey).
 */
function pivotByDayKey(wellbeingEntries: WellbeingEntry[]): Map<string, Record<string, number>> {
  const byDay = new Map<string, Record<string, number>>();
  for (const e of wellbeingEntries) {
    if (!SLEEP_METRIC_KEYS.has(e.metricKey)) continue;
    const num = toNum(e.value);
    if (num === null) continue;
    const rec = byDay.get(e.dayKey) ?? {};
    rec[e.metricKey] = num;
    byDay.set(e.dayKey, rec);
  }
  return byDay;
}

function buildNight(dayKey: string, rec: Record<string, number> | undefined): SleepNight {
  const r = rec ?? {};
  const get = (k: string): number | null => (k in r ? r[k] : null);
  const appleSleepScore = get('appleSleepScore');
  const durationMinutes = get('sleepDurationMinutes');
  const aid = get('sleepAidUsed');
  const night: SleepNight = {
    dayKey,
    appleSleepScore,
    bedtimeScore: get('appleSleepBedtimeScore'),
    durationScore: get('appleSleepDurationScore'),
    interruptionScore: get('appleSleepInterruptionScore'),
    bedtimeMinutes: get('sleepBedtimeMinutes'),
    wakeMinutes: get('sleepWakeMinutes'),
    durationMinutes,
    latencyMinutes: get('sleepLatencyMinutes'),
    awakenings: get('sleepAwakenings'),
    sleepAidUsed: aid === null ? null : aid >= 1,
    sleepQuality0to4: get('sleepQuality'),
    morningEnergy: get('energy'),
    hasData: appleSleepScore !== null || durationMinutes !== null,
  };
  return night;
}

/** Build per-night records for every dayKey in the range (gaps explicit). */
export function buildSleepNights(
  wellbeingEntries: WellbeingEntry[],
  dayKeys: string[]
): SleepNight[] {
  const byDay = pivotByDayKey(wellbeingEntries);
  return dayKeys.map((dk) => buildNight(dk, byDay.get(dk)));
}

// ─── Headline stats ────────────────────────────────────────────────────────────

type Polarity = 'higher' | 'lower' | 'closeness';

function pickNonNull(nights: SleepNight[], field: keyof SleepNight): number[] {
  const out: number[] = [];
  for (const n of nights) {
    const v = n[field];
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function buildStat(
  currentValues: number[],
  previousValues: number[],
  polarity: Polarity,
  target?: number
): SleepStat {
  const value = mean(currentValues);
  const prev = mean(previousValues);
  if (value === null) {
    return { value: null, sampleSize: 0, trendDelta: null, trendDirection: null };
  }
  if (prev === null) {
    return { value: round1(value), sampleSize: currentValues.length, trendDelta: null, trendDirection: null };
  }
  const delta = value - prev;
  let direction: SleepStat['trendDirection'];
  if (polarity === 'closeness' && target !== undefined) {
    const curDist = Math.abs(value - target);
    const prevDist = Math.abs(prev - target);
    const distDelta = curDist - prevDist;
    direction = Math.abs(distDelta) < 1 ? 'stable' : distDelta < 0 ? 'better' : 'worse';
  } else if (polarity === 'higher') {
    direction = Math.abs(delta) < 0.05 ? 'stable' : delta > 0 ? 'better' : 'worse';
  } else {
    direction = Math.abs(delta) < 0.05 ? 'stable' : delta < 0 ? 'better' : 'worse';
  }
  return {
    value: round1(value),
    sampleSize: currentValues.length,
    trendDelta: round1(delta),
    trendDirection: direction,
  };
}

// ─── Consistency ───────────────────────────────────────────────────────────────

function computeConsistency(nights: SleepNight[]): { overall: number | null; bedtime: number | null; wake: number | null } {
  const bedtimes = pickNonNull(nights, 'bedtimeMinutes');
  const wakes = pickNonNull(nights, 'wakeMinutes');
  const bedtime = bedtimes.length >= MIN_NIGHTS_FOR_CONSISTENCY ? consistencySubScore(circularStdDevMinutes(bedtimes)) : null;
  const wake = wakes.length >= MIN_NIGHTS_FOR_CONSISTENCY ? consistencySubScore(circularStdDevMinutes(wakes)) : null;
  let overall: number | null = null;
  if (bedtime !== null && wake !== null) overall = Math.round((bedtime + wake) / 2);
  else if (bedtime !== null) overall = bedtime;
  else if (wake !== null) overall = wake;
  return { overall, bedtime, wake };
}

// ─── Independence (sleep-aid) ──────────────────────────────────────────────────

function computeIndependence(currentNights: SleepNight[], previousNights: SleepNight[]): SleepIndependence {
  const scored = currentNights.filter((n) => n.sleepAidUsed !== null);
  const aidNights = scored.filter((n) => n.sleepAidUsed === true).length;
  const aidFreeNights = scored.filter((n) => n.sleepAidUsed === false).length;
  const aidFreePercent = scored.length > 0 ? aidFreeNights / scored.length : null;

  // streaks over chronological scored nights
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const n of scored) {
    if (n.sleepAidUsed === false) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  // current streak = trailing run of aid-free nights
  for (let i = scored.length - 1; i >= 0; i--) {
    if (scored[i].sleepAidUsed === false) current += 1;
    else break;
  }

  const prevScored = previousNights.filter((n) => n.sleepAidUsed !== null);
  const prevPercent = prevScored.length > 0
    ? prevScored.filter((n) => n.sleepAidUsed === false).length / prevScored.length
    : null;
  let trendDirection: SleepIndependence['trendDirection'] = null;
  let trendDelta: number | null = null;
  if (aidFreePercent !== null && prevPercent !== null) {
    trendDelta = round1((aidFreePercent - prevPercent) * 100);
    trendDirection = Math.abs(trendDelta) < 1 ? 'stable' : trendDelta > 0 ? 'better' : 'worse';
  }

  return {
    aidFreeNights,
    aidNights,
    aidFreePercent: aidFreePercent === null ? null : Math.round(aidFreePercent * 100) / 100,
    currentAidFreeStreak: current,
    longestAidFreeStreak: longest,
    trendDirection,
    trendDelta,
    sampleSize: scored.length,
  };
}

// ─── Trend + weekly summary ────────────────────────────────────────────────────

function buildTrend(nights: SleepNight[]): SleepTrendPoint[] {
  return nights.map((n) => ({
    dayKey: n.dayKey,
    durationMinutes: n.durationMinutes,
    appleSleepScore: n.appleSleepScore,
    bedtimeMinutes: n.bedtimeMinutes,
    wakeMinutes: n.wakeMinutes,
    sleepQuality0to10: n.sleepQuality0to4 === null ? null : round1(n.sleepQuality0to4 * 2.5),
  }));
}

function weekLabelFor(dayKey: string): string {
  const date = parseISO(dayKey);
  return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
}

function isOnTarget(n: SleepNight, targets: SleepTargets): boolean {
  if (n.bedtimeMinutes === null || n.durationMinutes === null) return false;
  const withinBedtime = Math.abs(n.bedtimeMinutes - targets.bedtimeMinutes) <= 30;
  const enoughSleep = n.durationMinutes >= targets.durationMinutes - 30;
  return withinBedtime && enoughSleep;
}

function buildWeeklySummary(nights: SleepNight[], targets: SleepTargets): SleepWeekSummary[] {
  const byWeek = new Map<string, SleepNight[]>();
  for (const n of nights) {
    const label = weekLabelFor(n.dayKey);
    const arr = byWeek.get(label) ?? [];
    arr.push(n);
    byWeek.set(label, arr);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekLabel, wkNights]) => {
      const dur = mean(wkNights.map((n) => n.durationMinutes).filter((v): v is number => v !== null));
      const lat = mean(wkNights.map((n) => n.latencyMinutes).filter((v): v is number => v !== null));
      const awk = mean(wkNights.map((n) => n.awakenings).filter((v): v is number => v !== null));
      const en = mean(wkNights.map((n) => n.morningEnergy).filter((v): v is number => v !== null));
      return {
        weekLabel,
        avgDurationMinutes: dur === null ? null : Math.round(dur),
        avgLatencyMinutes: lat === null ? null : Math.round(lat),
        nightsOnTarget: wkNights.filter((n) => isOnTarget(n, targets)).length,
        avgAwakenings: awk === null ? null : round1(awk),
        sleepAidFreeNights: wkNights.filter((n) => n.sleepAidUsed === false).length,
        avgMorningEnergy: en === null ? null : round1(en),
      };
    });
}

// ─── Achievements ──────────────────────────────────────────────────────────────

function buildAchievements(
  nights: SleepNight[],
  consistency: number | null,
  independence: SleepIndependence,
  targets: SleepTargets
): SleepAchievement[] {
  // longest run of consecutive on-target nights
  let onTargetRun = 0;
  let onTargetBest = 0;
  for (const n of nights) {
    if (isOnTarget(n, targets)) {
      onTargetRun += 1;
      onTargetBest = Math.max(onTargetBest, onTargetRun);
    } else {
      onTargetRun = 0;
    }
  }
  const qualities = pickNonNull(nights, 'sleepQuality0to4');
  const bestQuality = qualities.length ? Math.max(...qualities) : null;
  const latencies = pickNonNull(nights, 'latencyMinutes');
  const lowestLatency = latencies.length ? Math.min(...latencies) : null;

  return [
    {
      id: 'consistency-streak',
      label: 'Consistency Streak',
      description: 'Longest run of nights hitting your bedtime + duration targets.',
      earned: onTargetBest >= 7,
      value: onTargetBest,
      icon: 'streak',
    },
    {
      id: 'best-quality',
      label: 'Best Quality',
      description: 'Your highest single-night sleep quality.',
      earned: bestQuality !== null && bestQuality >= 4,
      value: bestQuality === null ? null : round1(bestQuality * 2.5),
      icon: 'quality',
    },
    {
      id: 'high-consistency',
      label: 'Steady Sleeper',
      description: 'Reached an 80+ consistency score.',
      earned: consistency !== null && consistency >= 80,
      value: consistency,
      icon: 'consistency',
    },
    {
      id: 'aid-free',
      label: 'Sleep-Aid Free',
      description: 'Longest run of nights without a sleep aid.',
      earned: independence.longestAidFreeStreak >= 7,
      value: independence.longestAidFreeStreak,
      icon: 'aidfree',
    },
    {
      id: 'low-latency',
      label: 'Fast to Sleep',
      description: 'Your fastest time to fall asleep.',
      earned: lowestLatency !== null && lowestLatency <= 10,
      value: lowestLatency,
      icon: 'latency',
    },
  ];
}

// ─── Correlation engine ────────────────────────────────────────────────────────

interface FactorSeries {
  id: string;
  name: string;
  source: 'form' | 'habit';
  /** dayKey -> numeric signal (0/1 for boolean/toggle, raw value for numeric). */
  byDay: Map<string, number>;
}

const OUTCOMES: Array<{ key: 'appleSleepScore' | 'sleepQuality' | 'latencyMinutes' | 'bedtimeMinutes'; field: keyof SleepNight; higherIsBetter: boolean; unitLabel: string }> = [
  { key: 'appleSleepScore', field: 'appleSleepScore', higherIsBetter: true, unitLabel: 'pts' },
  { key: 'sleepQuality', field: 'sleepQuality0to4', higherIsBetter: true, unitLabel: 'pts (0-4)' },
  { key: 'latencyMinutes', field: 'latencyMinutes', higherIsBetter: false, unitLabel: 'min' },
];

function cohensD(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  const va = a.reduce((acc, v) => acc + (v - ma) ** 2, 0) / (a.length - 1);
  const vb = b.reduce((acc, v) => acc + (v - mb) ** 2, 0) / (b.length - 1);
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
  if (pooled === 0) {
    // No within-group spread: identical means → no effect; differing means → maximal.
    if (ma === mb) return 0;
    return ma > mb ? 4 : -4;
  }
  return (ma - mb) / pooled;
}

/** Collapse a factor series into present/absent night sets via median split. */
function splitByFactor(series: FactorSeries, dayKeys: string[]): { present: Set<string>; absent: Set<string> } {
  const present = new Set<string>();
  const absent = new Set<string>();
  // boolean-like if all values are 0/1
  const values = dayKeys.map((dk) => series.byDay.get(dk) ?? 0);
  const isBinary = values.every((v) => v === 0 || v === 1);
  if (isBinary) {
    for (const dk of dayKeys) {
      ((series.byDay.get(dk) ?? 0) >= 1 ? present : absent).add(dk);
    }
    return { present, absent };
  }
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  const median = nonZero.length ? nonZero[Math.floor(nonZero.length / 2)] : 0;
  for (const dk of dayKeys) {
    ((series.byDay.get(dk) ?? 0) >= median && median > 0 ? present : absent).add(dk);
  }
  return { present, absent };
}

function buildFactorSeries(
  wellbeingByDay: Map<string, Record<string, number>>,
  habits: Habit[],
  habitEntries: HabitEntry[],
  timeZone: string,
  dayKeys: string[]
): FactorSeries[] {
  const series: FactorSeries[] = [];

  // (a) form factor keys
  for (const f of FORM_FACTOR_KEYS) {
    const byDay = new Map<string, number>();
    let any = false;
    for (const dk of dayKeys) {
      const rec = wellbeingByDay.get(dk);
      if (rec && f.key in rec) {
        byDay.set(dk, rec[f.key]);
        any = true;
      }
    }
    if (any) series.push({ id: f.key, name: f.name, source: 'form', byDay });
  }

  // (b) any other tracked habits (generic over type)
  const dayStates = buildDayStatesByHabit(habitEntries, timeZone);
  for (const habit of habits.filter(isTrackableHabit)) {
    const states = dayStates.get(habit.id);
    if (!states) continue;
    const byDay = new Map<string, number>();
    for (const dk of dayKeys) {
      const st = states.get(dk);
      if (!st) continue;
      // boolean habit → completed (1); numeric/count/duration → summed value
      byDay.set(dk, habit.goal.type === 'boolean' ? (st.completed ? 1 : 0) : st.value);
    }
    if (byDay.size > 0) {
      series.push({ id: habit.id, name: habit.name, source: 'habit', byDay });
    }
  }

  return series;
}

function correlate(nights: SleepNight[], series: FactorSeries[], dayKeys: string[]): SleepFactorInsight[] {
  const nightByDay = new Map(nights.map((n) => [n.dayKey, n]));
  const insights: SleepFactorInsight[] = [];

  for (const f of series) {
    const { present, absent } = splitByFactor(f, dayKeys);
    for (const outcome of OUTCOMES) {
      const presentVals: number[] = [];
      const absentVals: number[] = [];
      for (const dk of present) {
        const v = nightByDay.get(dk)?.[outcome.field];
        if (typeof v === 'number' && Number.isFinite(v)) presentVals.push(v);
      }
      for (const dk of absent) {
        const v = nightByDay.get(dk)?.[outcome.field];
        if (typeof v === 'number' && Number.isFinite(v)) absentVals.push(v);
      }
      if (presentVals.length < MIN_NIGHTS_PER_GROUP || absentVals.length < MIN_NIGHTS_PER_GROUP) continue;
      const d = cohensD(presentVals, absentVals);
      if (Math.abs(d) < MIN_EFFECT_SIZE) continue;

      const mPresent = presentVals.reduce((a, b) => a + b, 0) / presentVals.length;
      const mAbsent = absentVals.reduce((a, b) => a + b, 0) / absentVals.length;
      const diff = mPresent - mAbsent;
      const improves = outcome.higherIsBetter ? diff > 0 : diff < 0;

      const magnitude = Math.abs(round1(diff));
      const dirWord = improves ? 'higher' : (outcome.higherIsBetter ? 'lower' : 'higher');
      const outcomeLabel = outcome.key === 'appleSleepScore' ? 'sleep score'
        : outcome.key === 'sleepQuality' ? 'sleep quality'
        : 'sleep latency';
      const message = `On nights with "${f.name}", your ${outcomeLabel} is ${magnitude} ${outcome.unitLabel} ${dirWord} (n=${presentVals.length} vs ${absentVals.length}). Correlation, not proof.`;

      insights.push({
        factorId: f.id,
        factorName: f.name,
        source: f.source,
        outcome: outcome.key,
        factorPresentMean: round1(mPresent),
        factorAbsentMean: round1(mAbsent),
        meanDifference: round1(diff),
        effectSize: round1(d),
        direction: improves ? 'improves' : 'worsens',
        nPresent: presentVals.length,
        nAbsent: absentVals.length,
        message,
      });
    }
  }

  // Keep the strongest outcome per factor, then rank by |effect size|.
  const bestPerFactor = new Map<string, SleepFactorInsight>();
  for (const ins of insights) {
    const prev = bestPerFactor.get(ins.factorId);
    if (!prev || Math.abs(ins.effectSize) > Math.abs(prev.effectSize)) bestPerFactor.set(ins.factorId, ins);
  }
  return Array.from(bestPerFactor.values())
    .sort((a, b) => Math.abs(b.effectSize) - Math.abs(a.effectSize))
    .slice(0, MAX_FACTORS);
}

// ─── Top-level ─────────────────────────────────────────────────────────────────

export function computeSleepAnalytics(
  wellbeingEntries: WellbeingEntry[],
  habits: Habit[],
  habitEntries: HabitEntry[],
  _categories: Category[],
  referenceDayKey: string,
  days: number,
  timeZone: string,
  targets: SleepTargets = DEFAULT_SLEEP_TARGETS
): SleepAnalyticsSummary {
  const currentStart = startDayKeyForRange(referenceDayKey, days);
  const previousStart = startDayKeyForRange(referenceDayKey, days * 2);
  const previousEnd = format(subDays(parseISO(currentStart), 1), 'yyyy-MM-dd');

  const currentDayKeys = generateDayKeyRange(currentStart, referenceDayKey);
  const previousDayKeys = generateDayKeyRange(previousStart, previousEnd);

  const currentNights = buildSleepNights(wellbeingEntries, currentDayKeys);
  const previousNights = buildSleepNights(wellbeingEntries, previousDayKeys);

  // headline stats
  const avgDurationMinutes = buildStat(pickNonNull(currentNights, 'durationMinutes'), pickNonNull(previousNights, 'durationMinutes'), 'higher');
  const avgLatencyMinutes = buildStat(pickNonNull(currentNights, 'latencyMinutes'), pickNonNull(previousNights, 'latencyMinutes'), 'lower');
  const avgBedtimeMinutes = buildStat(pickNonNull(currentNights, 'bedtimeMinutes'), pickNonNull(previousNights, 'bedtimeMinutes'), 'closeness', targets.bedtimeMinutes);
  const avgWakeMinutes = buildStat(pickNonNull(currentNights, 'wakeMinutes'), pickNonNull(previousNights, 'wakeMinutes'), 'closeness', targets.wakeMinutes);
  const avgAppleSleepScore = buildStat(pickNonNull(currentNights, 'appleSleepScore'), pickNonNull(previousNights, 'appleSleepScore'), 'higher');
  const qual10Current = pickNonNull(currentNights, 'sleepQuality0to4').map((q) => q * 2.5);
  const qual10Previous = pickNonNull(previousNights, 'sleepQuality0to4').map((q) => q * 2.5);
  const avgSleepQuality0to10 = buildStat(qual10Current, qual10Previous, 'higher');

  // consistency
  const consistency = computeConsistency(currentNights);
  const prevConsistency = computeConsistency(previousNights);
  const consistencyTrendDelta = consistency.overall !== null && prevConsistency.overall !== null
    ? consistency.overall - prevConsistency.overall
    : null;

  // independence
  const independence = computeIndependence(currentNights, previousNights);

  // factors + correlations
  const wellbeingByDay = pivotByDayKey(wellbeingEntries);
  const series = buildFactorSeries(wellbeingByDay, habits, habitEntries, timeZone, currentDayKeys);
  const topFactors = correlate(currentNights, series, currentDayKeys);

  const nightsWithData = currentNights.filter((n) => n.hasData).length;

  return {
    avgDurationMinutes,
    avgLatencyMinutes,
    avgBedtimeMinutes,
    avgWakeMinutes,
    avgSleepQuality0to10,
    avgAppleSleepScore,
    consistencyScore: consistency.overall,
    consistencyBedtime: consistency.bedtime,
    consistencyWake: consistency.wake,
    consistencyTrendDelta,
    independence,
    trend: buildTrend(currentNights),
    weeklySummary: buildWeeklySummary(currentNights, targets),
    topFactors,
    achievements: buildAchievements(currentNights, consistency.overall, independence, targets),
    nights: currentNights,
    targets,
    rangeDays: days,
    coverage: { nightsWithData, nightsInRange: currentDayKeys.length },
  };
}
