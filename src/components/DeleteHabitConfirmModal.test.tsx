/** Remove Habit modal — bundle sub-habit surfacing and archive-children option.
 *
 * Removing a bundle parent must never silently strand its sub-habits: the
 * modal lists them, explains they are kept as standalone habits, and offers
 * a checkbox to archive them together with the bundle.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeleteHabitConfirmModal } from './DeleteHabitConfirmModal';

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    habitName: 'Music Practice',
    linkedGoalTitles: [] as string[],
};

describe('DeleteHabitConfirmModal bundle sub-habits', () => {
    it('lists sub-habit names when provided', () => {
        render(
            <DeleteHabitConfirmModal
                {...baseProps}
                onArchive={vi.fn()}
                onDelete={vi.fn()}
                subHabitNames={['Guitar', 'Piano', 'Music Practice (history)']}
            />
        );

        expect(screen.getAllByText(/3 sub-habits/).length).toBeGreaterThan(0);
        expect(screen.getByText('Guitar')).toBeTruthy();
        expect(screen.getByText('Piano')).toBeTruthy();
        expect(screen.getByText('Music Practice (history)')).toBeTruthy();
        expect(screen.getByRole('checkbox')).toBeTruthy();
    });

    it('hides the sub-habit section for non-bundle habits', () => {
        render(
            <DeleteHabitConfirmModal
                {...baseProps}
                onArchive={vi.fn()}
                onDelete={vi.fn()}
            />
        );

        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.queryByText(/sub-habit/)).toBeNull();
    });

    it('archives with archiveChildren=false by default', async () => {
        const onArchive = vi.fn().mockResolvedValue(undefined);
        render(
            <DeleteHabitConfirmModal
                {...baseProps}
                onArchive={onArchive}
                onDelete={vi.fn()}
                subHabitNames={['Guitar']}
            />
        );

        fireEvent.click(screen.getByText('Archive habit'));
        await waitFor(() =>
            expect(onArchive).toHaveBeenCalledWith({ archiveChildren: false })
        );
    });

    it('passes archiveChildren=true when the checkbox is ticked', async () => {
        const onDelete = vi.fn().mockResolvedValue(undefined);
        render(
            <DeleteHabitConfirmModal
                {...baseProps}
                onArchive={vi.fn()}
                onDelete={onDelete}
                subHabitNames={['Guitar', 'Piano']}
            />
        );

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByText('Delete permanently'));
        await waitFor(() =>
            expect(onDelete).toHaveBeenCalledWith({ archiveChildren: true })
        );
    });
});
