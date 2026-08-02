import type { Habit } from '../../models/persistenceTypes';
import {
  addDaysToDayKey,
  differenceInDayKeys,
  formatDayKeyFromDate,
  getIsoWeekStartDayKey,
  isValidDayKey,
} from '../../domain/time/dayKey';
import {
  getHabitCreatedDayKey,
  getWeeklyQuotaTargetOnDay,
  matchesHabitScheduleOnDay,
  usesWeeklyQuotaStreak,
} from './scheduleEngine';
import { isHabitInactiveOnDay } from '../../domain/habits/trackingHistory';

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
  target: number;
};

function dateToLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function filterStatesToReferenceDay(
  dayStates: HabitDayState[],
  referenceDayKey: string,
): HabitDayState[] {
  return dayStates.filter(state => (
    isValidDayKey(state.dayKey)
    && state.dayKey <= referenceDayKey
  ));
}

function getTrackingStartDayKey(
  createdDayKey: string | null,
  dayStates: HabitDayState[],
  referenceDayKey: string,
): string {
  const earliestRecordedDayKey = dayStates.map(state => state.dayKey).sort()[0];
  if (createdDayKey && earliestRecordedDayKey) {
    return createdDayKey < earliestRecordedDayKey ? createdDayKey : earliestRecordedDayKey;
  }
  return createdDayKey ?? earliestRecordedDayKey ?? referenceDayKey;
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

/** A daily↔weekly streak-unit change starts a new comparable streak segment. */
function getCurrentStreakModeStartDayKey(
  habit: Habit,
  createdDayKey: string,
  referenceDayKey: string,
): string {
  const currentUsesWeeklyQuota = usesWeeklyQuotaStreak(habit, referenceDayKey);
  let cursor = referenceDayKey;
  while (cursor > createdDayKey) {
    const previousDayKey = addDaysToDayKey(cursor, -1);
    if (usesWeeklyQuotaStreak(habit, previousDayKey) !== currentUsesWeeklyQuota) break;
    cursor = previousDayKey;
  }
  return cursor < createdDayKey ? createdDayKey : cursor;
}

/**
 * Daily streaks count scheduled opportunities, not adjacent calendar days.
 * A freeze protects an opportunity but is not itself reported as completion.
 */
function calculateOpportunityMetrics(
  dayStates: HabitDayState[],
  habit: Habit,
  referenceDayKey: string,
  timeZone?: string,
): HabitStreakMetrics {
  const createdDayKey = getHabitCreatedDayKey(habit, timeZone);
  const eligibleStates = filterStatesToReferenceDay(dayStates, referenceDayKey);
  const protectedDayKeys = new Set(
    eligibleStates
      .filter(state => qualifiesForStreak(state) || state.isFrozen)
      .map(state => state.dayKey),
  );
  const completedDayKeys = new Set(
    eligibleStates.filter(state => state.completed).map(state => state.dayKey),
  );

  // A real backdated/imported entry is evidence that tracking started before
  // the habit document was created. Start at the earlier boundary, but never
  // invent missed opportunities before the first such record.
  const lifetimeStartDayKey = getTrackingStartDayKey(
    createdDayKey,
    eligibleStates,
    referenceDayKey,
  );
  const effectiveCreatedDayKey = getCurrentStreakModeStartDayKey(
    habit,
    lifetimeStartDayKey,
    referenceDayKey,
  );
  const opportunityDayKeys: string[] = [];
  const totalCalendarDays = differenceInDayKeys(referenceDayKey, effectiveCreatedDayKey) + 1;
  for (let offset = 0; offset < totalCalendarDays; offset++) {
    const dayKey = addDaysToDayKey(effectiveCreatedDayKey, offset);
    if (matchesHabitScheduleOnDay(habit, dayKey)) opportunityDayKeys.push(dayKey);
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
  habit: Habit,
): Map<string, WeeklyProgress> {
  const protectedDaysByWeek = new Map<string, Set<string>>();

  for (const dayState of dayStates) {
    if (!(qualifiesForStreak(dayState) || dayState.isFrozen)) continue;
    if (!dayState.isFrozen && !matchesHabitScheduleOnDay(habit, dayState.dayKey)) continue;
    const weekKey = getIsoWeekStartDayKey(dayState.dayKey);
    const protectedDays = protectedDaysByWeek.get(weekKey) ?? new Set<string>();
    protectedDays.add(dayState.dayKey);
    protectedDaysByWeek.set(weekKey, protectedDays);
  }

  const weeklyMap = new Map<string, WeeklyProgress>();
  for (const [weekKey, protectedDays] of protectedDaysByWeek) {
    const progress = protectedDays.size;
    const target = getWeeklyQuotaTargetOnDay(habit, addDaysToDayKey(weekKey, 6)) ?? 1;
    weeklyMap.set(weekKey, { progress, satisfied: progress >= target, target });
  }
  return weeklyMap;
}

function getEligibleWeeklyPeriodKeys(
  habit: Habit,
  createdWeekKey: string,
  currentWeekKey: string,
): string[] {
  const eligible: string[] = [];
  for (let weekKey = createdWeekKey; weekKey <= currentWeekKey; weekKey = addDaysToDayKey(weekKey, 7)) {
    const weekEndDayKey = addDaysToDayKey(weekKey, 6);
    if (!usesWeeklyQuotaStreak(habit, weekEndDayKey)) continue;

    let hasScheduledDay = false;
    let intersectsInactivePeriod = false;
    for (let offset = 0; offset < 7; offset++) {
      const dayKey = addDaysToDayKey(weekKey, offset);
      if (isHabitInactiveOnDay(habit, dayKey)) intersectsInactivePeriod = true;
      if (matchesHabitScheduleOnDay(habit, dayKey)) hasScheduledDay = true;
    }

    // A week touched by an archive/restore interval is excused as one unit.
    if (hasScheduledDay && !intersectsInactivePeriod) eligible.push(weekKey);
  }
  return eligible;
}

function calculateWeeklyMetrics(
  dayStates: HabitDayState[],
  habit: Habit,
  referenceDayKey: string,
  timeZone?: string,
): HabitStreakMetrics {
  const createdDayKey = getHabitCreatedDayKey(habit, timeZone);
  const eligibleStates = filterStatesToReferenceDay(dayStates, referenceDayKey);
  const currentWeekKey = getIsoWeekStartDayKey(referenceDayKey);
  const lifetimeStartDayKey = getTrackingStartDayKey(
    createdDayKey,
    eligibleStates,
    referenceDayKey,
  );
  const modeStartDayKey = getCurrentStreakModeStartDayKey(
    habit,
    lifetimeStartDayKey,
    referenceDayKey,
  );
  const modeEligibleStates = eligibleStates.filter(state => state.dayKey >= modeStartDayKey);
  const weeklyProgressMap = buildWeeklyProgressMap(modeEligibleStates, habit);
  const createdWeekKey = getIsoWeekStartDayKey(modeStartDayKey);
  const currentTarget = getWeeklyQuotaTargetOnDay(habit, addDaysToDayKey(currentWeekKey, 6)) ?? 1;
  const currentWeek = weeklyProgressMap.get(currentWeekKey) ?? {
    progress: 0,
    satisfied: false,
    target: currentTarget,
  };
  const eligibleWeekKeys = getEligibleWeeklyPeriodKeys(
    habit,
    createdWeekKey,
    currentWeekKey,
  );
  const currentWeekIndex = eligibleWeekKeys.indexOf(currentWeekKey);

  let currentStreak = 0;
  let cursorIndex = currentWeekIndex >= 0
    ? currentWeekIndex - (currentWeek.satisfied ? 0 : 1)
    : eligibleWeekKeys.length - 1;
  while (cursorIndex >= 0 && weeklyProgressMap.get(eligibleWeekKeys[cursorIndex])?.satisfied) {
    currentStreak += 1;
    cursorIndex -= 1;
  }

  let bestStreak = 0;
  let span = 0;
  for (const weekKey of eligibleWeekKeys) {
    if (weeklyProgressMap.get(weekKey)?.satisfied) {
      span += 1;
      bestStreak = Math.max(bestStreak, span);
    } else {
      span = 0;
    }
  }

  const completedToday = eligibleStates.some(
    state => state.dayKey === referenceDayKey && state.completed,
  );
  const daysLeftInWeek = differenceInDayKeys(addDaysToDayKey(currentWeekKey, 6), referenceDayKey);

  return {
    currentStreak,
    bestStreak,
    lastCompletedDayKey: getLastCompletedDayKey(eligibleStates),
    completedToday,
    atRisk: currentStreak > 0 && currentWeekIndex >= 0 && !currentWeek.satisfied && daysLeftInWeek <= 2,
    weekSatisfied: currentWeek.satisfied,
    weekProgress: currentWeek.progress,
    weekTarget: currentWeek.target,
  };
}

/**
 * Calculate canonical streak metrics from day-level completion derived from
 * HabitEntries. The caller-supplied DayKey is the calendar boundary; future
 * states are excluded. A backdated/imported state may precede `createdAt` and
 * becomes the first evidenced opportunity instead of being discarded.
 */
export function calculateHabitStreakMetrics(
  habit: Habit,
  dayStates: HabitDayState[],
  referenceDate: Date = new Date(),
  referenceDayKey?: string,
  timeZone?: string,
): HabitStreakMetrics {
  const referenceDay = referenceDayKey
    ?? (timeZone ? formatDayKeyFromDate(referenceDate, timeZone) : dateToLocalDayKey(referenceDate));

  if (usesWeeklyQuotaStreak(habit, referenceDay)) {
    return calculateWeeklyMetrics(
      dayStates,
      habit,
      referenceDay,
      timeZone,
    );
  }

  return calculateOpportunityMetrics(dayStates, habit, referenceDay, timeZone);
}
