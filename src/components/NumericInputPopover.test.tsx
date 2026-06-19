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

const baseProps = {
    isOpen: true,
    onClose: () => {},
    onSubmit: () => {},
    position: { top: 0, left: 0 },
};

describe('NumericInputPopover', () => {
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
    });

    it('submits the typed numeric value', () => {
        const onSubmit = vi.fn();
        render(<NumericInputPopover {...baseProps} initialValue={0} onSubmit={onSubmit} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '12' } });
        fireEvent.submit(input.closest('form')!);
        expect(onSubmit).toHaveBeenCalledWith(12);
    });
});
