import { describe, it, expect } from 'vitest';
import { buildIterationChains } from './goalIterationChains';
import type { Goal } from '../models/persistenceTypes';

function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
    return {
        title: 'Test Goal',
        type: 'cumulative',
        targetValue: 25,
        linkedHabitIds: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-15T00:00:00.000Z',
        ...overrides,
    };
}

describe('buildIterationChains', () => {
    it('returns one single-entry chain for a goal with no predecessor or successor', () => {
        const goals = [makeGoal({ id: 'a', targetValue: 50 })];
        const chains = buildIterationChains(goals);
        expect(chains).toHaveLength(1);
        expect(chains[0].head.id).toBe('a');
        expect(chains[0].targets).toEqual([50]);
        expect(chains[0].goals.map(g => g.id)).toEqual(['a']);
    });

    it('collapses a 3-goal chain into a single entry headed by the latest', () => {
        const goals = [
            makeGoal({ id: 'g1', targetValue: 25, completedAt: '2026-01-01T00:00:00.000Z' }),
            makeGoal({ id: 'g2', targetValue: 50, iteratedFromGoalId: 'g1', completedAt: '2026-02-01T00:00:00.000Z' }),
            makeGoal({ id: 'g3', targetValue: 100, iteratedFromGoalId: 'g2', completedAt: '2026-03-01T00:00:00.000Z' }),
        ];
        const chains = buildIterationChains(goals);
        expect(chains).toHaveLength(1);
        expect(chains[0].head.id).toBe('g3');
        expect(chains[0].targets).toEqual([25, 50, 100]);
        expect(chains[0].goals.map(g => g.id)).toEqual(['g1', 'g2', 'g3']);
    });

    it('treats legacy iterated goals (no backref) as independent chains', () => {
        const goals = [
            makeGoal({ id: 'old1', targetValue: 25 }),
            makeGoal({ id: 'old2', targetValue: 50 }),
        ];
        const chains = buildIterationChains(goals);
        expect(chains).toHaveLength(2);
        expect(chains.flatMap(c => c.goals).map(g => g.id).sort()).toEqual(['old1', 'old2']);
    });

    it('keeps multiple independent chains separate', () => {
        const goals = [
            makeGoal({ id: 'a1', targetValue: 10, completedAt: '2026-01-01T00:00:00.000Z' }),
            makeGoal({ id: 'a2', targetValue: 20, iteratedFromGoalId: 'a1', completedAt: '2026-02-01T00:00:00.000Z' }),
            makeGoal({ id: 'b1', targetValue: 5, completedAt: '2026-03-01T00:00:00.000Z' }),
        ];
        const chains = buildIterationChains(goals);
        expect(chains).toHaveLength(2);
        const aChain = chains.find(c => c.head.id === 'a2');
        const bChain = chains.find(c => c.head.id === 'b1');
        expect(aChain?.targets).toEqual([10, 20]);
        expect(bChain?.targets).toEqual([5]);
    });

    it('orders chains by head completedAt desc', () => {
        const goals = [
            makeGoal({ id: 'old', completedAt: '2026-01-01T00:00:00.000Z' }),
            makeGoal({ id: 'new', completedAt: '2026-06-01T00:00:00.000Z' }),
            makeGoal({ id: 'mid', completedAt: '2026-03-01T00:00:00.000Z' }),
        ];
        const chains = buildIterationChains(goals);
        expect(chains.map(c => c.head.id)).toEqual(['new', 'mid', 'old']);
    });

    it('treats a missing predecessor reference as the chain start (no crash)', () => {
        const goals = [
            makeGoal({ id: 'orphan', targetValue: 75, iteratedFromGoalId: 'missing-id' }),
        ];
        const chains = buildIterationChains(goals);
        expect(chains).toHaveLength(1);
        expect(chains[0].targets).toEqual([75]);
    });

    it('does not infinite-loop on accidental cycles, and never repeats a goal within a chain', () => {
        const goals = [
            makeGoal({ id: 'x', iteratedFromGoalId: 'y' }),
            makeGoal({ id: 'y', iteratedFromGoalId: 'x' }),
        ];
        const chains = buildIterationChains(goals);
        for (const c of chains) {
            const ids = new Set(c.goals.map(g => g.id));
            expect(ids.size).toBe(c.goals.length);
        }
    });

    it('uses 0 as the target when targetValue is undefined', () => {
        const goals = [makeGoal({ id: 'a', targetValue: undefined })];
        const chains = buildIterationChains(goals);
        expect(chains[0].targets).toEqual([0]);
    });
});
