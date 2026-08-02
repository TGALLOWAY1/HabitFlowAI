import type {
  HabitInactivePeriod,
  HabitTrackingGoal,
  HabitTrackingRevision,
} from '../../shared/habitTracking';
import { isValidDayKey } from '../time/dayKey';

export interface HabitTrackingFields {
  goal: HabitTrackingGoal;
  assignedDays?: number[] | null;
  timesPerWeek?: number | null;
  requiredDaysPerWeek?: number | null;
  trackingRevisions?: HabitTrackingRevision[];
  inactivePeriods?: HabitInactivePeriod[];
}

export type ResolvedHabitTracking = Omit<HabitTrackingRevision, 'effectiveFromDayKey'>;

function optionalPositiveInteger(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function normalizeAssignedDays(days: number[] | null | undefined): number[] | undefined {
  if (!Array.isArray(days) || days.length === 0) return undefined;
  return [...new Set(days)].sort((a, b) => a - b);
}

function normalizeGoal(goal: HabitTrackingGoal): HabitTrackingGoal {
  return {
    type: goal.type,
    frequency: goal.frequency,
    ...(typeof goal.target === 'number' ? { target: goal.target } : {}),
    ...(typeof goal.unit === 'string' && goal.unit.length > 0 ? { unit: goal.unit } : {}),
  };
}

/** Capture only the fields that can change completion or scheduled opportunities. */
export function snapshotHabitTracking(habit: HabitTrackingFields): ResolvedHabitTracking {
  const assignedDays = normalizeAssignedDays(habit.assignedDays);
  const timesPerWeek = optionalPositiveInteger(habit.timesPerWeek);
  const requiredDaysPerWeek = optionalPositiveInteger(habit.requiredDaysPerWeek);
  return {
    goal: normalizeGoal(habit.goal),
    ...(assignedDays ? { assignedDays } : {}),
    ...(timesPerWeek !== undefined ? { timesPerWeek } : {}),
    ...(requiredDaysPerWeek !== undefined ? { requiredDaysPerWeek } : {}),
  };
}

function normalizeRevision(revision: HabitTrackingRevision): HabitTrackingRevision {
  return {
    effectiveFromDayKey: revision.effectiveFromDayKey,
    ...snapshotHabitTracking(revision),
  };
}

function validSortedRevisions(habit: HabitTrackingFields): HabitTrackingRevision[] {
  return (habit.trackingRevisions ?? [])
    .filter(revision => isValidDayKey(revision.effectiveFromDayKey))
    .map(normalizeRevision)
    .sort((a, b) => a.effectiveFromDayKey.localeCompare(b.effectiveFromDayKey));
}

/** Resolve the target and schedule that governed one historical DayKey. */
export function resolveHabitTrackingForDay(
  habit: HabitTrackingFields,
  dayKey?: string,
): ResolvedHabitTracking {
  if (!dayKey || !isValidDayKey(dayKey)) return snapshotHabitTracking(habit);

  const revisions = validSortedRevisions(habit);
  if (revisions.length === 0) return snapshotHabitTracking(habit);

  let selected = revisions[0];
  for (const revision of revisions) {
    if (revision.effectiveFromDayKey > dayKey) break;
    selected = revision;
  }

  const { effectiveFromDayKey: _, ...tracking } = selected;
  return tracking;
}

function trackingSignature(tracking: ResolvedHabitTracking): string {
  return JSON.stringify({
    goal: tracking.goal,
    assignedDays: tracking.assignedDays ?? null,
    timesPerWeek: tracking.timesPerWeek ?? null,
    requiredDaysPerWeek: tracking.requiredDaysPerWeek ?? null,
  });
}

export function trackingRulesEqual(
  left: HabitTrackingFields,
  right: HabitTrackingFields,
): boolean {
  return trackingSignature(snapshotHabitTracking(left)) === trackingSignature(snapshotHabitTracking(right));
}

/**
 * Add a baseline plus a new effective revision, replacing an edit made again
 * on the same DayKey. Existing HabitEntry documents are never touched.
 */
export function recordHabitTrackingRevision(
  existingHabit: HabitTrackingFields,
  updatedHabit: HabitTrackingFields,
  effectiveFromDayKey: string,
  baselineDayKey: string,
): HabitTrackingRevision[] {
  if (!isValidDayKey(effectiveFromDayKey) || !isValidDayKey(baselineDayKey)) {
    throw new Error('Tracking revisions require valid DayKeys');
  }

  const revisions = validSortedRevisions(existingHabit);
  if (revisions.length === 0) {
    revisions.push({
      effectiveFromDayKey: baselineDayKey,
      ...snapshotHabitTracking(existingHabit),
    });
  }

  const nextRevision: HabitTrackingRevision = {
    effectiveFromDayKey,
    ...snapshotHabitTracking(updatedHabit),
  };
  const withoutSameDay = revisions.filter(
    revision => revision.effectiveFromDayKey !== effectiveFromDayKey,
  );
  withoutSameDay.push(nextRevision);
  withoutSameDay.sort((a, b) => a.effectiveFromDayKey.localeCompare(b.effectiveFromDayKey));

  // A habit created and edited on the same day needs only the final rule.
  return withoutSameDay.filter((revision, index, all) => (
    index === 0
    || trackingSignature(revision) !== trackingSignature(all[index - 1])
  ));
}

export function isHabitInactiveOnDay(
  habit: Pick<HabitTrackingFields, 'inactivePeriods'>,
  dayKey: string,
): boolean {
  if (!isValidDayKey(dayKey)) return false;
  return (habit.inactivePeriods ?? []).some(period => (
    isValidDayKey(period.startDayKey)
    && period.startDayKey <= dayKey
    && (!period.endDayKey || (isValidDayKey(period.endDayKey) && dayKey <= period.endDayKey))
  ));
}
