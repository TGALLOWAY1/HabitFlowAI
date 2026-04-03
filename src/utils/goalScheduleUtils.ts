import { addWeeks, format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { GoalWithProgress } from '../models/persistenceTypes';
import type { GoalBreakdownItem } from '../lib/analyticsClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScheduleEventType = 'milestone' | 'target' | 'forecast' | 'completed';

export type GoalScheduleStatus = 'on-track' | 'at-risk' | 'behind' | 'insufficient-data';

export interface ScheduleEvent {
  goalId: string;
  goalTitle: string;
  eventType: ScheduleEventType;
  date: string; // YYYY-MM-DD
  label: string;
  categoryId?: string;
  status: GoalScheduleStatus;
  trendExplanation?: string;
  progressPercent: number;
  isDerived: true;
}

// ─── Status Mapping ─────────────────────────────────────────────────────────

function mapStatus(analyticsStatus: GoalBreakdownItem['status']): GoalScheduleStatus {
  switch (analyticsStatus) {
    case 'On Track': return 'on-track';
    case 'At Risk': return 'at-risk';
    case 'Behind': return 'behind';
    case 'Completed': return 'on-track';
    default: return 'insufficient-data';
  }
}

// ─── Milestone Date Computation ─────────────────────────────────────────────

/**
 * Compute the projected date for reaching a milestone percentage,
 * based on the goal's creation date and current pace.
 * Returns null if pace is zero or data is insufficient.
 */
function computeMilestoneDate(
  milestonePercent: number,
  targetValue: number,
  currentValue: number,
  createdAt: string,
  currentPacePerWeek: number,
  referenceDate: Date,
): string | null {
  if (currentPacePerWeek <= 0 || targetValue <= 0) return null;

  const milestoneValue = (milestonePercent / 100) * targetValue;

  // If already past this milestone, compute when it was reached
  if (currentValue >= milestoneValue) {
    const weeksToMilestone = milestoneValue / currentPacePerWeek;
    const milestoneDate = addWeeks(parseISO(createdAt), weeksToMilestone);
    return format(milestoneDate, 'yyyy-MM-dd');
  }

  // Future milestone: weeks from now to reach it
  const remainingToMilestone = milestoneValue - currentValue;
  const weeksFromNow = remainingToMilestone / currentPacePerWeek;
  const milestoneDate = addWeeks(referenceDate, weeksFromNow);
  return format(milestoneDate, 'yyyy-MM-dd');
}

// ─── Event Derivation ───────────────────────────────────────────────────────

const MILESTONE_PERCENTS = [25, 50, 75];

export function deriveScheduleEvents(
  goalsWithProgress: GoalWithProgress[],
  analytics: GoalBreakdownItem[],
  referenceDate: Date = new Date(),
): ScheduleEvent[] {
  const analyticsMap = new Map<string, GoalBreakdownItem>();
  for (const item of analytics) {
    analyticsMap.set(item.goalId, item);
  }

  const events: ScheduleEvent[] = [];

  for (const { goal, progress } of goalsWithProgress) {
    const analytic = analyticsMap.get(goal.id);
    const status = analytic ? mapStatus(analytic.status) : 'insufficient-data';
    const progressPercent = progress.percent;

    // 1. Target date (deadline)
    if (goal.deadline) {
      events.push({
        goalId: goal.id,
        goalTitle: goal.title,
        eventType: 'target',
        date: goal.deadline,
        label: 'Target deadline',
        categoryId: goal.categoryId,
        status,
        progressPercent,
        isDerived: true,
      });
    }

    // 2. Completed date
    if (goal.completedAt) {
      const completedDate = format(parseISO(goal.completedAt), 'yyyy-MM-dd');
      events.push({
        goalId: goal.id,
        goalTitle: goal.title,
        eventType: 'completed',
        date: completedDate,
        label: 'Completed',
        categoryId: goal.categoryId,
        status: 'on-track',
        progressPercent: 100,
        isDerived: true,
      });
    }

    // 3. Forecasted completion date
    if (
      !goal.completedAt &&
      goal.type === 'cumulative' &&
      analytic?.estimatedCompletionWeeks != null &&
      analytic.estimatedCompletionWeeks > 0
    ) {
      const forecastDate = addWeeks(referenceDate, analytic.estimatedCompletionWeeks);
      events.push({
        goalId: goal.id,
        goalTitle: goal.title,
        eventType: 'forecast',
        date: format(forecastDate, 'yyyy-MM-dd'),
        label: 'Forecasted completion',
        categoryId: goal.categoryId,
        status,
        trendExplanation: 'At current pace',
        progressPercent,
        isDerived: true,
      });
    }

    // 4. Milestones (only for cumulative goals with pace data)
    if (
      goal.type === 'cumulative' &&
      goal.targetValue &&
      goal.targetValue > 0 &&
      analytic?.currentPacePerWeek != null &&
      analytic.currentPacePerWeek > 0
    ) {
      for (const pct of MILESTONE_PERCENTS) {
        // Skip milestones already passed in the past (before today)
        const milestoneDate = computeMilestoneDate(
          pct,
          goal.targetValue,
          analytic.currentValue,
          goal.createdAt,
          analytic.currentPacePerWeek,
          referenceDate,
        );
        if (!milestoneDate) continue;

        // Only include milestones within a reasonable range (past 90 days to future 365 days)
        const daysFromNow = differenceInCalendarDays(parseISO(milestoneDate), referenceDate);
        if (daysFromNow < -90 || daysFromNow > 365) continue;

        events.push({
          goalId: goal.id,
          goalTitle: goal.title,
          eventType: 'milestone',
          date: milestoneDate,
          label: `${pct}% milestone`,
          categoryId: goal.categoryId,
          status,
          trendExplanation: pct * goal.targetValue / 100 <= analytic.currentValue
            ? undefined
            : 'Based on recent progress',
          progressPercent,
          isDerived: true,
        });
      }
    }
  }

  return events;
}

// ─── Grouping & Filtering ───────────────────────────────────────────────────

export function groupEventsByDate(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>();
  for (const event of events) {
    const existing = map.get(event.date);
    if (existing) {
      existing.push(event);
    } else {
      map.set(event.date, [event]);
    }
  }
  return map;
}

export function filterEventsByCategory(
  events: ScheduleEvent[],
  categoryIds: string[],
): ScheduleEvent[] {
  if (categoryIds.length === 0) return events;
  const idSet = new Set(categoryIds);
  return events.filter(e => e.categoryId && idSet.has(e.categoryId));
}

export function filterEventsByGoal(
  events: ScheduleEvent[],
  goalId: string,
): ScheduleEvent[] {
  return events.filter(e => e.goalId === goalId);
}

// ─── Event Type Ordering (for display) ──────────────────────────────────────

const EVENT_TYPE_ORDER: Record<ScheduleEventType, number> = {
  completed: 0,
  target: 1,
  forecast: 2,
  milestone: 3,
};

export function sortEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    // Sort by date first, then by event type
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return EVENT_TYPE_ORDER[a.eventType] - EVENT_TYPE_ORDER[b.eventType];
  });
}

// ─── Calendar Helpers ───────────────────────────────────────────────────────

export function getEventTypeColor(eventType: ScheduleEventType): string {
  switch (eventType) {
    case 'target': return 'bg-blue-500';
    case 'completed': return 'bg-emerald-500';
    case 'forecast': return 'bg-amber-500';
    case 'milestone': return 'bg-purple-500';
  }
}

export function getEventTypeLabel(eventType: ScheduleEventType): string {
  switch (eventType) {
    case 'target': return 'Deadline';
    case 'completed': return 'Completed';
    case 'forecast': return 'Forecast';
    case 'milestone': return 'Milestone';
  }
}

export function getStatusColor(status: GoalScheduleStatus): string {
  switch (status) {
    case 'on-track': return 'text-emerald-400';
    case 'at-risk': return 'text-amber-400';
    case 'behind': return 'text-red-400';
    case 'insufficient-data': return 'text-neutral-500';
  }
}

export function getStatusLabel(status: GoalScheduleStatus): string {
  switch (status) {
    case 'on-track': return 'On track';
    case 'at-risk': return 'At risk';
    case 'behind': return 'Behind';
    case 'insufficient-data': return 'Insufficient data';
  }
}
