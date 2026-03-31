/**
 * Analytics Service
 *
 * Computes read-only analytics metrics from HabitEntries (canonical truth).
 * Nothing is stored — all metrics are derived on-read.
 */

import { parseISO, subDays, format, getISOWeek, getISOWeekYear, differenceInCalendarDays } from 'date-fns';
import type { Habit, HabitEntry, Category, Routine, RoutineLog, Goal } from '../../models/persistenceTypes';
import type { BundleMembershipRecord } from '../domain/canonicalTypes';
import { calculateHabitStreakMetrics, type HabitDayState } from './streakService';
import { getCanonicalDayKeyFromEntry } from '../utils/dayKey';

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
  icon: 'streak' | 'completions' | 'week' | 'consistency' | 'first';
}

export interface HabitAnalyticsSummary {
  consistencyScore: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  graduatedHabits: number;
  // Momentum & trend
  trendDirection: 'up' | 'down' | 'stable';
  trendDelta: number;
  averageHabitsPerDay: number;
  mostConsistentDayOfWeek: string;
  // Extended streaks
  daysSinceLastMissed: number;
  bestWeekCompletions: number;
  bestWeekLabel: string;
  // Behavior patterns & achievements
  behaviorPatterns: BehaviorPatterns;
  achievements: Achievement[];
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFreezeType(note?: string): boolean {
  return !!note && note.startsWith('freeze:');
}

/**
 * Build a map of habitId → Map<dayKey, HabitDayState> from entries.
 */
export function buildDayStatesByHabit(
  entries: HabitEntry[],
  timeZone?: string
): Map<string, Map<string, HabitDayState>> {
  const dayStatesByHabit = new Map<string, Map<string, HabitDayState>>();

  for (const entry of entries) {
    const dayKey = getCanonicalDayKeyFromEntry(entry, { timeZone });
    if (!dayKey) continue;

    const habitDayMap = dayStatesByHabit.get(entry.habitId) ?? new Map<string, HabitDayState>();
    const existing = habitDayMap.get(dayKey) ?? { dayKey, value: 0, completed: false };

    if (parseFreezeType(entry.note)) {
      existing.isFrozen = true;
    } else {
      existing.completed = true;
      existing.value += typeof entry.value === 'number' ? entry.value : 1;
    }

    habitDayMap.set(dayKey, existing);
    dayStatesByHabit.set(entry.habitId, habitDayMap);
  }

  return dayStatesByHabit;
}

/**
 * Generate an array of dayKeys from startDayKey to endDayKey inclusive.
 */
function generateDayKeyRange(startDayKey: string, endDayKey: string): string[] {
  const days: string[] = [];
  const start = parseISO(startDayKey);
  const end = parseISO(endDayKey);
  const totalDays = differenceInCalendarDays(end, start);

  for (let i = 0; i <= totalDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    days.push(format(date, 'yyyy-MM-dd'));
  }

  return days;
}

/**
 * Determine which active (non-archived, non-bundle-parent) habits were scheduled on a given day.
 * If a habit has no assignedDays, it's considered scheduled every day.
 */
function getScheduledHabitsForDay(habits: Habit[], dayKey: string): Habit[] {
  const dayOfWeek = new Date(dayKey + 'T12:00:00Z').getUTCDay();
  return habits.filter(h => {
    if (!h.assignedDays || h.assignedDays.length === 0) return true;
    return h.assignedDays.includes(dayOfWeek);
  });
}

/**
 * Filter to trackable habits: non-archived, non-bundle-parent.
 */
function getTrackableHabits(habits: Habit[]): Habit[] {
  return habits.filter(h => !h.archived && h.type !== 'bundle');
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Compute completion stats per day-of-week across a range.
 */
function computeDayOfWeekStats(
  trackable: Habit[],
  dayKeys: string[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>
): Array<{ day: number; scheduled: number; completed: number; rate: number }> {
  const stats = Array.from({ length: 7 }, () => ({ scheduled: 0, completed: 0 }));
  for (const dk of dayKeys) {
    const dow = new Date(dk + 'T12:00:00Z').getUTCDay();
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    stats[dow].scheduled += scheduled.length;
    for (const habit of scheduled) {
      if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) {
        stats[dow].completed++;
      }
    }
  }
  return stats.map((s, i) => ({
    day: i,
    scheduled: s.scheduled,
    completed: s.completed,
    rate: s.scheduled > 0 ? s.completed / s.scheduled : 0,
  })).filter(d => d.scheduled > 0);
}

/**
 * Group dayKeys by ISO week and compute completions per week.
 */
function groupByWeek(
  trackable: Habit[],
  dayKeys: string[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>
): Map<string, { completions: number; scheduled: number }> {
  const weekMap = new Map<string, { completions: number; scheduled: number }>();
  for (const dk of dayKeys) {
    const date = parseISO(dk);
    const weekYear = getISOWeekYear(date);
    const weekNum = getISOWeek(date);
    const weekLabel = `${weekYear}-W${String(weekNum).padStart(2, '0')}`;
    const existing = weekMap.get(weekLabel) ?? { completions: 0, scheduled: 0 };
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    existing.scheduled += scheduled.length;
    for (const habit of scheduled) {
      if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) existing.completions++;
    }
    weekMap.set(weekLabel, existing);
  }
  return weekMap;
}

/**
 * Compute trend direction by comparing recent vs prior period.
 */
function computeTrendDirection(
  trackable: Habit[],
  dayKeys: string[],
  dayStatesByHabit: Map<string, Map<string, HabitDayState>>
): { direction: 'up' | 'down' | 'stable'; delta: number } {
  if (dayKeys.length < 14) return { direction: 'stable', delta: 0 };

  const computeRangeRate = (keys: string[]) => {
    let s = 0, c = 0;
    for (const dk of keys) {
      const scheduled = getScheduledHabitsForDay(trackable, dk);
      s += scheduled.length;
      for (const habit of scheduled) {
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) c++;
      }
    }
    return s > 0 ? c / s : 0;
  };

  const midpoint = dayKeys.length - 14;
  const recentRate = computeRangeRate(dayKeys.slice(midpoint));
  const priorRate = computeRangeRate(dayKeys.slice(Math.max(0, midpoint - 14), midpoint));
  const delta = recentRate - priorRate;

  if (Math.abs(delta) < 0.03) return { direction: 'stable', delta: Math.round(delta * 1000) / 1000 };
  return { direction: delta > 0 ? 'up' : 'down', delta: Math.round(delta * 1000) / 1000 };
}

/**
 * Compute achievements based on streak and completion data.
 */
function computeAchievements(
  bestStreak: number,
  totalCompletions: number,
  bestWeekCompletions: number,
  consistencyScore: number,
  _daysWithCompletion: number
): Achievement[] {
  const achievements: Achievement[] = [];

  // Streak achievements
  for (const threshold of [7, 14, 30, 60, 90]) {
    achievements.push({
      id: `streak-${threshold}`,
      label: `${threshold} Day Streak`,
      description: `Completed habits ${threshold} days in a row`,
      earned: bestStreak >= threshold,
      icon: 'streak',
    });
  }

  // Completion achievements
  for (const threshold of [50, 100, 500, 1000]) {
    achievements.push({
      id: `completions-${threshold}`,
      label: `${threshold} Completions`,
      description: `Completed ${threshold} total habit entries`,
      earned: totalCompletions >= threshold,
      icon: 'completions',
    });
  }

  // First habit
  achievements.push({
    id: 'first-completion',
    label: 'First Step',
    description: 'Logged your first habit completion',
    earned: totalCompletions >= 1,
    icon: 'first',
  });

  // Best week 10+
  achievements.push({
    id: 'week-10',
    label: 'Power Week',
    description: 'Completed 10+ habits in a single week',
    earned: bestWeekCompletions >= 10,
    icon: 'week',
  });

  // Best week 25+
  achievements.push({
    id: 'week-25',
    label: 'Unstoppable Week',
    description: 'Completed 25+ habits in a single week',
    earned: bestWeekCompletions >= 25,
    icon: 'week',
  });

  // Consistency
  achievements.push({
    id: 'consistency-80',
    label: 'Habit Master',
    description: 'Maintained 80%+ consistency score',
    earned: consistencyScore >= 0.8,
    icon: 'consistency',
  });

  return achievements;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function computeHabitAnalyticsSummary(
  habits: Habit[],
  entries: HabitEntry[],
  memberships: BundleMembershipRecord[],
  categories: Category[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): HabitAnalyticsSummary {
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);

  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);
  const dayKeySet = new Set(dayKeys);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[analytics] summary: ${trackable.length} trackable habits, ${entries.length} entries, range ${startDayKey}..${referenceDayKey} (${dayKeys.length} days), dayStates for ${dayStatesByHabit.size} habits`);
  }

  // Consistency: days with >= 1 completion / total days
  const daysWithCompletion = new Set<string>();
  for (const [, dayMap] of dayStatesByHabit) {
    for (const [dk, state] of dayMap) {
      if (state.completed && dayKeySet.has(dk)) {
        daysWithCompletion.add(dk);
      }
    }
  }
  const consistencyScore = dayKeys.length > 0 ? daysWithCompletion.size / dayKeys.length : 0;

  // Completion rate: completed / scheduled across all days
  let totalScheduled = 0;
  let totalCompleted = 0;
  for (const dk of dayKeys) {
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    totalScheduled += scheduled.length;
    for (const habit of scheduled) {
      const dayMap = dayStatesByHabit.get(habit.id);
      if (dayMap?.get(dk)?.completed) {
        totalCompleted++;
      }
    }
  }
  const completionRate = totalScheduled > 0 ? totalCompleted / totalScheduled : 0;

  // Streaks: max across all trackable habits
  let maxCurrentStreak = 0;
  let maxBestStreak = 0;
  const refDate = parseISO(referenceDayKey);
  for (const habit of trackable) {
    const dayMap = dayStatesByHabit.get(habit.id);
    if (!dayMap) continue;
    const dayStates = Array.from(dayMap.values());
    const metrics = calculateHabitStreakMetrics(habit, dayStates, refDate, referenceDayKey);
    maxCurrentStreak = Math.max(maxCurrentStreak, metrics.currentStreak);
    maxBestStreak = Math.max(maxBestStreak, metrics.bestStreak);
  }

  // Total completions (non-freeze entries in range)
  const totalCompletions = entries.filter(e => {
    const dk = getCanonicalDayKeyFromEntry(e, { timeZone });
    return dk && dayKeySet.has(dk) && !parseFreezeType(e.note);
  }).length;

  // Graduated habits count
  const graduatedHabits = memberships.filter(m => m.graduatedAt !== null).length;

  // ─── NEW: Day-of-week stats ─────────────────────────────────────────────
  const dayOfWeekStats = computeDayOfWeekStats(trackable, dayKeys, dayStatesByHabit);
  const bestDay = dayOfWeekStats.length > 0 ? dayOfWeekStats.reduce((a, b) => a.rate > b.rate ? a : b) : null;
  const worstDay = dayOfWeekStats.length > 0 ? dayOfWeekStats.reduce((a, b) => a.rate < b.rate ? a : b) : null;

  // ─── NEW: Trend direction ─────────────────────────────────────────────
  const trend = computeTrendDirection(trackable, dayKeys, dayStatesByHabit);

  // ─── NEW: Average habits per day ─────────────────────────────────────
  const averageHabitsPerDay = dayKeys.length > 0 ? Math.round((totalCompletions / dayKeys.length) * 10) / 10 : 0;

  // ─── NEW: Days since last missed ─────────────────────────────────────
  let daysSinceLastMissed = 0;
  for (let i = dayKeys.length - 1; i >= 0; i--) {
    const dk = dayKeys[i];
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    let allCompleted = scheduled.length > 0;
    for (const habit of scheduled) {
      if (!dayStatesByHabit.get(habit.id)?.get(dk)?.completed) {
        allCompleted = false;
        break;
      }
    }
    if (!allCompleted) break;
    daysSinceLastMissed++;
  }

  // ─── NEW: Week-level stats ─────────────────────────────────────────────
  const weekMap = groupByWeek(trackable, dayKeys, dayStatesByHabit);
  let bestWeekLabel = '';
  let bestWeekCompletions = 0;
  let worstWeekLabel = '';
  let worstWeekCompletions = Infinity;
  for (const [week, data] of weekMap) {
    if (data.completions > bestWeekCompletions) {
      bestWeekCompletions = data.completions;
      bestWeekLabel = week;
    }
    if (data.completions < worstWeekCompletions) {
      worstWeekCompletions = data.completions;
      worstWeekLabel = week;
    }
  }
  if (worstWeekCompletions === Infinity) worstWeekCompletions = 0;

  // ─── NEW: Weekday vs Weekend ─────────────────────────────────────────
  let weekdayScheduled = 0, weekdayCompleted = 0;
  let weekendScheduled = 0, weekendCompleted = 0;
  for (const dk of dayKeys) {
    const dow = new Date(dk + 'T12:00:00Z').getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    for (const habit of scheduled) {
      if (isWeekend) {
        weekendScheduled++;
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) weekendCompleted++;
      } else {
        weekdayScheduled++;
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) weekdayCompleted++;
      }
    }
  }
  const weekdayRate = weekdayScheduled > 0 ? weekdayCompleted / weekdayScheduled : 0;
  const weekendRate = weekendScheduled > 0 ? weekendCompleted / weekendScheduled : 0;

  // ─── NEW: Category completions for behavior patterns ─────────────────
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const catCompletions = new Map<string, { name: string; completions: number }>();
  for (const habit of trackable) {
    const catId = habit.categoryId || 'uncategorized';
    const cat = categoryMap.get(catId);
    const catName = cat?.name ?? 'Uncategorized';
    const existing = catCompletions.get(catId) ?? { name: catName, completions: 0 };
    const dayMap = dayStatesByHabit.get(habit.id);
    if (dayMap) {
      for (const [dk, state] of dayMap) {
        if (state.completed && dayKeySet.has(dk)) existing.completions++;
      }
    }
    catCompletions.set(catId, existing);
  }
  const catList = Array.from(catCompletions.values()).filter(c => c.completions > 0);
  const mostCompletedCategory = catList.length > 0 ? catList.reduce((a, b) => a.completions > b.completions ? a : b) : null;
  const leastCompletedCategory = catList.length > 1 ? catList.reduce((a, b) => a.completions < b.completions ? a : b) : null;

  // ─── NEW: Behavior patterns ─────────────────────────────────────────────
  const avgHabitsPerWeek = weekMap.size > 0 ? Math.round((totalCompletions / weekMap.size) * 10) / 10 : 0;
  const behaviorPatterns: BehaviorPatterns = {
    mostConsistentDay: bestDay ? { day: DAY_NAMES[bestDay.day], rate: Math.round(bestDay.rate * 1000) / 1000 } : { day: 'N/A', rate: 0 },
    leastConsistentDay: worstDay ? { day: DAY_NAMES[worstDay.day], rate: Math.round(worstDay.rate * 1000) / 1000 } : { day: 'N/A', rate: 0 },
    avgHabitsPerDay: averageHabitsPerDay,
    avgHabitsPerWeek,
    percentDaysWithCompletion: dayKeys.length > 0 ? Math.round((daysWithCompletion.size / dayKeys.length) * 1000) / 1000 : 0,
    bestWeek: { label: bestWeekLabel, completions: bestWeekCompletions },
    worstWeek: { label: worstWeekLabel, completions: worstWeekCompletions },
    mostCompletedCategory: mostCompletedCategory ? { name: mostCompletedCategory.name, completions: mostCompletedCategory.completions } : null,
    leastCompletedCategory: leastCompletedCategory ? { name: leastCompletedCategory.name, completions: leastCompletedCategory.completions } : null,
    weekdayRate: Math.round(weekdayRate * 1000) / 1000,
    weekendRate: Math.round(weekendRate * 1000) / 1000,
  };

  // ─── NEW: Achievements ─────────────────────────────────────────────────
  const achievements = computeAchievements(maxBestStreak, totalCompletions, bestWeekCompletions, consistencyScore, daysWithCompletion.size);

  return {
    consistencyScore: Math.round(consistencyScore * 1000) / 1000,
    completionRate: Math.round(completionRate * 1000) / 1000,
    currentStreak: maxCurrentStreak,
    longestStreak: maxBestStreak,
    totalCompletions,
    graduatedHabits,
    trendDirection: trend.direction,
    trendDelta: trend.delta,
    averageHabitsPerDay,
    mostConsistentDayOfWeek: bestDay ? DAY_NAMES[bestDay.day] : 'N/A',
    daysSinceLastMissed,
    bestWeekCompletions,
    bestWeekLabel,
    behaviorPatterns,
    achievements,
  };
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

export function computeHeatmapData(
  habits: Habit[],
  entries: HabitEntry[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): HeatmapResponse {
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);

  const dataPoints = dayKeys.map(dk => {
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    const scheduledCount = scheduled.length;
    let completedCount = 0;
    for (const habit of scheduled) {
      const dayMap = dayStatesByHabit.get(habit.id);
      if (dayMap?.get(dk)?.completed) completedCount++;
    }
    return {
      dayKey: dk,
      completionPercent: scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 1000) / 1000 : 0,
      completedCount,
      scheduledCount,
    };
  });

  // Compute heatmap insights
  const dayStats = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  const monthStats = new Map<number, { total: number; count: number }>();
  let weekdayTotal = 0, weekdayCount = 0, weekendTotal = 0, weekendCount = 0;

  for (const dp of dataPoints) {
    if (dp.scheduledCount === 0) continue;
    const date = parseISO(dp.dayKey);
    const dow = date.getUTCDay();
    const month = date.getMonth();
    const pct = dp.completionPercent;

    dayStats[dow].total += pct;
    dayStats[dow].count++;

    const ms = monthStats.get(month) ?? { total: 0, count: 0 };
    ms.total += pct;
    ms.count++;
    monthStats.set(month, ms);

    if (dow === 0 || dow === 6) {
      weekendTotal += pct;
      weekendCount++;
    } else {
      weekdayTotal += pct;
      weekdayCount++;
    }
  }

  const dayAvgs = dayStats.map((s, i) => ({ day: i, avg: s.count > 0 ? s.total / s.count : 0 })).filter(d => d.avg > 0);
  const bestDayHeatmap = dayAvgs.length > 0 ? dayAvgs.reduce((a, b) => a.avg > b.avg ? a : b) : { day: 1, avg: 0 };
  const worstDayHeatmap = dayAvgs.length > 0 ? dayAvgs.reduce((a, b) => a.avg < b.avg ? a : b) : { day: 0, avg: 0 };

  let bestMonth = 0;
  let bestMonthAvg = 0;
  for (const [month, ms] of monthStats) {
    const avg = ms.count > 0 ? ms.total / ms.count : 0;
    if (avg > bestMonthAvg) {
      bestMonthAvg = avg;
      bestMonth = month;
    }
  }

  const insights: HeatmapInsights = {
    mostActiveDay: DAY_NAMES[bestDayHeatmap.day],
    leastActiveDay: DAY_NAMES[worstDayHeatmap.day],
    mostActiveMonth: MONTH_NAMES[bestMonth],
    weekdayAvgPercent: weekdayCount > 0 ? Math.round((weekdayTotal / weekdayCount) * 1000) / 1000 : 0,
    weekendAvgPercent: weekendCount > 0 ? Math.round((weekendTotal / weekendCount) * 1000) / 1000 : 0,
  };

  return { dataPoints, insights };
}

// ─── Trends ──────────────────────────────────────────────────────────────────

export function computeTrendData(
  habits: Habit[],
  entries: HabitEntry[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): TrendDataPoint[] {
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);

  // Group dayKeys by ISO week
  const weekMap = new Map<string, string[]>();
  for (const dk of dayKeys) {
    const date = parseISO(dk);
    const weekYear = getISOWeekYear(date);
    const weekNum = getISOWeek(date);
    const weekLabel = `${weekYear}-W${String(weekNum).padStart(2, '0')}`;
    const existing = weekMap.get(weekLabel) ?? [];
    existing.push(dk);
    weekMap.set(weekLabel, existing);
  }

  const results: TrendDataPoint[] = [];
  for (const [week, weekDayKeys] of weekMap) {
    let totalScheduled = 0;
    let totalCompleted = 0;
    for (const dk of weekDayKeys) {
      const scheduled = getScheduledHabitsForDay(trackable, dk);
      totalScheduled += scheduled.length;
      for (const habit of scheduled) {
        const dayMap = dayStatesByHabit.get(habit.id);
        if (dayMap?.get(dk)?.completed) totalCompleted++;
      }
    }
    results.push({
      week,
      completionRate: totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 1000) / 1000 : 0,
      totalCompleted,
      totalScheduled,
    });
  }

  return results.sort((a, b) => a.week.localeCompare(b.week));
}

// ─── Category Breakdown ──────────────────────────────────────────────────────

export function computeCategoryBreakdown(
  habits: Habit[],
  entries: HabitEntry[],
  categories: Category[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): CategoryBreakdownItem[] {
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);

  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Split dayKeys into two halves for trend computation
  const midpoint = Math.floor(dayKeys.length / 2);
  const recentKeys = dayKeys.slice(midpoint);
  const priorKeys = dayKeys.slice(0, midpoint);

  // Group trackable habits by category
  const habitsByCategory = new Map<string, Habit[]>();
  for (const habit of trackable) {
    const catId = habit.categoryId || 'uncategorized';
    const existing = habitsByCategory.get(catId) ?? [];
    existing.push(habit);
    habitsByCategory.set(catId, existing);
  }

  const computeCatRate = (catHabits: Habit[], keys: string[]) => {
    let s = 0, c = 0;
    for (const dk of keys) {
      const dayOfWeek = new Date(dk + 'T12:00:00Z').getUTCDay();
      for (const habit of catHabits) {
        const isScheduled = !habit.assignedDays || habit.assignedDays.length === 0 || habit.assignedDays.includes(dayOfWeek);
        if (isScheduled) {
          s++;
          if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) c++;
        }
      }
    }
    return s > 0 ? c / s : 0;
  };

  const results: CategoryBreakdownItem[] = [];
  for (const [catId, catHabits] of habitsByCategory) {
    let totalScheduled = 0;
    let totalCompleted = 0;

    for (const dk of dayKeys) {
      const dayOfWeek = new Date(dk + 'T12:00:00Z').getUTCDay();
      for (const habit of catHabits) {
        const isScheduled = !habit.assignedDays || habit.assignedDays.length === 0 || habit.assignedDays.includes(dayOfWeek);
        if (isScheduled) {
          totalScheduled++;
          if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) totalCompleted++;
        }
      }
    }

    const overallRate = totalScheduled > 0 ? totalCompleted / totalScheduled : 0;
    const recentRate = computeCatRate(catHabits, recentKeys);
    const priorRate = computeCatRate(catHabits, priorKeys);
    const delta = recentRate - priorRate;

    const trendDirection: CategoryBreakdownItem['trendDirection'] =
      Math.abs(delta) < 0.03 ? 'stable' : delta > 0 ? 'up' : 'down';

    let status: CategoryBreakdownItem['status'];
    if (overallRate >= 0.8) status = 'Strong';
    else if (trendDirection === 'up' && overallRate >= 0.4) status = 'Improving';
    else if (trendDirection === 'stable' && overallRate >= 0.4) status = 'Stable';
    else if (overallRate < 0.15) status = 'Neglected';
    else status = 'Needs Attention';

    const cat = categoryMap.get(catId);
    results.push({
      categoryId: catId,
      categoryName: cat?.name ?? 'Uncategorized',
      color: cat?.color ?? 'bg-neutral-500',
      completionRate: totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 1000) / 1000 : 0,
      totalCompleted,
      totalScheduled,
      trendDirection,
      status,
    });
  }

  return results.sort((a, b) => b.completionRate - a.completionRate);
}

// ─── Insights ────────────────────────────────────────────────────────────────

export function computeInsights(
  habits: Habit[],
  entries: HabitEntry[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): Insight[] {
  const trackable = getTrackableHabits(habits);
  if (trackable.length === 0) return [];

  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);
  const insights: Insight[] = [];

  // 1. Best/worst day of week
  const dayOfWeekStats = new Array(7).fill(null).map(() => ({ scheduled: 0, completed: 0 }));
  for (const dk of dayKeys) {
    const dow = new Date(dk + 'T12:00:00Z').getUTCDay();
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    dayOfWeekStats[dow].scheduled += scheduled.length;
    for (const habit of scheduled) {
      if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) {
        dayOfWeekStats[dow].completed++;
      }
    }
  }

  const dayRates = dayOfWeekStats.map((s, i) => ({
    day: i,
    rate: s.scheduled > 0 ? s.completed / s.scheduled : 0,
    scheduled: s.scheduled,
  })).filter(d => d.scheduled > 0);

  if (dayRates.length > 0) {
    const best = dayRates.reduce((a, b) => a.rate > b.rate ? a : b);
    const worst = dayRates.reduce((a, b) => a.rate < b.rate ? a : b);

    if (best.rate > 0) {
      insights.push({
        type: 'success',
        message: `Your best day is ${DAY_NAMES[best.day]} with a ${Math.round(best.rate * 100)}% completion rate.`,
      });
    }
    if (worst.rate < best.rate) {
      insights.push({
        type: 'warning',
        message: `${DAY_NAMES[worst.day]} is your most challenging day at ${Math.round(worst.rate * 100)}% completion.`,
      });
    }
  }

  // 2. Most/least consistent habits
  const habitRates: { habit: Habit; rate: number; scheduled: number }[] = [];
  for (const habit of trackable) {
    let scheduled = 0;
    let completed = 0;
    for (const dk of dayKeys) {
      const dow = new Date(dk + 'T12:00:00Z').getUTCDay();
      const isScheduled = !habit.assignedDays || habit.assignedDays.length === 0 || habit.assignedDays.includes(dow);
      if (isScheduled) {
        scheduled++;
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) completed++;
      }
    }
    if (scheduled > 0) {
      habitRates.push({ habit, rate: completed / scheduled, scheduled });
    }
  }

  if (habitRates.length >= 2) {
    const sorted = [...habitRates].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    insights.push({
      type: 'success',
      message: `"${best.habit.name}" is your most consistent habit at ${Math.round(best.rate * 100)}%.`,
    });
    if (worst.rate < best.rate) {
      insights.push({
        type: 'warning',
        message: `"${worst.habit.name}" needs attention — only ${Math.round(worst.rate * 100)}% completion rate.`,
      });
    }
  }

  // 3. Longest streak habit
  const refDate = parseISO(referenceDayKey);
  let longestStreakHabit: { name: string; streak: number } | null = null;
  for (const habit of trackable) {
    const dayMap = dayStatesByHabit.get(habit.id);
    if (!dayMap) continue;
    const metrics = calculateHabitStreakMetrics(habit, Array.from(dayMap.values()), refDate, referenceDayKey);
    if (!longestStreakHabit || metrics.bestStreak > longestStreakHabit.streak) {
      longestStreakHabit = { name: habit.name, streak: metrics.bestStreak };
    }
  }
  if (longestStreakHabit && longestStreakHabit.streak > 1) {
    insights.push({
      type: 'success',
      message: `"${longestStreakHabit.name}" has your longest streak at ${longestStreakHabit.streak} days.`,
    });
  }

  // 4. Weekend vs weekday comparison
  let weekdayScheduled = 0, weekdayCompleted = 0;
  let weekendScheduled = 0, weekendCompleted = 0;
  for (const dk of dayKeys) {
    const dow = new Date(dk + 'T12:00:00Z').getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const scheduled = getScheduledHabitsForDay(trackable, dk);
    for (const habit of scheduled) {
      if (isWeekend) {
        weekendScheduled++;
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) weekendCompleted++;
      } else {
        weekdayScheduled++;
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) weekdayCompleted++;
      }
    }
  }
  const weekdayRate = weekdayScheduled > 0 ? weekdayCompleted / weekdayScheduled : 0;
  const weekendRate = weekendScheduled > 0 ? weekendCompleted / weekendScheduled : 0;
  if (weekdayScheduled > 0 && weekendScheduled > 0) {
    const diff = Math.abs(weekdayRate - weekendRate);
    if (diff >= 0.1) {
      if (weekdayRate > weekendRate) {
        insights.push({
          type: 'info',
          message: `You complete ${Math.round(diff * 100)}% more habits on weekdays than weekends.`,
        });
      } else {
        insights.push({
          type: 'info',
          message: `You complete ${Math.round(diff * 100)}% more habits on weekends than weekdays.`,
        });
      }
    }
  }

  // 5. Trend direction (last 4 weeks vs prior 4 weeks)
  if (dayKeys.length >= 28) {
    const midpoint = dayKeys.length - 14;
    const recentKeys = dayKeys.slice(midpoint);
    const priorKeys = dayKeys.slice(Math.max(0, midpoint - 14), midpoint);

    const computeRangeRate = (keys: string[]) => {
      let s = 0, c = 0;
      for (const dk of keys) {
        const scheduled = getScheduledHabitsForDay(trackable, dk);
        s += scheduled.length;
        for (const habit of scheduled) {
          if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) c++;
        }
      }
      return s > 0 ? c / s : 0;
    };

    const recentRate = computeRangeRate(recentKeys);
    const priorRate = computeRangeRate(priorKeys);
    const trendDiff = recentRate - priorRate;

    if (Math.abs(trendDiff) >= 0.05) {
      if (trendDiff > 0) {
        insights.push({
          type: 'success',
          message: `Your completion rate improved by ${Math.round(trendDiff * 100)}% over the last 2 weeks.`,
        });
      } else {
        insights.push({
          type: 'warning',
          message: `Your completion rate dropped by ${Math.round(Math.abs(trendDiff) * 100)}% over the last 2 weeks.`,
        });
      }
    }
  }

  return insights;
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

export function computeRoutineAnalytics(
  routines: Routine[],
  routineLogs: Record<string, RoutineLog>,
  habits: Habit[],
  entries: HabitEntry[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): RoutineAnalyticsSummary {
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);
  const dayKeySet = new Set(dayKeys);
  const logs = Object.values(routineLogs).filter(log => log.date >= startDayKey && log.date <= referenceDayKey);

  const totalStarted = logs.length;
  const completedLogs = logs.filter(log => log.completedAt);
  const totalCompleted = completedLogs.length;
  const reliabilityRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 1000) / 1000 : 0;

  const durationsSeconds = completedLogs
    .map(log => log.actualDurationSeconds)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const averageDurationSeconds = durationsSeconds.length > 0
    ? Math.round(durationsSeconds.reduce((a, b) => a + b, 0) / durationsSeconds.length)
    : 0;

  // Per-routine breakdown
  const routineMap = new Map(routines.map(r => [r.id, r]));
  const byRoutine = new Map<string, { completed: number; started: number; durations: number[] }>();
  for (const log of logs) {
    const entry = byRoutine.get(log.routineId) ?? { completed: 0, started: 0, durations: [] };
    entry.started++;
    if (log.completedAt) {
      entry.completed++;
      if (typeof log.actualDurationSeconds === 'number' && log.actualDurationSeconds > 0) {
        entry.durations.push(log.actualDurationSeconds);
      }
    }
    byRoutine.set(log.routineId, entry);
  }

  const routineBreakdown = Array.from(byRoutine.entries())
    .map(([routineId, data]) => ({
      routineId,
      routineTitle: routineMap.get(routineId)?.title ?? 'Unknown',
      completedCount: data.completed,
      timesStarted: data.started,
      averageDurationSeconds: data.durations.length > 0
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 0,
    }))
    .sort((a, b) => b.completedCount - a.completedCount);

  // ─── Routine Effectiveness: habit completion on routine days vs non-routine days
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);

  // Build per-routine day sets
  const routineDaySets = new Map<string, Set<string>>();
  for (const log of completedLogs) {
    const daySet = routineDaySets.get(log.routineId) ?? new Set<string>();
    if (dayKeySet.has(log.date)) daySet.add(log.date);
    routineDaySets.set(log.routineId, daySet);
  }

  // Helper: compute habit completion rate for a set of days
  const computeHabitRate = (keys: string[]) => {
    let s = 0, c = 0;
    for (const dk of keys) {
      const scheduled = getScheduledHabitsForDay(trackable, dk);
      s += scheduled.length;
      for (const habit of scheduled) {
        if (dayStatesByHabit.get(habit.id)?.get(dk)?.completed) c++;
      }
    }
    return s > 0 ? c / s : 0;
  };

  const effectiveness: RoutineEffectivenessItem[] = [];
  for (const [routineId, daySet] of routineDaySets) {
    if (daySet.size === 0) continue;
    const routineDays = Array.from(daySet);
    const nonRoutineDays = dayKeys.filter(dk => !daySet.has(dk));

    const rateWith = computeHabitRate(routineDays);
    const rateWithout = computeHabitRate(nonRoutineDays);
    const delta = rateWith - rateWithout;

    let effectivenessLevel: RoutineEffectivenessItem['effectivenessLevel'];
    if (delta >= 0.3) effectivenessLevel = 'Very High';
    else if (delta >= 0.15) effectivenessLevel = 'High';
    else if (delta >= 0.05) effectivenessLevel = 'Medium';
    else effectivenessLevel = 'Low';

    effectiveness.push({
      routineId,
      routineTitle: routineMap.get(routineId)?.title ?? 'Unknown',
      timesUsed: daySet.size,
      habitCompletionRateWithRoutine: Math.round(rateWith * 1000) / 1000,
      habitCompletionRateWithoutRoutine: Math.round(rateWithout * 1000) / 1000,
      effectivenessLevel,
    });
  }
  effectiveness.sort((a, b) => b.habitCompletionRateWithRoutine - a.habitCompletionRateWithRoutine);

  // ─── Routine Insights
  const routineInsights: Insight[] = [];
  if (effectiveness.length > 0) {
    const best = effectiveness[0];
    if (best.habitCompletionRateWithRoutine > best.habitCompletionRateWithoutRoutine) {
      const delta = Math.round((best.habitCompletionRateWithRoutine - best.habitCompletionRateWithoutRoutine) * 100);
      routineInsights.push({
        type: 'success',
        message: `You complete ${delta}% more habits on days you run "${best.routineTitle}".`,
      });
    }
  }

  // Weekday vs weekend routine usage
  let weekdayUsage = 0, weekendUsage = 0;
  for (const log of completedLogs) {
    if (!dayKeySet.has(log.date)) continue;
    const dow = new Date(log.date + 'T12:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) weekendUsage++;
    else weekdayUsage++;
  }
  if (weekdayUsage > 0 && weekendUsage > 0) {
    const total = weekdayUsage + weekendUsage;
    const weekdayPct = Math.round((weekdayUsage / total) * 100);
    if (weekdayPct > 70) {
      routineInsights.push({ type: 'info', message: `You use routines mostly on weekdays (${weekdayPct}% of sessions).` });
    } else if (weekdayPct < 30) {
      routineInsights.push({ type: 'info', message: `You use routines mostly on weekends (${100 - weekdayPct}% of sessions).` });
    }
  }

  return {
    totalCompleted,
    totalStarted,
    reliabilityRate,
    averageDurationSeconds,
    routineBreakdown,
    effectiveness,
    routineInsights,
  };
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

export function computeGoalAnalytics(
  goals: Goal[],
  _habits: Habit[],
  entries: HabitEntry[],
  referenceDayKey: string,
  timeZone?: string
): GoalAnalyticsSummary {
  const activeGoals = goals.filter(g => !g.completedAt);
  const completedGoals = goals.filter(g => g.completedAt);

  // Build entry lookup by habitId
  const entriesByHabit = new Map<string, HabitEntry[]>();
  for (const entry of entries) {
    const existing = entriesByHabit.get(entry.habitId) ?? [];
    existing.push(entry);
    entriesByHabit.set(entry.habitId, existing);
  }

  const goalBreakdown: GoalBreakdownItem[] = [];

  for (const goal of goals) {
    let progressPercent = 0;
    let isAtRisk = false;
    let currentValue = 0;
    let status: GoalBreakdownItem['status'] = 'Not Started';
    let timeElapsedPercent: number | null = null;
    let requiredPacePerWeek: number | null = null;
    let currentPacePerWeek: number | null = null;
    let remainingWork: number | null = null;
    let estimatedCompletionWeeks: number | null = null;
    let completionDate: string | null = null;
    let timeTakenDays: number | null = null;
    let avgPerWeek: number | null = null;

    if (goal.completedAt) {
      progressPercent = 100;
      status = 'Completed';
      completionDate = goal.completedAt;

      // Compute time taken and work done for completed goals
      if (goal.createdAt) {
        timeTakenDays = differenceInCalendarDays(parseISO(goal.completedAt), parseISO(goal.createdAt));
        const weeks = Math.max(1, timeTakenDays / 7);

        // Compute total work done
        for (const habitId of goal.linkedHabitIds) {
          const habitEntries = entriesByHabit.get(habitId) ?? [];
          const nonFreeze = habitEntries.filter(e => !parseFreezeType(e.note));
          if (goal.aggregationMode === 'sum') {
            currentValue += nonFreeze.reduce((sum, e) => sum + (typeof e.value === 'number' ? e.value : 0), 0);
          } else if (goal.countMode === 'entries') {
            currentValue += nonFreeze.length;
          } else {
            currentValue += new Set(nonFreeze.map(e => getCanonicalDayKeyFromEntry(e, { timeZone })).filter(Boolean)).size;
          }
        }
        avgPerWeek = Math.round((currentValue / weeks) * 10) / 10;
      }
    } else if (goal.type === 'cumulative' && goal.targetValue && goal.targetValue > 0) {
      // Compute current value from linked habit entries
      for (const habitId of goal.linkedHabitIds) {
        const habitEntries = entriesByHabit.get(habitId) ?? [];
        const nonDeletedEntries = habitEntries.filter(e => !parseFreezeType(e.note));
        if (goal.aggregationMode === 'count' || !goal.aggregationMode) {
          if (goal.countMode === 'entries') {
            currentValue += nonDeletedEntries.length;
          } else {
            const dayKeys = new Set(nonDeletedEntries.map(e => getCanonicalDayKeyFromEntry(e, { timeZone })).filter(Boolean));
            currentValue += dayKeys.size;
          }
        } else {
          currentValue += nonDeletedEntries.reduce((sum, e) => sum + (typeof e.value === 'number' ? e.value : 0), 0);
        }
      }
      progressPercent = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));
      remainingWork = Math.max(0, goal.targetValue - currentValue);

      // Compute pace
      if (goal.createdAt) {
        const elapsedDays = Math.max(1, differenceInCalendarDays(parseISO(referenceDayKey), parseISO(goal.createdAt)));
        const elapsedWeeks = Math.max(0.5, elapsedDays / 7);
        currentPacePerWeek = Math.round((currentValue / elapsedWeeks) * 10) / 10;

        if (currentPacePerWeek > 0) {
          estimatedCompletionWeeks = Math.ceil(remainingWork / currentPacePerWeek);
        }
      }

      // Time elapsed % and required pace (if deadline)
      if (goal.deadline && goal.createdAt) {
        const totalDuration = differenceInCalendarDays(parseISO(goal.deadline), parseISO(goal.createdAt));
        const elapsed = differenceInCalendarDays(parseISO(referenceDayKey), parseISO(goal.createdAt));
        timeElapsedPercent = totalDuration > 0 ? Math.min(100, Math.round((elapsed / totalDuration) * 100)) : 100;

        const remainingDays = differenceInCalendarDays(parseISO(goal.deadline), parseISO(referenceDayKey));
        const remainingWeeks = Math.max(0.5, remainingDays / 7);
        requiredPacePerWeek = Math.round((remainingWork / remainingWeeks) * 10) / 10;

        // Determine status based on progress vs time
        if (remainingDays <= 0) {
          status = progressPercent >= 100 ? 'Completed' : 'Behind';
          isAtRisk = progressPercent < 100;
        } else if (progressPercent >= (timeElapsedPercent ?? 0) - 10) {
          status = 'On Track';
        } else if (progressPercent >= (timeElapsedPercent ?? 0) - 25) {
          status = 'At Risk';
          isAtRisk = true;
        } else {
          status = 'Behind';
          isAtRisk = true;
        }
      } else {
        // No deadline: status based on activity
        if (currentValue === 0) status = 'Not Started';
        else status = 'On Track';
      }
    } else if (goal.type === 'onetime') {
      progressPercent = 0;
      status = 'Not Started';
    }

    goalBreakdown.push({
      goalId: goal.id,
      goalTitle: goal.title,
      progressPercent,
      isCompleted: !!goal.completedAt,
      isAtRisk,
      status,
      currentValue,
      targetValue: goal.targetValue ?? null,
      unit: goal.unit ?? null,
      timeElapsedPercent,
      requiredPacePerWeek,
      currentPacePerWeek,
      remainingWork,
      estimatedCompletionWeeks,
      completionDate,
      timeTakenDays,
      avgPerWeek,
    });
  }

  const activeProgressValues = goalBreakdown.filter(g => !g.isCompleted).map(g => g.progressPercent);
  const averageProgressPercent = activeProgressValues.length > 0
    ? Math.round(activeProgressValues.reduce((a, b) => a + b, 0) / activeProgressValues.length)
    : 0;

  return {
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    averageProgressPercent,
    goalsAtRisk: goalBreakdown.filter(g => g.isAtRisk).length,
    goalsBehind: goalBreakdown.filter(g => g.status === 'Behind').length,
    goalsOnTrack: goalBreakdown.filter(g => g.status === 'On Track').length,
    goalBreakdown: goalBreakdown.sort((a, b) => {
      // Sort: At Risk/Behind first, then active by progress, then completed
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      if (a.isAtRisk !== b.isAtRisk) return a.isAtRisk ? -1 : 1;
      return b.progressPercent - a.progressPercent;
    }),
  };
}
