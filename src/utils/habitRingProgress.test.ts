/**
 * Habit Ring Progress Tests
 *
 * Tests for daily habits ring counting logic:
 * - getRootHabits: filters to top-level habit units (excludes bundle children)
 * - isHabitComplete: determines completion for standalone and bundle habits
 * - getDailyHabitRingProgress: computes {completed, total} for the ring
 * - computeBundleStatus: bundle-specific completion semantics
 */

import { describe, it, expect } from 'vitest';
import {
    getRootHabits,
    isHabitComplete,
    getDailyHabitRingProgress,
    getBundleChildIds,
    computeBundleStatus,
    getHabitsForDate,
} from './habitUtils';
import type { Habit, DayLog } from '../types';

// --- Helpers ---

function makeHabit(overrides: Partial<Habit> & { id: string; name: string }): Habit {
    return {
        categoryId: 'cat-1',
        goal: { type: 'boolean', frequency: 'daily' },
        archived: false,
        createdAt: '2026-01-01T00:00:00Z',
        ...overrides,
    } as Habit;
}

function makeLog(habitId: string, date: string, completed: boolean, value?: number): [string, DayLog] {
    return [
        `${habitId}-${date}`,
        { habitId, date, completed, value: value ?? (completed ? 1 : 0) },
    ];
}

const DATE = '2026-03-28';

// --- Test Data Factories ---

function standaloneHabits() {
    return [
        makeHabit({ id: 'h1', name: 'Meditate' }),
        makeHabit({ id: 'h2', name: 'Exercise' }),
        makeHabit({ id: 'h3', name: 'Read' }),
    ];
}

function checklistBundle() {
    return {
        parent: makeHabit({
            id: 'bundle-cl',
            name: 'Morning Routine',
            type: 'bundle',
            bundleType: 'checklist',
            subHabitIds: ['cl-child-1', 'cl-child-2', 'cl-child-3', 'cl-child-4'],
        }),
        children: [
            makeHabit({ id: 'cl-child-1', name: 'Brush teeth', bundleParentId: 'bundle-cl' }),
            makeHabit({ id: 'cl-child-2', name: 'Shower', bundleParentId: 'bundle-cl' }),
            makeHabit({ id: 'cl-child-3', name: 'Make bed', bundleParentId: 'bundle-cl' }),
            makeHabit({ id: 'cl-child-4', name: 'Breakfast', bundleParentId: 'bundle-cl' }),
        ],
    };
}

function choiceBundle() {
    return {
        parent: makeHabit({
            id: 'bundle-ch',
            name: 'Workout Type',
            type: 'bundle',
            bundleType: 'choice',
            subHabitIds: ['ch-opt-1', 'ch-opt-2', 'ch-opt-3'],
        }),
        children: [
            makeHabit({ id: 'ch-opt-1', name: 'Running', bundleParentId: 'bundle-ch' }),
            makeHabit({ id: 'ch-opt-2', name: 'Swimming', bundleParentId: 'bundle-ch' }),
            makeHabit({ id: 'ch-opt-3', name: 'Yoga', bundleParentId: 'bundle-ch' }),
        ],
    };
}

// =============================================================================
// Case A — standalone only
// =============================================================================
describe('Case A — standalone habits only', () => {
    const habits = standaloneHabits();

    it('getRootHabits returns all 3 standalone habits', () => {
        expect(getRootHabits(habits)).toHaveLength(3);
    });

    it('total = 3 with none completed', () => {
        const logs: Record<string, DayLog> = {};
        const result = getDailyHabitRingProgress(habits, logs, DATE);
        expect(result).toEqual({ completed: 0, total: 3 });
    });

    it('completed = 2 when two habits have logs', () => {
        const logs = Object.fromEntries([
            makeLog('h1', DATE, true),
            makeLog('h3', DATE, true),
        ]);
        const result = getDailyHabitRingProgress(habits, logs, DATE);
        expect(result).toEqual({ completed: 2, total: 3 });
    });
});

// =============================================================================
// Case B — checklist bundle
// =============================================================================
describe('Case B — standalone + checklist bundle', () => {
    const cl = checklistBundle();
    const habits = [
        ...standaloneHabits().slice(0, 2), // h1, h2
        cl.parent,
        ...cl.children,
    ];

    it('total = 3 (2 standalone + 1 bundle parent — matches Today view rows)', () => {
        const result = getDailyHabitRingProgress(habits, {}, DATE);
        expect(result.total).toBe(3);
    });

    it('bundle children are excluded from root habits, parent is in root (for DayView + ring)', () => {
        const childIds = getBundleChildIds(habits);
        expect(childIds.size).toBe(4);
        const root = getRootHabits(habits);
        expect(root).toHaveLength(3);
        expect(root.map(h => h.id)).toContain('bundle-cl');
        expect(root.map(h => h.id)).not.toContain('cl-child-1');
    });

    it('bundle parent counts toward completed when all children are done', () => {
        const logs = Object.fromEntries([
            makeLog('cl-child-1', DATE, true),
            makeLog('cl-child-2', DATE, true),
            makeLog('cl-child-3', DATE, true),
            makeLog('cl-child-4', DATE, true),
        ]);
        const result = getDailyHabitRingProgress(habits, logs, DATE);
        expect(result).toEqual({ completed: 1, total: 3 });
    });

    it('bundle parent not counted when only some children done', () => {
        const logs = Object.fromEntries([
            makeLog('cl-child-1', DATE, true),
            makeLog('cl-child-2', DATE, true),
        ]);
        const result = getDailyHabitRingProgress(habits, logs, DATE);
        expect(result).toEqual({ completed: 0, total: 3 });
    });
});

// =============================================================================
// Case C — choice bundle
// =============================================================================
describe('Case C — standalone + choice bundle', () => {
    const ch = choiceBundle();
    const habits = [
        ...standaloneHabits().slice(0, 2), // h1, h2
        ch.parent,
        ...ch.children,
    ];

    it('total = 3 (2 standalone + 1 bundle parent — matches Today view rows)', () => {
        const result = getDailyHabitRingProgress(habits, {}, DATE);
        expect(result.total).toBe(3);
    });

    it('choice bundle counts as complete when any child done', () => {
        const logs = Object.fromEntries([
            makeLog('ch-opt-2', DATE, true),
        ]);
        const result = getDailyHabitRingProgress(habits, logs, DATE);
        expect(result).toEqual({ completed: 1, total: 3 });
    });
});

// =============================================================================
// Case D — mixed bundles
// =============================================================================
describe('Case D — mixed: standalone + checklist + choice', () => {
    const cl = checklistBundle();
    const ch = choiceBundle();
    const habits = [
        standaloneHabits()[0], // h1
        cl.parent,
        ...cl.children,
        ch.parent,
        ...ch.children,
    ];

    it('total = 3 (1 standalone + 2 bundle parents — matches Today view rows)', () => {
        const result = getDailyHabitRingProgress(habits, {}, DATE);
        expect(result.total).toBe(3);
    });
});

// =============================================================================
// Case E — completion logic
// =============================================================================
describe('Case E — bundle completion semantics', () => {
    describe('checklist bundle', () => {
        const cl = checklistBundle();
        const habits = [cl.parent, ...cl.children];

        it('incomplete when only some children done (AND logic)', () => {
            const logs = Object.fromEntries([
                makeLog('cl-child-1', DATE, true),
                makeLog('cl-child-2', DATE, true),
            ]);
            expect(isHabitComplete(cl.parent, logs, DATE)).toBe(false);
            const status = computeBundleStatus(cl.parent, logs, DATE);
            expect(status.completed).toBe(false);
        });

        it('complete when ALL children done', () => {
            const logs = Object.fromEntries([
                makeLog('cl-child-1', DATE, true),
                makeLog('cl-child-2', DATE, true),
                makeLog('cl-child-3', DATE, true),
                makeLog('cl-child-4', DATE, true),
            ]);
            expect(isHabitComplete(cl.parent, logs, DATE)).toBe(true);
        });

        it('ring counts bundle parent as 1 completed when checklist rule met', () => {
            const logs = Object.fromEntries([
                makeLog('cl-child-1', DATE, true),
                makeLog('cl-child-2', DATE, true),
                makeLog('cl-child-3', DATE, true),
                makeLog('cl-child-4', DATE, true),
            ]);
            const result = getDailyHabitRingProgress(habits, logs, DATE);
            expect(result).toEqual({ completed: 1, total: 1 });
        });
    });

    describe('choice bundle', () => {
        const ch = choiceBundle();
        const habits = [ch.parent, ...ch.children];

        it('complete when ANY child done (OR logic)', () => {
            const logs = Object.fromEntries([
                makeLog('ch-opt-2', DATE, true),
            ]);
            expect(isHabitComplete(ch.parent, logs, DATE)).toBe(true);
        });

        it('incomplete when no child done', () => {
            expect(isHabitComplete(ch.parent, {}, DATE)).toBe(false);
        });

        it('ring counts bundle parent as 1 completed when any child done', () => {
            const logs = Object.fromEntries([
                makeLog('ch-opt-1', DATE, true),
            ]);
            const result = getDailyHabitRingProgress(habits, logs, DATE);
            expect(result).toEqual({ completed: 1, total: 1 });
        });
    });
});

// =============================================================================
// Case F — parent/child double-count protection
// =============================================================================
describe('Case F — no double-counting of parent and children', () => {
    const cl = checklistBundle();
    const ch = choiceBundle();

    it('checklist: children never appear in root habits', () => {
        const habits = [cl.parent, ...cl.children];
        const root = getRootHabits(habits);
        expect(root).toHaveLength(1);
        expect(root[0].id).toBe('bundle-cl');
    });

    it('choice: children never appear in root habits', () => {
        const habits = [ch.parent, ...ch.children];
        const root = getRootHabits(habits);
        expect(root).toHaveLength(1);
        expect(root[0].id).toBe('bundle-ch');
    });

    it('mixed scenario: ring counts standalone habits and bundle parents (matches Today view rows)', () => {
        const standalone = standaloneHabits();
        const habits = [
            ...standalone,
            cl.parent, ...cl.children,
            ch.parent, ...ch.children,
        ];
        // Complete everything
        const logs = Object.fromEntries([
            makeLog('h1', DATE, true),
            makeLog('h2', DATE, true),
            makeLog('h3', DATE, true),
            makeLog('cl-child-1', DATE, true),
            makeLog('cl-child-2', DATE, true),
            makeLog('cl-child-3', DATE, true),
            makeLog('cl-child-4', DATE, true),
            makeLog('ch-opt-1', DATE, true),
        ]);
        const result = getDailyHabitRingProgress(habits, logs, DATE);
        // 3 standalone + 2 bundle parents = 5 rows on the Today view.
        // Children are excluded from rows by getBundleChildIds; bundle parents
        // are counted, so the ring mirrors Today.
        expect(result.total).toBe(5);
        expect(result.completed).toBe(5);
        expect(result.completed).toBeLessThanOrEqual(result.total);
    });
});

// =============================================================================
// Edge cases
// =============================================================================
describe('Edge cases', () => {
    it('empty habits list', () => {
        expect(getDailyHabitRingProgress([], {}, DATE)).toEqual({ completed: 0, total: 0 });
    });

    it('archived habits excluded', () => {
        const habits = [
            makeHabit({ id: 'h1', name: 'Active' }),
            makeHabit({ id: 'h2', name: 'Archived', archived: true }),
        ];
        expect(getDailyHabitRingProgress(habits, {}, DATE).total).toBe(1);
    });

    it('bundle with empty subHabitIds falls back to own log entry', () => {
        const habit = makeHabit({
            id: 'b-empty',
            name: 'Empty Bundle',
            type: 'bundle',
            bundleType: 'checklist',
            subHabitIds: [],
        });
        // With no children, isHabitComplete falls back to checking the habit's own log
        const logs = Object.fromEntries([makeLog('b-empty', DATE, true)]);
        expect(isHabitComplete(habit, logs, DATE)).toBe(true);
        // And without a log entry, it's incomplete
        expect(isHabitComplete(habit, {}, DATE)).toBe(false);
    });

    it('standalone habit completion uses log directly', () => {
        const habit = makeHabit({ id: 'h1', name: 'Meditate' });
        const logs = Object.fromEntries([makeLog('h1', DATE, true)]);
        expect(isHabitComplete(habit, logs, DATE)).toBe(true);
        expect(isHabitComplete(habit, {}, DATE)).toBe(false);
    });

    it('timesPerWeek habits included in daily ring progress, total habits included', () => {
        const habits = [
            makeHabit({ id: 'h1', name: 'Daily habit' }),
            makeHabit({ id: 'h2', name: 'Weekly quota habit', timesPerWeek: 3, goal: { type: 'boolean', frequency: 'daily' } }),
            makeHabit({ id: 'h3', name: 'Total habit', goal: { type: 'number', frequency: 'total' } }),
        ];
        const result = getDailyHabitRingProgress(habits, {}, DATE);
        expect(result.total).toBe(3); // daily + timesPerWeek + total
    });

    // --- assignedDays schedule filtering ---
    // DATE = '2026-03-28' is a Saturday (day 6)

    it('habit with assignedDays is excluded when not scheduled for the day', () => {
        const habits = [
            makeHabit({ id: 'h1', name: 'MWF habit', assignedDays: [1, 3, 5] }), // Mon/Wed/Fri only
            makeHabit({ id: 'h2', name: 'Every day habit' }),
        ];
        // Saturday — h1 should be excluded
        const result = getHabitsForDate(habits, DATE);
        expect(result.map(h => h.id)).toEqual(['h2']);
    });

    it('habit with assignedDays is included when scheduled for the day', () => {
        const habits = [
            makeHabit({ id: 'h1', name: 'Sat/Sun habit', assignedDays: [0, 6] }), // Sun/Sat
            makeHabit({ id: 'h2', name: 'Every day habit' }),
        ];
        // Saturday — both should appear
        const result = getHabitsForDate(habits, DATE);
        expect(result.map(h => h.id)).toEqual(['h1', 'h2']);
    });

    it('habit without assignedDays shows every day', () => {
        const habits = [makeHabit({ id: 'h1', name: 'Daily' })];
        // Check multiple days of the week
        expect(getHabitsForDate(habits, '2026-03-23').length).toBe(1); // Monday
        expect(getHabitsForDate(habits, '2026-03-26').length).toBe(1); // Thursday
        expect(getHabitsForDate(habits, DATE).length).toBe(1);         // Saturday
    });

    it('ring progress excludes unscheduled habits from total', () => {
        const habits = [
            makeHabit({ id: 'h1', name: 'MWF', assignedDays: [1, 3, 5] }),
            makeHabit({ id: 'h2', name: 'Every day' }),
        ];
        // Saturday — only h2 counts toward the ring
        const result = getDailyHabitRingProgress(habits, {}, DATE);
        expect(result.total).toBe(1);
    });

    it('child with bundleParentId excluded even if parent subHabitIds is missing', () => {
        const habits = [
            makeHabit({ id: 'parent', name: 'Bundle', type: 'bundle', bundleType: 'choice' }),
            makeHabit({ id: 'orphan-child', name: 'Orphan Child', bundleParentId: 'parent' }),
            makeHabit({ id: 'h1', name: 'Standalone' }),
        ];
        const childIds = getBundleChildIds(habits);
        expect(childIds.has('orphan-child')).toBe(true);
        const root = getRootHabits(habits);
        expect(root.map(h => h.id)).not.toContain('orphan-child');
    });
});
