import { differenceInCalendarDays, endOfWeek, format, parseISO, startOfWeek, subDays } from 'date-fns';
import type { Habit } from '../../models/persistenceTypes';

export interface HabitDayState {
  dayKey: string;
  value: number;
  completed: boolean;
  isFrozen?: boolean;
}

export interface HabitStreakMetrics {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDayKey: string | null;
  completedToday: boolean;
  atRisk: boolean;
  weekSatisfied?: boolean;
  weekProgress?: number;
  weekTarget?: number;
}

function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function previousDayKey(dayKey: string): string {
  return toDayKey(subDays(parseISO(dayKey), 1));
}

function weekStartDayKey(date: Date): string {
  return toDayKey(startOfWeek(date, { weekStartsOn: 1 }));
}

function previousWeekStartDayKey(currentWeekStart: string): string {
  return weekStartDayKey(subDays(parseISO(currentWeekStart), 7));
}

function calculateBestConsecutiveSpan(dayKeys: string[], stepInDays: number): number {
  if (dayKeys.length === 0) return 0;

  const sorted = [...new Set(dayKeys)].sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const next = parseISO(sorted[i]);
    const diff = differenceInCalendarDays(next, prev);

    if (diff === stepInDays) {
      current += 1;
      best = Math.max(best, current);
    } else if (diff > stepInDays) {
      current = 1;
    }
  }

  return best;
}

function calculateDailyMetrics(
  dayStates: HabitDayState[],
  referenceDate: Date,
  referenceDayKey?: string
): HabitStreakMetrics {
  const validDayKeys = new Set(
    dayStates
      .filter(state => state.completed || state.isFrozen)
      .map(state => state.dayKey)
  );

  const todayDayKey = referenceDayKey ?? toDayKey(referenceDate);
  const completedToday = validDayKeys.has(todayDayKey);
  const allCompletedDayKeys = [...validDayKeys];
  const sortedCompletedDayKeys = allCompletedDayKeys.sort();
  const lastCompletedDayKey = sortedCompletedDayKeys.length > 0
    ? sortedCompletedDayKeys[sortedCompletedDayKeys.length - 1]
    : null;

  let currentStreak = 0;
  let cursor = completedToday ? todayDayKey : previousDayKey(todayDayKey);
  while (validDayKeys.has(cursor)) {
    currentStreak += 1;
    cursor = previousDayKey(cursor);
    if (currentStreak > 10000) break;
  }

  const bestStreak = calculateBestConsecutiveSpan(allCompletedDayKeys, 1);
  const atRisk = currentStreak > 0 && !completedToday;

  return {
    currentStreak,
    bestStreak,
    lastCompletedDayKey,
    completedToday,
    atRisk,
  };
}

type WeeklyProgress = {
  progress: number;
  satisfied: boolean;
};

function buildWeeklyProgressMap(
  dayStates: HabitDayState[],
  habit: Habit
): Map<string, WeeklyProgress> {
  const isQuantity = habit.goal.type === 'number';
  const target = habit.goal.target ?? 1;

  const rawWeekMap = new Map<string, { total: number; distinctDays: Set<string> }>();

  for (const dayState of dayStates) {
    if (!(dayState.completed || dayState.isFrozen)) continue;

    const weekKey = weekStartDayKey(parseISO(dayState.dayKey));
    const existing = rawWeekMap.get(weekKey) ?? { total: 0, distinctDays: new Set<string>() };
    existing.distinctDays.add(dayState.dayKey);

    if (isQuantity) {
      existing.total += dayState.value;
    }

    rawWeekMap.set(weekKey, existing);
  }

  const weeklyMap = new Map<string, WeeklyProgress>();
  for (const [weekKey, value] of rawWeekMap.entries()) {
    const progress = isQuantity ? value.total : value.distinctDays.size;
    weeklyMap.set(weekKey, {
      progress,
      satisfied: progress >= target,
    });
  }

  return weeklyMap;
}

function calculateWeeklyMetrics(
  dayStates: HabitDayState[],
  habit: Habit,
  referenceDate: Date,
  referenceDayKey?: string
): HabitStreakMetrics {
  const referenceDay = referenceDayKey ? parseISO(referenceDayKey) : referenceDate;
  const target = habit.goal.target ?? 1;
  const weeklyProgressMap = buildWeeklyProgressMap(dayStates, habit);
  const currentWeekKey = weekStartDayKey(referenceDay);
  const currentWeek = weeklyProgressMap.get(currentWeekKey) ?? { progress: 0, satisfied: false };

  let currentStreak = 0;
  let cursorWeekKey = currentWeek.satisfied ? currentWeekKey : previousWeekStartDayKey(currentWeekKey);

  while (weeklyProgressMap.get(cursorWeekKey)?.satisfied) {
    currentStreak += 1;
    cursorWeekKey = previousWeekStartDayKey(cursorWeekKey);
    if (currentStreak > 10000) break;
  }

  const satisfiedWeekKeys = [...weeklyProgressMap.entries()]
    .filter(([, value]) => value.satisfied)
    .map(([weekKey]) => weekKey);

  const bestStreak = calculateBestConsecutiveSpan(satisfiedWeekKeys, 7);

  const completedDayKeys = dayStates
    .filter(state => state.completed || state.isFrozen)
    .map(state => state.dayKey)
    .sort();
  const lastCompletedDayKey = completedDayKeys.length > 0
    ? completedDayKeys[completedDayKeys.length - 1]
    : null;

  const daysLeftInWeek = differenceInCalendarDays(
    endOfWeek(referenceDay, { weekStartsOn: 1 }),
    referenceDay
  );
  const atRisk = currentStreak > 0 && !currentWeek.satisfied && daysLeftInWeek <= 2;

  return {
    currentStreak,
    bestStreak,
    lastCompletedDayKey,
    completedToday: dayStates.some(state => state.dayKey === (referenceDayKey ?? toDayKey(referenceDay)) && (state.completed || state.isFrozen)),
    atRisk,
    weekSatisfied: currentWeek.satisfied,
    weekProgress: currentWeek.progress,
    weekTarget: target,
  };
}

/**
 * Calculates canonical streak metrics from day-level completion derived from HabitEntries.
 * DayLogs are intentionally not required here.
 */
export function calculateHabitStreakMetrics(
  habit: Habit,
  dayStates: HabitDayState[],
  referenceDate: Date = new Date(),
  referenceDayKey?: string
): HabitStreakMetrics {
  if (habit.goal.frequency === 'weekly') {
    return calculateWeeklyMetrics(dayStates, habit, referenceDate, referenceDayKey);
  }

  return calculateDailyMetrics(dayStates, referenceDate, referenceDayKey);
}
