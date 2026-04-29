import type { Goal } from '../models/persistenceTypes';

/**
 * One iteration chain — a sequence of completed cumulative goals linked
 * via `iteratedFromGoalId`. The `head` is the most recent (latest) goal
 * in the chain; `goals` is ordered oldest -> newest; `targets` mirrors
 * `goals` and pulls each goal's `targetValue` (0 when undefined).
 */
export interface IterationChain {
    head: Goal;
    goals: Goal[];
    targets: number[];
}

/**
 * Group completed cumulative goals into iteration chains.
 *
 * Goals linked via `iteratedFromGoalId` collapse into a single chain
 * keyed by the chain head (the latest iteration — the one nothing else
 * points to). Standalone goals and legacy iterated goals (no backref)
 * become single-entry chains. Defensive against accidental cycles.
 *
 * Output is sorted by head `completedAt` desc so callers can render
 * directly without re-sorting.
 */
export function buildIterationChains(goals: Goal[]): IterationChain[] {
    const byId = new Map<string, Goal>();
    for (const g of goals) byId.set(g.id, g);

    const successors = new Set<string>();
    for (const g of goals) {
        if (g.iteratedFromGoalId && byId.has(g.iteratedFromGoalId)) {
            successors.add(g.iteratedFromGoalId);
        }
    }

    const chains: IterationChain[] = [];
    for (const g of goals) {
        if (successors.has(g.id)) continue;

        const ordered: Goal[] = [];
        const seen = new Set<string>();
        let cursor: Goal | undefined = g;
        while (cursor && !seen.has(cursor.id)) {
            seen.add(cursor.id);
            ordered.unshift(cursor);
            const prevId = cursor.iteratedFromGoalId;
            cursor = prevId ? byId.get(prevId) : undefined;
        }

        chains.push({
            head: g,
            goals: ordered,
            targets: ordered.map(goal => (typeof goal.targetValue === 'number' ? goal.targetValue : 0)),
        });
    }

    chains.sort((a, b) => {
        const at = a.head.completedAt ?? '';
        const bt = b.head.completedAt ?? '';
        return bt.localeCompare(at);
    });

    return chains;
}
