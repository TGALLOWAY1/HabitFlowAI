/**
 * Tests for NumericInputPopover.
 *
 * Regression: on iOS the popover sometimes opened without displaying the value
 * (existing values appeared blank and the first typed digit was swallowed).
 * The fix shows existing values reliably, leaves new entries blank so the
 * placeholder shows, and selects via the native onFocus instead of a delayed
 * programmatic select().
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumericInputPopover } from './NumericInputPopover';
import { getSafeNumericPopoverPosition } from './numericPopoverPosition';

const baseProps = {
    isOpen: true,
    onClose: () => {},
    onSubmit: () => {},
    position: { top: 0, left: 0 },
};

describe('NumericInputPopover', () => {
    it.each([
        ['right edge', { top: 200, left: 333 }, { top: 200, left: 190 }],
        ['left edge', { top: 200, left: -20 }, { top: 200, left: 8 }],
        ['bottom edge', { top: 820, left: 100 }, { top: 772, left: 100 }],
    ])('clamps the popover at the %s of a mobile viewport', (_label, position, expected) => {
        expect(getSafeNumericPopoverPosition(position, { width: 390, height: 844 })).toEqual(expected);
    });

    it('displays the existing value when opened for an entry that has one', () => {
        render(<NumericInputPopover {...baseProps} initialValue={40} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('40');
    });

    it('starts blank (placeholder visible) for a new entry', () => {
        render(<NumericInputPopover {...baseProps} initialValue={0} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');
        expect(input).toHaveAttribute('placeholder', '0');
    });

    it('reflects the typed number', () => {
        render(<NumericInputPopover {...baseProps} initialValue={0} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '7' } });
        expect(input.value).toBe('7');
        expect(input).toHaveClass('min-w-0', 'flex-1');
    });

    it('uses the clamped mobile position when the trigger is near the right edge', () => {
        const originalWidth = window.innerWidth;
        const originalHeight = window.innerHeight;
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });

        const { container } = render(
            <NumericInputPopover {...baseProps} position={{ top: 200, left: 333 }} />,
        );
        const positionedContainer = container.firstElementChild as HTMLElement;
        expect(positionedContainer.style.left).toBe('190px');

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
    });

    it('submits the typed numeric value', () => {
        const onSubmit = vi.fn();
        render(<NumericInputPopover {...baseProps} initialValue={0} onSubmit={onSubmit} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '12' } });
        fireEvent.submit(input.closest('form')!);
        expect(onSubmit).toHaveBeenCalledWith(12);
    });

    it('does not submit a negative quantity', () => {
        const onSubmit = vi.fn();
        render(<NumericInputPopover {...baseProps} initialValue={0} onSubmit={onSubmit} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '-2' } });
        fireEvent.submit(input.closest('form')!);

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('treats zero as clearing the entry instead of storing redundant progress', () => {
        const onSubmit = vi.fn();
        const onClear = vi.fn();
        render(
            <NumericInputPopover
                {...baseProps}
                initialValue={4}
                onSubmit={onSubmit}
                onClear={onClear}
            />
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '0' } });
        fireEvent.submit(input.closest('form')!);

        expect(onClear).toHaveBeenCalledOnce();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
