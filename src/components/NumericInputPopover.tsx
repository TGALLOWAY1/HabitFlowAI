import React, { useState, useEffect, useRef } from 'react';
import { Check, Trash2 } from 'lucide-react';

interface NumericInputPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: number) => void;
    onClear?: () => void;
    initialValue?: number;
    unit?: string;
    position: { top: number; left: number };
}

export const NumericInputPopover: React.FC<NumericInputPopoverProps> = ({
    isOpen,
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
        if (isOpen) {
            // Existing values are shown for editing; new entries start blank so the
            // placeholder ("0") shows and the first typed digit always appears.
            setValue(initialValue > 0 ? initialValue.toString() : '');
            // Double-rAF ensures DOM is painted before focus (more reliable than setTimeout on iOS).
            // Selection is handled by the input's onFocus (below) rather than a delayed select()
            // call here: on iOS a late, programmatic select() races with the on-screen keyboard
            // and can swallow the user's first keystroke, leaving the field looking empty.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    inputRef.current?.focus();
                });
            });
        }
    }, [isOpen, initialValue]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            onSubmit(numValue);
        }
        onClose();
    };

    const showClear = initialValue > 0 && onClear;

    return (
        <div
            className="fixed z-50"
            style={{ top: position.top, left: position.left }}
        >
            <div className="fixed inset-0" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative bg-neutral-800 border border-white/10 rounded-xl p-3 shadow-xl flex items-center gap-2 w-48 animate-in fade-in zoom-in-95 duration-200"
            >
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="0"
                />
                {unit && <span className="text-xs text-neutral-500 font-medium">{unit}</span>}
                <button
                    type="submit"
                    className="p-1.5 bg-emerald-500 text-neutral-900 rounded-lg hover:bg-emerald-400 transition-colors"
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
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Clear entry"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </form>
        </div>
    );
};
