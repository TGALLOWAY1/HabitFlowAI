/**
 * Tests for explicit clear-entry via cell kebab menu (touch-safe).
 * Double-click delete has been removed; clear is only via menu or delete mode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import { TrackerGrid } from './TrackerGrid';
import type { Habit, DayLog } from '../types';

const todayKey = () => format(new Date(), 'yyyy-MM-dd');

vi.mock('../store/HabitContext', () => ({ useHabitStore: vi.fn() }));
vi.mock('../store/RoutineContext', () => ({ useRoutineStore: vi.fn() }));
vi.mock('../lib/useProgressOverview', () => ({ useProgressOverview: vi.fn() }));
vi.mock('./Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('./NumericInputPopover', () => ({ NumericInputPopover: () => null }));
vi.mock('./HabitHistoryModal', () => ({ HabitHistoryModal: () => null }));
vi.mock('./HabitLogModal', () => ({ HabitLogModal: () => null }));
vi.mock('./WeeklyHabitCard', () => ({ WeeklyHabitCard: () => null }));

import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useProgressOverview } from '../lib/useProgressOverview';

describe('TrackerGrid clear entry (explicit menu)', () => {
    const mockDeleteHabitEntryByKey = vi.fn().mockResolvedValue({ dayLog: null });
    const mockUpsertHabitEntry = vi.fn();
    const mockDeleteHabit = vi.fn();
    const mockReorderHabits = vi.fn();
    const mockRefreshProgress = vi.fn();

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
            />
        );

        expect(screen.getByText('Morning Meditation')).toBeInTheDocument();
        // Cell kebab (Clear entry) is present when cell has entry - find by title or aria-label
        const kebab = container.querySelector('button[title="Clear entry"]') ?? container.querySelector('button[aria-label*="Options for entry"]');
        expect(kebab).toBeTruthy();
    });

    it('should call deleteHabitEntryByKey when Clear entry is clicked from cell menu', async () => {
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
            />
        );

        const kebab = container.querySelector('button[title="Clear entry"]') ?? container.querySelector('button[aria-label*="Options for entry"]');
        if (!kebab) {
            throw new Error('Cell kebab not found - ensure grid renders a completed cell for today');
        }
        fireEvent.click(kebab);

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });
        const clearButton = screen.getByRole('menuitem', { name: /clear entry/i });
        fireEvent.click(clearButton);

        await waitFor(() => {
            expect(mockDeleteHabitEntryByKey).toHaveBeenCalledWith(habitId, dayKey);
        });
        expect(mockRefreshProgress).toHaveBeenCalled();
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
            />
        );

        const kebab = container.querySelector('button[title="Clear entry"]') ?? container.querySelector('button[aria-label*="Options for entry"]');
        if (!kebab) throw new Error('Cell kebab not found');
        fireEvent.click(kebab);
        await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
        fireEvent.click(screen.getByRole('menuitem', { name: /clear entry/i }));

        await waitFor(() => expect(mockDeleteHabitEntryByKey).toHaveBeenCalled());
        const [id, date] = mockDeleteHabitEntryByKey.mock.calls[0];
        expect(id).toBe(habitId);
        expect(date).toBe(dayKey);
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
