import {
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Category, Habit, HabitEntry } from '../../models/persistenceTypes';
import { formatDayKeyFromDate } from '../../domain/time/dayKey';
import type {
  DashboardCadenceFilter,
  MainDashboardQuery,
  MainDashboardResponse,
} from '../../types/mainDashboard';

interface WeekWindow {
  startDayKey: string;
  endDayKey: string;
}

interface HabitMonthlyStats {
  completed: number;
  goal: number;
  percent: number;
}

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertValidMonthKey(month: string): void {
  if (!MONTH_KEY_REGEX.test(month)) {
    throw new Error('month must be in YYYY-MM format');
  }
}

function deriveHabitCadence(habit: Habit): 'daily' | 'weekly' {
  if (habit.goal.frequency === 'weekly' || habit.frequency === 'weekly') {
    return 'weekly';
  }
  return 'daily';
}

function getWeekTarget(habit: Habit): number {
  const target = habit.goal.target ?? habit.weeklyTarget ?? 1;
  if (!Number.isFinite(target) || target <= 0) return 1;
  return target;
}

function toPercent(completed: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.round((completed / goal) * 10000) / 100;
}

function buildEntryIndex(entries: HabitEntry[]): Map<string, Map<string, HabitEntry[]>> {
  const index = new Map<string, Map<string, HabitEntry[]>>();

  for (const entry of entries) {
    const dayKey = entry.dayKey || entry.date;
    if (!dayKey) continue;

    let habitDays = index.get(entry.habitId);
    if (!habitDays) {
      habitDays = new Map<string, HabitEntry[]>();
      index.set(entry.habitId, habitDays);
    }

    const dayEntries = habitDays.get(dayKey) || [];
    dayEntries.push(entry);
    habitDays.set(dayKey, dayEntries);
  }

  return index;
}

function getEntriesForDay(
  entryIndex: Map<string, Map<string, HabitEntry[]>>,
  habitId: string,
  dayKey: string,
): HabitEntry[] {
  return entryIndex.get(habitId)?.get(dayKey) || [];
}

function getEntriesInRange(
  entryIndex: Map<string, Map<string, HabitEntry[]>>,
  habitId: string,
  startDayKey: string,
  endDayKey: string,
): HabitEntry[] {
  const dayMap = entryIndex.get(habitId);
  if (!dayMap) return [];

  const results: HabitEntry[] = [];
  for (const [dayKey, entries] of dayMap.entries()) {
    if (dayKey >= startDayKey && dayKey <= endDayKey) {
      results.push(...entries);
    }
  }

  return results;
}

function isDailyComplete(habit: Habit, entries: HabitEntry[]): boolean {
  if (entries.length === 0) return false;

  if (habit.goal.type === 'number') {
    const target = habit.goal.target ?? 1;
    const total = entries.reduce((sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
    return total >= target;
  }

  return true;
}

function hasDayActivity(entries: HabitEntry[]): boolean {
  return entries.length > 0;
}

function isWeeklyComplete(
  habit: Habit,
  entriesInWindow: HabitEntry[],
): boolean {
  const target = getWeekTarget(habit);

  if (habit.goal.type === 'number') {
    const total = entriesInWindow.reduce(
      (sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0),
      0,
    );
    return total >= target;
  }

  const distinctDays = new Set(entriesInWindow.map(entry => entry.dayKey || entry.date).filter(Boolean)).size;
  return distinctDays >= target;
}

function getDayKeysInMonth(month: string): {
  monthStart: Date;
  monthEnd: Date;
  dayKeys: string[];
} {
  const monthStart = startOfMonth(parse(`${month}-01`, 'yyyy-MM-dd', new Date()));
  const monthEnd = endOfMonth(monthStart);
  const dayKeys = eachDayOfInterval({ start: monthStart, end: monthEnd }).map(d => format(d, 'yyyy-MM-dd'));

  return { monthStart, monthEnd, dayKeys };
}

function getWeekWindowsOverlappingMonth(monthStart: Date, monthEnd: Date): WeekWindow[] {
  const windows: WeekWindow[] = [];
  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 });

  while (cursor <= monthEnd) {
    const weekStart = cursor;
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    windows.push({
      startDayKey: format(weekStart, 'yyyy-MM-dd'),
      endDayKey: format(weekEnd, 'yyyy-MM-dd'),
    });
    cursor = addWeeks(cursor, 1);
  }

  return windows;
}

function getSelectedHabits(
  habits: Habit[],
  categoryId: string | undefined,
  cadenceFilter: DashboardCadenceFilter,
  includeWeekly: boolean,
): Habit[] {
  return habits
    .filter(habit => !habit.archived)
    .filter(habit => habit.type !== 'bundle')
    .filter(habit => (categoryId ? habit.categoryId === categoryId : true))
    .filter(habit => {
      const cadence = deriveHabitCadence(habit);

      if (cadenceFilter === 'daily') return cadence === 'daily';
      if (cadenceFilter === 'weekly') return cadence === 'weekly';

      if (!includeWeekly && cadence === 'weekly') return false;
      return true;
    })
    .sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
}

function clampDayKey(dayKey: string, startDayKey: string, endDayKey: string): string {
  if (dayKey < startDayKey) return startDayKey;
  if (dayKey > endDayKey) return endDayKey;
  return dayKey;
}

function getDayKeysBetween(startDayKey: string, endDayKey: string): string[] {
  const start = parseISO(startDayKey);
  const end = parseISO(endDayKey);
  return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
}

export function buildMainDashboardReadModel(params: {
  habits: Habit[];
  categories: Category[];
  entries: HabitEntry[];
  query: MainDashboardQuery;
  now?: Date;
}): MainDashboardResponse {
  const { habits, categories, entries, query } = params;

  assertValidMonthKey(query.month);

  const now = params.now || new Date();
  const { monthStart, monthEnd, dayKeys } = getDayKeysInMonth(query.month);
  const startDayKey = dayKeys[0];
  const endDayKey = dayKeys[dayKeys.length - 1];
  const monthWeeks = getWeekWindowsOverlappingMonth(monthStart, monthEnd);

  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const selectedHabits = getSelectedHabits(
    habits,
    query.categoryId,
    query.cadence,
    query.includeWeekly,
  );

  const entryIndex = buildEntryIndex(entries);

  const habitMonthlyStats = new Map<string, HabitMonthlyStats>();

  for (const habit of selectedHabits) {
    const cadence = deriveHabitCadence(habit);

    if (cadence === 'daily') {
      const completed = dayKeys.reduce((sum, dayKey) => {
        const complete = isDailyComplete(habit, getEntriesForDay(entryIndex, habit.id, dayKey));
        return sum + (complete ? 1 : 0);
      }, 0);

      const goal = dayKeys.length;
      habitMonthlyStats.set(habit.id, {
        completed,
        goal,
        percent: toPercent(completed, goal),
      });
      continue;
    }

    const completed = monthWeeks.reduce((sum, week) => {
      const weekEntries = getEntriesInRange(entryIndex, habit.id, week.startDayKey, week.endDayKey);
      const complete = isWeeklyComplete(habit, weekEntries);
      return sum + (complete ? 1 : 0);
    }, 0);

    const goal = monthWeeks.length;
    habitMonthlyStats.set(habit.id, {
      completed,
      goal,
      percent: toPercent(completed, goal),
    });
  }

  const dailyCounts: Record<string, number> = {};
  const dailyPercent: Record<string, number> = {};

  for (const dayKey of dayKeys) {
    let completedCount = 0;

    for (const habit of selectedHabits) {
      const cadence = deriveHabitCadence(habit);
      const dayEntries = getEntriesForDay(entryIndex, habit.id, dayKey);

      const dayComplete = cadence === 'daily'
        ? isDailyComplete(habit, dayEntries)
        : hasDayActivity(dayEntries);

      if (dayComplete) completedCount += 1;
    }

    const goal = selectedHabits.length;
    dailyCounts[dayKey] = completedCount;
    dailyPercent[dayKey] = toPercent(completedCount, goal);
  }

  let monthlyCompleted = 0;
  let monthlyGoal = 0;

  for (const habit of selectedHabits) {
    const stats = habitMonthlyStats.get(habit.id);
    if (!stats) continue;
    monthlyCompleted += stats.completed;
    monthlyGoal += stats.goal;
  }

  const todayDayKey = formatDayKeyFromDate(now, query.timeZone);
  const referenceDayKey = clampDayKey(todayDayKey, startDayKey, endDayKey);

  const referenceDate = parseISO(referenceDayKey);
  const weekStartDayKey = format(startOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEndDayKey = format(endOfWeek(referenceDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekToDateDayKeys = getDayKeysBetween(weekStartDayKey, referenceDayKey);

  let weeklyCompleted = 0;
  let weeklyGoal = 0;

  for (const habit of selectedHabits) {
    const cadence = deriveHabitCadence(habit);

    if (cadence === 'daily') {
      const completeCount = weekToDateDayKeys.reduce((sum, dayKey) => {
        const complete = isDailyComplete(habit, getEntriesForDay(entryIndex, habit.id, dayKey));
        return sum + (complete ? 1 : 0);
      }, 0);

      weeklyCompleted += completeCount;
      weeklyGoal += weekToDateDayKeys.length;
      continue;
    }

    const weekEntries = getEntriesInRange(entryIndex, habit.id, weekStartDayKey, referenceDayKey);
    const complete = isWeeklyComplete(habit, weekEntries);
    weeklyCompleted += complete ? 1 : 0;
    weeklyGoal += 1;
  }

  const heatmapHabits = selectedHabits.map(habit => {
    const cadence = deriveHabitCadence(habit);
    const stats = habitMonthlyStats.get(habit.id) || { completed: 0, goal: 0, percent: 0 };
    const category = categoryMap.get(habit.categoryId);

    const dayCompletion: Record<string, boolean> = {};
    for (const dayKey of dayKeys) {
      const dayEntries = getEntriesForDay(entryIndex, habit.id, dayKey);
      dayCompletion[dayKey] = cadence === 'daily'
        ? isDailyComplete(habit, dayEntries)
        : hasDayActivity(dayEntries);
    }

    return {
      habitId: habit.id,
      habitName: habit.name,
      categoryId: habit.categoryId,
      categoryName: category?.name || 'Uncategorized',
      cadence,
      dayCompletion,
      monthlyCompleted: stats.completed,
      monthlyGoal: stats.goal,
      monthlyPercent: stats.percent,
    };
  });

  const categoryRollupMap = new Map<string, { completed: number; goal: number }>();

  for (const habit of selectedHabits) {
    const stats = habitMonthlyStats.get(habit.id);
    if (!stats) continue;

    const row = categoryRollupMap.get(habit.categoryId) || { completed: 0, goal: 0 };
    row.completed += stats.completed;
    row.goal += stats.goal;
    categoryRollupMap.set(habit.categoryId, row);
  }

  const categoryRollup = Array.from(categoryRollupMap.entries())
    .map(([categoryId, totals]) => {
      const category = categoryMap.get(categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Uncategorized',
        color: category?.color,
        completed: totals.completed,
        goal: totals.goal,
        percent: toPercent(totals.completed, totals.goal),
      };
    })
    .sort((a, b) => b.percent - a.percent || a.categoryName.localeCompare(b.categoryName));

  const categoryOptions = categories
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(category => ({
      id: category.id,
      name: category.name,
      color: category.color,
    }));

  return {
    month: query.month,
    startDayKey,
    endDayKey,
    days: dayKeys,
    dailyCounts,
    dailyPercent,
    monthlySummary: {
      completed: monthlyCompleted,
      goal: monthlyGoal,
      percent: toPercent(monthlyCompleted, monthlyGoal),
    },
    weeklySummary: {
      startDayKey: weekStartDayKey,
      endDayKey: weekEndDayKey,
      referenceDayKey,
      completed: weeklyCompleted,
      goal: weeklyGoal,
      percent: toPercent(weeklyCompleted, weeklyGoal),
    },
    heatmap: {
      habits: heatmapHabits,
    },
    categoryRollup,
    categoryOptions,
    filters: {
      categoryId: query.categoryId,
      cadence: query.cadence,
      includeWeekly: query.includeWeekly,
      timeZone: query.timeZone,
    },
  };
}
