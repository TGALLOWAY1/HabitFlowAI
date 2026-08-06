/** Bundle-child visibility coverage for the All grid.
 *
 * A bundle child must be hidden only when its parent bundle is part of the
 * same filtered view (it renders inside the parent's drawer). Children whose
 * parent is archived, deleted, or lives in another category previously
 * disappeared from the grid entirely while dashboard category counts still
 * included them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrackerGrid } from './TrackerGrid';
import type { Habit } from '../types';

vi.mock('../store/HabitContext', () => ({ useHabitStore: vi.fn() }));
vi.mock('../store/RoutineContext', () => ({ useRoutineStore: vi.fn() }));
vi.mock('../lib/useProgressOverview', () => ({ useProgressOverview: vi.fn() }));
vi.mock('../lib/useGoalsWithProgress', () => ({ useGoalsWithProgress: vi.fn() }));
vi.mock('../store/DashboardPrefsContext', () => ({
    useDashboardPrefs: () => ({ hideStreaks: false }),
}));
vi.mock('./Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('./NumericInputPopover', () => ({ NumericInputPopover: () => null }));
vi.mock('./HabitHistoryModal', () => ({ HabitHistoryModal: () => null }));
vi.mock('./HabitLogModal', () => ({ HabitLogModal: () => null }));

import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useProgressOverview } from '../lib/useProgressOverview';
import { useGoalsWithProgress } from '../lib/useGoalsWithProgress';

const createHabit = (id: string, name: string, extra: Partial<Habit> = {}): Habit => ({
    id,
    categoryId: 'cat-1',
    name,
    goal: { type: 'boolean', frequency: 'daily' },
    archived: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...extra,
});

const renderGrid = (habits: Habit[], allHabits?: Habit[]) =>
    render(
        <TrackerGrid
            habits={habits}
            allHabits={allHabits ?? habits}
            logs={{}}
            onAddHabit={() => {}}
            onEditHabit={() => {}}
            onViewHistory={() => {}}
            onToggle={async () => {}}
            onUpdateValue={async () => {}}
        />
    );

describe('TrackerGrid bundle child visibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useHabitStore).mockReturnValue({
            deleteHabit: vi.fn(),
            archiveHabit: vi.fn(),
            reorderHabits: vi.fn(),
            upsertHabitEntry: vi.fn(),
            deleteHabitEntryByKey: vi.fn(),
            toggleHabit: vi.fn(),
        } as unknown as ReturnType<typeof useHabitStore>);
        vi.mocked(useRoutineStore).mockReturnValue({ routines: [] } as unknown as ReturnType<typeof useRoutineStore>);
        vi.mocked(useProgressOverview).mockReturnValue({
            data: undefined,
            loading: false,
            error: undefined,
            refresh: vi.fn(),
        });
        vi.mocked(useGoalsWithProgress).mockReturnValue({
            data: [],
            loading: false,
            error: null,
            refetch: vi.fn(),
        });
    });

    it('hides a bundle child when its parent is in the same view', () => {
        const parent = createHabit('bundle-1', 'Morning Bundle', {
            type: 'bundle',
            bundleType: 'checklist',
            subHabitIds: ['child-1'],
        });
        const child = createHabit('child-1', 'Stretch', { bundleParentId: 'bundle-1' });

        renderGrid([parent, child]);

        expect(screen.getByText('Morning Bundle')).toBeInTheDocument();
        expect(screen.queryByText('Stretch')).not.toBeInTheDocument();
    });

    it('shows a bundle child as a top-level row when its parent is not in the view (other category or archived)', () => {
        // The habits prop is the category-filtered set: the parent lives in a
        // different category (or is archived), so only the child is passed in.
        const parent = createHabit('bundle-1', 'Morning Bundle', {
            type: 'bundle',
            bundleType: 'checklist',
            subHabitIds: ['child-1'],
            categoryId: 'cat-other',
        });
        const child = createHabit('child-1', 'Stretch', { bundleParentId: 'bundle-1' });

        renderGrid([child], [parent, child]);

        expect(screen.getByText('Stretch')).toBeInTheDocument();
    });

    it('shows a bundle child as a top-level row when its parent was deleted', () => {
        const child = createHabit('child-1', 'Stretch', { bundleParentId: 'gone-parent' });

        renderGrid([child]);

        expect(screen.getByText('Stretch')).toBeInTheDocument();
    });
});
