import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Habit, HabitEntry } from '../models/persistenceTypes';
import { HabitHistoryModal } from './HabitHistoryModal';

vi.mock('../store/HabitContext', () => ({ useHabitStore: vi.fn() }));
vi.mock('../lib/persistenceClient', () => ({
    fetchHabitEntries: vi.fn(),
    updateHabitEntry: vi.fn(),
    deleteHabitEntry: vi.fn(),
    createHabitEntry: vi.fn(),
}));

import { useHabitStore } from '../store/HabitContext';
import {
    createHabitEntry,
    deleteHabitEntry,
    fetchHabitEntries,
    updateHabitEntry,
} from '../lib/persistenceClient';

const habit: Habit = {
    id: 'habit-1',
    categoryId: 'cat-1',
    name: 'Read',
    goal: { type: 'number', frequency: 'daily', target: 10, unit: 'pages' },
    archived: false,
    createdAt: '2026-07-01T12:00:00.000Z',
};

const existingEntry: HabitEntry = {
    id: 'entry-1',
    habitId: habit.id,
    dayKey: '2026-08-01',
    date: '2026-08-01',
    timestamp: '2026-08-01T16:00:00.000Z',
    value: 5,
    source: 'manual',
    createdAt: '2026-08-01T16:00:00.000Z',
    updatedAt: '2026-08-01T16:00:00.000Z',
};

describe('HabitHistoryModal', () => {
    const refreshDayLogs = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date(2026, 7, 2, 12, 0, 0));
        vi.mocked(useHabitStore).mockReturnValue({
            habits: [habit],
            refreshDayLogs,
        } as unknown as ReturnType<typeof useHabitStore>);
        vi.mocked(fetchHabitEntries).mockResolvedValue([existingEntry]);
        vi.mocked(deleteHabitEntry).mockResolvedValue({ success: true, dayLog: null });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function openExistingEntry() {
        render(<HabitHistoryModal habitId={habit.id} onClose={() => {}} />);
        const dateButton = await screen.findByRole('button', { name: /Sat, Aug 1, 2026/ });
        fireEvent.click(dateButton);
    }

    it('treats an edited zero as clearing the entry', async () => {
        await openExistingEntry();
        fireEvent.click(screen.getByTitle('Edit'));

        const input = screen.getByLabelText('Entry quantity') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '0' } });
        expect(input.value).toBe('0');
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(deleteHabitEntry).toHaveBeenCalledWith(existingEntry.id));
        expect(updateHabitEntry).not.toHaveBeenCalled();
        expect(refreshDayLogs).toHaveBeenCalledOnce();
    });

    it('keeps a decimal draft visible and saves its numeric value', async () => {
        vi.mocked(updateHabitEntry).mockResolvedValue({
            entry: { ...existingEntry, value: 12.5 },
            dayLog: null,
        });
        await openExistingEntry();
        fireEvent.click(screen.getByTitle('Edit'));

        const input = screen.getByLabelText('Entry quantity') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '12.5' } });
        expect(input.value).toBe('12.5');
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => {
            expect(updateHabitEntry).toHaveBeenCalledWith(existingEntry.id, { value: 12.5 });
        });
    });

    it('does not offer a second entry for a day that already has one', async () => {
        await openExistingEntry();
        expect(screen.queryByRole('button', { name: 'Add Entry' })).not.toBeInTheDocument();
        expect(createHabitEntry).not.toHaveBeenCalled();
    });
});
