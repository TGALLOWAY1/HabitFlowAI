/**
 * Analytics API Client
 *
 * Frontend client for the analytics endpoints.
 */

import { API_BASE_URL } from './persistenceConfig';
import { getLocalTimeZone, getIdentityHeaders } from './persistenceClient';

async function analyticsRequest<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getIdentityHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(`Analytics API error: ${response.status}`);
  }
  return response.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BehaviorPatterns {
  mostConsistentDay: { day: string; rate: number };
  leastConsistentDay: { day: string; rate: number };
  avgHabitsPerDay: number;
  avgHabitsPerWeek: number;
  percentDaysWithCompletion: number;
  bestWeek: { label: string; completions: number };
  worstWeek: { label: string; completions: number };
  mostCompletedCategory: { name: string; completions: number } | null;
  leastCompletedCategory: { name: string; completions: number } | null;
  weekdayRate: number;
  weekendRate: number;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  icon: 'streak' | 'completions' | 'week' | 'consistency' | 'first' | 'track';
}

export interface EntriesByHabitItem {
  habitId: string;
  name: string;
  color?: string;
  totalEntries: number;
  entriesInRange: number;
}

export interface HabitAnalyticsSummary {
  consistencyScore: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  graduatedHabits: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendDelta: number;
  averageHabitsPerDay: number;
  mostConsistentDayOfWeek: string;
  daysSinceLastMissed: number;
  bestWeekCompletions: number;
  bestWeekLabel: string;
  behaviorPatterns: BehaviorPatterns;
  achievements: Achievement[];
  totalActiveDays: number;
  entriesByHabit: EntriesByHabitItem[];
}

export interface HeatmapDataPoint {
  dayKey: string;
  completionPercent: number;
  completedCount: number;
  scheduledCount: number;
}

export interface HeatmapInsights {
  mostActiveDay: string;
  leastActiveDay: string;
  mostActiveMonth: string;
  weekdayAvgPercent: number;
  weekendAvgPercent: number;
}

export interface HeatmapResponse {
  dataPoints: HeatmapDataPoint[];
  insights: HeatmapInsights;
}

export interface TrendDataPoint {
  week: string;
  completionRate: number;
  totalCompleted: number;
  totalScheduled: number;
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  completionRate: number;
  totalCompleted: number;
  totalScheduled: number;
  trendDirection: 'up' | 'down' | 'stable';
  status: 'Strong' | 'Improving' | 'Stable' | 'Needs Attention' | 'Neglected';
}

export interface Insight {
  type: 'info' | 'success' | 'warning';
  message: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

function buildParams(days: number): string {
  const timeZone = getLocalTimeZone();
  return `?days=${days}&timeZone=${encodeURIComponent(timeZone)}`;
}

export interface AllHabitAnalytics {
  summary: HabitAnalyticsSummary;
  heatmap: HeatmapResponse;
  trends: TrendDataPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  insights: Insight[];
}

/**
 * Consolidated habit analytics — fetches summary, heatmap, trends,
 * categoryBreakdown, and insights in a single API call.
 */
export async function fetchAllHabitAnalytics(days = 90, heatmapDays = 365): Promise<AllHabitAnalytics> {
  const timeZone = getLocalTimeZone();
  const params = `?days=${days}&heatmapDays=${heatmapDays}&timeZone=${encodeURIComponent(timeZone)}`;
  return analyticsRequest(`/analytics/habits/all${params}`);
}

export async function fetchHabitSummary(days = 90): Promise<HabitAnalyticsSummary> {
  return analyticsRequest(`/analytics/habits/summary${buildParams(days)}`);
}

export async function fetchHabitHeatmap(days = 365): Promise<HeatmapResponse> {
  return analyticsRequest(`/analytics/habits/heatmap${buildParams(days)}`);
}

export async function fetchHabitTrends(days = 90): Promise<TrendDataPoint[]> {
  return analyticsRequest(`/analytics/habits/trends${buildParams(days)}`);
}

export async function fetchHabitCategoryBreakdown(days = 90): Promise<CategoryBreakdownItem[]> {
  return analyticsRequest(`/analytics/habits/category-breakdown${buildParams(days)}`);
}

export async function fetchHabitInsights(days = 90): Promise<Insight[]> {
  return analyticsRequest(`/analytics/habits/insights${buildParams(days)}`);
}

// ─── Routine Analytics ───────────────────────────────────────────────────────

export interface RoutineEffectivenessItem {
  routineId: string;
  routineTitle: string;
  timesUsed: number;
  habitCompletionRateWithRoutine: number;
  habitCompletionRateWithoutRoutine: number;
  effectivenessLevel: 'Very High' | 'High' | 'Medium' | 'Low';
}

export interface RoutineAnalyticsSummary {
  totalCompleted: number;
  totalStarted: number;
  reliabilityRate: number;
  averageDurationSeconds: number;
  routineBreakdown: Array<{
    routineId: string;
    routineTitle: string;
    completedCount: number;
    timesStarted: number;
    averageDurationSeconds: number;
  }>;
  effectiveness: RoutineEffectivenessItem[];
  routineInsights: Insight[];
}

export async function fetchRoutineSummary(days = 90): Promise<RoutineAnalyticsSummary> {
  return analyticsRequest(`/analytics/routines/summary${buildParams(days)}`);
}

// ─── Goal Analytics ──────────────────────────────────────────────────────────

export interface GoalBreakdownItem {
  goalId: string;
  goalTitle: string;
  progressPercent: number;
  isCompleted: boolean;
  isAtRisk: boolean;
  status: 'Completed' | 'On Track' | 'At Risk' | 'Behind' | 'Not Started';
  currentValue: number;
  targetValue: number | null;
  unit: string | null;
  timeElapsedPercent: number | null;
  requiredPacePerWeek: number | null;
  currentPacePerWeek: number | null;
  remainingWork: number | null;
  estimatedCompletionWeeks: number | null;
  completionDate: string | null;
  timeTakenDays: number | null;
  avgPerWeek: number | null;
}

export interface GoalAnalyticsSummary {
  activeGoals: number;
  completedGoals: number;
  averageProgressPercent: number;
  goalsAtRisk: number;
  goalsBehind: number;
  goalsOnTrack: number;
  goalBreakdown: GoalBreakdownItem[];
}

export async function fetchGoalSummary(days = 90): Promise<GoalAnalyticsSummary> {
  return analyticsRequest(`/analytics/goals/summary${buildParams(days)}`);
}

// ─── Sleep Analytics ─────────────────────────────────────────────────────────

/** A single headline metric with its sample size and period-over-period trend. */
export interface SleepStat {
  /** Average over the window, or null when there is no data. */
  value: number | null;
  /** Number of nights that contributed to `value`. */
  sampleSize: number;
  /** Signed change vs the previous equal-length period (same units as value). */
  trendDelta: number | null;
  /**
   * Whether the metric improved/worsened vs the previous period.
   * 'better'/'worse' is interpreted against the metric's polarity by the service.
   */
  trendDirection: 'better' | 'worse' | 'stable' | null;
}

/**
 * Flat, numeric, null-explicit per-night record. Keyed by the MORNING dayKey the
 * night was logged under. AI-friendly: future features consume this directly.
 */
export interface SleepNight {
  dayKey: string;
  appleSleepScore: number | null;
  bedtimeScore: number | null;
  durationScore: number | null;
  interruptionScore: number | null;
  bedtimeMinutes: number | null;   // minutes-after-noon (0..1439)
  wakeMinutes: number | null;      // minutes-after-noon (0..1439)
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
  bedtimeMinutes: number | null;   // minutes-after-noon (for bedtime chart + 10PM line)
  wakeMinutes: number | null;      // minutes-after-noon (for wake chart + 6AM line)
  sleepQuality0to10: number | null;
}

export interface SleepWeekSummary {
  weekLabel: string;               // ISO week, matches TrendDataPoint convention
  avgDurationMinutes: number | null;
  avgLatencyMinutes: number | null;
  nightsOnTarget: number;
  avgAwakenings: number | null;
  sleepAidFreeNights: number;
  avgMorningEnergy: number | null;
}

export interface SleepFactorInsight {
  factorId: string;                // metricKey or habitId
  factorName: string;
  source: 'form' | 'habit';
  outcome: 'appleSleepScore' | 'sleepQuality' | 'latencyMinutes' | 'bedtimeMinutes';
  factorPresentMean: number;
  factorAbsentMean: number;
  meanDifference: number;          // signed, outcome units
  effectSize: number;              // Cohen's d
  direction: 'improves' | 'worsens';
  nPresent: number;
  nAbsent: number;
  message: string;                 // pre-rendered, caveated, includes both Ns
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
  bedtimeMinutes: number;          // minutes-after-noon
  wakeMinutes: number;             // minutes-after-noon
  durationMinutes: number;
}

export interface SleepIndependence {
  aidFreeNights: number;
  aidNights: number;
  aidFreePercent: number | null;   // 0-1, null if no data
  currentAidFreeStreak: number;
  longestAidFreeStreak: number;
  trendDirection: 'better' | 'worse' | 'stable' | null;
  trendDelta: number | null;       // change in aid-free percent vs previous period
  sampleSize: number;
}

export async function fetchSleepSummary(days = 30): Promise<SleepAnalyticsSummary> {
  return analyticsRequest(`/analytics/sleep/summary${buildParams(days)}`);
}

export interface SleepAnalyticsSummary {
  // headline cards
  avgDurationMinutes: SleepStat;
  avgLatencyMinutes: SleepStat;
  avgBedtimeMinutes: SleepStat;    // minutes-after-noon; client formats to clock
  avgWakeMinutes: SleepStat;
  avgSleepQuality0to10: SleepStat;
  avgAppleSleepScore: SleepStat;
  // consistency
  consistencyScore: number | null; // 0-100
  consistencyBedtime: number | null;
  consistencyWake: number | null;
  consistencyTrendDelta: number | null;
  // independence
  independence: SleepIndependence;
  // trend + weekly
  trend: SleepTrendPoint[];
  weeklySummary: SleepWeekSummary[];
  // correlations
  topFactors: SleepFactorInsight[];
  // achievements
  achievements: SleepAchievement[];
  // meta / AI-friendly
  nights: SleepNight[];
  targets: SleepTargets;
  rangeDays: number;
  coverage: { nightsWithData: number; nightsInRange: number };
}
