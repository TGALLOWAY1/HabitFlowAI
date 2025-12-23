/**
 * Regression test for double-click delete functionality
 * 
 * Ensures that double-clicking a habit grid cell deletes the existing HabitEntry
 * using the correct (habitId, dayKey) resolution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TrackerGrid } from './TrackerGrid';
import type { Habit, DayLog } from '../types';

// Mock dependencies
vi.mock('../store/HabitContext', () => ({
    useHabitStore: vi.fn(),
}));

vi.mock('../store/RoutineContext', () => ({
    useRoutineStore: vi.fn(),
}));

vi.mock('../lib/useProgressOverview', () => ({
    useProgressOverview: vi.fn(),
}));

vi.mock('./NumericInputPopover', () => ({
    NumericInputPopover: () => null,
}));

vi.mock('./HabitHistoryModal', () => ({
    HabitHistoryModal: () => null,
}));

vi.mock('./HabitLogModal', () => ({
    HabitLogModal: () => null,
}));

vi.mock('./WeeklyHabitCard', () => ({
    WeeklyHabitCard: () => null,
}));

import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useProgressOverview } from '../lib/useProgressOverview';

describe('TrackerGrid double-click delete', () => {
    const mockDeleteHabitEntryByKey = vi.fn().mockResolvedValue({ dayLog: null });
    const mockUpsertHabitEntry = vi.fn();
    const mockDeleteHabit = vi.fn();
    const mockReorderHabits = vi.fn();
    const mockRefreshProgress = vi.fn();

    const createBooleanHabit = (id: string, name: string): Habit => ({
        id,
        categoryId: 'cat-1',
        name,
        goal: {
            type: 'boolean',
            frequency: 'daily',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
    });

    const createNumericHabit = (id: string, name: string): Habit => ({
        id,
        categoryId: 'cat-1',
        name,
        goal: {
            type: 'number',
            frequency: 'daily',
            target: 8,
            unit: 'hours',
        },
        archived: false,
        createdAt: '2025-01-01T00:00:00.000Z',
    });

    const createDayLog = (habitId: string, date: string, completed: boolean, value?: number): DayLog => ({
        habitId,
        date,
        completed,
        value,
    });

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        (useHabitStore as any).mockReturnValue({
            deleteHabit: mockDeleteHabit,
            reorderHabits: mockReorderHabits,
            upsertHabitEntry: mockUpsertHabitEntry,
            deleteHabitEntryByKey: mockDeleteHabitEntryByKey,
        });

        (useRoutineStore as any).mockReturnValue({
            routines: [],
        });

        (useProgressOverview as any).mockReturnValue({
            data: null,
            refresh: mockRefreshProgress,
        });
    });

    describe('Boolean habit double-click delete', () => {
        it('should delete entry when double-clicking a completed boolean habit cell', async () => {
            const habitId = 'habit-bool-1';
            // Use today's date to ensure it's in the rendered date range
            const today = new Date();
            const dayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format (canonical dayKey)
            const habit = createBooleanHabit(habitId, 'Morning Meditation');
            const log = createDayLog(habitId, dayKey, true, 1);

            const habits = [habit];
            const logs: Record<string, DayLog> = {
                [`${habitId}-${dayKey}`]: log,
            };

            const { container } = render(
                <TrackerGrid
                    habits={habits}
                    logs={logs}
                    onAddHabit={() => {}}
                    onEditHabit={() => {}}
                    onViewHistory={() => {}}
                />
            );

            // Find buttons in the grid - look for cell buttons (not action buttons)
            const allButtons = Array.from(container.querySelectorAll('button'));
            
            // Find cell buttons - they have rounded-lg class and are in the grid area
            const cellButtons = allButtons.filter(btn => {
                const classes = btn.className;
                // Cell buttons have rounded-lg and are not action buttons (which have p-1.5)
                return classes.includes('rounded-lg') && 
                       !classes.includes('p-1.5') &&
                       btn.closest('.w-16'); // Cell buttons are in w-16 containers
            });

            expect(cellButtons.length).toBeGreaterThan(0);

            // Double-click the first cell button (should be today's cell if it exists)
            const targetCell = cellButtons[0];
            
            // Simulate double-click event - ensure event type is set correctly
            const dblClickEvent = {
                type: 'dblclick',
                preventDefault: vi.fn(),
                stopPropagation: vi.fn(),
            } as unknown as React.MouseEvent;
            
            fireEvent.dblClick(targetCell);

            // Wait for async operations
            await waitFor(() => {
                expect(mockDeleteHabitEntryByKey).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Verify it was called with correct (habitId, dayKey) - using canonical dayKey format
            expect(mockDeleteHabitEntryByKey).toHaveBeenCalledWith(habitId, dayKey);
        });

        it('should not delete when double-clicking an empty boolean habit cell', async () => {
            const habitId = 'habit-bool-2';
            const dayKey = '2025-01-27';
            const habit = createBooleanHabit(habitId, 'Evening Reading');
            // No log = empty cell

            const habits = [habit];
            const logs: Record<string, DayLog> = {};

            const { container } = render(
                <TrackerGrid
                    habits={habits}
                    logs={logs}
                    onAddHabit={() => {}}
                    onEditHabit={() => {}}
                    onViewHistory={() => {}}
                />
            );

            // Find empty cell buttons
            const allButtons = Array.from(container.querySelectorAll('button'));
            const cellButtons = allButtons.filter(btn => {
                const parent = btn.closest('.flex');
                return parent && parent.classList.contains('flex') && 
                       btn.className.includes('rounded-lg') &&
                       !btn.className.includes('p-1.5');
            });

            if (cellButtons.length > 0) {
                fireEvent.dblClick(cellButtons[0]);

                // Wait a bit to ensure no deletion occurs
                await new Promise(resolve => setTimeout(resolve, 500));

                // Should not have been called
                expect(mockDeleteHabitEntryByKey).not.toHaveBeenCalled();
            }
        });
    });

    describe('Numeric habit double-click delete', () => {
        it('should delete entry when double-clicking a numeric habit cell with value', async () => {
            const habitId = 'habit-num-1';
            const dayKey = '2025-01-27'; // YYYY-MM-DD format (canonical dayKey)
            const habit = createNumericHabit(habitId, 'Hours Slept');
            const log = createDayLog(habitId, dayKey, false, 8); // value > 0 but not completed

            const habits = [habit];
            const logs: Record<string, DayLog> = {
                [`${habitId}-${dayKey}`]: log,
            };

            const { container } = render(
                <TrackerGrid
                    habits={habits}
                    logs={logs}
                    onAddHabit={() => {}}
                    onEditHabit={() => {}}
                    onViewHistory={() => {}}
                />
            );

            // Find cell buttons - same approach as boolean test
            const allButtons = Array.from(container.querySelectorAll('button'));
            const cellButtons = allButtons.filter(btn => {
                const classes = btn.className;
                return classes.includes('rounded-lg') && 
                       !classes.includes('p-1.5') &&
                       btn.closest('.w-16');
            });

            expect(cellButtons.length).toBeGreaterThan(0);

            // Double-click the first cell button
            const targetCell = cellButtons[0];
            fireEvent.dblClick(targetCell);

            // Wait for async operations - the handler uses setTimeout for single-click delay
            // Double-click should execute immediately, so we wait a bit longer
            await waitFor(() => {
                expect(mockDeleteHabitEntryByKey).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Verify it was called with correct (habitId, dayKey) - using canonical dayKey format
            expect(mockDeleteHabitEntryByKey).toHaveBeenCalledWith(habitId, dayKey);
        });

        it('should delete entry when double-clicking a completed numeric habit cell', async () => {
            const habitId = 'habit-num-2';
            // Use today's date to ensure it's in the rendered date range
            const today = new Date();
            const dayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD format (canonical dayKey)
            const habit = createNumericHabit(habitId, 'Water Glasses');
            const log = createDayLog(habitId, dayKey, true, 8); // completed with value

            const habits = [habit];
            const logs: Record<string, DayLog> = {
                [`${habitId}-${dayKey}`]: log,
            };

            const { container } = render(
                <TrackerGrid
                    habits={habits}
                    logs={logs}
                    onAddHabit={() => {}}
                    onEditHabit={() => {}}
                    onViewHistory={() => {}}
                />
            );

            // Find cell buttons - same approach as boolean test
            const allButtons = Array.from(container.querySelectorAll('button'));
            const cellButtons = allButtons.filter(btn => {
                const classes = btn.className;
                return classes.includes('rounded-lg') && 
                       !classes.includes('p-1.5') &&
                       btn.closest('.w-16');
            });

            expect(cellButtons.length).toBeGreaterThan(0);

            // Double-click the first cell button
            const targetCell = cellButtons[0];
            fireEvent.dblClick(targetCell);

            // Wait for async operations - the handler uses setTimeout for single-click delay
            // Double-click should execute immediately, so we wait a bit longer
            await waitFor(() => {
                expect(mockDeleteHabitEntryByKey).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Verify it was called with correct (habitId, dayKey) - using canonical dayKey format
            expect(mockDeleteHabitEntryByKey).toHaveBeenCalledWith(habitId, dayKey);
        });
    });

    describe('Entry resolution by (habitId, dayKey)', () => {
        it('should use canonical dayKey format (YYYY-MM-DD) not legacy date', async () => {
            const habitId = 'habit-test-1';
            // Use today's date to ensure it's in the rendered date range
            const today = new Date();
            const dayKey = today.toISOString().split('T')[0]; // Canonical format: YYYY-MM-DD
            const habit = createBooleanHabit(habitId, 'Test Habit');
            const log = createDayLog(habitId, dayKey, true, 1);

            const habits = [habit];
            const logs: Record<string, DayLog> = {
                [`${habitId}-${dayKey}`]: log, // Key uses dayKey format
            };

            const { container } = render(
                <TrackerGrid
                    habits={habits}
                    logs={logs}
                    onAddHabit={() => {}}
                    onEditHabit={() => {}}
                    onViewHistory={() => {}}
                />
            );

            // Find and double-click cell
            const allButtons = Array.from(container.querySelectorAll('button'));
            const cellButtons = allButtons.filter(btn => {
                const classes = btn.className;
                return classes.includes('rounded-lg') && 
                       !classes.includes('p-1.5') &&
                       btn.closest('.w-16');
            });

            expect(cellButtons.length).toBeGreaterThan(0);

            fireEvent.dblClick(cellButtons[0]);

            await waitFor(() => {
                expect(mockDeleteHabitEntryByKey).toHaveBeenCalled();
            }, { timeout: 3000 });

            // Verify dayKey is in canonical format (YYYY-MM-DD), not legacy format
            const callArgs = mockDeleteHabitEntryByKey.mock.calls[0];
            expect(callArgs[0]).toBe(habitId);
            expect(callArgs[1]).toBe(dayKey); // Should be YYYY-MM-DD
            expect(callArgs[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Canonical format
        });
    });
});
