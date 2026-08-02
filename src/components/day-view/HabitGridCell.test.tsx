import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '../../types';
import { HabitGridCell } from './HabitGridCell';

vi.mock('../../store/HabitContext', () => ({
    useHabitStore: () => ({ archiveHabit: vi.fn(), deleteHabit: vi.fn() }),
}));

vi.mock('../../lib/useGoalsWithProgress', () => ({
    useGoalsWithProgress: () => ({ data: [] }),
}));

const numericHabit: Habit = {
    id: 'numeric-1',
    categoryId: 'cat-1',
    name: 'Read pages',
    goal: { type: 'number', frequency: 'daily', target: 10, unit: 'pages' },
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
};

function renderNumericCell(currentValue: number, isComplete: boolean) {
    return render(
        <HabitGridCell
            habit={numericHabit}
            isCompleted={isComplete}
            isExpanded={false}
            onToggle={vi.fn()}
            onExpand={vi.fn()}
            onPin={vi.fn()}
            onNumericClick={vi.fn()}
            habitStatus={{
                habit: numericHabit,
                isComplete,
                currentValue,
                targetValue: 10,
                progressPercent: currentValue * 10,
            }}
        />,
    );
}

describe('HabitGridCell numeric completion state', () => {
    it('shows partial progress without a checkmark or strike-through', () => {
        renderNumericCell(5, false);

        const checkbox = screen.getByRole('checkbox', { name: /read pages/i });
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
        expect(within(checkbox).queryByTestId('numeric-complete-check')).not.toBeInTheDocument();
        expect(screen.getByText('Read pages')).not.toHaveClass('line-through');
    });

    it('shows the checkmark and strike-through from the same complete state', () => {
        renderNumericCell(10, true);

        const checkbox = screen.getByRole('checkbox', { name: /read pages/i });
        expect(checkbox).toHaveAttribute('aria-checked', 'true');
        expect(within(checkbox).getByTestId('numeric-complete-check')).toBeInTheDocument();
        expect(screen.getByText('Read pages')).toHaveClass('line-through');
    });
});
