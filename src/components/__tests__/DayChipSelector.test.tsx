import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayChipSelector } from '../DayChipSelector';

describe('DayChipSelector', () => {
    it('renders 7 day buttons', () => {
        const onChange = vi.fn();
        render(<DayChipSelector selectedDays={[0, 1, 2, 3, 4, 5, 6]} onChange={onChange} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(7);
    });

    it('shows selected days with active styling', () => {
        const onChange = vi.fn();
        render(<DayChipSelector selectedDays={[1, 3, 5]} onChange={onChange} />);

        const buttons = screen.getAllByRole('button');
        // Mon (index 1), Wed (index 3), Fri (index 5) should have emerald class
        expect(buttons[1].className).toContain('bg-emerald-500');
        expect(buttons[3].className).toContain('bg-emerald-500');
        expect(buttons[5].className).toContain('bg-emerald-500');
        // Sun (index 0) should not
        expect(buttons[0].className).toContain('bg-neutral-800');
    });

    it('calls onChange when toggling a day on', () => {
        const onChange = vi.fn();
        render(<DayChipSelector selectedDays={[1, 3]} onChange={onChange} />);

        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[5]); // click Friday
        expect(onChange).toHaveBeenCalledWith([1, 3, 5]);
    });

    it('calls onChange when toggling a day off', () => {
        const onChange = vi.fn();
        render(<DayChipSelector selectedDays={[1, 3, 5]} onChange={onChange} />);

        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[3]); // click Wed to deselect
        expect(onChange).toHaveBeenCalledWith([1, 5]);
    });

    it('prevents deselecting below minSelected', () => {
        const onChange = vi.fn();
        render(<DayChipSelector selectedDays={[3]} onChange={onChange} minSelected={1} />);

        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[3]); // try to deselect the only day
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange when disabled', () => {
        const onChange = vi.fn();
        render(<DayChipSelector selectedDays={[1]} onChange={onChange} disabled />);

        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[3]);
        expect(onChange).not.toHaveBeenCalled();
    });
});
