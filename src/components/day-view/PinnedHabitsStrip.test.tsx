import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '../../types';
import type { DayViewHabitStatus } from './habitStatusResolution';
import { PinnedHabitsStrip } from './PinnedHabitsStrip';

vi.mock('../../store/HabitContext', () => ({
    useHabitStore: () => ({ archiveHabit: vi.fn(), deleteHabit: vi.fn(), habits: [] }),
}));

vi.mock('../../lib/useGoalsWithProgress', () => ({
    useGoalsWithProgress: () => ({ data: [] }),
}));

const DAY_KEY = '2026-08-13';

const numericHabit: Habit = {
    id: 'numeric-1',
    categoryId: 'cat-1',
    name: 'Read pages',
    pinned: true,
    goal: { type: 'number', frequency: 'daily', target: 10, unit: 'pages' },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
};

const optionA: Habit = {
    id: 'option-a',
    categoryId: 'cat-1',
    name: 'Swim',
    goal: { type: 'boolean', frequency: 'daily' },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    bundleParentId: 'choice-1',
};

const choiceBundle: Habit = {
    id: 'choice-1',
    categoryId: 'cat-1',
    name: 'Move your body',
    pinned: true,
    type: 'bundle',
    bundleType: 'choice',
    subHabitIds: [optionA.id],
    goal: { type: 'boolean', frequency: 'daily' },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
};

function statusFor(habit: Habit, overrides: Partial<DayViewHabitStatus> = {}): DayViewHabitStatus {
    return {
        habit,
        isComplete: false,
        currentValue: 0,
        targetValue: 1,
        progressPercent: 0,
        ...overrides,
    };
}

function renderStrip(habits: Habit[], statusMap: Map<string, DayViewHabitStatus>, allHabits: Habit[] = habits) {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    const onUpdateHabitEntry = vi.fn().mockResolvedValue(undefined);
    render(
        <PinnedHabitsStrip
            habits={habits}
            habitStatusMap={statusMap}
            dateStr={DAY_KEY}
            allHabitsLookup={new Map(allHabits.map(h => [h.id, h]))}
            onUnpin={vi.fn()}
            onToggle={onToggle}
            onUpdateHabitEntry={onUpdateHabitEntry}
            deleteHabitEntryByKey={vi.fn().mockResolvedValue(undefined)}
        />,
    );
    return { onToggle, onUpdateHabitEntry };
}

describe('PinnedHabitsStrip habit type wiring', () => {
    it('opens the quantity popover for a pinned numeric habit instead of toggling', async () => {
        const statusMap = new Map([
            [numericHabit.id, statusFor(numericHabit, { currentValue: 4, targetValue: 10, progressPercent: 40 })],
        ]);
        const { onToggle, onUpdateHabitEntry } = renderStrip([numericHabit], statusMap);

        const checkbox = screen.getByRole('checkbox', { name: /4 of 10 pages/i });
        fireEvent.click(checkbox);

        // Toggle must NOT fire — the numeric popover opens for value entry.
        expect(onToggle).not.toHaveBeenCalled();
        const input = await screen.findByRole('textbox');
        fireEvent.change(input, { target: { value: '7' } });
        fireEvent.submit(input.closest('form')!);

        expect(onUpdateHabitEntry).toHaveBeenCalledWith(numericHabit.id, DAY_KEY, { value: 7, source: 'manual' });
    });

    it('renders choice bundle options so a pinned choice bundle is selectable', async () => {
        const statusMap = new Map([
            [choiceBundle.id, statusFor(choiceBundle)],
            [optionA.id, statusFor(optionA)],
        ]);
        const { onToggle } = renderStrip([choiceBundle], statusMap, [choiceBundle, optionA]);

        const option = screen.getByRole('button', { name: 'Swim' });
        await act(async () => {
            fireEvent.click(option);
        });

        expect(onToggle).toHaveBeenCalledWith(optionA.id);
    });

    it('still toggles a pinned boolean habit directly', () => {
        const booleanHabit: Habit = {
            ...numericHabit,
            id: 'bool-1',
            name: 'Meditate',
            goal: { type: 'boolean', frequency: 'daily' },
        };
        const statusMap = new Map([[booleanHabit.id, statusFor(booleanHabit)]]);
        const { onToggle } = renderStrip([booleanHabit], statusMap);

        fireEvent.click(screen.getByRole('checkbox', { name: 'Meditate' }));
        expect(onToggle).toHaveBeenCalledWith(booleanHabit.id);
    });
});
