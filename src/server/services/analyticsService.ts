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

export interface HabitAnalyticsSummary {
  consistencyScore: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  graduatedHabits: number;
}

export interface HeatmapDataPoint {
  dayKey: string;
  completionPercent: number;
  completedCount: number;
  scheduledCount: number;
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

// ─── Summary ─────────────────────────────────────────────────────────────────

export function computeHabitAnalyticsSummary(
  habits: Habit[],
  entries: HabitEntry[],
  memberships: BundleMembershipRecord[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): HabitAnalyticsSummary {
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);

  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);

  // Consistency: days with >= 1 completion / total days
  const daysWithCompletion = new Set<string>();
  for (const [, dayMap] of dayStatesByHabit) {
    for (const [dk, state] of dayMap) {
      if (state.completed && dayKeys.includes(dk)) {
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
    return dk && dayKeys.includes(dk) && !parseFreezeType(e.note);
  }).length;

  // Graduated habits count
  const graduatedHabits = memberships.filter(m => m.graduatedAt !== null).length;

  return {
    consistencyScore: Math.round(consistencyScore * 1000) / 1000,
    completionRate: Math.round(completionRate * 1000) / 1000,
    currentStreak: maxCurrentStreak,
    longestStreak: maxBestStreak,
    totalCompletions,
    graduatedHabits,
  };
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

export function computeHeatmapData(
  habits: Habit[],
  entries: HabitEntry[],
  referenceDayKey: string,
  days: number,
  timeZone?: string
): HeatmapDataPoint[] {
  const trackable = getTrackableHabits(habits);
  const dayStatesByHabit = buildDayStatesByHabit(entries, timeZone);
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
  const dayKeys = generateDayKeyRange(startDayKey, referenceDayKey);

  return dayKeys.map(dk => {
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

  // Group trackable habits by category
  const habitsByCategory = new Map<string, Habit[]>();
  for (const habit of trackable) {
    const catId = habit.categoryId || 'uncategorized';
    const existing = habitsByCategory.get(catId) ?? [];
    existing.push(habit);
    habitsByCategory.set(catId, existing);
  }

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
          const dayMap = dayStatesByHabit.get(habit.id);
          if (dayMap?.get(dk)?.completed) totalCompleted++;
        }
      }
    }

    const cat = categoryMap.get(catId);
    results.push({
      categoryId: catId,
      categoryName: cat?.name ?? 'Uncategorized',
      color: cat?.color ?? 'bg-neutral-500',
      completionRate: totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 1000) / 1000 : 0,
      totalCompleted,
      totalScheduled,
    });
  }

  return results.sort((a, b) => b.completionRate - a.completionRate);
}

// ─── Insights ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export interface RoutineAnalyticsSummary {
  totalCompleted: number;
  totalStarted: number;
  reliabilityRate: number;
  averageDurationSeconds: number;
  routineBreakdown: Array<{
    routineId: string;
    routineTitle: string;
    completedCount: number;
    averageDurationSeconds: number;
  }>;
}

export function computeRoutineAnalytics(
  routines: Routine[],
  routineLogs: Record<string, RoutineLog>,
  referenceDayKey: string,
  days: number
): RoutineAnalyticsSummary {
  const startDayKey = format(subDays(parseISO(referenceDayKey), days - 1), 'yyyy-MM-dd');
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
  const byRoutine = new Map<string, { completed: number; durations: number[] }>();
  for (const log of completedLogs) {
    const entry = byRoutine.get(log.routineId) ?? { completed: 0, durations: [] };
    entry.completed++;
    if (typeof log.actualDurationSeconds === 'number' && log.actualDurationSeconds > 0) {
      entry.durations.push(log.actualDurationSeconds);
    }
    byRoutine.set(log.routineId, entry);
  }

  const routineBreakdown = Array.from(byRoutine.entries())
    .map(([routineId, data]) => ({
      routineId,
      routineTitle: routineMap.get(routineId)?.title ?? 'Unknown',
      completedCount: data.completed,
      averageDurationSeconds: data.durations.length > 0
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 0,
    }))
    .sort((a, b) => b.completedCount - a.completedCount);

  return {
    totalCompleted,
    totalStarted,
    reliabilityRate,
    averageDurationSeconds,
    routineBreakdown,
  };
}

// ─── Goal Analytics ──────────────────────────────────────────────────────────

export interface GoalAnalyticsSummary {
  activeGoals: number;
  completedGoals: number;
  averageProgressPercent: number;
  goalsAtRisk: number;
  goalBreakdown: Array<{
    goalId: string;
    goalTitle: string;
    progressPercent: number;
    isCompleted: boolean;
    isAtRisk: boolean;
  }>;
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

  const goalBreakdown: GoalAnalyticsSummary['goalBreakdown'] = [];

  for (const goal of goals) {
    let progressPercent = 0;
    let isAtRisk = false;

    if (goal.completedAt) {
      progressPercent = 100;
    } else if (goal.type === 'cumulative' && goal.targetValue && goal.targetValue > 0) {
      // Compute current value from linked habit entries
      let currentValue = 0;
      for (const habitId of goal.linkedHabitIds) {
        const habitEntries = entriesByHabit.get(habitId) ?? [];
        const nonDeletedEntries = habitEntries.filter(e => !parseFreezeType(e.note));
        if (goal.aggregationMode === 'count' || !goal.aggregationMode) {
          if (goal.countMode === 'entries') {
            currentValue += nonDeletedEntries.length;
          } else {
            // distinctDays
            const dayKeys = new Set(nonDeletedEntries.map(e => getCanonicalDayKeyFromEntry(e, { timeZone })).filter(Boolean));
            currentValue += dayKeys.size;
          }
        } else {
          // sum
          currentValue += nonDeletedEntries.reduce((sum, e) => sum + (typeof e.value === 'number' ? e.value : 0), 0);
        }
      }
      progressPercent = Math.min(100, Math.round((currentValue / goal.targetValue) * 100));

      // At risk: has deadline, less than 75% progress, deadline within 14 days
      if (goal.deadline) {
        const daysUntilDeadline = differenceInCalendarDays(parseISO(goal.deadline), parseISO(referenceDayKey));
        if (daysUntilDeadline <= 14 && progressPercent < 75) {
          isAtRisk = true;
        }
      }
    } else if (goal.type === 'onetime') {
      // One-time goals are 0% until completed
      progressPercent = 0;
    }

    goalBreakdown.push({
      goalId: goal.id,
      goalTitle: goal.title,
      progressPercent,
      isCompleted: !!goal.completedAt,
      isAtRisk,
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
    goalBreakdown: goalBreakdown.sort((a, b) => b.progressPercent - a.progressPercent),
  };
}
