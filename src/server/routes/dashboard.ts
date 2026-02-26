import type { Request, Response } from 'express';
import { format, startOfWeek, subDays } from 'date-fns';
import { getHabitsByUser } from '../repositories/habitRepository';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';
import { calculateHabitStreakMetrics, type HabitDayState } from '../services/streakService';

type HabitLast7Cell = {
  dayKey: string;
  completed: boolean;
  value: number;
};

function toDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getUserIdFromRequest(req: Request): string {
  const candidate = (req as Request & { userId?: unknown }).userId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'anonymous-user';
}

function parseFreezeType(note?: string): 'manual' | 'auto' | 'soft' | undefined {
  if (!note || !note.startsWith('freeze:')) return undefined;
  const raw = note.slice('freeze:'.length);
  if (raw === 'manual' || raw === 'auto' || raw === 'soft') return raw;
  return 'auto';
}

function buildLast7DayKeys(referenceDate: Date): string[] {
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dayKeys.push(toDayKey(subDays(referenceDate, i)));
  }
  return dayKeys;
}

function aggregateDayStatesByHabit(
  entries: Awaited<ReturnType<typeof getHabitEntriesByUser>>
): Map<string, Map<string, HabitDayState>> {
  const dayStatesByHabit = new Map<string, Map<string, HabitDayState>>();

  for (const entry of entries) {
    const dayKey = entry.dayKey || entry.date;
    if (!dayKey) continue;

    const habitDayMap = dayStatesByHabit.get(entry.habitId) ?? new Map<string, HabitDayState>();
    const existing = habitDayMap.get(dayKey) ?? {
      dayKey,
      value: 0,
      completed: false,
    };

    const freezeType = parseFreezeType(entry.note);
    if (freezeType) {
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

export async function getDashboardStreaks(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserIdFromRequest(req);
    const referenceDate = new Date();
    const todayDayKey = toDayKey(referenceDate);
    const weekStartDayKey = toDayKey(startOfWeek(referenceDate, { weekStartsOn: 1 }));

    const [habits, entries] = await Promise.all([
      getHabitsByUser(userId),
      getHabitEntriesByUser(userId),
    ]);

    const activeHabits = habits.filter(habit => !habit.archived);
    const dayStatesByHabit = aggregateDayStatesByHabit(entries);
    const last7DayKeys = buildLast7DayKeys(referenceDate);

    const habitSummaries = activeHabits.map(habit => {
      const habitDayMap = dayStatesByHabit.get(habit.id) ?? new Map<string, HabitDayState>();
      const dayStates = Array.from(habitDayMap.values());
      const streak = calculateHabitStreakMetrics(habit, dayStates, referenceDate);

      const last7Days: HabitLast7Cell[] = last7DayKeys.map(dayKey => {
        const state = habitDayMap.get(dayKey);
        return {
          dayKey,
          completed: Boolean(state && (state.completed || state.isFrozen)),
          value: state?.value ?? 0,
        };
      });

      return {
        habit,
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        lastCompletedDayKey: streak.lastCompletedDayKey,
        atRisk: streak.atRisk,
        completedToday: streak.completedToday,
        weekSatisfied: streak.weekSatisfied,
        weekProgress: streak.weekProgress,
        weekTarget: streak.weekTarget,
        last7Days,
      };
    });

    const topStreaks = [...habitSummaries]
      .sort((a, b) => {
        if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
        if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
        return a.habit.name.localeCompare(b.habit.name);
      })
      .slice(0, 8)
      .map(summary => ({
        habitId: summary.habit.id,
        habitName: summary.habit.name,
        categoryId: summary.habit.categoryId,
        frequency: summary.habit.goal.frequency,
        currentStreak: summary.currentStreak,
        bestStreak: summary.bestStreak,
        lastCompletedDayKey: summary.lastCompletedDayKey,
        atRisk: summary.atRisk,
      }));

    const atRiskHabits = habitSummaries
      .filter(summary => summary.atRisk)
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .map(summary => ({
        habitId: summary.habit.id,
        habitName: summary.habit.name,
        categoryId: summary.habit.categoryId,
        frequency: summary.habit.goal.frequency,
        currentStreak: summary.currentStreak,
        bestStreak: summary.bestStreak,
        lastCompletedDayKey: summary.lastCompletedDayKey,
        weekSatisfied: summary.weekSatisfied,
        weekProgress: summary.weekProgress,
        weekTarget: summary.weekTarget,
      }));

    const weeklyProgress = habitSummaries
      .filter(summary => summary.habit.goal.frequency === 'weekly')
      .map(summary => ({
        habitId: summary.habit.id,
        habitName: summary.habit.name,
        categoryId: summary.habit.categoryId,
        weekStartDayKey,
        current: summary.weekProgress ?? 0,
        target: summary.weekTarget ?? summary.habit.goal.target ?? 1,
        satisfied: Boolean(summary.weekSatisfied),
      }));

    const todayStrip = {
      todayDayKey,
      totalHabits: habitSummaries.length,
      completedToday: habitSummaries.filter(summary => summary.completedToday).length,
      atRiskCount: atRiskHabits.length,
      completedDaily: habitSummaries.filter(
        summary => summary.habit.goal.frequency !== 'weekly' && summary.completedToday
      ).length,
      completedWeekly: habitSummaries.filter(
        summary => summary.habit.goal.frequency === 'weekly' && summary.weekSatisfied
      ).length,
    };

    const heatmap = {
      dayKeys: last7DayKeys,
      habits: habitSummaries.map(summary => ({
        habitId: summary.habit.id,
        habitName: summary.habit.name,
        categoryId: summary.habit.categoryId,
        frequency: summary.habit.goal.frequency,
        cells: summary.last7Days,
      })),
    };

    res.status(200).json({
      todayDayKey,
      todayStrip,
      topStreaks,
      atRiskHabits,
      heatmap,
      weeklyProgress,
      habits: habitSummaries,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching dashboard streaks:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch dashboard streak data',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}
