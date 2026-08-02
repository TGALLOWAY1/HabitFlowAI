/**
 * Tests for the explicit clear-entry control (touch and keyboard accessible).
 * Double-click delete has been removed; clear is only via the control or delete mode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import { TrackerGrid } from './TrackerGrid';
import type { Habit, DayLog } from '../types';

vi.mock('../store/HabitContext', () => ({ useHabitStore: vi.fn() }));
vi.mock('../store/RoutineContext', () => ({ useRoutineStore: vi.fn() }));
vi.mock('../lib/useProgressOverview', () => ({ useProgressOverview: vi.fn() }));
vi.mock('./Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('./NumericInputPopover', () => ({ NumericInputPopover: () => null }));
vi.mock('./HabitHistoryModal', () => ({ HabitHistoryModal: () => null }));
vi.mock('./HabitLogModal', () => ({ HabitLogModal: () => null }));

import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useProgressOverview } from '../lib/useProgressOverview';

describe('TrackerGrid clear entry (explicit menu)', () => {
    const mockDeleteHabitEntryByKey = vi.fn().mockResolvedValue({ dayLog: null });
    const mockUpsertHabitEntry = vi.fn();
    const mockDeleteHabit = vi.fn();
    const mockReorderHabits = vi.fn();
    const mockRefreshProgress = vi.fn();
    const mockToggleHabit = vi.fn().mockResolvedValue(undefined);

    const createBooleanHabit = (id: string, name: string): Habit => ({
        id,
        categoryId: 'cat-1',
        name,
        goal: { type: 'boolean', frequency: 'daily' },
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
        (useHabitStore as any).mockReturnValue({
            deleteHabit: mockDeleteHabit,
            reorderHabits: mockReorderHabits,
            upsertHabitEntry: mockUpsertHabitEntry,
            deleteHabitEntryByKey: mockDeleteHabitEntryByKey,
            toggleHabit: mockToggleHabit,
        });
        (useRoutineStore as any).mockReturnValue({ routines: [] });
        (useProgressOverview as any).mockReturnValue({ data: null, refresh: mockRefreshProgress });
    });

    it('should render grid with habit row and no double-click delete on cells', () => {
        const habitId = 'habit-1';
        const today = new Date();
        const dayKey = format(today, 'yyyy-MM-dd');
        const habit = createBooleanHabit(habitId, 'Morning Meditation');
        const log = createDayLog(habitId, dayKey, true, 1);
        const habits = [habit];
        const logs: Record<string, DayLog> = { [`${habitId}-${dayKey}`]: log };

        const { container } = render(
            <TrackerGrid
                habits={habits}
                logs={logs}
                onAddHabit={() => {}}
                onEditHabit={() => {}}
                onViewHistory={() => {}}
                onToggle={async () => {}}
                onUpdateValue={async () => {}}
            />
        );

        expect(screen.getByText('Morning Meditation')).toBeInTheDocument();
        expect(container.querySelector('button[title="Clear entry"]')).toBeTruthy();
    });

    it('should call deleteHabitEntryByKey when the Clear entry control is clicked', async () => {
        const habitId = 'habit-1';
        const today = new Date();
        const dayKey = format(today, 'yyyy-MM-dd');
        const habit = createBooleanHabit(habitId, 'Morning Meditation');
        const log = createDayLog(habitId, dayKey, true, 1);
        const habits = [habit];
        const logs: Record<string, DayLog> = { [`${habitId}-${dayKey}`]: log };

        const { container } = render(
            <TrackerGrid
                habits={habits}
                logs={logs}
                onAddHabit={() => {}}
                onEditHabit={() => {}}
                onViewHistory={() => {}}
                onToggle={async () => {}}
                onUpdateValue={async () => {}}
            />
        );

        const clearButton = container.querySelector('button[title="Clear entry"]');
        if (!clearButton) {
            throw new Error('Clear entry control not found');
        }
        fireEvent.click(clearButton);

        await waitFor(() => {
            expect(mockDeleteHabitEntryByKey).toHaveBeenCalledWith(habitId, dayKey);
        });
        await waitFor(() => expect(mockRefreshProgress).toHaveBeenCalled());
    });

    it('should NOT delete when double-clicking a cell (double-click delete removed)', async () => {
        const habitId = 'habit-2';
        const today = new Date();
        const dayKey = format(today, 'yyyy-MM-dd');
        const habit = createBooleanHabit(habitId, 'Evening Reading');
        const log = createDayLog(habitId, dayKey, true, 1);
        const habits = [habit];
        const logs: Record<string, DayLog> = { [`${habitId}-${dayKey}`]: log };

        const { container } = render(
            <TrackerGrid
                habits={habits}
                logs={logs}
                onAddHabit={() => {}}
                onEditHabit={() => {}}
                onViewHistory={() => {}}
                onToggle={async () => {}}
                onUpdateValue={async () => {}}
            />
        );

        const cellButtons = Array.from(container.querySelectorAll('button')).filter(
            btn => btn.className.includes('rounded-lg') && !btn.className.includes('p-1.5') && btn.closest('.w-16')
        );
        expect(cellButtons.length).toBeGreaterThan(0);

        fireEvent.dblClick(cellButtons[0]);
        await new Promise(r => setTimeout(r, 400));

        expect(mockDeleteHabitEntryByKey).not.toHaveBeenCalled();
    });

    it('should use canonical dayKey (YYYY-MM-DD) when clearing via menu', async () => {
        const habitId = 'habit-3';
        const today = new Date();
        const dayKey = format(today, 'yyyy-MM-dd');
        const habit = createBooleanHabit(habitId, 'Test Habit');
        const log = createDayLog(habitId, dayKey, true, 1);
        const habits = [habit];
        const logs: Record<string, DayLog> = { [`${habitId}-${dayKey}`]: log };

        const { container } = render(
            <TrackerGrid
                habits={habits}
                logs={logs}
                onAddHabit={() => {}}
                onEditHabit={() => {}}
                onViewHistory={() => {}}
                onToggle={async () => {}}
                onUpdateValue={async () => {}}
            />
        );

        const clearButton = container.querySelector('button[title="Clear entry"]');
        if (!clearButton) throw new Error('Clear entry control not found');
        fireEvent.click(clearButton);

        await waitFor(() => expect(mockDeleteHabitEntryByKey).toHaveBeenCalled());
        const [id, date] = mockDeleteHabitEntryByKey.mock.calls[0];
        expect(id).toBe(habitId);
        expect(date).toBe(dayKey);
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('delegates checklist parent completion as one canonical bundle action', async () => {
        const dayKey = format(new Date(), 'yyyy-MM-dd');
        const parent: Habit = {
            ...createBooleanHabit('bundle-1', 'Morning bundle'),
            type: 'bundle',
            bundleType: 'checklist',
            subHabitIds: ['numeric-child'],
        };
        const child: Habit = {
            ...createBooleanHabit('numeric-child', 'Drink water'),
            bundleParentId: parent.id,
            goal: { type: 'number', frequency: 'daily', target: 8, unit: 'glasses' },
        };

        const { container } = render(
            <TrackerGrid
                habits={[parent, child]}
                allHabits={[parent, child]}
                logs={{
                    [`${child.id}-${dayKey}`]: createDayLog(child.id, dayKey, false, 2),
                }}
                onAddHabit={() => {}}
                onEditHabit={() => {}}
                onViewHistory={() => {}}
                onToggle={async () => {}}
                onUpdateValue={async () => {}}
            />
        );

        const parentCell = container.querySelector('button[title="Click to toggle all sub-habits"]');
        expect(parentCell).toBeTruthy();
        fireEvent.click(parentCell!);

        await waitFor(() => expect(mockToggleHabit).toHaveBeenCalledWith(parent.id, dayKey));
        expect(mockToggleHabit).not.toHaveBeenCalledWith(child.id, dayKey);
    });
});
