import type { Habit } from '../../models/persistenceTypes';
import {
  addDaysToDayKey,
  differenceInDayKeys,
  getIsoWeekStartDayKey,
  isValidDayKey,
} from '../../domain/time/dayKey';
import { isHabitScheduledOnDay } from './scheduleEngine';

export interface HabitDayState {
  dayKey: string;
  value: number;
  completed: boolean;
  /** Optional bundle-specific qualification when streak rules differ from daily success. */
  streakCompleted?: boolean;
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

type WeeklyProgress = {
  progress: number;
  satisfied: boolean;
};

function dateToLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCreatedDayKey(habit: Habit): string | null {
  const candidate = habit.createdAt?.slice(0, 10);
  return candidate && isValidDayKey(candidate) ? candidate : null;
}

function filterStatesToHabitLifetime(
  dayStates: HabitDayState[],
  habit: Habit,
  referenceDayKey: string,
): HabitDayState[] {
  const createdDayKey = getCreatedDayKey(habit);
  return dayStates.filter(state => (
    isValidDayKey(state.dayKey)
    && state.dayKey <= referenceDayKey
    && (!createdDayKey || state.dayKey >= createdDayKey)
  ));
}

function calculateBestConsecutiveSpan(dayKeys: string[], stepInDays: number): number {
  if (dayKeys.length === 0) return 0;

  const sorted = [...new Set(dayKeys)].sort();
  let best = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const difference = differenceInDayKeys(sorted[i], sorted[i - 1]);
    if (difference === stepInDays) {
      current += 1;
      best = Math.max(best, current);
    } else if (difference > stepInDays) {
      current = 1;
    }
  }

  return best;
}

function qualifiesForStreak(state: HabitDayState): boolean {
  return state.streakCompleted ?? state.completed;
}

function getLastCompletedDayKey(dayStates: HabitDayState[]): string | null {
  const completedDayKeys = dayStates
    .filter(qualifiesForStreak)
    .map(state => state.dayKey)
    .sort();
  return completedDayKeys.at(-1) ?? null;
}

/**
 * Daily streaks count scheduled opportunities, not adjacent calendar days.
 * A freeze protects an opportunity but is not itself reported as completion.
 */
function calculateOpportunityMetrics(
  dayStates: HabitDayState[],
  habit: Habit,
  referenceDayKey: string,
): HabitStreakMetrics {
  const eligibleStates = filterStatesToHabitLifetime(dayStates, habit, referenceDayKey);
  const protectedDayKeys = new Set(
    eligibleStates
      .filter(state => qualifiesForStreak(state) || state.isFrozen)
      .map(state => state.dayKey),
  );
  const completedDayKeys = new Set(
    eligibleStates.filter(state => state.completed).map(state => state.dayKey),
  );

  const createdDayKey = getCreatedDayKey(habit)
    ?? eligibleStates.map(state => state.dayKey).sort()[0]
    ?? referenceDayKey;
  const opportunityDayKeys: string[] = [];
  const totalCalendarDays = differenceInDayKeys(referenceDayKey, createdDayKey) + 1;
  for (let offset = 0; offset < totalCalendarDays; offset++) {
    const dayKey = addDaysToDayKey(createdDayKey, offset);
    if (isHabitScheduledOnDay(habit, dayKey)) opportunityDayKeys.push(dayKey);
  }

  let bestStreak = 0;
  let span = 0;
  for (const opportunityDayKey of opportunityDayKeys) {
    if (protectedDayKeys.has(opportunityDayKey)) {
      span += 1;
      bestStreak = Math.max(bestStreak, span);
    } else {
      span = 0;
    }
  }

  const referenceIsOpportunity = opportunityDayKeys.at(-1) === referenceDayKey;
  let cursorIndex = opportunityDayKeys.length - 1;
  // An unfinished opportunity on the reference day is still open. Preserve
  // the streak through the prior scheduled occurrence and mark it at risk.
  if (referenceIsOpportunity && !protectedDayKeys.has(referenceDayKey)) {
    cursorIndex -= 1;
  }

  let currentStreak = 0;
  while (cursorIndex >= 0 && protectedDayKeys.has(opportunityDayKeys[cursorIndex])) {
    currentStreak += 1;
    cursorIndex -= 1;
  }

  const completedToday = completedDayKeys.has(referenceDayKey);
  return {
    currentStreak,
    bestStreak,
    lastCompletedDayKey: getLastCompletedDayKey(eligibleStates),
    completedToday,
    atRisk: currentStreak > 0 && referenceIsOpportunity && !protectedDayKeys.has(referenceDayKey),
  };
}

/** Weekly quotas always count distinct protected habit-days, never quantity. */
function buildWeeklyProgressMap(
  dayStates: HabitDayState[],
  target: number,
): Map<string, WeeklyProgress> {
  const protectedDaysByWeek = new Map<string, Set<string>>();

  for (const dayState of dayStates) {
    if (!(qualifiesForStreak(dayState) || dayState.isFrozen)) continue;
    const weekKey = getIsoWeekStartDayKey(dayState.dayKey);
    const protectedDays = protectedDaysByWeek.get(weekKey) ?? new Set<string>();
    protectedDays.add(dayState.dayKey);
    protectedDaysByWeek.set(weekKey, protectedDays);
  }

  const weeklyMap = new Map<string, WeeklyProgress>();
  for (const [weekKey, protectedDays] of protectedDaysByWeek) {
    const progress = protectedDays.size;
    weeklyMap.set(weekKey, { progress, satisfied: progress >= target });
  }
  return weeklyMap;
}

function calculateWeeklyMetrics(
  dayStates: HabitDayState[],
  habit: Habit,
  referenceDayKey: string,
  target: number,
): HabitStreakMetrics {
  const eligibleStates = filterStatesToHabitLifetime(dayStates, habit, referenceDayKey);
  const weeklyProgressMap = buildWeeklyProgressMap(eligibleStates, target);
  const currentWeekKey = getIsoWeekStartDayKey(referenceDayKey);
  const createdWeekKey = getIsoWeekStartDayKey(getCreatedDayKey(habit) ?? referenceDayKey);
  const currentWeek = weeklyProgressMap.get(currentWeekKey) ?? { progress: 0, satisfied: false };

  let currentStreak = 0;
  let cursorWeekKey = currentWeek.satisfied
    ? currentWeekKey
    : addDaysToDayKey(currentWeekKey, -7);
  while (
    cursorWeekKey >= createdWeekKey
    && weeklyProgressMap.get(cursorWeekKey)?.satisfied
  ) {
    currentStreak += 1;
    cursorWeekKey = addDaysToDayKey(cursorWeekKey, -7);
  }

  const satisfiedWeekKeys = [...weeklyProgressMap.entries()]
    .filter(([weekKey, value]) => (
      weekKey >= createdWeekKey
      && weekKey <= currentWeekKey
      && value.satisfied
    ))
    .map(([weekKey]) => weekKey);
  const bestStreak = calculateBestConsecutiveSpan(satisfiedWeekKeys, 7);

  const completedToday = eligibleStates.some(
    state => state.dayKey === referenceDayKey && state.completed,
  );
  const daysLeftInWeek = differenceInDayKeys(addDaysToDayKey(currentWeekKey, 6), referenceDayKey);

  return {
    currentStreak,
    bestStreak,
    lastCompletedDayKey: getLastCompletedDayKey(eligibleStates),
    completedToday,
    atRisk: currentStreak > 0 && !currentWeek.satisfied && daysLeftInWeek <= 2,
    weekSatisfied: currentWeek.satisfied,
    weekProgress: currentWeek.progress,
    weekTarget: target,
  };
}

/**
 * Calculate canonical streak metrics from day-level completion derived from
 * HabitEntries. The caller-supplied DayKey is the calendar boundary; future
 * states and states before habit creation are excluded.
 */
export function calculateHabitStreakMetrics(
  habit: Habit,
  dayStates: HabitDayState[],
  referenceDate: Date = new Date(),
  referenceDayKey?: string,
): HabitStreakMetrics {
  const referenceDay = referenceDayKey ?? dateToLocalDayKey(referenceDate);

  if (habit.timesPerWeek != null && habit.timesPerWeek > 0) {
    return calculateWeeklyMetrics(dayStates, habit, referenceDay, habit.timesPerWeek);
  }

  if (habit.assignedDays?.length && habit.requiredDaysPerWeek != null) {
    return calculateWeeklyMetrics(
      dayStates,
      habit,
      referenceDay,
      habit.requiredDaysPerWeek,
    );
  }

  return calculateOpportunityMetrics(dayStates, habit, referenceDay);
}
