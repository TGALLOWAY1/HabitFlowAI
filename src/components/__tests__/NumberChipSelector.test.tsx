import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberChipSelector } from '../NumberChipSelector';

describe('NumberChipSelector', () => {
    it('renders chips from min to max', () => {
        const onChange = vi.fn();
        render(<NumberChipSelector value={3} onChange={onChange} min={1} max={7} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(7);
        expect(buttons[0].textContent).toBe('1');
        expect(buttons[6].textContent).toBe('7');
    });

    it('renders fewer chips when max is lower', () => {
        const onChange = vi.fn();
        render(<NumberChipSelector value={3} onChange={onChange} min={1} max={5} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(5);
    });

    it('highlights the selected value', () => {
        const onChange = vi.fn();
        render(<NumberChipSelector value={4} onChange={onChange} min={1} max={7} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons[3].className).toContain('bg-emerald-500'); // value 4 is at index 3
        expect(buttons[0].className).toContain('bg-neutral-800');
    });

    it('calls onChange when clicking a chip', () => {
        const onChange = vi.fn();
        render(<NumberChipSelector value={3} onChange={onChange} min={1} max={7} />);

        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[4]); // click "5"
        expect(onChange).toHaveBeenCalledWith(5);
    });

    it('handles max < min gracefully (caps to min)', () => {
        const onChange = vi.fn();
        render(<NumberChipSelector value={1} onChange={onChange} min={1} max={0} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].textContent).toBe('1');
    });

    it('does not call onChange when disabled', () => {
        const onChange = vi.fn();
        render(<NumberChipSelector value={3} onChange={onChange} min={1} max={7} disabled />);

        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[4]);
        expect(onChange).not.toHaveBeenCalled();
    });
});
