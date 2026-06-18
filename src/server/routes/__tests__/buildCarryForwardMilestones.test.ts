/**
 * Unit tests for buildCarryForwardMilestones — the pure helper behind the
 * extended-goal milestone progression (Bug #2). No DB required.
 *
 * Extending preserves the prior target(s) as pre-acknowledged milestones so the
 * achievements UI can render "50 done / 100 in progress".
 */
import { describe, it, expect } from 'vitest';
import { buildCarryForwardMilestones } from '../goals';
import type { Goal } from '../../../models/persistenceTypes';

function makeGoal(overrides: Partial<Goal>): Goal {
    return {
        id: 'g1',
        title: 'Test',
        type: 'cumulative',
        targetValue: 50,
        linkedHabitIds: [],
        createdAt: new Date().toISOString(),
        ...overrides,
    } as Goal;
}

describe('buildCarryForwardMilestones', () => {
    it('carries the prior target forward as a single milestone (50 -> 100)', () => {
        const result = buildCarryForwardMilestones(makeGoal({ targetValue: 50 }), 100);
        expect(result.map((m) => m.value)).toEqual([50]);
    });

    it('pre-acknowledges carried milestones so they do not re-celebrate', () => {
        const result = buildCarryForwardMilestones(makeGoal({ targetValue: 50 }), 100);
        expect(typeof result[0].acknowledgedAt).toBe('string');
        expect(result[0].id.length).toBeGreaterThan(0);
    });

    it('accumulates prior milestones plus the prior target (50 -> 100 -> 150)', () => {
        // The 100 goal already carried [50]; extending it to 150 yields [50, 100].
        const goal100 = makeGoal({
            targetValue: 100,
            milestones: [{ id: 'm50', value: 50, acknowledgedAt: '2025-01-01T00:00:00.000Z' }],
        });
        const result = buildCarryForwardMilestones(goal100, 150);
        expect(result.map((m) => m.value)).toEqual([50, 100]);
    });

    it('drops values at or above the new target', () => {
        const goal = makeGoal({
            targetValue: 100,
            milestones: [{ id: 'm50', value: 50 }, { id: 'm90', value: 90 }],
        });
        // Extend to 95: prior target 100 is >= 95 (dropped); 90 < 95 (kept); 50 kept.
        const result = buildCarryForwardMilestones(goal, 95);
        expect(result.map((m) => m.value)).toEqual([50, 90]);
    });

    it('dedupes when a prior milestone equals the prior target boundary', () => {
        const goal = makeGoal({
            targetValue: 50,
            milestones: [{ id: 'm25', value: 25 }],
        });
        const result = buildCarryForwardMilestones(goal, 100);
        expect(result.map((m) => m.value)).toEqual([25, 50]);
    });

    it('caps the carried milestones at the 20-milestone maximum', () => {
        const milestones = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, value: i + 1 }));
        const goal = makeGoal({ targetValue: 100, milestones });
        const result = buildCarryForwardMilestones(goal, 200);
        expect(result.length).toBe(20);
    });

    it('returns nothing for non-cumulative goals', () => {
        const goal = makeGoal({ type: 'onetime', targetValue: 1 });
        expect(buildCarryForwardMilestones(goal, 1)).toEqual([]);
    });

    it('returns nothing when the source goal has no usable prior target', () => {
        const goal = makeGoal({ targetValue: undefined, milestones: [] });
        expect(buildCarryForwardMilestones(goal, 100)).toEqual([]);
    });
});
