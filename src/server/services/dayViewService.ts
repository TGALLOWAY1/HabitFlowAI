/**
 * Day View Service
 * 
 * Derives completion/progress for habits on a specific day from truthQuery EntryViews.
 * 
 * Completion is always derived, never stored.
 * HabitEntry (via EntryView) is the only historical truth.
 */

import { getHabitsByUser } from '../repositories/habitRepository';
import { getEntryViewsForHabits } from './truthQuery';
import type { Habit } from '../../models/persistenceTypes';
import type { EntryView } from './truthQuery';
import type { DayKey } from '../../domain/time/dayKey';
import { startOfWeek, endOfWeek, parseISO, format, isWithinInterval } from 'date-fns';

/**
 * Day View Habit Status
 * 
 * Represents the completion/progress state of a habit for a specific day.
 */
export interface DayViewHabitStatus {
  /** The habit */
  habit: Habit;

  /** Whether the habit is complete for the requested day */
  isComplete: boolean;

  /** Current progress value (for weekly habits, this is the week's progress) */
  currentValue: number;

  /** Target value (for weekly habits, this is the weekly target) */
  targetValue: number;

  /** Progress percentage (0-100) */
  progressPercent: number;

  /** For weekly habits: whether the week is complete */
  weekComplete?: boolean;

  /** For bundle parents: count of completed children */
  completedChildrenCount?: number;

  /** For bundle parents: total number of children */
  totalChildrenCount?: number;
}

/**
 * Day View Response
 * 
 * Complete day view state for a specific dayKey.
 */
export interface DayViewResponse {
  /** The requested dayKey */
  dayKey: DayKey;

  /** Array of habit statuses for this day */
  habits: DayViewHabitStatus[];

  /** Optional evidence hints (for UI hints only, never affects completion) */
  evidenceHints?: Array<{
    habitId: string;
    hasEvidence: boolean;
  }>;
}

/**
 * Get the ISO week window (Monday-Sunday) for a given dayKey.
 * 
 * @param dayKey - DayKey in YYYY-MM-DD format
 * @returns Object with startDayKey and endDayKey (both inclusive)
 */
function getWeekWindow(dayKey: DayKey): { startDayKey: DayKey; endDayKey: DayKey } {
  const date = parseISO(dayKey);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday

  return {
    startDayKey: format(weekStart, 'yyyy-MM-dd') as DayKey,
    endDayKey: format(weekEnd, 'yyyy-MM-dd') as DayKey,
  };
}

/**
 * Derive daily habit completion from EntryViews.
 * 
 * A daily habit is complete if there exists at least one EntryView
 * for the habit on the requested dayKey (and not deleted).
 * 
 * @param habitId - Habit ID
 * @param dayKey - DayKey to check
 * @param entryViews - All EntryViews for this habit
 * @returns True if complete
 */
function deriveDailyCompletion(
  habitId: string,
  dayKey: DayKey,
  entryViews: EntryView[]
): boolean {
  return entryViews.some(
    entry =>
      entry.habitId === habitId &&
      entry.dayKey === dayKey &&
      !entry.deletedAt
  );
}

/**
 * Derive weekly habit progress and completion from EntryViews.
 * 
 * @param habit - Habit configuration
 * @param weekStartDayKey - Start of week (Monday)
 * @param weekEndDayKey - End of week (Sunday)
 * @param entryViews - All EntryViews for this habit
 * @returns Object with isComplete, currentValue, targetValue
 */
function deriveWeeklyProgress(
  habit: Habit,
  weekStartDayKey: DayKey,
  weekEndDayKey: DayKey,
  entryViews: EntryView[]
): {
  isComplete: boolean;
  currentValue: number;
  targetValue: number;
} {
  // Filter entries to this week and exclude deleted
  const weekEntries = entryViews.filter(
    entry =>
      entry.habitId === habit.id &&
      entry.dayKey >= weekStartDayKey &&
      entry.dayKey <= weekEndDayKey &&
      !entry.deletedAt
  );

  const target = habit.goal.target ?? 1;

  // Determine weekly type
  const isQuantity = habit.goal.type === 'number';
  const isFrequency = !isQuantity && target > 1;
  const isBinary = !isQuantity && target === 1;

  let currentValue: number;
  let isComplete: boolean;

  if (isQuantity) {
    // Quantity weekly: sum of entry values
    currentValue = weekEntries.reduce((sum, entry) => sum + (entry.value ?? 0), 0);
    isComplete = currentValue >= target;
  } else if (isFrequency) {
    // Frequency weekly: count distinct dayKeys
    const distinctDays = new Set(weekEntries.map(e => e.dayKey)).size;
    currentValue = distinctDays;
    isComplete = distinctDays >= target;
  } else {
    // Binary weekly: any entry in week
    currentValue = weekEntries.length > 0 ? 1 : 0;
    isComplete = weekEntries.length > 0;
  }

  return {
    isComplete,
    currentValue,
    targetValue: target,
  };
}

/**
 * Derive bundle parent completion from child habits.
 * 
 * Bundle parents never have entries. Completion is derived from children.
 * 
 * @param bundleHabit - Bundle parent habit
 * @param dayKey - DayKey to check (for daily bundles)
 * @param weekStartDayKey - Start of week (for weekly bundles)
 * @param weekEndDayKey - End of week (for weekly bundles)
 * @param allHabits - All habits (to look up children)
 * @param entryViews - All EntryViews (to check child completion)
 * @returns Object with isComplete and optional child counts
 */
function deriveBundleCompletion(
  bundleHabit: Habit,
  dayKey: DayKey,
  weekStartDayKey: DayKey | null,
  weekEndDayKey: DayKey | null,
  allHabits: Habit[],
  entryViews: EntryView[]
): {
  isComplete: boolean;
  completedChildrenCount?: number;
  totalChildrenCount?: number;
} {
  if (!bundleHabit.subHabitIds || bundleHabit.subHabitIds.length === 0) {
    return {
      isComplete: false,
      completedChildrenCount: 0,
      totalChildrenCount: 0,
    };
  }

  const childHabits = bundleHabit.subHabitIds
    .map(id => allHabits.find(h => h.id === id))
    .filter((h): h is Habit => h !== undefined);

  let completedCount = 0;

  for (const childHabit of childHabits) {
    let childComplete = false;

    if (childHabit.goal.frequency === 'weekly') {
      // Weekly child: check if week is complete
      if (weekStartDayKey && weekEndDayKey) {
        const weekProgress = deriveWeeklyProgress(
          childHabit,
          weekStartDayKey,
          weekEndDayKey,
          entryViews
        );
        childComplete = weekProgress.isComplete;
      }
    } else {
      // Daily child: check if complete on dayKey
      childComplete = deriveDailyCompletion(childHabit.id, dayKey, entryViews);
    }

    if (childComplete) {
      completedCount++;
    }
  }

  // Bundle is complete if ANY child is complete
  return {
    isComplete: completedCount > 0,
    completedChildrenCount: completedCount,
    totalChildrenCount: childHabits.length,
  };
}

/**
 * Compute day view for a specific dayKey.
 * 
 * @param userId - User ID
 * @param dayKey - DayKey to view (YYYY-MM-DD)
 * @param timeZone - User's timezone
 * @returns DayViewResponse
 */
export async function computeDayView(
  userId: string,
  dayKey: DayKey,
  timeZone: string
): Promise<DayViewResponse> {
  // Fetch all active habits for the user
  const allHabits = await getHabitsByUser(userId);
  const activeHabits = allHabits.filter(h => !h.archived);

  // Get week window for weekly habits
  const weekWindow = getWeekWindow(dayKey);

  // Collect all habit IDs (including bundle children)
  const allHabitIds = new Set<string>();
  for (const habit of activeHabits) {
    allHabitIds.add(habit.id);
    if (habit.subHabitIds) {
      habit.subHabitIds.forEach(id => allHabitIds.add(id));
    }
  }

  // Fetch all EntryViews for all habits via truthQuery
  // Fetch a wider range to cover weekly habits (entire week)
  const allEntryViews = await getEntryViewsForHabits(Array.from(allHabitIds), userId, {
    startDayKey: weekWindow.startDayKey,
    endDayKey: weekWindow.endDayKey,
    timeZone,
  });

  // Build habit statuses
  const habitStatuses: DayViewHabitStatus[] = [];

  for (const habit of activeHabits) {
    // Filter entries for this habit
    const habitEntries = allEntryViews.filter(e => e.habitId === habit.id);

    let status: DayViewHabitStatus;

    if (habit.type === 'bundle') {
      // Bundle parent: derive from children
      const bundleStatus = deriveBundleCompletion(
        habit,
        dayKey,
        weekWindow.startDayKey,
        weekWindow.endDayKey,
        allHabits,
        allEntryViews
      );

      status = {
        habit,
        isComplete: bundleStatus.isComplete,
        currentValue: bundleStatus.completedChildrenCount ?? 0,
        targetValue: bundleStatus.totalChildrenCount ?? 0,
        progressPercent:
          bundleStatus.totalChildrenCount && bundleStatus.totalChildrenCount > 0
            ? Math.min(100, Math.round(((bundleStatus.completedChildrenCount ?? 0) / bundleStatus.totalChildrenCount) * 100))
            : 0,
        completedChildrenCount: bundleStatus.completedChildrenCount,
        totalChildrenCount: bundleStatus.totalChildrenCount,
      };
    } else if (habit.goal.frequency === 'weekly') {
      // Weekly habit: derive week progress
      const weekProgress = deriveWeeklyProgress(
        habit,
        weekWindow.startDayKey,
        weekWindow.endDayKey,
        habitEntries
      );

      status = {
        habit,
        isComplete: weekProgress.isComplete,
        currentValue: weekProgress.currentValue,
        targetValue: weekProgress.targetValue,
        progressPercent:
          weekProgress.targetValue > 0
            ? Math.min(100, Math.round((weekProgress.currentValue / weekProgress.targetValue) * 100))
            : 0,
        weekComplete: weekProgress.isComplete,
      };
    } else {
      // Daily habit: derive daily completion
      const isComplete = deriveDailyCompletion(habit.id, dayKey, habitEntries);

      status = {
        habit,
        isComplete,
        currentValue: isComplete ? 1 : 0,
        targetValue: 1,
        progressPercent: isComplete ? 100 : 0,
      };
    }

    habitStatuses.push(status);
  }

  return {
    dayKey,
    habits: habitStatuses,
  };
}

