export interface HabitTrackingGoal {
  type: 'boolean' | 'number';
  target?: number;
  unit?: string;
  frequency: 'daily' | 'total';
}

/**
 * Tracking rules that became effective on one local calendar day.
 *
 * Revisions live on the habit document. They preserve how existing entries
 * were interpreted without copying or rewriting HabitEntry history.
 */
export interface HabitTrackingRevision {
  effectiveFromDayKey: string;
  goal: HabitTrackingGoal;
  assignedDays?: number[];
  timesPerWeek?: number;
  requiredDaysPerWeek?: number;
}

/** Inclusive local-day interval during which a restored habit was inactive. */
export interface HabitInactivePeriod {
  startDayKey: string;
  endDayKey?: string;
}
