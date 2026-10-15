/**
 * Daily Check-in — pure derivation helpers.
 *
 * Completion is never stored on a check-in: "done" is derived from habit
 * entries (the same day-level rule the heatmaps use). A check-in only adds the
 * states entries cannot express (partial for boolean habits, skipped) plus
 * reflections (mood, tags, effort, journal).
 */

import type { Category, DayLog, Habit } from '../../types';
import type { HabitCheckIn, HabitCheckInCompletionStatus } from '../../models/persistenceTypes';
import { DAILY_CHECK_IN_STEP_COUNT, type DailyCheckInMoodTag } from '../../shared/dailyCheckIn';
import { deriveDailyHabitCompletion } from '../../domain/habits/completion';
import { resolveHabitTrackingForDay } from '../../domain/habits/trackingHistory';
import { getEffectiveCategoryId, getHabitsForDate, isHabitCompleteOnDay } from '../../utils/habitUtils';

export type CheckInCompletionStatus = 'done' | HabitCheckInCompletionStatus;

export type CheckInHabitKind = 'boolean' | 'numeric' | 'checklist' | 'choice';

export interface CheckInHabitTruth {
    kind: CheckInHabitKind;
    /** Derived from entries for this calendar day. */
    isComplete: boolean;
    /** Below-target numeric value, or some (not enough) checklist items done. */
    hasProgress: boolean;
    /** Numeric: today's value. Bundles: completed child count. */
    currentValue: number;
    /** Numeric: target. Bundles: child count. */
    targetValue: number;
    unit?: string;
}

export function getCheckInHabitKind(habit: Habit, dayKey: string): CheckInHabitKind {
    if (habit.type === 'bundle' && habit.subHabitIds && habit.subHabitIds.length > 0) {
        return habit.bundleType === 'choice' ? 'choice' : 'checklist';
    }
    return resolveHabitTrackingForDay(habit, dayKey).goal.type === 'number' ? 'numeric' : 'boolean';
}

export function getCheckInHabitTruth(habit: Habit, logs: Record<string, DayLog>, dayKey: string): CheckInHabitTruth {
    const kind = getCheckInHabitKind(habit, dayKey);
    const isComplete = isHabitCompleteOnDay(habit, logs, dayKey);

    if (kind === 'checklist' || kind === 'choice') {
        const childIds = habit.subHabitIds ?? [];
        const completedChildren = childIds.filter(id => logs[`${id}-${dayKey}`]?.completed).length;
        return {
            kind,
            isComplete,
            hasProgress: kind === 'checklist' && !isComplete && completedChildren > 0,
            currentValue: completedChildren,
            targetValue: childIds.length,
        };
    }

    const log = logs[`${habit.id}-${dayKey}`];
    const entries = log && !log.isFrozen ? [{ value: log.value }] : [];
    const completion = deriveDailyHabitCompletion(habit, entries, dayKey);
    return {
        kind,
        isComplete,
        hasProgress: kind === 'numeric' && !isComplete && completion.hasProgress,
        currentValue: completion.currentValue,
        targetValue: completion.targetValue,
        unit: resolveHabitTrackingForDay(habit, dayKey).goal.unit,
    };
}

/**
 * Status shown for a habit in the check-in. Entries win: a habit that is
 * complete is always "done", whatever was declared earlier. Otherwise the
 * declared partial/skipped applies, then natural partial progress.
 */
export function resolveCheckInStatus(
    truth: Pick<CheckInHabitTruth, 'isComplete' | 'hasProgress'>,
    declared: HabitCheckInCompletionStatus | null | undefined,
): CheckInCompletionStatus | null {
    if (truth.isComplete) return 'done';
    if (declared) return declared;
    if (truth.hasProgress) return 'partial';
    return null;
}

/** Done and partial habits get mood/effort reflection; skipped or unmarked ones do not. */
export function needsReflection(status: CheckInCompletionStatus | null): boolean {
    return status === 'done' || status === 'partial';
}

/**
 * Today's habits for the check-in: the same scheduled set the Today view and
 * dashboard ring use, ordered by category order then habit order.
 */
export function getCheckInHabits(habits: Habit[], categories: Category[], dayKey: string): Habit[] {
    const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
    const habitById = new Map(habits.map(habit => [habit.id, habit]));
    const categoryRank = (habit: Habit) =>
        categoryOrder.get(getEffectiveCategoryId(habit, habitById)) ?? Number.MAX_SAFE_INTEGER;
    const habitRank = (habit: Habit) => habit.order ?? Number.MAX_SAFE_INTEGER;

    return [...getHabitsForDate(habits, dayKey)].sort((a, b) =>
        categoryRank(a) - categoryRank(b) || habitRank(a) - habitRank(b)
    );
}

// ─── Step navigation ───────────────────────────────────────────────────────

export const CHECK_IN_FIRST_STEP = 1;
export const CHECK_IN_LAST_STEP = DAILY_CHECK_IN_STEP_COUNT;

/** Parse a step from a URL param, falling back to the intro page. */
export function parseCheckInStep(raw: string | null | undefined): number {
    const step = Number(raw);
    return Number.isInteger(step) && step >= CHECK_IN_FIRST_STEP && step <= CHECK_IN_LAST_STEP
        ? step
        : CHECK_IN_FIRST_STEP;
}

/** With nothing to reflect on, the mood and effort pages are skipped. */
export function getNextStep(step: number, reflectCount: number): number {
    if (step === 2 && reflectCount === 0) return CHECK_IN_LAST_STEP;
    return Math.min(step + 1, CHECK_IN_LAST_STEP);
}

export function getPreviousStep(step: number, reflectCount: number): number {
    if (step === CHECK_IN_LAST_STEP && reflectCount === 0) return 2;
    return Math.max(step - 1, CHECK_IN_FIRST_STEP);
}

// Rough per-page cost in seconds; tuned so 4 habits ≈ 2 minutes overall.
const INTRO_SECONDS = 10;
const STATUS_SECONDS_PER_HABIT = 5;
const MOOD_SECONDS_PER_HABIT = 10;
const EFFORT_SECONDS_PER_HABIT = 5;
const WRAP_UP_SECONDS = 30;

/** Estimated minutes left from the start of `step` (always at least 1). */
export function estimateRemainingMinutes(step: number, habitCount: number, reflectCount: number): number {
    const perStep = [
        INTRO_SECONDS,
        habitCount * STATUS_SECONDS_PER_HABIT,
        reflectCount * MOOD_SECONDS_PER_HABIT,
        reflectCount * EFFORT_SECONDS_PER_HABIT,
        WRAP_UP_SECONDS,
    ];
    const seconds = perStep.slice(Math.max(step, CHECK_IN_FIRST_STEP) - 1).reduce((sum, s) => sum + s, 0);
    return Math.max(1, Math.ceil(seconds / 60));
}

// ─── Scales & tags ─────────────────────────────────────────────────────────

export interface ScaleOption {
    score: number;
    label: string;
}

export const MOOD_OPTIONS: ReadonlyArray<ScaleOption & { emoji: string; summary: string }> = [
    { score: 1, emoji: '😖', label: 'Really tough', summary: 'It was a tough one.' },
    { score: 2, emoji: '😞', label: 'Difficult', summary: 'It felt difficult today.' },
    { score: 3, emoji: '😐', label: 'Neutral', summary: 'You felt steady today.' },
    { score: 4, emoji: '🙂', label: 'Good', summary: 'You felt good today.' },
    { score: 5, emoji: '😍', label: 'Felt great', summary: 'You felt great today!' },
];

export const EFFORT_OPTIONS: ReadonlyArray<ScaleOption & { hint: string }> = [
    { score: 1, label: 'Very easy', hint: 'Barely noticed it' },
    { score: 2, label: 'Easy', hint: 'A light lift' },
    { score: 3, label: 'Moderate', hint: 'Took some push' },
    { score: 4, label: 'Hard', hint: 'Real effort today' },
    { score: 5, label: 'Very hard', hint: 'You showed up anyway' },
];

export const MOOD_TAG_LABELS: Record<DailyCheckInMoodTag, string> = {
    calm: 'Calm',
    energized: 'Energized',
    focused: 'Focused',
    distracted: 'Distracted',
    proud: 'Proud',
    tired: 'Tired',
};

export function getMoodOption(score: number | null | undefined) {
    return MOOD_OPTIONS.find(option => option.score === score);
}

export function getEffortOption(score: number | null | undefined) {
    return EFFORT_OPTIONS.find(option => option.score === score);
}

// ─── Summary ───────────────────────────────────────────────────────────────

export interface CheckInSummaryRow {
    status: CheckInCompletionStatus | null;
    reflection?: HabitCheckIn;
}

export interface CheckInSummary {
    total: number;
    done: number;
    partial: number;
    skipped: number;
    unmarked: number;
    /** Average mood across reflected (done/partial) habits; null if none rated. */
    averageMood: number | null;
    /** Average effort across reflected (done/partial) habits; null if none rated. */
    averageEffort: number | null;
    journalCount: number;
}

function average(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

export function buildCheckInSummary(rows: CheckInSummaryRow[]): CheckInSummary {
    const count = (status: CheckInCompletionStatus | null) => rows.filter(row => row.status === status).length;
    // Mood/effort only count where they are collected; a rating left on a habit
    // later switched to skipped is kept (non-destructive) but not summarized.
    const reflected = rows.filter(row => needsReflection(row.status));
    return {
        total: rows.length,
        done: count('done'),
        partial: count('partial'),
        skipped: count('skipped'),
        unmarked: count(null),
        averageMood: average(reflected.flatMap(row => row.reflection?.moodScore ?? [])),
        averageEffort: average(reflected.flatMap(row => row.reflection?.effortScore ?? [])),
        journalCount: rows.filter(row => row.reflection?.journalEntry).length,
    };
}

export function getCompletionHeadline(summary: Pick<CheckInSummary, 'done' | 'total'>): string {
    if (summary.total > 0 && summary.done === summary.total) return 'Great consistency today!';
    if (summary.done > 0 && summary.done * 2 >= summary.total) return 'Solid progress — every rep counts.';
    if (summary.done > 0) return 'Progress counts. Tomorrow is a fresh start.';
    return 'Showing up to reflect is a win.';
}
