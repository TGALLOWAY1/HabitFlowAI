/**
 * Lightweight test for Completed Habits modal: default checked state
 * follows stepStates (steps with "done" are pre-checked).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletedHabitsModal } from './CompletedHabitsModal';
import type { Routine } from '../models/persistenceTypes';
import type { StepStates } from '../store/RoutineContext';

const routineWithTwoHabitSteps: Routine = {
    id: 'routine-1',
    userId: 'user-1',
    title: 'Test Routine',
    linkedHabitIds: ['habit-a', 'habit-b'],
    steps: [
        { id: 'step-1', title: 'Step 1', linkedHabitId: 'habit-a' },
        { id: 'step-2', title: 'Step 2', linkedHabitId: 'habit-b' },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
};

const getHabitName = (habitId: string) => (habitId === 'habit-a' ? 'Habit A' : habitId === 'habit-b' ? 'Habit B' : habitId);

describe('CompletedHabitsModal default checked behavior', () => {
    it('pre-checks rows for steps whose stepState is "done"', () => {
        const stepStates: StepStates = {
            'step-1': 'done',
            'step-2': 'done',
        };

        render(
            <CompletedHabitsModal
                isOpen={true}
                routine={routineWithTwoHabitSteps}
                stepStates={stepStates}
                getHabitName={getHabitName}
                onClose={vi.fn()}
                onLogSelected={vi.fn()}
            />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');
        expect(checkboxes[1]).toHaveAttribute('aria-checked', 'true');
    });

    it('leaves rows unchecked when stepState is not "done"', () => {
        const stepStates: StepStates = {
            'step-1': 'skipped',
            'step-2': 'neutral',
        };

        render(
            <CompletedHabitsModal
                isOpen={true}
                routine={routineWithTwoHabitSteps}
                stepStates={stepStates}
                getHabitName={getHabitName}
                onClose={vi.fn()}
                onLogSelected={vi.fn()}
            />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).toHaveAttribute('aria-checked', 'false');
        expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false');
    });

    it('pre-checks only the step marked done when one is done and one is skipped', () => {
        const stepStates: StepStates = {
            'step-1': 'done',
            'step-2': 'skipped',
        };

        render(
            <CompletedHabitsModal
                isOpen={true}
                routine={routineWithTwoHabitSteps}
                stepStates={stepStates}
                getHabitName={getHabitName}
                onClose={vi.fn()}
                onLogSelected={vi.fn()}
            />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');
        expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false');
    });
});
