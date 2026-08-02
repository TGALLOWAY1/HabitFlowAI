import React, { useState, useEffect, useRef } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { getSafeNumericPopoverPosition } from './numericPopoverPosition';

interface NumericInputPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: number) => void;
    onClear?: () => void;
    initialValue?: number;
    unit?: string;
    position: { top: number; left: number };
}

type NumericInputPopoverContentProps = Omit<NumericInputPopoverProps, 'isOpen'>;

const NumericInputPopoverContent: React.FC<NumericInputPopoverContentProps> = ({
    onClose,
    onSubmit,
    onClear,
    initialValue = 0,
    unit,
    position,
}) => {
    const [value, setValue] = useState(initialValue > 0 ? initialValue.toString() : '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Double-rAF ensures DOM is painted before focus (more reliable than setTimeout on iOS).
        // Selection is handled by the input's onFocus (below) rather than a delayed select()
        // call here: on iOS a late, programmatic select() races with the on-screen keyboard
        // and can swallow the user's first keystroke, leaving the field looking empty.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        });
    }, []);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numValue = parseFloat(value);
        if (!Number.isFinite(numValue) || numValue < 0) return;
        if (numValue === 0 && onClear) {
            onClear();
            onClose();
            return;
        }
        onSubmit(numValue);
        onClose();
    };

    const showClear = initialValue > 0 && onClear;
    const visualViewport = window.visualViewport;
    const safePosition = getSafeNumericPopoverPosition(position, {
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
        offsetLeft: visualViewport?.offsetLeft,
        offsetTop: visualViewport?.offsetTop,
    });

    return (
        <div
            className="fixed z-50"
            style={{ top: safePosition.top, left: safePosition.left }}
        >
            <div className="fixed inset-0" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative bg-neutral-800 border border-white/10 rounded-xl p-3 shadow-xl flex items-center gap-2 w-48 max-w-[calc(100vw-1rem)] animate-in fade-in zoom-in-95 duration-200"
            >
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="0"
                    aria-label={`Quantity${unit ? ` in ${unit}` : ''}`}
                />
                {unit && <span className="max-w-12 truncate shrink-0 text-xs text-neutral-500 font-medium">{unit}</span>}
                <button
                    type="submit"
                    aria-label="Save quantity"
                    className="shrink-0 p-1.5 bg-emerald-500 text-neutral-900 rounded-lg hover:bg-emerald-400 transition-colors"
                >
                    <Check size={14} strokeWidth={3} />
                </button>
                {showClear && (
                    <button
                        type="button"
                        onClick={() => {
                            onClear();
                            onClose();
                        }}
                        className="shrink-0 p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Clear entry"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </form>
        </div>
    );
};

export const NumericInputPopover: React.FC<NumericInputPopoverProps> = ({ isOpen, ...props }) => {
    if (!isOpen) return null;
    // Mounting content only while open resets its draft value for every editing
    // session without a state-setting effect that can race the mobile keyboard.
    return <NumericInputPopoverContent {...props} />;
};
