/**
 * Tests for routineVariantUtils
 *
 * Covers variant resolution, step resolution, linked habit computation,
 * composite keys, and legacy fallback behavior.
 */

import { describe, it, expect } from 'vitest';
import type { Routine, RoutineVariant, RoutineStep } from '../../models/persistenceTypes';
import {
    resolveVariant,
    resolveSteps,
    computeRoutineLevelLinkedHabits,
    computeVariantLinkedHabits,
    getLogCompositeKey,
    hasVariants,
    isMultiVariant,
    getEstimatedDurationMinutes,
} from '../routineVariantUtils';

// Helpers to build test fixtures
function makeStep(overrides: Partial<RoutineStep> = {}): RoutineStep {
    return {
        id: 'step-1',
        title: 'Step 1',
        sortOrder: 0,
        ...overrides,
    };
}

function makeVariant(overrides: Partial<RoutineVariant> = {}): RoutineVariant {
    return {
        id: 'v1',
        name: 'Default',
        estimatedDurationMinutes: 10,
        sortOrder: 0,
        steps: [makeStep()],
        linkedHabitIds: [],
        isAiGenerated: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        ...overrides,
    };
}

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
    return {
        id: 'r1',
        title: 'Test Routine',
        steps: [],
        linkedHabitIds: [],
        userId: 'u1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        ...overrides,
    };
}

describe('resolveVariant', () => {
    it('returns variant by explicit variantId', () => {
        const v1 = makeVariant({ id: 'v1', name: 'Quick' });
        const v2 = makeVariant({ id: 'v2', name: 'Deep' });
        const routine = makeRoutine({ variants: [v1, v2] });

        expect(resolveVariant(routine, 'v2')?.name).toBe('Deep');
    });

    it('falls back to defaultVariantId when variantId not found', () => {
        const v1 = makeVariant({ id: 'v1', name: 'Quick' });
        const v2 = makeVariant({ id: 'v2', name: 'Deep' });
        const routine = makeRoutine({ variants: [v1, v2], defaultVariantId: 'v2' });

        expect(resolveVariant(routine, 'nonexistent')?.name).toBe('Deep');
    });

    it('falls back to defaultVariantId when no variantId provided', () => {
        const v1 = makeVariant({ id: 'v1', name: 'Quick' });
        const v2 = makeVariant({ id: 'v2', name: 'Deep' });
        const routine = makeRoutine({ variants: [v1, v2], defaultVariantId: 'v2' });

        expect(resolveVariant(routine)?.name).toBe('Deep');
    });

    it('falls back to first variant when no default', () => {
        const v1 = makeVariant({ id: 'v1', name: 'Quick' });
        const v2 = makeVariant({ id: 'v2', name: 'Deep' });
        const routine = makeRoutine({ variants: [v1, v2] });

        expect(resolveVariant(routine)?.name).toBe('Quick');
    });

    it('synthesizes legacy variant from root steps when no variants', () => {
        const step = makeStep({ title: 'Legacy Step', timerSeconds: 120 });
        const routine = makeRoutine({ steps: [step], linkedHabitIds: ['h1'] });

        const resolved = resolveVariant(routine);
        expect(resolved).not.toBeNull();
        expect(resolved!.id).toBe('__legacy__');
        expect(resolved!.name).toBe('Default');
        expect(resolved!.steps).toHaveLength(1);
        expect(resolved!.linkedHabitIds).toEqual(['h1']);
    });

    it('returns null when no variants and no steps', () => {
        const routine = makeRoutine({ steps: [], variants: [] });
        expect(resolveVariant(routine)).toBeNull();
    });
});

describe('resolveSteps', () => {
    it('returns steps from resolved variant', () => {
        const steps = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
        const routine = makeRoutine({ variants: [makeVariant({ steps })] });

        expect(resolveSteps(routine)).toHaveLength(2);
    });

    it('returns empty array when no steps anywhere', () => {
        const routine = makeRoutine({ steps: [], variants: [] });
        expect(resolveSteps(routine)).toEqual([]);
    });
});

describe('computeRoutineLevelLinkedHabits', () => {
    it('returns union of all variant linkedHabitIds', () => {
        const v1 = makeVariant({ linkedHabitIds: ['h1', 'h2'] });
        const v2 = makeVariant({ linkedHabitIds: ['h2', 'h3'] });
        const routine = makeRoutine({ variants: [v1, v2] });

        const result = computeRoutineLevelLinkedHabits(routine);
        expect(result.sort()).toEqual(['h1', 'h2', 'h3']);
    });

    it('falls back to routine.linkedHabitIds when no variants', () => {
        const routine = makeRoutine({ linkedHabitIds: ['h1'] });
        expect(computeRoutineLevelLinkedHabits(routine)).toEqual(['h1']);
    });
});

describe('computeVariantLinkedHabits', () => {
    it('extracts unique linkedHabitIds from steps', () => {
        const steps = [
            makeStep({ id: 's1', linkedHabitId: 'h1' }),
            makeStep({ id: 's2', linkedHabitId: 'h2' }),
            makeStep({ id: 's3', linkedHabitId: 'h1' }),
        ];
        expect(computeVariantLinkedHabits(steps).sort()).toEqual(['h1', 'h2']);
    });

    it('returns empty array when no steps have linkedHabitId', () => {
        const steps = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
        expect(computeVariantLinkedHabits(steps)).toEqual([]);
    });
});

describe('getLogCompositeKey', () => {
    it('generates variant-aware key when variantId provided', () => {
        expect(getLogCompositeKey('r1', '2025-01-01', 'v1')).toBe('r1-v1-2025-01-01');
    });

    it('generates legacy key when no variantId', () => {
        expect(getLogCompositeKey('r1', '2025-01-01')).toBe('r1-2025-01-01');
    });
});

describe('hasVariants', () => {
    it('returns true when variants exist', () => {
        expect(hasVariants(makeRoutine({ variants: [makeVariant()] }))).toBe(true);
    });

    it('returns false when no variants', () => {
        expect(hasVariants(makeRoutine())).toBe(false);
    });
});

describe('isMultiVariant', () => {
    it('returns true with 2+ variants', () => {
        const routine = makeRoutine({ variants: [makeVariant({ id: 'v1' }), makeVariant({ id: 'v2' })] });
        expect(isMultiVariant(routine)).toBe(true);
    });

    it('returns false with single variant', () => {
        expect(isMultiVariant(makeRoutine({ variants: [makeVariant()] }))).toBe(false);
    });
});

describe('getEstimatedDurationMinutes', () => {
    it('returns variant duration', () => {
        const routine = makeRoutine({ variants: [makeVariant({ estimatedDurationMinutes: 25 })] });
        expect(getEstimatedDurationMinutes(routine)).toBe(25);
    });

    it('computes from legacy steps when no variants', () => {
        const steps = [
            makeStep({ timerSeconds: 120 }),
            makeStep({ timerSeconds: 180 }),
        ];
        const routine = makeRoutine({ steps });
        expect(getEstimatedDurationMinutes(routine)).toBe(5); // (120+180)/60 = 5
    });

    it('uses default 60s per step when no timerSeconds', () => {
        const steps = [makeStep({}), makeStep({})];
        const routine = makeRoutine({ steps });
        expect(getEstimatedDurationMinutes(routine)).toBe(2); // (60+60)/60 = 2
    });
});
