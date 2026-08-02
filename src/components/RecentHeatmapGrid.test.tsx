import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayLog, Habit } from '../types';
import { RecentHeatmapGrid } from './RecentHeatmapGrid';

vi.mock('../store/HabitContext', () => ({ useHabitStore: vi.fn() }));
vi.mock('react-tooltip', () => ({ Tooltip: () => null }));

import { useHabitStore } from '../store/HabitContext';

describe('RecentHeatmapGrid', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 2, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows an actual backdated completion without filling adjacent days', () => {
        const habit: Habit = {
            id: 'habit-1',
            categoryId: 'cat-1',
            name: 'Rogain AM',
            goal: { type: 'boolean', frequency: 'daily' },
            archived: false,
            createdAt: '2026-07-25T12:00:00.000Z',
        };
        const completion: DayLog = {
            habitId: habit.id,
            date: '2026-07-24',
            value: 1,
            completed: true,
        };
        vi.mocked(useHabitStore).mockReturnValue({
            logs: { [`${habit.id}-${completion.date}`]: completion },
        } as unknown as ReturnType<typeof useHabitStore>);

        const { container } = render(<RecentHeatmapGrid habits={[habit]} range="30d" />);

        expect(
            container.querySelector('[data-tooltip-content="Jul 24, 2026: 1 completions across 1 categories"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-tooltip-content="Jul 25, 2026: 0 completions across 0 categories"]'),
        ).not.toBeNull();
    });
});
