/**
 * Insights Service
 *
 * Cross-domain analytics computed entirely from canonical truth at read time —
 * nothing is stored. Powers the Insights page tabs:
 *   • Overview      — headline averages, discoveries, milestones
 *   • Correlations  — factor↔outcome relationships (Cohen's d, via correlationEngine)
 *   • Predictions   — simple linear-trend projections per wellbeing metric
 *   • Medications   — per-medication adherence + correlations to wellbeing
 *
 * Statistical approach mirrors the Sleep Analytics service: a factor↔outcome
 * relationship is a present/absent group split + Cohen's d effect size, always
 * surfaced as correlation (never causation). Predictions are ordinary
 * least-squares trend lines — intentionally simple and clearly caveated.
 *
 * All exported `compute*` functions are PURE (inputs → output, no I/O) so they
 * are deterministically unit-testable and can back a future AI prompt layer.
 */

import { parseISO, subDays, format } from 'date-fns';
import type {
  Habit,
  HabitEntry,
  WellbeingEntry,
  Medication,
  MedicationLog,
  Supplement,
  SupplementLog,
  Symptom,
  SymptomLog,
} from '../../models/persistenceTypes';
import { buildDayStatesByHabit } from './analyticsService';
import { isTrackableHabit } from './scheduleEngine';
import {
  correlateFactorsToOutcomes,
  type FactorSeries,
  type OutcomeSeries,
  type CorrelationResult,
} from './correlationEngine';

// ─── Tunables ───────────────────────────────────────────────────────────────────

const MIN_PER_GROUP = 5;
const MIN_EFFECT_SIZE = 0.2;
const MAX_CORRELATIONS = 12;
const MIN_DAYS_FOR_PREDICTION = 5;
const DEFAULT_PREDICTION_HORIZON_DAYS = 14;
/** Slope (per week, on a 1-5 scale) below which a trend is "stable". */
const STABLE_SLOPE_EPSILON = 0.05;

// ─── Outcome metric registry ─────────────────────────────────────────────────────

/**
 * Subjective wellbeing metrics treated as OUTCOMES (and prediction targets).
 * `higherIsBetter` drives improves/worsens + improving/declining wording.
 */
export const OUTCOME_METRICS: Array<{ key: string; label: string; higherIsBetter: boolean }> = [
  { key: 'mood', label: 'mood', higherIsBetter: true },
  { key: 'energy', label: 'energy', higherIsBetter: true },
  { key: 'calm', label: 'calm', higherIsBetter: true },
  { key: 'motivation', label: 'motivation', higherIsBetter: true },
  { key: 'confidence', label: 'confidence', higherIsBetter: true },
  { key: 'socialBattery', label: 'social battery', higherIsBetter: true },
  { key: 'focus', label: 'focus', higherIsBetter: true },
  { key: 'productivity', label: 'productivity', higherIsBetter: true },
  { key: 'enjoyment', label: 'enjoyment', higherIsBetter: true },
  { key: 'socialConnection', label: 'social connection', higherIsBetter: true },
  { key: 'gratitude', label: 'gratitude', higherIsBetter: true },
  { key: 'fulfillment', label: 'fulfillment', higherIsBetter: true },
  { key: 'satisfaction', label: 'satisfaction', higherIsBetter: true },
  { key: 'anxiety', label: 'anxiety', higherIsBetter: false },
  { key: 'stress', label: 'stress', higherIsBetter: false },
  { key: 'lowMood', label: 'low mood', higherIsBetter: false },
  { key: 'depression', label: 'depression', higherIsBetter: false },
  { key: 'brainFog', label: 'brain fog', higherIsBetter: false },
  { key: 'irritability', label: 'irritability', higherIsBetter: false },
];

const OUTCOME_BY_KEY = new Map(OUTCOME_METRICS.map((m) => [m.key, m]));

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricPredictionPoint {
  dayKey: string;
  value: number;
}

export interface MetricPrediction {
  metricKey: string;
  label: string;
  higherIsBetter: boolean;
  sampleSize: number;
  /** Recent average (last up-to-7 logged days). */
  currentValue: number | null;
  /** Signed change per week implied by the trend line. */
  slopePerWeek: number | null;
  /** Projected value `horizonDays` after the last logged day. */
  predictedValue: number | null;
  horizonDays: number;
  direction: 'improving' | 'declining' | 'stable' | null;
  confidence: 'low' | 'medium' | 'high';
  /** R² of the fit (0-1), for transparency. */
  fitQuality: number | null;
  /** Observed daily averages used for the fit, for charting. */
  trend: MetricPredictionPoint[];
}

export interface Discovery {
  id: string;
  type: 'positive' | 'negative' | 'milestone' | 'info';
  title: string;
  message: string;
}

export interface MetricAverage {
  metricKey: string;
  label: string;
  average: number;
  sampleSize: number;
  higherIsBetter: boolean;
}

export interface InsightsOverview {
  rangeDays: number;
  daysWithCheckins: number;
  metricAverages: MetricAverage[];
  topCorrelations: CorrelationResult[];
  discoveries: Discovery[];
}

export interface MedicationAdherence {
  medicationId: string;
  name: string;
  dosage: string | null;
  takenDays: number;
  loggedDays: number;
  adherencePercent: number | null;
  currentTakenStreak: number;
}

export interface MedicationInsights {
  rangeDays: number;
  adherence: MedicationAdherence[];
  correlations: CorrelationResult[];
}

export interface AllInsightsData {
  factors: FactorSeries[];
  outcomes: OutcomeSeries[];
  dayKeys: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toNum(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function generateDayKeyRange(startDayKey: string, endDayKey: string): string[] {
  const days: string[] = [];
  const start = parseISO(startDayKey);
  const end = parseISO(endDayKey);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(format(d, 'yyyy-MM-dd'));
  }
  return days;
}

export function startDayKeyForRange(referenceDayKey: string, days: number): string {
  return format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
}

// ─── Outcome series (subjective wellbeing metrics, averaged per day) ───────────────

export function buildOutcomeSeries(wellbeingEntries: WellbeingEntry[], dayKeys: string[]): OutcomeSeries[] {
  const dayKeySet = new Set(dayKeys);
  // metricKey -> dayKey -> values[]
  const acc = new Map<string, Map<string, number[]>>();
  for (const e of wellbeingEntries) {
    if (!OUTCOME_BY_KEY.has(e.metricKey)) continue;
    if (!dayKeySet.has(e.dayKey)) continue;
    const num = toNum(e.value);
    if (num === null) continue;
    let byDay = acc.get(e.metricKey);
    if (!byDay) {
      byDay = new Map();
      acc.set(e.metricKey, byDay);
    }
    const arr = byDay.get(e.dayKey) ?? [];
    arr.push(num);
    byDay.set(e.dayKey, arr);
  }

  const series: OutcomeSeries[] = [];
  for (const metric of OUTCOME_METRICS) {
    const byDayValues = acc.get(metric.key);
    if (!byDayValues || byDayValues.size === 0) continue;
    const byDay = new Map<string, number>();
    for (const [dk, vals] of byDayValues) {
      const m = mean(vals);
      if (m !== null) byDay.set(dk, m);
    }
    series.push({ key: metric.key, label: metric.label, higherIsBetter: metric.higherIsBetter, byDay });
  }
  return series;
}

// ─── Factor series (habits, meds, supplements, symptoms, behavioral factors) ──────

/** Behavioral factors recorded directly as wellbeing metric keys. */
const WELLBEING_FACTOR_KEYS: Array<{ key: string; name: string }> = [
  { key: 'factorPhoneInBed', name: 'Phone in bed' },
  { key: 'factorWindDown', name: 'Wind-down routine' },
  { key: 'factorLateNightEating', name: 'Late-night eating' },
  { key: 'factorCaffeineAfter12', name: 'Caffeine after noon' },
  { key: 'factorBlueLightMinutes', name: 'Blue light after target' },
  { key: 'sleepAidUsed', name: 'Sleep aid used' },
  { key: 'caffeineMg', name: 'Caffeine intake' },
];

export interface InsightsSources {
  wellbeingEntries: WellbeingEntry[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  medications: Medication[];
  medicationLogs: MedicationLog[];
  supplements: Supplement[];
  supplementLogs: SupplementLog[];
  symptoms: Symptom[];
  symptomLogs: SymptomLog[];
}

function pivotWellbeing(wellbeingEntries: WellbeingEntry[]): Map<string, Record<string, number>> {
  const byDay = new Map<string, Record<string, number>>();
  for (const e of wellbeingEntries) {
    const num = toNum(e.value);
    if (num === null) continue;
    const rec = byDay.get(e.dayKey) ?? {};
    rec[e.metricKey] = num;
    byDay.set(e.dayKey, rec);
  }
  return byDay;
}

export function buildFactorSeries(
  sources: InsightsSources,
  timeZone: string,
  dayKeys: string[]
): FactorSeries[] {
  const dayKeySet = new Set(dayKeys);
  const series: FactorSeries[] = [];

  // (a) behavioral wellbeing factors
  const wellbeingByDay = pivotWellbeing(sources.wellbeingEntries);
  for (const f of WELLBEING_FACTOR_KEYS) {
    const byDay = new Map<string, number>();
    for (const dk of dayKeys) {
      const rec = wellbeingByDay.get(dk);
      if (rec && f.key in rec) byDay.set(dk, rec[f.key]);
    }
    if (byDay.size > 0) series.push({ id: f.key, name: f.name, source: 'wellbeingFactor', byDay });
  }

  // (b) tracked habits
  const dayStates = buildDayStatesByHabit(sources.habitEntries, timeZone);
  for (const habit of sources.habits.filter(isTrackableHabit)) {
    const states = dayStates.get(habit.id);
    if (!states) continue;
    const byDay = new Map<string, number>();
    for (const dk of dayKeys) {
      const st = states.get(dk);
      if (!st) continue;
      byDay.set(dk, habit.goal?.type === 'boolean' ? (st.completed ? 1 : 0) : st.value);
    }
    if (byDay.size > 0) series.push({ id: habit.id, name: habit.name, source: 'habit', byDay });
  }

  // (c) medications (taken = 1)
  const medNames = new Map(sources.medications.map((m) => [m.id, m.name]));
  series.push(...buildTakenSeries(sources.medicationLogs, dayKeySet, medNames, 'medication', (l) => l.medicationId));

  // (d) supplements (taken = 1)
  const supNames = new Map(sources.supplements.map((s) => [s.id, s.name]));
  series.push(...buildTakenSeries(sources.supplementLogs, dayKeySet, supNames, 'supplement', (l) => l.supplementId));

  // (e) symptoms (severity 1-5)
  const symNames = new Map(sources.symptoms.map((s) => [s.id, s.name]));
  const symByEntity = new Map<string, Map<string, number>>();
  for (const log of sources.symptomLogs) {
    if (!dayKeySet.has(log.dayKey)) continue;
    let byDay = symByEntity.get(log.symptomId);
    if (!byDay) {
      byDay = new Map();
      symByEntity.set(log.symptomId, byDay);
    }
    byDay.set(log.dayKey, log.severity);
  }
  for (const [symptomId, byDay] of symByEntity) {
    if (byDay.size > 0) {
      series.push({ id: symptomId, name: symNames.get(symptomId) ?? 'Symptom', source: 'symptom', byDay });
    }
  }

  return series;
}

function buildTakenSeries<T extends { dayKey: string; taken: boolean }>(
  logs: T[],
  dayKeySet: Set<string>,
  names: Map<string, string>,
  source: string,
  entityId: (log: T) => string
): FactorSeries[] {
  const byEntity = new Map<string, Map<string, number>>();
  for (const log of logs) {
    if (!dayKeySet.has(log.dayKey)) continue;
    const id = entityId(log);
    let byDay = byEntity.get(id);
    if (!byDay) {
      byDay = new Map();
      byEntity.set(id, byDay);
    }
    byDay.set(log.dayKey, log.taken ? 1 : 0);
  }
  const out: FactorSeries[] = [];
  for (const [id, byDay] of byEntity) {
    if (byDay.size > 0) out.push({ id, name: names.get(id) ?? source, source, byDay });
  }
  return out;
}

// ─── Correlations ────────────────────────────────────────────────────────────

export function computeInsightsCorrelations(
  factors: FactorSeries[],
  outcomes: OutcomeSeries[],
  dayKeys: string[],
  maxResults = MAX_CORRELATIONS
): CorrelationResult[] {
  return correlateFactorsToOutcomes(factors, outcomes, dayKeys, {
    minPerGroup: MIN_PER_GROUP,
    minEffectSize: MIN_EFFECT_SIZE,
    maxResults,
  });
}

// ─── Predictions (ordinary least squares) ────────────────────────────────────

function linearFit(points: Array<{ x: number; y: number }>): { slope: number; intercept: number; r2: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const meanY = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

export function computeMetricPredictions(
  outcomes: OutcomeSeries[],
  dayKeys: string[],
  horizonDays = DEFAULT_PREDICTION_HORIZON_DAYS
): MetricPrediction[] {
  const indexByDay = new Map(dayKeys.map((dk, i) => [dk, i]));
  const predictions: MetricPrediction[] = [];

  for (const outcome of outcomes) {
    const trend: MetricPredictionPoint[] = [];
    const points: Array<{ x: number; y: number }> = [];
    for (const dk of dayKeys) {
      const v = outcome.byDay.get(dk);
      if (typeof v === 'number' && Number.isFinite(v)) {
        const x = indexByDay.get(dk)!;
        points.push({ x, y: v });
        trend.push({ dayKey: dk, value: round1(v) });
      }
    }

    const sampleSize = points.length;
    const recent = trend.slice(-7).map((p) => p.value);
    const currentValue = recent.length ? round1(recent.reduce((a, b) => a + b, 0) / recent.length) : null;

    if (sampleSize < MIN_DAYS_FOR_PREDICTION) {
      predictions.push({
        metricKey: outcome.key,
        label: outcome.label,
        higherIsBetter: outcome.higherIsBetter,
        sampleSize,
        currentValue,
        slopePerWeek: null,
        predictedValue: null,
        horizonDays,
        direction: null,
        confidence: 'low',
        fitQuality: null,
        trend,
      });
      continue;
    }

    const fit = linearFit(points);
    if (!fit) {
      predictions.push({
        metricKey: outcome.key,
        label: outcome.label,
        higherIsBetter: outcome.higherIsBetter,
        sampleSize,
        currentValue,
        slopePerWeek: 0,
        predictedValue: currentValue,
        horizonDays,
        direction: 'stable',
        confidence: 'low',
        fitQuality: null,
        trend,
      });
      continue;
    }

    const slopePerWeek = round1(fit.slope * 7);
    const lastX = points[points.length - 1].x;
    const predictedValue = round1(fit.slope * (lastX + horizonDays) + fit.intercept);

    let direction: MetricPrediction['direction'];
    if (Math.abs(slopePerWeek) < STABLE_SLOPE_EPSILON) {
      direction = 'stable';
    } else {
      const valueRising = fit.slope > 0;
      const improving = valueRising === outcome.higherIsBetter;
      direction = improving ? 'improving' : 'declining';
    }

    let confidence: MetricPrediction['confidence'] = 'medium';
    if (sampleSize < 7) confidence = 'low';
    else if (sampleSize >= 14 && fit.r2 >= 0.3) confidence = 'high';

    predictions.push({
      metricKey: outcome.key,
      label: outcome.label,
      higherIsBetter: outcome.higherIsBetter,
      sampleSize,
      currentValue,
      slopePerWeek,
      predictedValue,
      horizonDays,
      direction,
      confidence,
      fitQuality: round1(fit.r2),
      trend,
    });
  }

  // Most data first — strongest signals at the top.
  return predictions.sort((a, b) => b.sampleSize - a.sampleSize);
}

// ─── Discoveries / milestones ─────────────────────────────────────────────────

export function computeDiscoveries(
  correlations: CorrelationResult[],
  predictions: MetricPrediction[],
  daysWithCheckins: number
): Discovery[] {
  const discoveries: Discovery[] = [];

  const topPositive = correlations.find((c) => c.direction === 'improves');
  if (topPositive) {
    discoveries.push({
      id: `corr-pos-${topPositive.factorId}-${topPositive.outcomeKey}`,
      type: 'positive',
      title: `${topPositive.factorName} is linked to better ${topPositive.outcomeLabel}`,
      message: topPositive.message,
    });
  }

  const topNegative = correlations.find((c) => c.direction === 'worsens');
  if (topNegative) {
    discoveries.push({
      id: `corr-neg-${topNegative.factorId}-${topNegative.outcomeKey}`,
      type: 'negative',
      title: `${topNegative.factorName} is linked to worse ${topNegative.outcomeLabel}`,
      message: topNegative.message,
    });
  }

  const improving = predictions
    .filter((p) => p.direction === 'improving' && p.confidence !== 'low')
    .sort((a, b) => Math.abs(b.slopePerWeek ?? 0) - Math.abs(a.slopePerWeek ?? 0))[0];
  if (improving) {
    discoveries.push({
      id: `trend-up-${improving.metricKey}`,
      type: 'positive',
      title: `Your ${improving.label} is trending up`,
      message: `${improving.label} has been improving by about ${Math.abs(improving.slopePerWeek ?? 0)}/week over this window.`,
    });
  }

  const declining = predictions
    .filter((p) => p.direction === 'declining' && p.confidence !== 'low')
    .sort((a, b) => Math.abs(b.slopePerWeek ?? 0) - Math.abs(a.slopePerWeek ?? 0))[0];
  if (declining) {
    discoveries.push({
      id: `trend-down-${declining.metricKey}`,
      type: 'negative',
      title: `Your ${declining.label} is trending down`,
      message: `${declining.label} has been declining by about ${Math.abs(declining.slopePerWeek ?? 0)}/week over this window. Worth a closer look.`,
    });
  }

  // Coverage milestone — largest threshold reached.
  const milestone = [100, 60, 30, 14, 7].find((t) => daysWithCheckins >= t);
  if (milestone) {
    discoveries.push({
      id: `milestone-${milestone}`,
      type: 'milestone',
      title: `${milestone}+ days of check-ins`,
      message: `You've logged wellbeing check-ins on ${daysWithCheckins} days. More data means sharper insights.`,
    });
  }

  if (discoveries.length === 0) {
    discoveries.push({
      id: 'no-data',
      type: 'info',
      title: 'Keep checking in',
      message: 'Log a few more morning and evening check-ins to start surfacing patterns and predictions.',
    });
  }

  return discoveries;
}

// ─── Top-level assemblies ──────────────────────────────────────────────────────

function countDaysWithCheckins(wellbeingEntries: WellbeingEntry[], dayKeys: string[]): number {
  const dayKeySet = new Set(dayKeys);
  const days = new Set<string>();
  for (const e of wellbeingEntries) {
    if (dayKeySet.has(e.dayKey) && OUTCOME_BY_KEY.has(e.metricKey) && toNum(e.value) !== null) {
      days.add(e.dayKey);
    }
  }
  return days.size;
}

export function computeMetricAverages(outcomes: OutcomeSeries[]): MetricAverage[] {
  const averages: MetricAverage[] = [];
  for (const o of outcomes) {
    const vals = Array.from(o.byDay.values());
    const m = mean(vals);
    if (m === null) continue;
    averages.push({
      metricKey: o.key,
      label: o.label,
      average: round1(m),
      sampleSize: vals.length,
      higherIsBetter: o.higherIsBetter,
    });
  }
  return averages.sort((a, b) => b.sampleSize - a.sampleSize);
}

export function computeInsightsOverview(
  sources: InsightsSources,
  referenceDayKey: string,
  days: number,
  timeZone: string
): InsightsOverview {
  const startKey = startDayKeyForRange(referenceDayKey, days);
  const dayKeys = generateDayKeyRange(startKey, referenceDayKey);

  const outcomes = buildOutcomeSeries(sources.wellbeingEntries, dayKeys);
  const factors = buildFactorSeries(sources, timeZone, dayKeys);
  const correlations = computeInsightsCorrelations(factors, outcomes, dayKeys);
  const predictions = computeMetricPredictions(outcomes, dayKeys);
  const daysWithCheckins = countDaysWithCheckins(sources.wellbeingEntries, dayKeys);
  const discoveries = computeDiscoveries(correlations, predictions, daysWithCheckins);

  return {
    rangeDays: days,
    daysWithCheckins,
    metricAverages: computeMetricAverages(outcomes),
    topCorrelations: correlations.slice(0, 5),
    discoveries,
  };
}

/**
 * Correlations for a full source bundle, optionally restricted to certain factor
 * sources (e.g. ['habit'] for the Habit tab, ['medication'] for Medications).
 */
export function computeCorrelationsForSources(
  sources: InsightsSources,
  referenceDayKey: string,
  days: number,
  timeZone: string,
  factorSources?: string[]
): CorrelationResult[] {
  const startKey = startDayKeyForRange(referenceDayKey, days);
  const dayKeys = generateDayKeyRange(startKey, referenceDayKey);
  const outcomes = buildOutcomeSeries(sources.wellbeingEntries, dayKeys);
  let factors = buildFactorSeries(sources, timeZone, dayKeys);
  if (factorSources && factorSources.length > 0) {
    const allowed = new Set(factorSources);
    factors = factors.filter((f) => allowed.has(f.source));
  }
  return computeInsightsCorrelations(factors, outcomes, dayKeys);
}

/** Linear-trend predictions for a full source bundle. */
export function computePredictionsForSources(
  sources: InsightsSources,
  referenceDayKey: string,
  days: number,
  horizonDays = DEFAULT_PREDICTION_HORIZON_DAYS
): MetricPrediction[] {
  const startKey = startDayKeyForRange(referenceDayKey, days);
  const dayKeys = generateDayKeyRange(startKey, referenceDayKey);
  const outcomes = buildOutcomeSeries(sources.wellbeingEntries, dayKeys);
  return computeMetricPredictions(outcomes, dayKeys, horizonDays);
}

export function computeMedicationInsights(
  sources: InsightsSources,
  referenceDayKey: string,
  days: number,
  timeZone: string
): MedicationInsights {
  const startKey = startDayKeyForRange(referenceDayKey, days);
  const dayKeys = generateDayKeyRange(startKey, referenceDayKey);
  const dayKeySet = new Set(dayKeys);

  // Per-medication adherence.
  const logsByMed = new Map<string, MedicationLog[]>();
  for (const log of sources.medicationLogs) {
    if (!dayKeySet.has(log.dayKey)) continue;
    const arr = logsByMed.get(log.medicationId) ?? [];
    arr.push(log);
    logsByMed.set(log.medicationId, arr);
  }

  const adherence: MedicationAdherence[] = sources.medications
    .filter((m) => m.active)
    .map((m) => {
      const logs = (logsByMed.get(m.id) ?? []).slice().sort((a, b) => a.dayKey.localeCompare(b.dayKey));
      const loggedDays = logs.length;
      const takenDays = logs.filter((l) => l.taken).length;
      // current streak: trailing run of taken days
      let currentTakenStreak = 0;
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].taken) currentTakenStreak += 1;
        else break;
      }
      return {
        medicationId: m.id,
        name: m.name,
        dosage: m.dosage ?? null,
        takenDays,
        loggedDays,
        adherencePercent: loggedDays > 0 ? Math.round((takenDays / loggedDays) * 100) : null,
        currentTakenStreak,
      };
    });

  // Correlations limited to medication factors against wellbeing outcomes.
  const outcomes = buildOutcomeSeries(sources.wellbeingEntries, dayKeys);
  const allFactors = buildFactorSeries(sources, timeZone, dayKeys);
  const medFactors = allFactors.filter((f) => f.source === 'medication');
  const correlations = correlateFactorsToOutcomes(medFactors, outcomes, dayKeys, {
    minPerGroup: MIN_PER_GROUP,
    minEffectSize: MIN_EFFECT_SIZE,
    maxResults: MAX_CORRELATIONS,
  });

  return { rangeDays: days, adherence, correlations };
}
