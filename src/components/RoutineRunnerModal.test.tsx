/**
 * Reproduction test: clicking the close (X) icon in execute mode must not
 * trigger a React render-loop / hooks-mismatch error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { RoutineProvider } from '../store/RoutineContext';
import { HabitProvider } from '../store/HabitContext';
import { ToastProvider } from './Toast';
import { RoutineRunnerModal } from './RoutineRunnerModal';
import type { Routine } from '../models/persistenceTypes';

const mockRoutine: Routine = {
    id: 'routine-1',
    userId: 'user-1',
    title: 'Test Routine',
    linkedHabitIds: [],
    steps: [
        { id: 'step-a', title: 'Step A', timerSeconds: 30 },
        { id: 'step-b', title: 'Step B' },
    ],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
};

vi.mock('../lib/persistenceClient', async () => {
    const actual = await vi.importActual<typeof import('../lib/persistenceClient')>('../lib/persistenceClient');
    return {
        ...actual,
        fetchRoutines: vi.fn().mockResolvedValue([]),
        fetchRoutineLogs: vi.fn().mockResolvedValue({}),
        fetchCategories: vi.fn().mockResolvedValue([]),
        fetchHabits: vi.fn().mockResolvedValue([]),
        fetchDayLogs: vi.fn().mockResolvedValue({}),
        fetchWellbeingLogs: vi.fn().mockResolvedValue({}),
        fetchPotentialEvidence: vi.fn().mockResolvedValue([]),
        submitRoutine: vi.fn().mockResolvedValue(undefined),
        batchCreateEntries: vi.fn().mockResolvedValue(undefined),
        recordRoutineStepsReachedBatch: vi.fn().mockResolvedValue(undefined),
    };
});

function Harness() {
    const [open, setOpen] = React.useState(true);
    return (
        <React.StrictMode>
            <ToastProvider>
                <HabitProvider>
                    <RoutineProvider>
                        <RoutineRunnerModal
                            isOpen={open}
                            routine={mockRoutine}
                            variantId={undefined}
                            onClose={() => setOpen(false)}
                        />
                    </RoutineProvider>
                </HabitProvider>
            </ToastProvider>
        </React.StrictMode>
    );
}

describe('RoutineRunnerModal — close button', () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it('closes cleanly without a React error when close icon is clicked', async () => {
        render(<Harness />);
        await waitFor(() => {
            expect(screen.getByLabelText('Close')).toBeTruthy();
        });
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Close'));
        });
        // After close, modal should no longer be in the DOM
        expect(screen.queryByLabelText('Close')).toBeNull();
        // No React errors should have been logged
        const reactErrors = errorSpy.mock.calls.filter((args: unknown[]) =>
            args.some((a: unknown) => typeof a === 'string' && (a.includes('Minified React error') || a.includes('Too many re-renders') || a.includes('Rendered fewer hooks')))
        );
        expect(reactErrors).toEqual([]);
    });

    it('closes cleanly after starting the timer', async () => {
        render(<Harness />);
        await waitFor(() => {
            expect(screen.getByLabelText('Close')).toBeTruthy();
        });
        // Start the countdown timer (step-a has timerSeconds: 30)
        const startBtn = screen.queryByText('Start');
        if (startBtn) {
            await act(async () => {
                fireEvent.click(startBtn);
            });
        }
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Close'));
        });
        expect(screen.queryByLabelText('Close')).toBeNull();
        const reactErrors = errorSpy.mock.calls.filter((args: unknown[]) =>
            args.some((a: unknown) => typeof a === 'string' && (a.includes('Minified React error') || a.includes('Too many re-renders') || a.includes('Rendered fewer hooks')))
        );
        expect(reactErrors).toEqual([]);
    });

    it('closes cleanly after navigating to the completion view', async () => {
        render(<Harness />);
        await waitFor(() => {
            expect(screen.getByLabelText('Close')).toBeTruthy();
        });
        // Advance through all steps to reach completion view
        for (let i = 0; i < 5; i++) {
            const nextBtn = screen.queryByText(/Next Step|Finish/);
            if (nextBtn) {
                await act(async () => {
                    fireEvent.click(nextBtn);
                });
            }
        }
        // Now try closing
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Close'));
        });
        expect(screen.queryByLabelText('Close')).toBeNull();
        const reactErrors = errorSpy.mock.calls.filter((args: unknown[]) =>
            args.some((a: unknown) => typeof a === 'string' && (a.includes('Minified React error') || a.includes('Too many re-renders') || a.includes('Rendered fewer hooks')))
        );
        expect(reactErrors).toEqual([]);
    });
});
