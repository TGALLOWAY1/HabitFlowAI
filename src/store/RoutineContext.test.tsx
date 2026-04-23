/**
 * Unit tests for routine execution state: stepStates, start/exit, setStepState.
 * No habit logging; step state is in-memory only and cleared on exit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { RoutineProvider, useRoutineStore, type StepStatus } from './RoutineContext';
import type { Routine, RoutineLog } from '../models/persistenceTypes';

const mockRoutine: Routine = {
    id: 'routine-1',
    userId: 'user-1',
    title: 'Test Routine',
    linkedHabitIds: [],
    steps: [
        { id: 'step-a', title: 'Step A' },
        { id: 'step-b', title: 'Step B' },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../lib/persistenceClient', () => ({
    fetchRoutines: vi.fn(),
    fetchRoutineLogs: vi.fn(),
    createRoutine: vi.fn(),
    updateRoutine: vi.fn(),
    deleteRoutine: vi.fn(),
    getActiveUserId: vi.fn(() => 'user-1'),
}));

import { fetchRoutines, fetchRoutineLogs } from '../lib/persistenceClient';

function TestConsumer({ onMount }: { onMount?: (store: ReturnType<typeof useRoutineStore>) => void }) {
    const store = useRoutineStore();
    if (onMount) {
        try {
            onMount(store);
        } catch (_) {
            // ignore
        }
    }
    return (
        <div>
            <span data-testid="loading">{String(store.loading)}</span>
            <span data-testid="step-states">{JSON.stringify(store.stepStates)}</span>
            <span data-testid="execution-state">{store.executionState}</span>
            <button onClick={() => store.selectRoutine(mockRoutine.id)}>Select</button>
            <button onClick={() => store.activeRoutine && store.startRoutine(store.activeRoutine)}>Start</button>
            <button onClick={() => store.setStepState('step-a', 'done')}>Mark A done</button>
            <button onClick={() => store.setStepState('step-b', 'skipped')}>Mark B skipped</button>
            <button onClick={() => store.exitRoutine()}>Exit</button>
        </div>
    );
}

describe('RoutineContext execution state', () => {
    beforeEach(() => {
        vi.mocked(fetchRoutines).mockResolvedValue([mockRoutine]);
        vi.mocked(fetchRoutineLogs).mockResolvedValue({} as Record<string, RoutineLog>);
    });

    it('startRoutine initializes all step states to neutral', async () => {
        render(
            <RoutineProvider>
                <TestConsumer />
            </RoutineProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });

        await act(async () => {
            screen.getByText('Select').click();
        });
        await act(async () => {
            screen.getByText('Start').click();
        });

        const stepStatesEl = screen.getByTestId('step-states');
        const stepStates = JSON.parse(stepStatesEl.textContent || '{}') as Record<string, StepStatus>;
        expect(stepStates['step-a']).toBe('neutral');
        expect(stepStates['step-b']).toBe('neutral');
        expect(Object.keys(stepStates)).toHaveLength(2);
    });

    it('setStepState updates step status deterministically', async () => {
        render(
            <RoutineProvider>
                <TestConsumer />
            </RoutineProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });

        await act(async () => {
            screen.getByText('Select').click();
        });
        await act(async () => {
            screen.getByText('Start').click();
        });

        await act(async () => {
            screen.getByText('Mark A done').click();
        });
        let stepStates = JSON.parse(screen.getByTestId('step-states').textContent || '{}') as Record<string, StepStatus>;
        expect(stepStates['step-a']).toBe('done');
        expect(stepStates['step-b']).toBe('neutral');

        await act(async () => {
            screen.getByText('Mark B skipped').click();
        });
        stepStates = JSON.parse(screen.getByTestId('step-states').textContent || '{}') as Record<string, StepStatus>;
        expect(stepStates['step-a']).toBe('done');
        expect(stepStates['step-b']).toBe('skipped');
    });

    it('exitRoutine clears step states', async () => {
        render(
            <RoutineProvider>
                <TestConsumer />
            </RoutineProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });

        await act(async () => {
            screen.getByText('Select').click();
        });
        await act(async () => {
            screen.getByText('Start').click();
        });
        await act(async () => {
            screen.getByText('Mark A done').click();
        });

        expect(JSON.parse(screen.getByTestId('step-states').textContent || '{}')).toHaveProperty('step-a');

        await act(async () => {
            screen.getByText('Exit').click();
        });

        const stepStates = JSON.parse(screen.getByTestId('step-states').textContent || '{}');
        expect(stepStates).toEqual({});
        expect(screen.getByTestId('execution-state').textContent).toBe('browse');
    });
});
