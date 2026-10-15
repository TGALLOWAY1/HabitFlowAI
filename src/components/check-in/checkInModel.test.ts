import { describe, expect, it } from 'vitest';
import type { Category, DayLog, Habit } from '../../types';
import {
    buildCheckInSummary,
    estimateRemainingMinutes,
    getCheckInHabits,
    getCheckInHabitTruth,
    getCompletionHeadline,
    getNextStep,
    getPreviousStep,
    parseCheckInStep,
    resolveCheckInStatus,
} from './checkInModel';

const DAY = '2026-10-12'; // a Monday

function habit(overrides: Partial<Habit> & Pick<Habit, 'id'>): Habit {
    return {
        categoryId: 'cat-a',
        name: overrides.id,
        goal: { type: 'boolean', frequency: 'daily' },
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

function log(habitId: string, value: number, extra: Partial<DayLog> = {}): Record<string, DayLog> {
    return { [`${habitId}-${DAY}`]: { habitId, date: DAY, value, completed: true, ...extra } };
}

const protein = habit({ id: 'protein', goal: { type: 'number', frequency: 'daily', target: 140, unit: 'g' } });

describe('getCheckInHabitTruth', () => {
    it('derives boolean completion from the day log', () => {
        const sunlight = habit({ id: 'sunlight' });
        expect(getCheckInHabitTruth(sunlight, {}, DAY)).toMatchObject({ kind: 'boolean', isComplete: false, hasProgress: false });
        expect(getCheckInHabitTruth(sunlight, log('sunlight', 1), DAY)).toMatchObject({ isComplete: true });
    });

    it('treats a below-target numeric value as partial progress, not completion', () => {
        const truth = getCheckInHabitTruth(protein, log('protein', 90, { completed: false }), DAY);
        expect(truth).toMatchObject({ kind: 'numeric', isComplete: false, hasProgress: true, currentValue: 90, targetValue: 140, unit: 'g' });
        expect(getCheckInHabitTruth(protein, log('protein', 150), DAY).isComplete).toBe(true);
    });

    it('never counts a freeze marker as completion', () => {
        const sunlight = habit({ id: 'sunlight' });
        expect(getCheckInHabitTruth(sunlight, log('sunlight', 1, { isFrozen: true }), DAY).isComplete).toBe(false);
    });

    it('derives checklist progress from children against the success rule', () => {
        const chores = habit({ id: 'chores', type: 'bundle', bundleType: 'checklist', subHabitIds: ['trash', 'dishes'] });
        const truth = getCheckInHabitTruth(chores, log('trash', 1), DAY);
        expect(truth).toMatchObject({ kind: 'checklist', isComplete: false, hasProgress: true, currentValue: 1, targetValue: 2 });
    });

    it('completes a choice bundle when any option is done', () => {
        const move = habit({ id: 'move', type: 'bundle', bundleType: 'choice', subHabitIds: ['run', 'swim'] });
        expect(getCheckInHabitTruth(move, log('swim', 1), DAY)).toMatchObject({ kind: 'choice', isComplete: true });
    });
});

describe('resolveCheckInStatus', () => {
    it('lets entries win: a completed habit is done even if skipped was declared earlier', () => {
        expect(resolveCheckInStatus({ isComplete: true, hasProgress: false }, 'skipped')).toBe('done');
    });

    it('uses the declared status when not complete, then natural progress', () => {
        expect(resolveCheckInStatus({ isComplete: false, hasProgress: false }, 'skipped')).toBe('skipped');
        expect(resolveCheckInStatus({ isComplete: false, hasProgress: false }, 'partial')).toBe('partial');
        expect(resolveCheckInStatus({ isComplete: false, hasProgress: true }, null)).toBe('partial');
        expect(resolveCheckInStatus({ isComplete: false, hasProgress: false }, null)).toBeNull();
    });
});

describe('getCheckInHabits', () => {
    it("returns today's scheduled root habits ordered by category then habit order", () => {
        const categories: Category[] = [
            { id: 'cat-b', name: 'Mind', color: 'bg-violet-500' },
            { id: 'cat-a', name: 'Body', color: 'bg-emerald-500' },
        ];
        const habits = [
            habit({ id: 'a2', categoryId: 'cat-a', order: 2 }),
            habit({ id: 'a1', categoryId: 'cat-a', order: 1 }),
            habit({ id: 'b1', categoryId: 'cat-b', order: 5 }),
            habit({ id: 'archived', archived: true }),
            habit({ id: 'weekend-only', assignedDays: [0, 6] }),
            habit({ id: 'bundle', categoryId: 'cat-b', order: 1, type: 'bundle', bundleType: 'checklist', subHabitIds: ['child'] }),
            habit({ id: 'child', categoryId: 'cat-b', bundleParentId: 'bundle' }),
        ];
        expect(getCheckInHabits(habits, categories, DAY).map(h => h.id)).toEqual(['bundle', 'b1', 'a1', 'a2']);
    });
});

describe('step navigation', () => {
    it('parses URL steps defensively', () => {
        expect(parseCheckInStep('3')).toBe(3);
        expect(parseCheckInStep('9')).toBe(1);
        expect(parseCheckInStep('abc')).toBe(1);
        expect(parseCheckInStep(null)).toBe(1);
    });

    it('skips the mood and effort pages when nothing needs reflection', () => {
        expect(getNextStep(2, 0)).toBe(5);
        expect(getPreviousStep(5, 0)).toBe(2);
        expect(getNextStep(2, 3)).toBe(3);
        expect(getPreviousStep(5, 3)).toBe(4);
        expect(getPreviousStep(1, 3)).toBe(1);
        expect(getNextStep(5, 3)).toBe(5);
    });
});

describe('estimateRemainingMinutes', () => {
    it('estimates about two minutes for four habits and at least one minute for wrap-up', () => {
        expect(estimateRemainingMinutes(1, 4, 4)).toBe(2);
        expect(estimateRemainingMinutes(5, 4, 4)).toBe(1);
        expect(estimateRemainingMinutes(1, 22, 22)).toBeGreaterThan(estimateRemainingMinutes(1, 4, 4));
    });
});

describe('buildCheckInSummary', () => {
    it('counts statuses and averages reflections only for done/partial habits', () => {
        const reflection = (habitId: string, moodScore: number | null, effortScore: number | null, journalEntry: string | null = null) => ({
            habitId, completionStatus: null, moodScore, moodTags: [], effortScore, journalEntry,
        });
        const summary = buildCheckInSummary([
            { status: 'done', reflection: reflection('a', 5, 2, 'Felt great') },
            { status: 'partial', reflection: reflection('b', 3, 4) },
            { status: 'skipped', reflection: reflection('c', 1, 5, 'Too tired') },
            { status: null },
        ]);
        expect(summary).toEqual({
            total: 4,
            done: 1,
            partial: 1,
            skipped: 1,
            unmarked: 1,
            averageMood: 4,
            averageEffort: 3,
            journalCount: 2,
        });
    });

    it('reports null averages when nothing was rated', () => {
        const summary = buildCheckInSummary([{ status: 'done' }]);
        expect(summary.averageMood).toBeNull();
        expect(summary.averageEffort).toBeNull();
    });

    it('picks encouraging headline copy from the completion ratio', () => {
        expect(getCompletionHeadline({ done: 4, total: 4 })).toMatch(/Great consistency/);
        expect(getCompletionHeadline({ done: 2, total: 4 })).toMatch(/Solid progress/);
        expect(getCompletionHeadline({ done: 1, total: 4 })).toMatch(/Progress counts/);
        expect(getCompletionHeadline({ done: 0, total: 4 })).toMatch(/Showing up/);
    });
});
